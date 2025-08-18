// commands/catch.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const spawnManager = require('../utils/managers/spawnManager'); // Import spawnManager
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM
const logger = require('../utils/logger'); // <-- Thêm dòng này

// Collection để lưu trữ cooldown cho các tương tác bắt Pokémon
const catchCooldowns = new Collection();
const DEFAULT_CATCH_COOLDOWN_SECONDS = 60; // Cooldown mặc định cho mỗi lần thử bắt (60 giây)

// Hàm phụ trợ: Lấy thông tin Pokémon của người dùng
async function getUserPokemon(db, userId, pokemonInstanceId) {
    try {
        const userPokemon = await db('user_pokemons')
            .where('user_discord_id', userId)
            .andWhere('id', pokemonInstanceId)
            .select('*')
            .first();
        logger.debug('[CATCH_HELPER]', `Đã lấy Pokémon instance ${pokemonInstanceId} của người dùng ${userId}: ${userPokemon ? 'Found' : 'Not Found'}`);
        return userPokemon;
    } catch (error) {
        logger.error(`[CATCH_HELPER_ERROR] Lỗi khi lấy Pokémon của người dùng ${userId} (ID: ${pokemonInstanceId}):`, error);
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
        logger.debug('[CATCH_HELPER]', `Đã lấy PokéCoins của người dùng ${userId}: ${user ? user.pokecoins : 0}`);
        return user ? user.pokecoins : 0;
    } catch (error) {
        logger.error(`[CATCH_HELPER_ERROR] Lỗi khi lấy PokéCoins của người dùng ${userId}:`, error);
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
            logger.debug('[CATCH_HELPER]', `Đã cập nhật số lượng vật phẩm ${itemId} cho người dùng ${userId}. Số lượng thêm: ${quantity}`);
        } else {
            await db('user_inventory_items').insert({
                user_discord_id: userId,
                item_id: itemId,
                quantity: quantity,
            });
            logger.debug('[CATCH_HELPER]', `Đã thêm vật phẩm ${itemId} mới cho người dùng ${userId}. Số lượng: ${quantity}`);
        }
        return true;
    } catch (error) {
        logger.error(`[CATCH_HELPER_ERROR] Lỗi khi thêm/cập nhật vật phẩm ${itemId} cho người dùng ${userId}:`, error);
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
            logger.debug('[CATCH_HELPER]', `Đã trừ ${quantity} của vật phẩm ${itemId} từ người dùng ${userId}.`);
            return true;
        }
        logger.warn('[CATCH_HELPER_WARN]', `Người dùng ${userId} không đủ vật phẩm ${itemId} để trừ. Hiện có: ${currentQuantity ? currentQuantity.quantity : 0}, Cần: ${quantity}`);
        return false;
    } catch (error) {
        logger.error(`[CATCH_HELPER_ERROR] Lỗi khi trừ vật phẩm ${itemId} của người dùng ${userId}:`, error);
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
        logger.debug('[CATCH_HELPER]', `Đã lấy chi tiết Poké Ball "${ballName}": ${ball ? 'Found' : 'Not Found'}`);
        return ball;
    } catch (error) {
        logger.error(`[CATCH_HELPER_ERROR] Lỗi khi lấy chi tiết Poké Ball ${ballName}:`, error);
        return null;
    }
}

// Hàm tính toán tỷ lệ bắt (giống trong spawnManager.js để đồng bộ)
function calculateCatchChance(pokemonCaptureRate, pokeballModifier, pokemonCurrentHP, pokemonMaxHP) {
    const hpFactor = 2 - (pokemonCurrentHP / pokemonMaxHP); 
    let chance = (pokemonCaptureRate / 255) * pokeballModifier * hpFactor;
    chance = Math.max(0, Math.min(1, chance));
    logger.debug('[CATCH_CALCULATION]', `Tính toán tỷ lệ bắt: CaptureRate=${pokemonCaptureRate}, BallMod=${pokeballModifier}, HPRatio=${hpFactor.toFixed(2)}. Tỷ lệ cuối: ${(chance * 100).toFixed(2)}%`);
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
            logger.error(`[ADD_POKEMON_ERROR] Không tìm thấy base stats cho Pokedex ID ${pokedexId}.`);
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
        logger.info('[ADD_POKEMON_SUCCESS]', `Đã thêm Pokémon Pokedex ID ${pokedexId} (Lv ${level}, IVs: HP=${ivs.hp_iv}, ATK=${ivs.attack_iv}, DEF=${ivs.defense_iv}, SA=${ivs.special_attack_iv}, SD=${ivs.special_defense_iv}, SPD=${ivs.speed_iv}) vào kho của người dùng ${userId}.`);
        return true;
    } catch (error) {
        logger.error(`[ADD_POKEMON_ERROR] Lỗi khi thêm Pokémon Pokedex ID ${pokedexId} vào kho của người dùng ${userId}:`, error);
        return false;
    }
}


module.exports = {
    name: 'catch', 
    description: 'Xử lý tương tác bắt Pokémon.',
    cooldown: 60, 

    async execute(interaction, client, db) { 
        logger.warn(`[CATCH_COMMAND_USAGE] Lệnh /catch (hoặc !catch) được gọi trực tiếp. Đây không phải cách sử dụng chính, vui lòng chỉ dùng qua nút tương tác.`);
        // Sử dụng followUp thay vì reply vì interaction có thể đã được defer bởi interactionCreate.js
        return interaction.followUp({ content: 'Lệnh này chỉ được sử dụng thông qua các nút tương tác khi Pokémon xuất hiện.', ephemeral: true });
    },

    async handleCatchInteraction(interaction, client, db) {
        const userId = interaction.user.id;
        const channelId = interaction.channel.id;
        const messageId = interaction.message.id;
        const ballName = interaction.customId.replace('catch_ball_', ''); 

        logger.info('[CATCH_INTERACTION]', `Người dùng ${interaction.user.tag} (${userId}) đang cố gắng bắt Pokémon bằng ${ballName} ở kênh ${channelId}, tin nhắn ${messageId}.`);

        // --- Áp dụng Cooldown cho tương tác bắt ---
        const now = Date.now();
        const cooldownAmount = DEFAULT_CATCH_COOLDOWN_SECONDS * 1000; 

        if (catchCooldowns.has(userId)) {
            const expirationTime = catchCooldowns.get(userId) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                logger.debug('[CATCH_COOLDOWN]', `Người dùng ${userId} đang trong thời gian cooldown bắt. Còn lại ${timeLeft.toFixed(1)}s.`);
                await interaction.followUp({ 
                    content: `Vui lòng đợi thêm ${timeLeft.toFixed(1)} giây trước khi thử bắt Pokémon khác.`, 
                    ephemeral: true 
                });
                return;
            }
        }
        catchCooldowns.set(userId, now);
        logger.debug('[CATCH_COOLDOWN]', `Thiết lập cooldown bắt cho người dùng ${userId}.`);
        setTimeout(() => {
            catchCooldowns.delete(userId);
            logger.debug('[CATCH_COOLDOWN]', `Đã xóa cooldown bắt cho người dùng ${userId}.`);
        }, cooldownAmount);

        // 1. Kiểm tra xem Pokémon có đang spawn hợp lệ không
        logger.debug('[CATCH_CHECK_SPAWN]', `Đang kiểm tra spawn hợp lệ cho kênh ${channelId}, tin nhắn ${messageId}.`);
        const activeSpawn = await db('active_spawns') 
            .where('channel_id', channelId)
            .andWhere('message_id', messageId)
            .whereNull('catcher_id') 
            .where('expires_at', '>', db.fn.now()) 
            .first();

        if (!activeSpawn) {
            logger.warn('[CATCH_INVALID_SPAWN]', `Pokémon spawn không hợp lệ/đã hết hạn/đã bị bắt cho kênh ${channelId}, tin nhắn ${messageId}.`);
            await interaction.followUp({ content: 'Pokémon này đã bị bắt, đã biến mất hoặc không còn hợp lệ nữa.', ephemeral: true });
            if (interaction.message && interaction.message.deletable) {
                try {
                    await interaction.message.delete();
                    logger.debug('[CATCH_MESSAGE_DELETE]', `Đã xóa tin nhắn spawn không hợp lệ (ID: ${messageId}).`);
                } catch (e) {
                    logger.error('[CATCH_MESSAGE_DELETE_ERROR]', `Lỗi khi xóa tin nhắn spawn không hợp lệ (ID: ${messageId}):`, e);
                    await sendOwnerDM(client, `[Lỗi Xóa Tin Nhắn] Không thể xóa tin nhắn spawn không hợp lệ: ${messageId}`, e);
                }
            }
            catchCooldowns.delete(userId); // Xóa cooldown nếu spawn không hợp lệ để người dùng có thể thử lại ngay
            return;
        }
        logger.debug('[CATCH_VALID_SPAWN]', `Tìm thấy spawn hợp lệ: Pokedex ID ${activeSpawn.pokedex_id}, Level ${activeSpawn.level}.`);

        // 2. Lấy thông tin Poké Ball
        logger.debug('[CATCH_GET_BALL]', `Đang lấy thông tin Poké Ball: ${ballName}.`);
        const pokeball = await getPokeballDetails(db, ballName); 
        if (!pokeball) {
            logger.error('[CATCH_BALL_NOT_FOUND]', `Không tìm thấy thông tin cho loại bóng **${ballName}**.`);
            await interaction.followUp({ content: `Không tìm thấy thông tin cho loại bóng **${ballName}**.`, ephemeral: true });
            catchCooldowns.delete(userId); 
            return;
        }
        logger.debug('[CATCH_BALL_FOUND]', `Thông tin Poké Ball ${pokeball.name}: Item ID ${pokeball.item_id}, Modifier ${pokeball.catch_rate_modifier}.`);

        // 3. Kiểm tra số lượng Poké Ball trong kho người dùng VÀ TRỪ BÓNG
        logger.debug('[CATCH_CONSUME_BALL]', `Đang kiểm tra và trừ 1 ${pokeball.name} cho người dùng ${userId}.`);
        const hasBall = await consumeUserItem(db, userId, pokeball.item_id, 1); 
        if (!hasBall) {
            logger.warn('[CATCH_NO_BALLS]', `Người dùng ${userId} không có đủ **${pokeball.name}**.`);
            await interaction.followUp({ content: `Bạn không có đủ **${pokeball.name}** để bắt Pokémon này.`, ephemeral: true });
            catchCooldowns.delete(userId); 
            return; 
        }
        logger.debug('[CATCH_BALL_CONSUMED]', `Đã trừ 1 ${pokeball.name} từ kho của ${userId}.`);

        // 4. Lấy chi tiết Pokémon đang spawn (sử dụng base_hp từ pokemons table)
        logger.debug('[CATCH_GET_POKEMON_DETAILS]', `Đang lấy chi tiết Pokémon Pokedex ID: ${activeSpawn.pokedex_id}.`);
        const pokemonDetails = await spawnManager.getPokemonDetails(db, activeSpawn.pokedex_id); 
        if (!pokemonDetails) {
            logger.error('[CATCH_POKEMON_DETAILS_ERROR]', `Đã xảy ra lỗi khi lấy thông tin chi tiết Pokémon Pokedex ID ${activeSpawn.pokedex_id}.`);
            await interaction.followUp({ content: 'Đã xảy ra lỗi khi lấy thông tin Pokémon. Vui lòng thử lại.', ephemeral: true });
            await addUserItem(db, userId, pokeball.item_id, 1); // Hoàn tác lại bóng nếu lỗi
            catchCooldowns.delete(userId); 
            return;
        }
        logger.debug('[CATCH_POKEMON_DETAILS_FOUND]', `Chi tiết Pokémon: ${pokemonDetails.name}, Capture Rate: ${pokemonDetails.capture_rate}, Base HP: ${pokemonDetails.base_hp}.`);

        // Tính toán Max HP của Pokémon tại level spawn để truyền vào calculateCatchChance
        const pokemonMaxHPAtSpawn = Math.floor(((2 * pokemonDetails.base_hp + activeSpawn.hp_iv) * activeSpawn.level) / 100) + activeSpawn.level + 10;
        logger.debug('[CATCH_HP_CALC]', `Pokémon Max HP tại Lv ${activeSpawn.level}: ${pokemonMaxHPAtSpawn}.`);

        // 5. Tính toán tỷ lệ bắt
        const catchChance = calculateCatchChance(
            pokemonDetails.capture_rate,
            pokeball.catch_rate_modifier,
            pokemonMaxHPAtSpawn, 
            pokemonMaxHPAtSpawn 
        );

        const randomNumber = Math.random(); 
        logger.debug('[CATCH_ROLL]', `Roll bắt: ${randomNumber.toFixed(4)}. Cần < ${catchChance.toFixed(4)} (${(catchChance * 100).toFixed(2)}%) để thành công.`);

        let catchSuccess = false;
        let catchMessage = '';
        let embedColor = '#FF0000'; // Mặc định là màu đỏ (thất bại)

        if (randomNumber < catchChance) {
            catchSuccess = true;
            embedColor = '#00FF00'; // Màu xanh lá (thành công)

            logger.info('[CATCH_ATTEMPT_RESULT]', `Người dùng ${interaction.user.tag} đã bắt thành công ${pokemonDetails.name} (Lv ${activeSpawn.level})!`);
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
                logger.debug('[CATCH_DB_UPDATE]', `Đã cập nhật active_spawns với catcher_id ${userId} cho spawn ID ${activeSpawn.id}.`);
                
                catchMessage = `Chúc mừng! Bạn đã bắt được **${pokemonDetails.name}** (Lv ${activeSpawn.level}) bằng **${pokeball.name}**!`;
                
                const caughtEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🎉 Pokémon đã bị bắt!')
                    .setDescription(`${pokemonDetails.name} đã bị **${interaction.user.username}** bắt được!`)
                    .setImage(pokemonDetails.sprite_url || null)
                    .setTimestamp();
                
                await interaction.message.edit({ embeds: [caughtEmbed], components: [] }); 
                logger.debug('[CATCH_EMBED_UPDATE]', `Đã cập nhật embed của tin nhắn spawn.`);

            } else {
                catchMessage = `Đã xảy ra lỗi khi thêm ${pokemonDetails.name} vào kho của bạn. Vui lòng thử lại sau.`;
                await addUserItem(db, userId, pokeball.item_id, 1); // Hoàn tác bóng nếu không thêm được vào kho
                logger.error('[CATCH_ADD_TO_INVENTORY_FAILED]', `Không thể thêm Pokémon Pokedex ID ${activeSpawn.pokedex_id} vào kho của người dùng ${userId}. Đã hoàn tác bóng.`);
                await sendOwnerDM(client, `[Lỗi Bắt Pokémon] Không thể thêm Pokémon vào kho người dùng ${userId}`, new Error(`Failed to add ${pokemonDetails.name} to inventory.`));
            }
        } else {
            catchMessage = `Ôi không! **${pokemonDetails.name}** đã thoát khỏi **${pokeball.name}** của bạn! Hãy thử lại với một quả bóng khác hoặc chờ đợi một Pokémon mới.`;
            logger.info('[CATCH_ATTEMPT_RESULT]', `Người dùng ${interaction.user.tag} đã bắt thất bại ${pokemonDetails.name} (Lv ${activeSpawn.level}).`);
        }

        // Sử dụng followUp thay vì reply để gửi tin nhắn kết quả bắt
        await interaction.followUp({ content: catchMessage, ephemeral: true })
            .catch(e => logger.error('[CATCH_FOLLOWUP_ERROR]', `Không thể gửi followUp message cho ${userId} sau nỗ lực bắt:`, e));
    }
};