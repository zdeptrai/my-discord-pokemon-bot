// commands/catch.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const spawnManager = require('../utils/managers/spawnManager'); // Import spawnManager
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

// Collection để lưu trữ cooldown cho các tương tác bắt Pokémon
const catchCooldowns = new Collection();
const DEFAULT_CATCH_COOLDOWN_SECONDS = 60; // Cooldown mặc định cho mỗi lần thử bắt (15 giây)

// Hàm phụ trợ: Lấy thông tin Pokémon của người dùng
async function getUserPokemon(db, userId, pokemonInstanceId) {
    try {
        const userPokemon = await db('user_pokemons')
            .where('user_discord_id', userId)
            .andWhere('id', pokemonInstanceId)
            .select('*')
            .first();
        return userPokemon;
    } catch (error) {
        console.error(`Lỗi khi lấy Pokémon của người dùng ${userId} (ID: ${pokemonInstanceId}):`, error);
        return null;
    }
}

// Hàm phụ trợ: Lấy số dư PokéCoin của người dùng
async function getUserPokecoins(db, userId) {
    try {
        const user = await db('users')
            .where('discord_id', userId)
            .select('pokecoins')
            .first();
        return user ? user.pokecoins : 0;
    } catch (error) {
        console.error(`Lỗi khi lấy PokéCoins của người dùng ${userId}:`, error);
        return 0;
    }
}

// Hàm phụ trợ: Thêm/Cập nhật vật phẩm trong kho của người dùng
async function addUserItem(db, userId, itemId, quantity) {
    try {
        const existingItem = await db('user_inventory_items')
            .where('user_discord_id', userId)
            .andWhere('item_id', itemId)
            .first();

        if (existingItem) {
            await db('user_inventory_items')
                .where('id', existingItem.id)
                .increment('quantity', quantity);
        } else {
            await db('user_inventory_items').insert({
                user_discord_id: userId,
                item_id: itemId,
                quantity: quantity,
            });
        }
        return true;
    } catch (error) {
        console.error(`Lỗi khi thêm/cập nhật vật phẩm ${itemId} cho người dùng ${userId}:`, error);
        return false;
    }
}

// Hàm phụ trợ: Tiêu thụ vật phẩm khỏi kho của người dùng
async function consumeUserItem(db, userId, itemId, quantity = 1) {
    try {
        const currentQuantity = await db('user_inventory_items')
            .where('user_discord_id', userId)
            .andWhere('item_id', itemId)
            .select('quantity')
            .first();
        
        if (currentQuantity && currentQuantity.quantity >= quantity) {
            await db('user_inventory_items')
                .where('user_discord_id', userId)
                .andWhere('item_id', itemId)
                .decrement('quantity', quantity); 
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Lỗi khi trừ vật phẩm ${itemId} của người dùng ${userId}:`, error);
        return false;
    }
}

// Hàm phụ trợ: Lấy thông tin Poké Ball
async function getPokeballDetails(db, ballName) {
    try {
        const ball = await db('items')
            .where('name', ballName)
            .andWhere('catch_rate_modifier', '>', 0) 
            .select('item_id', 'name', 'catch_rate_modifier')
            .first();
        return ball;
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết Poké Ball ${ballName}:`, error);
        return null;
    }
}

// Hàm tính toán tỷ lệ bắt (giống trong spawnManager.js để đồng bộ)
function calculateCatchChance(pokemonCaptureRate, pokeballModifier, pokemonCurrentHP, pokemonMaxHP) {
    const hpFactor = 2 - (pokemonCurrentHP / pokemonMaxHP); 
    let chance = (pokemonCaptureRate / 255) * pokeballModifier * hpFactor;
    chance = Math.max(0, Math.min(1, chance));
    return chance;
}

// Hàm thêm Pokémon vào kho người dùng
async function addPokemonToUserInventory(db, userId, pokedexId, level, ivs) {
    try {
        const baseStats = await db('pokemons')
            .where('pokedex_id', pokedexId)
            .select('hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed')
            .first();

        if (!baseStats) {
            console.error(`Không tìm thấy base stats cho Pokedex ID ${pokedexId}.`);
            return false;
        }

        const calculateStat = (base, iv, level) => {
            return Math.floor(((2 * base + iv) * level) / 100) + 5;
        };

        const maxHp = Math.floor(((2 * baseStats.hp + ivs.hp_iv) * level) / 100) + level + 10;
        const attack = calculateStat(baseStats.attack, ivs.attack_iv, level);
        const defense = calculateStat(baseStats.defense, ivs.defense_iv, level);
        const special_attack = calculateStat(baseStats.special_attack, ivs.special_attack_iv, level);
        const special_defense = calculateStat(baseStats.special_defense, ivs.special_defense_iv, level);
        const speed = calculateStat(baseStats.speed, ivs.speed_iv, level); 

        await db('user_pokemons').insert({
            user_discord_id: userId,
            pokedex_id: pokedexId,
            level: level,
            experience: 0, 
            current_hp: maxHp, 
            max_hp: maxHp,
            attack: attack,
            defense: defense,
            special_attack: special_attack,
            special_defense: special_defense,
            speed: speed,
            hp_iv: ivs.hp_iv,
            attack_iv: ivs.attack_iv,
            defense_iv: ivs.defense_iv,
            special_attack_iv: ivs.special_attack_iv,
            special_defense_iv: ivs.special_defense_iv,
            speed_iv: ivs.speed_iv, 
            learned_skill_ids: '[]' 
        });
        return true;
    } catch (error) {
        console.error(`Lỗi khi thêm Pokémon Pokedex ID ${pokedexId} vào kho của người dùng ${userId}:`, error);
        return false;
    }
}


module.exports = {
    name: 'catch', 
    description: 'Xử lý tương tác bắt Pokémon.',
    cooldown: 60, 

    async execute(interaction, client, db) { 
        console.log(`[CATCH_COMMAND] Lệnh !catch được gọi. Đây không phải cách sử dụng chính.`);
        // Sử dụng followUp thay vì reply vì interaction có thể đã được defer bởi interactionCreate.js
        return interaction.followUp({ content: 'Lệnh này chỉ được sử dụng thông qua các nút tương tác khi Pokémon xuất hiện.', ephemeral: true });
    },

    async handleCatchInteraction(interaction, client, db) {
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;
        const messageId = interaction.message.id;
        const ballName = interaction.customId.replace('catch_ball_', ''); 

        // --- Áp dụng Cooldown cho tương tác bắt ---
        const now = Date.now();
        const cooldownAmount = DEFAULT_CATCH_COOLDOWN_SECONDS * 1000; 

        if (catchCooldowns.has(userId)) {
            const expirationTime = catchCooldowns.get(userId) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                // Sử dụng followUp thay vì reply
                await interaction.followUp({ 
                    content: `Vui lòng đợi thêm ${timeLeft.toFixed(1)} giây trước khi thử bắt Pokémon khác.`, 
                    ephemeral: true 
                });
                return;
            }
        }
        catchCooldowns.set(userId, now);
        setTimeout(() => catchCooldowns.delete(userId), cooldownAmount);

        // 1. Kiểm tra xem Pokémon có đang spawn hợp lệ không
        const activeSpawn = await db('active_spawns') 
            .where('channel_id', channelId)
            .andWhere('message_id', messageId)
            .whereNull('catcher_id') 
            .where('expires_at', '>', db.fn.now()) 
            .first();

        if (!activeSpawn) {
            // Sử dụng followUp thay vì reply
            await interaction.followUp({ content: 'Pokémon này đã bị bắt, đã biến mất hoặc không còn hợp lệ nữa.', ephemeral: true });
            if (interaction.message && interaction.message.deletable) {
                try {
                    await interaction.message.delete();
                } catch (e) {
                    console.error('Lỗi khi xóa tin nhắn spawn không hợp lệ:', e);
                    sendOwnerDM(client, `[Lỗi Xóa Tin Nhắn] Không thể xóa tin nhắn spawn không hợp lệ: ${messageId}`, e);
                }
            }
            catchCooldowns.delete(userId); 
            return;
        }

        // 2. Lấy thông tin Poké Ball
        const pokeball = await getPokeballDetails(db, ballName); 
        if (!pokeball) {
            // Sử dụng followUp thay vì reply
            await interaction.followUp({ content: `Không tìm thấy thông tin cho loại bóng **${ballName}**.`, ephemeral: true });
            catchCooldowns.delete(userId); 
            return;
        }

        // 3. Kiểm tra số lượng Poké Ball trong kho người dùng VÀ TRỪ BÓNG
        const hasBall = await consumeUserItem(db, userId, pokeball.item_id, 1); 
        if (!hasBall) {
            // Sử dụng followUp thay vì reply
            await interaction.followUp({ content: `Bạn không có đủ **${pokeball.name}** để bắt Pokémon này.`, ephemeral: true });
            catchCooldowns.delete(userId); 
            return; 
        }

        // 4. Lấy chi tiết Pokémon đang spawn (sử dụng base_hp từ pokemons table)
        const pokemonDetails = await spawnManager.getPokemonDetails(db, activeSpawn.pokedex_id); 
        if (!pokemonDetails) {
            // Sử dụng followUp thay vì reply
            await interaction.followUp({ content: 'Đã xảy ra lỗi khi lấy thông tin Pokémon. Vui lòng thử lại.', ephemeral: true });
            await addUserItem(db, userId, pokeball.item_id, 1); // Hoàn tác lại bóng nếu lỗi
            catchCooldowns.delete(userId); 
            return;
        }

        // Tính toán Max HP của Pokémon tại level spawn để truyền vào calculateCatchChance
        const pokemonMaxHPAtSpawn = Math.floor(((2 * pokemonDetails.base_hp + activeSpawn.hp_iv) * activeSpawn.level) / 100) + activeSpawn.level + 10;

        // 5. Tính toán tỷ lệ bắt
        const catchChance = calculateCatchChance(
            pokemonDetails.capture_rate,
            pokeball.catch_rate_modifier,
            pokemonMaxHPAtSpawn, 
            pokemonMaxHPAtSpawn 
        );

        const randomNumber = Math.random(); 

        let catchSuccess = false;
        let catchMessage = '';
        let embedColor = '#FF0000'; 

        if (randomNumber < catchChance) {
            catchSuccess = true;
            embedColor = '#00FF00'; 

            const addedToInventory = await addPokemonToUserInventory(
                db, 
                userId,
                activeSpawn.pokedex_id,
                activeSpawn.level,
                {
                    hp_iv: activeSpawn.hp_iv,
                    attack_iv: activeSpawn.attack_iv,
                    defense_iv: activeSpawn.defense_iv,
                    special_attack_iv: activeSpawn.special_attack_iv,
                    special_defense_iv: activeSpawn.special_defense_iv,
                    speed_iv: activeSpawn.speed_iv, 
                }
            );

            if (addedToInventory) {
                await db('active_spawns') 
                    .where('id', activeSpawn.id)
                    .update({ catcher_id: userId }); 
                
                catchMessage = `Chúc mừng! Bạn đã bắt được **${pokemonDetails.name}** (Lv ${activeSpawn.level}) bằng **${pokeball.name}**!`;
                
                const caughtEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🎉 Pokémon đã bị bắt!')
                    .setDescription(`${pokemonDetails.name} đã bị **${interaction.user.username}** bắt được!`)
                    .setImage(pokemonDetails.sprite_url || null)
                    .setTimestamp();
                
                // Sử dụng edit để cập nhật tin nhắn spawn gốc
                await interaction.message.edit({ embeds: [caughtEmbed], components: [] }); 
                console.log(`[CATCH] Người dùng ${interaction.user.username} đã bắt thành công ${pokemonDetails.name}.`);

            } else {
                catchMessage = `Đã xảy ra lỗi khi thêm ${pokemonDetails.name} vào kho của bạn. Vui lòng thử lại sau.`;
                await addUserItem(db, userId, pokeball.item_id, 1); // Hoàn tác bóng nếu không thêm được vào kho
                sendOwnerDM(client, `[Lỗi Bắt Pokémon] Không thể thêm Pokémon vào kho người dùng ${userId}`, new Error(`Failed to add ${pokemonDetails.name} to inventory.`));
            }
        } else {
            catchMessage = `Ôi không! **${pokemonDetails.name}** đã thoát khỏi **${pokeball.name}** của bạn! Hãy thử lại với một quả bóng khác hoặc chờ đợi một Pokémon mới.`;
            console.log(`[CATCH] Người dùng ${interaction.user.username} đã bắt thất bại ${pokemonDetails.name}.`);
        }

        // Sử dụng followUp thay vì reply để gửi tin nhắn kết quả bắt
        await interaction.followUp({ content: catchMessage, ephemeral: true });
    }
};
