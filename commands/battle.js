// commands/battle.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isUserRegistered, getSelectedOrFirstPokemon } = require('../utils/core/userUtils');

// Import các hàm và module đã tách
// const { deleteMessageWithTimeout } = require('../utils/commonUtils'); // Đã loại bỏ vì không cần nữa
const { getAndInitializeWildPokemon } = require('../utils/battle/wildPokemonHandler');
const { simulateFullBattle } = require('../utils/battle/battleLogic');
const { generateBattleEmbed } = require('../utils/battle/battleUtils');
const {
    calculateExpToNextLevel,
    calculateHP,
    calculateStat,
    calculateExpGain,
    calculatePokecoinGain
} = require('../utils/battle/battleCalculations');

// Loại bỏ hằng số MESSAGE_DELETE_TIMEOUT vì không còn sử dụng deleteMessageWithTimeout cho các phản hồi ephemeral
// const MESSAGE_DELETE_TIMEOUT = 5000;

module.exports = {
    name: 'battle',
    description: 'Chiến đấu với Pokémon hoang dã để kiếm kinh nghiệm và Pokecoin!',
    aliases: ['b', 'fight'],
    cooldown: 6,

    async execute(message, args, client) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const guildId = message.guild.id;
        const prefix = client.config.PREFIX;

        let userPokemon; 

        try {
            // --- KIỂM TRA KÊNH CHIẾN ĐẤU ---
            const guildSettings = await db('guild_settings').where({ guild_id: guildId }).first();
            let battleChannelIds = [];

            if (guildSettings && guildSettings.battle_channel_ids) {
                try {
                    battleChannelIds = JSON.parse(guildSettings.battle_channel_ids);
                    if (!Array.isArray(battleChannelIds)) {
                        console.warn(`[BATTLE_COMMAND_WARN] battle_channel_ids cho guild ${guildId} không phải là một mảng sau khi parse. Đặt lại thành mảng rỗng.`);
                        battleChannelIds = [];
                    }
                } catch (e) {
                    console.error(`[BATTLE_COMMAND_ERROR] Lỗi khi parse battle_channel_ids cho guild ${guildId}:`, e);
                    battleChannelIds = [];
                }
            }

            if (battleChannelIds.length === 0 || !battleChannelIds.includes(channelId)) {
                // SỬA: Dùng ephemeral message thay vì reply và delete
                await message.channel.send({
                    content: `Lệnh \`${prefix}battle\` không được phép sử dụng ở kênh này. Bạn chỉ có thể dùng lệnh này` +
                             `${battleChannelIds.length > 0 ? ` tại các kênh sau: ${battleChannelIds.map(id => `<#${id}>`).join(', ')}.` : ' tại bất kỳ kênh nào. Vui lòng yêu cầu Admin sử dụng lệnh `!setbattlechannel add` tại kênh bạn muốn cho phép chiến đấu.'}`,
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send battle channel restriction message:", e));
                return;
            }

            // --- KIỂM TRA ĐĂNG KÝ NGƯỜI DÙNG ---
            const registered = await isUserRegistered(userId);
            if (!registered) {
                // SỬA: Dùng ephemeral message thay vì reply và delete
                await message.channel.send({
                    content: `Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${prefix}start\` để đăng ký và bắt đầu.`,
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send unregistered user message:", e));
                return;
            }

            // --- LẤY POKEMON CỦA NGƯỜI DÙNG ---
            userPokemon = await getSelectedOrFirstPokemon(userId); 

            if (!userPokemon) {
                // SỬA: Dùng ephemeral message thay vì reply và delete
                await message.channel.send({
                    content: 'Bạn chưa có Pokémon nào để chiến đấu! Hãy bắt Pokémon đầu tiên của bạn bằng cách đợi một Pokémon xuất hiện rồi dùng lệnh `!catch` hoặc chọn một Pokémon bằng `!mypokemons`.',
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send no pokemon message:", e));
                return;
            }

            if (userPokemon.training_start_time) {
                // SỬA: Dùng ephemeral message thay vì reply và delete
                await message.channel.send({
                    content: `Bạn không thể đưa **${userPokemon.nickname || userPokemon.pokemon_name}** vào trận chiến vì nó đang được huấn luyện! Vui lòng dùng \`${prefix}collecttrain\` để nhận lại.`,
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send training pokemon message:", e));
                return;
            }

            // --- LẤY VÀ KHỞI TẠO POKEMON HOANG DÃ ---
            const wildPokeCopy = await getAndInitializeWildPokemon(userPokemon);

            if (!wildPokeCopy) {
                // SỬA: Dùng ephemeral message thay vì reply và delete
                await message.channel.send({
                    content: 'Không thể tìm thấy Pokémon hoang dã nào để chiến đấu. Vui lòng thử lại sau.',
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send no wild pokemon message:", e));
                return;
            }

            let userPokeCopy = { ...userPokemon };
            userPokeCopy.current_hp = userPokemon.max_hp; // Đảm bảo Pokémon người chơi bắt đầu với HP đầy đủ

            // --- CHẠY TRẬN ĐẤU ---
            const initialBattleEmbed = generateBattleEmbed(userPokeCopy, wildPokeCopy, [`Trận chiến giữa ${userPokeCopy.nickname || userPokemon.pokemon_name} (Lv.${userPokeCopy.level}) và ${wildPokeCopy.pokemon_name} (Lv.${wildPokeCopy.level}) sắp bắt đầu!`], true);
            // SỬA: Dùng message.channel.send thay vì message.reply để tránh lỗi Unknown Message
            const battleMessage = await message.channel.send({ embeds: [initialBattleEmbed] }).catch(e => console.error("Could not send initial battle message:", e));

            if (!battleMessage) { // Kiểm tra nếu không gửi được tin nhắn battleMessage
                console.error("[BATTLE_COMMAND_ERROR] Không thể gửi tin nhắn battle khởi tạo.");
                await message.channel.send({
                    content: 'Đã có lỗi xảy ra khi bắt đầu trận chiến (không thể gửi tin nhắn). Vui lòng thử lại sau.',
                    flags: MessageFlags.Ephemeral
                }).catch(e => console.error("Could not send critical error message:", e));
                return;
            }


            const battleResult = await simulateFullBattle(userPokeCopy, wildPokeCopy, battleMessage);

            const { userPokemonFinal, wildPokemonFinal, battleResultType, fullBattleLog } = battleResult;

            // --- XỬ LÝ KẾT QUẢ TRẬN ĐẤU ---
            let finalEmbed = generateBattleEmbed(
                userPokemonFinal,
                wildPokemonFinal,
                fullBattleLog,
                false
            );

            if (battleResultType === 'win') {
                finalEmbed.setTitle(`🎉 Chiến thắng! ${userPokemonFinal.nickname || userPokemonFinal.pokemon_name} đã thắng!`);
                finalEmbed.setColor(0x32CD32);

                // --- TÍNH TOÁN EXP VÀ POKECOIN MỚI ---
                const expGain = calculateExpGain(userPokemonFinal, wildPokemonFinal);
                const pokecoinGain = calculatePokecoinGain(userPokemonFinal, wildPokemonFinal);

                let updatedExp = userPokemonFinal.experience + expGain;
                let updatedLevel = userPokemonFinal.level;
                let levelUpMessage = '';
                let statsIncreasedMessage = '';

                while (updatedLevel < 100 && updatedExp >= calculateExpToNextLevel(updatedLevel)) {
                    updatedExp -= calculateExpToNextLevel(updatedLevel);
                    updatedLevel++;

                    const oldMaxHp = userPokemonFinal.max_hp;
                    const oldAttack = userPokemonFinal.attack;
                    const oldDefense = userPokemonFinal.defense;
                    const oldSpecialAttack = userPokemonFinal.special_attack;
                    const oldSpecialDefense = userPokemonFinal.special_defense;
                    const oldSpeed = userPokemonFinal.speed;

                    const newMaxHp = calculateHP(userPokemonFinal.base_hp, userPokemonFinal.hp_iv, updatedLevel);
                    const newAttack = calculateStat(userPokemonFinal.base_attack, userPokemonFinal.attack_iv, updatedLevel);
                    const newDefense = calculateStat(userPokemonFinal.base_defense, userPokemonFinal.defense_iv, updatedLevel);
                    const newSpecialAttack = calculateStat(userPokemonFinal.base_special_attack, userPokemonFinal.special_attack_iv, updatedLevel);
                    const newSpecialDefense = calculateStat(userPokemonFinal.base_special_defense, userPokemonFinal.special_defense_iv, updatedLevel);
                    const newSpeed = calculateStat(userPokemonFinal.base_speed, userPokemonFinal.speed_iv, updatedLevel);

                    userPokemonFinal.level = updatedLevel;
                    userPokemonFinal.max_hp = newMaxHp;
                    userPokemonFinal.attack = newAttack;
                    userPokemonFinal.defense = newDefense;
                    userPokemonFinal.special_attack = newSpecialAttack;
                    userPokemonFinal.special_defense = newSpecialDefense;
                    userPokemonFinal.speed = newSpeed;

                    levelUpMessage += `\n${userPokemonFinal.nickname || userPokemonFinal.pokemon_name} đã lên **Level ${updatedLevel}**! 🎉`;
                    statsIncreasedMessage += `\nHP: ${oldMaxHp} -> ${newMaxHp} (+${newMaxHp - oldMaxHp})`;
                    statsIncreasedMessage += ` | ATK: ${oldAttack} -> ${newAttack} (+${newAttack - oldAttack})`;
                    statsIncreasedMessage += ` | DEF: ${oldDefense} -> ${newDefense} (+${newDefense - oldDefense})`;
                }
                
                if (updatedLevel >= 100) {
                    updatedExp = 0;
                }

                await db('user_pokemons')
                    .where({ id: userPokemonFinal.id })
                    .update({
                        experience: updatedExp,
                        level: updatedLevel,
                        current_hp: userPokemonFinal.max_hp,
                        max_hp: userPokemonFinal.max_hp,
                        attack: userPokemonFinal.attack,
                        defense: userPokemonFinal.defense,
                        special_attack: userPokemonFinal.special_attack,
                        special_defense: userPokemonFinal.special_defense,
                        speed: userPokemonFinal.speed,
                        updated_at: new Date()
                    });

                await db('users')
                    .where({ discord_id: userId })
                    .increment('pokecoins', pokecoinGain);

                const expNeeded = (updatedLevel < 100) ? calculateExpToNextLevel(updatedLevel) : 0;
                finalEmbed.setFooter({ 
                    text: `Bạn nhận được ${expGain} EXP và ${pokecoinGain} Pokecoin!${levelUpMessage}\n` +
                          (updatedLevel < 100 ? `EXP hiện tại: ${updatedExp}/${expNeeded} để lên Level ${updatedLevel + 1}` : `Pokémon đã đạt cấp độ tối đa (Lv.100)!`) +
                          (statsIncreasedMessage ? `\nChỉ số tăng: ${statsIncreasedMessage}` : '')
                });

            } else if (battleResultType === 'lose' || battleResultType === 'draw') {
                finalEmbed.setTitle(`😔 Trận chiến kết thúc!`);
                finalEmbed.setColor(0xFF4500);
                if (battleResultType === 'lose') {
                    finalEmbed.setDescription(`${finalEmbed.data.description || ''}\n${userPokemonFinal.nickname || userPokemonFinal.pokemon_name} đã gục ngã.`);
                    finalEmbed.setFooter({ text: `Bạn đã thua trận chiến! HP của Pokémon được hồi phục.` });
                } else {
                    finalEmbed.setDescription(`${finalEmbed.data.description || ''}\nTrận chiến kết thúc trong bế tắc.`);
                    finalEmbed.setFooter({ text: `Trận chiến kết thúc. HP của Pokémon được hồi phục.` });
                }

                await db('user_pokemons')
                    .where({ id: userPokemonFinal.id })
                    .update({
                        current_hp: userPokemonFinal.max_hp,
                        updated_at: new Date()
                    });
            }

            await battleMessage.edit({ embeds: [finalEmbed] });

        } catch (error) {
            console.error('[BATTLE_COMMAND_ERROR] Lỗi không mong muốn khi thực hiện lệnh battle:', error);
            // SỬA: Dùng message.channel.send với MessageFlags.Ephemeral hoặc message.editReply tùy thuộc trạng thái
            if (!message.replied && !message.deferred) {
                // Nếu chưa phản hồi hoặc hoãn phản hồi, gửi một tin nhắn lỗi ephemeral mới
                await message.channel.send({
                    content: 'Đã có lỗi xảy ra trong trận chiến. Vui lòng thử lại sau.',
                    flags: MessageFlags.Ephemeral
                }).catch(err => console.error("Lỗi khi gửi tin nhắn lỗi ephemeral:", err));
            } else { // Nếu đã phản hồi hoặc hoãn phản hồi, thử chỉnh sửa phản hồi đó
                await message.editReply('Đã có lỗi xảy ra trong trận chiến. Vui lòng thử lại sau.').catch(err => console.error("Lỗi khi chỉnh sửa tin nhắn lỗi:", err));
            }
        }
    },
};