// utils/spwnManager.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js'); 
const { sendOwnerDM } = require('../errors/errorReporter'); // Import sendOwnerDM

let db; 
let spawnInterval; 

const SPAWN_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
const DESPAWN_TIMER_MS = 60 * 60 * 1000; // 1 giờ
const POKEMON_SPAWN_LEVEL_MIN = 3;
const POKEMON_SPAWN_LEVEL_MAX = 10;

const MYTHICAL_POKEMON_CUSTOM_IDS = [
    99999 + 151, // Mew
    99999 + 251, // Celebi
    99999 + 385, // Jirachi
    99999 + 386, // Deoxys (nếu có nhiều form, liệt kê tất cả pokedex_id tùy chỉnh của chúng)
    99999 + 489, // Phione
    99999 + 490, // Manaphy
    99999 + 491, // Darkrai
    99999 + 492, // Shaymin (tất cả các form)
    99999 + 493, // Arceus
    99999 + 647, // Keldeo (tất cả các form)
    99999 + 648, // Meloetta (tất cả các form)
    99999 + 649, // Genesect
    99999 + 719, // Diancie (tất cả các form)
    99999 + 720, // Hoopa (tất cả các form)
    99999 + 721, // Volcanion
    99999 + 801, // Magearna
    99999 + 802, // Marshadow
    99999 + 807, // Zeraora
    99999 + 893, // Zarude (tất cả các form)
    99999 + 905, // Enamorus (tất cả các form)
];

// Hàm phụ trợ: Lấy chi tiết Pokémon bao gồm cả form
async function getPokemonDetails(dbInstance, pokedexId, client) { 
    try {
        const pokemon = await dbInstance('pokemons') 
            .where('pokedex_id', pokedexId)
            .select('name', 'form', 'sprite_front_url', 'rarity', 'capture_rate', 'hp') 
            .first();
        if (!pokemon) return null;
        return {
            name: pokemon.name,
            form: pokemon.form,
            sprite_url: pokemon.sprite_front_url,
            rarity: pokemon.rarity,
            capture_rate: pokemon.capture_rate,
            base_hp: pokemon.hp 
        };
    } catch (error) {
        console.error(`[SPAWN_MANAGER_ERROR] Lỗi khi lấy chi tiết Pokémon cho Pokedex ID ${pokedexId}:`, error);
        sendOwnerDM(client, `[Lỗi Spawn Manager] Lỗi khi lấy chi tiết Pokémon cho Pokedex ID ${pokedexId}.`, error);
        return null;
    }
}

// Hàm chọn Pokémon ngẫu nhiên
async function getRandomSpawnablePokemonPokedexId(client) { 
    try {
        const evolvedToPokedexIds = await db('evolutions').distinct('evolves_to_pokedex_id').pluck('evolves_to_pokedex_id'); 

        const spawnablePokemons = await db('pokemons') 
            .whereNotIn('pokedex_id', evolvedToPokedexIds) 
            .andWhere(function() {
                this.whereNull('form').orWhere('form', 'normal'); 
            })
            .andWhere(function() {
                this.whereNotIn('pokedex_id', MYTHICAL_POKEMON_CUSTOM_IDS);
            })
            .select('pokedex_id');

        if (spawnablePokemons.length === 0) {
            console.warn('[SPAWN_MANAGER_WARN] Không tìm thấy Pokémon nào hợp lệ để spawn. Vui lòng kiểm tra dữ liệu.');
            sendOwnerDM(client, '[Cảnh báo Spawn Manager] Không tìm thấy Pokémon nào hợp lệ để spawn.', null);
            return null;
        }

        const randomIndex = Math.floor(Math.random() * spawnablePokemons.length);
        return spawnablePokemons[randomIndex].pokedex_id;

    } catch (error) {
        console.error('[SPAWN_MANAGER_ERROR] Lỗi khi chọn Pokémon ngẫu nhiên để spawn:', error);
        sendOwnerDM(client, '[Lỗi Spawn Manager] Lỗi khi chọn Pokémon ngẫu nhiên để spawn.', error);
        return null;
    }
}

// Hàm tính toán tỷ lệ bắt (giống trong catch.js)
function calculateCatchChance(pokemonCaptureRate, pokeballModifier, pokemonCurrentHP, pokemonMaxHP) {
    const hpFactor = 2 - (pokemonCurrentHP / pokemonMaxHP); 
    let chance = (pokemonCaptureRate / 255) * pokeballModifier * hpFactor;
    chance = Math.max(0, Math.min(1, chance));
    return chance;
}

// Hàm lấy tất cả các loại Poké Ball từ DB (đã sửa)
async function getAllPokeballs(dbInstance, client) { 
    try {
        // Danh sách các tên bóng bạn muốn hiển thị và xử lý
        const desiredBallNames = ['pokeball', 'greatball', 'ultraball', 'masterball']; 

        const pokeballs = await dbInstance('items')
            .whereIn('name', desiredBallNames) 
            .andWhere('catch_rate_modifier', '>', 0) 
            .select('item_id', 'name', 'catch_rate_modifier', 'sprite_url') 
            .orderBy('catch_rate_modifier', 'asc'); 

        return pokeballs;
    } catch (error) {
        console.error('[SPAWN_MANAGER_ERROR] Lỗi khi lấy danh sách Poké Balls:', error);
        sendOwnerDM(client, '[Lỗi Spawn Manager] Lỗi khi lấy danh sách Poké Balls.', error);
        return [];
    }
}

// Hàm spawn Pokémon
async function spawnPokemon(client) {
    const guildsWithSpawnChannels = await db('guild_settings') 
        .whereNotNull('spawn_channel_ids')
        .andWhere('spawn_channel_ids', '<>', '[]'); 
    
    if (guildsWithSpawnChannels.length === 0) {
        console.log('[SPAWN_MANAGER] Không có server nào thiết lập kênh spawn. Bỏ qua spawn.');
        return;
    }

    // Lấy danh sách tất cả Poké Balls một lần
    const availablePokeballs = await getAllPokeballs(db, client); 
    if (availablePokeballs.length === 0) {
        console.warn('[SPAWN_MANAGER_WARN] Không tìm thấy Poké Balls nào trong database (kiểm tra cột "type" của bảng "items" có phải là "pokeball" không). Không thể spawn Pokémon với nút bắt.');
        sendOwnerDM(client, '[Cảnh báo Spawn Manager] Không tìm thấy Poké Balls nào trong database để tạo nút bắt.', null);
        return;
    }

    for (const guildSetting of guildsWithSpawnChannels) {
        // Bắt lỗi cho từng guild/kênh cụ thể
        try { 
            const guildId = guildSetting.guild_id;
            const spawnChannels = JSON.parse(guildSetting.spawn_channel_ids);

            if (spawnChannels.length === 0) {
                console.warn(`[SPAWN_MANAGER_WARN] Guild ${guildId} không có kênh spawn nào được cấu hình. Bỏ qua.`);
                continue; // Bỏ qua guild này và đi đến guild tiếp theo
            } 

            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                console.warn(`[SPAWN_MANAGER_WARN] Không tìm thấy Guild với ID ${guildId}. Bỏ qua.`);
                sendOwnerDM(client, `[Cảnh báo Spawn Manager] Không tìm thấy Guild với ID ${guildId}.`, null);
                continue; // Bỏ qua guild này
            }

            const randomChannelId = spawnChannels[Math.floor(Math.random() * spawnChannels.length)];
            const channel = guild.channels.cache.get(randomChannelId);

            if (!channel || channel.type !== 0 || !channel.isTextBased()) {
                console.warn(`[SPAWN_MANAGER_WARN] Kênh ${randomChannelId} trong Guild ${guildId} không hợp lệ hoặc không phải kênh văn bản. Bỏ qua.`);
                sendOwnerDM(client, `[Cảnh báo Spawn Manager] Kênh ${randomChannelId} trong Guild ${guildId} không hợp lệ hoặc không phải kênh văn bản.`, null);
                continue; // Bỏ qua kênh này
            }

            // KIỂM TRA QUYỀN CỦA BOT TRƯỚC KHI GỬI TIN NHẮN
            const botPermissionsInChannel = channel.permissionsFor(client.user);
            if (!botPermissionsInChannel || 
                !botPermissionsInChannel.has(PermissionsBitField.Flags.ViewChannel) ||
                !botPermissionsInChannel.has(PermissionsBitField.Flags.SendMessages) ||
                !botPermissionsInChannel.has(PermissionsBitField.Flags.EmbedLinks) ||
                !botPermissionsInChannel.has(PermissionsBitField.Flags.AttachFiles)) 
            {
                const missingPerms = [];
                if (!botPermissionsInChannel.has(PermissionsBitField.Flags.ViewChannel)) missingPerms.push('View Channel');
                if (!botPermissionsInChannel.has(PermissionsBitField.Flags.SendMessages)) missingPerms.push('Send Messages');
                if (!botPermissionsInChannel.has(PermissionsBitField.Flags.EmbedLinks)) missingPerms.push('Embed Links');
                if (!botPermissionsInChannel.has(PermissionsBitField.Flags.AttachFiles)) missingPerms.push('Attach Files');

                console.warn(`[SPAWN_MANAGER_WARN] Bot thiếu quyền trong kênh ${channel.name} (${channel.id}) của Guild ${guild.name} (${guild.id}). Thiếu: ${missingPerms.join(', ')}. Bỏ qua spawn.`);
                sendOwnerDM(client, `[Cảnh báo Spawn Manager] Bot thiếu quyền trong kênh ${channel.name} (${channel.id}) của Guild ${guild.name} (${guild.id}). Thiếu: ${missingPerms.join(', ')}.`, null);
                continue; // Bỏ qua kênh này và đi đến kênh/guild tiếp theo
            }


            const pokedexId = await getRandomSpawnablePokemonPokedexId(client); 
            if (!pokedexId) {
                console.warn('[SPAWN_MANAGER_WARN] Không thể chọn Pokémon để spawn. Bỏ qua spawn.');
                continue;
            }

            const pokemonDetails = await getPokemonDetails(db, pokedexId, client); 
            if (!pokemonDetails) {
                console.error(`[SPAWN_MANAGER_ERROR] Không tìm thấy chi tiết Pokémon cho Pokedex ID ${pokedexId}. Bỏ qua spawn.`);
                sendOwnerDM(client, `[Lỗi Spawn Manager] Không tìm thấy chi tiết Pokémon cho Pokedex ID ${pokedexId}.`, null);
                continue;
            }

            const spawnLevel = Math.floor(Math.random() * (POKEMON_SPAWN_LEVEL_MAX - POKEMON_SPAWN_LEVEL_MIN + 1)) + POKEMON_SPAWN_LEVEL_MIN;

            const generateRandomIV = () => Math.floor(Math.random() * 32); 
            const ivs = {
                hp_iv: generateRandomIV(),
                attack_iv: generateRandomIV(),
                defense_iv: generateRandomIV(),
                special_attack_iv: generateRandomIV(),
                special_defense_iv: generateRandomIV(),
                speed_iv: generateRandomIV(),
            };

            const despawnTime = new Date(Date.now() + DESPAWN_TIMER_MS);

            const totalIV = ivs.hp_iv + ivs.attack_iv + ivs.defense_iv + ivs.special_attack_iv + ivs.special_defense_iv + ivs.speed_iv;
            const ivPercentage = ((totalIV / (31 * 6)) * 100).toFixed(2); 

            const pokemonMaxHPAtSpawn = Math.floor(((2 * pokemonDetails.base_hp + ivs.hp_iv) * spawnLevel) / 100) + spawnLevel + 10;

            const embed = new EmbedBuilder()
                .setColor('#FF0000') 
                .setTitle('✨ Một Pokémon hoang dã đã xuất hiện!')
                .setDescription(`Một **${pokemonDetails.name}** đã xuất hiện!`) 
                .addFields(
                    { name: 'Level', value: `${spawnLevel}`, inline: true },
                    { name: 'Phẩm chất', value: `${pokemonDetails.rarity.charAt(0).toUpperCase() + pokemonDetails.rarity.slice(1)}`, inline: true }, 
                    { name: '\u200B', value: '\u200B', inline: true }, 
                    { 
                        name: 'IVs', 
                        value: `HP: ${ivs.hp_iv}/31 | ATK: ${ivs.attack_iv}/31 | DEF: ${ivs.defense_iv}/31\nSpA: ${ivs.special_attack_iv}/31 | SpD: ${ivs.special_defense_iv}/31 | SPD: ${ivs.speed_iv}/31\nTổng IV: **${ivPercentage}%**`, 
                        inline: false 
                    } 
                )
                .setImage(pokemonDetails.sprite_url || null) 
                .setTimestamp()
                .setFooter({ text: `Sẽ biến mất vào: ${despawnTime.toLocaleTimeString('vi-VN')}`, iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder();
            availablePokeballs.forEach(ball => {
                const chance = calculateCatchChance(
                    pokemonDetails.capture_rate,
                    ball.catch_rate_modifier,
                    pokemonMaxHPAtSpawn, 
                    pokemonMaxHPAtSpawn  
                ) * 100; 

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`catch_ball_${ball.name.toLowerCase()}`) 
                        .setLabel(`${ball.name} (${chance.toFixed(1)}%)`) 
                        .setStyle(ButtonStyle.Primary) 
                        // .setEmoji(ball.sprite_url ? { url: ball.sprite_url } : null) 
                );
            });

            const spawnMessage = await channel.send({ content: '', embeds: [embed], components: [row] }); 

            await db('active_spawns').insert({ 
                pokedex_id: pokedexId,
                channel_id: channel.id,
                message_id: spawnMessage.id,
                spawn_time: new Date(),
                expires_at: despawnTime,
                level: spawnLevel,
                ...ivs 
            });

            console.log(`[SPAWN] Đã spawn ${pokemonDetails.name} (ID: ${pokedexId}) Lv ${spawnLevel} trong kênh ${channel.name} (${channel.id}).`);

        } catch (error) {
            // Bắt lỗi cụ thể cho từng guild/kênh và tiếp tục vòng lặp
            console.error(`[SPAWN_MANAGER_ERROR] Lỗi khi spawn Pokémon trong Guild ${guildSetting.guild_id} (Kênh: ${guildSetting.spawn_channel_ids}):`, error);
            sendOwnerDM(client, `[Lỗi Spawn Manager] Lỗi khi spawn Pokémon trong Guild ${guildSetting.guild_id}.`, error);
            // Không `throw error` ở đây, chỉ `continue` để xử lý guild tiếp theo
        }
    }
}

// Hàm dọn dẹp các spawn đã hết hạn (không thay đổi)
async function cleanupExpiredSpawns(client) {
    try {
        const expiredSpawns = await db('active_spawns') 
            .where('expires_at', '<=', db.fn.now()) 
            .orWhereNotNull('catcher_id'); 

        for (const spawn of expiredSpawns) {
            const channel = client.channels.cache.get(spawn.channel_id);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(spawn.message_id);
                    if (message && message.deletable) {
                        await message.delete();
                        console.log(`[CLEANUP] Đã xóa tin nhắn spawn cũ trong kênh ${channel.name} (ID: ${spawn.message_id}).`);
                    }
                } catch (msgError) {
                    console.warn(`[SPAWN_MANAGER_WARN] Không thể xóa tin nhắn spawn ${spawn.message_id} (có thể đã bị xóa thủ công):`, msgError.message);
                    // sendOwnerDM(client, `[Cảnh báo Spawn Manager] Không thể xóa tin nhắn spawn ${spawn.message_id} (có thể đã bị xóa thủ công).`, msgError); 
                }
            }
            await db('active_spawns').where('id', spawn.id).del(); 
            console.log(`[CLEANUP] Đã xóa bản ghi spawn ID ${spawn.id} khỏi DB.`);
        }
    } catch (error) {
        console.error('Lỗi trong quá trình dọn dẹp spawn đã hết hạn:', error);
        sendOwnerDM(client, `[Lỗi Spawn Manager] Lỗi trong quá trình dọn dẹp spawn đã hết hạn.`, error);
    }
}

// Hàm khởi tạo và quản lý spawn (không thay đổi)
function startSpawnManager(client, dbInstance) {
    db = dbInstance; 

    cleanupExpiredSpawns(client); 

    spawnInterval = setInterval(() => spawnPokemon(client), SPAWN_INTERVAL_MS); 

    setInterval(() => cleanupExpiredSpawns(client), SPAWN_INTERVAL_MS / 2); 
    
    console.log(`[SPAWN_MANAGER] Đã khởi động quản lý spawn. Spawn mỗi ${SPAWN_INTERVAL_MS / 1000} giây.`);
}

function stopSpawnManager() {
    if (spawnInterval) {
        clearInterval(spawnInterval);
        console.log('[SPAWN_MANAGER] Đã dừng quản lý spawn.');
    }
}

module.exports = {
    startSpawnManager,
    stopSpawnManager,
    getPokemonDetails, 
    getRandomSpawnablePokemonPokedexId,
    MYTHICAL_POKEMON_CUSTOM_IDS 
};
