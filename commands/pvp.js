// commands/pvp.js
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { getPokemonTeamForPvp, initializePvpBattleState, generatePvpBattleEmbed, generateSkillButtons } = require('../utils/pvpUtils');
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { calculateDamage } = require('../utils/dame/battleCalculations'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 

// Map để lưu trữ các thử thách PvP đang chờ xử lý
// Key: ID người thách đấu, Value: { opponentId, mode, channelId, messageId }
const pendingPvpChallenges = new Map();

// Map để lưu trữ các trận đấu PvP đang hoạt động
// Key: ID kênh, Value: PvpBattleState object
const activePvpBattles = new Map();

/**
 * Gửi tin nhắn ephemeral và báo cáo lỗi nếu không thành công.
 * @param {Interaction} interaction Đối tượng tương tác.
 * @param {string} content Nội dung tin nhắn.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function sendEphemeralReply(interaction, content, logContext) {
    try {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch (e) {
        console.error(`[PVP_ERROR] Lỗi gửi tin nhắn ephemeral (${logContext}):`, e);
        sendOwnerDM(interaction.client, `[Lỗi PvP] Lỗi gửi tin nhắn ephemeral (${logContext}) cho ${interaction.user.tag}.`, e);
    }
}

/**
 * Chỉnh sửa tin nhắn và báo cáo lỗi nếu không thành công (bao gồm Unknown Message).
 * @param {Message} message Đối tượng tin nhắn cần chỉnh sửa.
 * @param {object} options Tùy chọn chỉnh sửa tin nhắn.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function editMessageSafe(message, options, logContext) {
    try {
        // Fetch lại tin nhắn để đảm bảo nó vẫn tồn tại và có thể chỉnh sửa
        const fetchedMessage = await message.channel.messages.fetch(message.id).catch(() => null);
        if (fetchedMessage && fetchedMessage.editable) {
            await fetchedMessage.edit(options);
        } else {
            console.warn(`[PVP_WARN] Tin nhắn không còn tồn tại hoặc không thể chỉnh sửa (${logContext}).`);
        }
    } catch (e) {
        if (e.code === 10008) { // Unknown Message
            console.warn(`[PVP_WARN] Tin nhắn đã bị xóa, không thể chỉnh sửa (${logContext}).`);
        } else {
            console.error(`[PVP_ERROR] Lỗi chỉnh sửa tin nhắn (${logContext}):`, e);
            sendOwnerDM(message.client, `[Lỗi PvP] Lỗi chỉnh sửa tin nhắn (${logContext}) trên kênh ${message.channel.id}.`, e);
        }
    }
}

/**
 * Xóa tin nhắn ephemeral và báo cáo lỗi nếu không thành công.
 * @param {Channel} channel Kênh chứa tin nhắn.
 * @param {string} messageId ID tin nhắn ephemeral cần xóa.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function deleteEphemeralMessageSafe(channel, messageId, logContext) {
    if (!messageId) return;
    try {
        const ephemeralMessage = await channel.messages.fetch(messageId);
        if (ephemeralMessage) {
            await ephemeralMessage.delete();
        }
    } catch (error) {
        if (error.code === 10008) { // Unknown Message
            console.warn(`[PVP_WARN] Tin nhắn ephemeral đã bị xóa, không thể xóa lại (${logContext}).`);
        } else {
            console.error(`[PVP_ERROR] Không thể xóa tin nhắn ephemeral (${logContext}):`, error);
            // sendOwnerDM(channel.client, `[Lỗi PvP] Không thể xóa tin nhắn ephemeral (${logContext}).`, error); // Bỏ comment nếu muốn DM cho mỗi lần lỗi xóa ephemeral
        }
    }
}


module.exports = {
    name: 'pvp',
    description: 'Bắt đầu một trận chiến PvP với người chơi khác.',
    aliases: ['ble', 'fight'],
    usage: '<@đối_thủ> <chế_độ_1v1|3v3|5v5>',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const userDisplayName = message.member ? message.member.displayName : message.author.displayName;

        if (args.length !== 2) {
            return sendEphemeralReply(message.channel, `<@${userId}> Vui lòng sử dụng đúng cú pháp: \`${client.config.PREFIX}pvp <@đối_thủ> <chế_độ_1v1|3v3|5v5>\`.`, 'pvp_syntax_error');
        }

        const opponentMention = message.mentions.users.first();
        if (!opponentMention) {
            return sendEphemeralReply(message.channel, `<@${userId}> Vui lòng tag người bạn muốn thách đấu.`, 'pvp_no_opponent_tagged');
        }

        const opponentId = opponentMention.id;
        const modeString = args[1].toLowerCase(); 
        let mode;

        switch (modeString) {
            case '1v1': mode = 1; break;
            case '3v3': mode = 3; break;
            case '5v5': mode = 5; break;
            default:
                return sendEphemeralReply(message.channel, `<@${userId}> Chế độ PvP không hợp lệ. Vui lòng chọn \`1v1\`, \`3v3\` hoặc \`5v5\`.`, 'pvp_invalid_mode');
        }

        if (userId === opponentId) {
            return sendEphemeralReply(message.channel, `<@${userId}> Bạn không thể thách đấu chính mình!`, 'pvp_self_challenge');
        }

        const isChallengerRegistered = await isUserRegistered(userId);
        const isOpponentRegistered = await isUserRegistered(opponentId);

        if (!isChallengerRegistered) {
            return sendEphemeralReply(message.channel, `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký.`, 'pvp_challenger_not_registered');
        }
        if (!isOpponentRegistered) {
            return sendEphemeralReply(message.channel, `<@${opponentId}> Người này chưa bắt đầu cuộc phiêu lưu của họ.`, 'pvp_opponent_not_registered');
        }

        if (activePvpBattles.has(message.channel.id) || 
            Array.from(pendingPvpChallenges.values()).some(c => c.challengerId === userId || c.opponentId === userId || c.challengerId === opponentId || c.opponentId === opponentId)) {
            return sendEphemeralReply(message.channel, `<@${userId}> Bạn hoặc đối thủ đã đang trong một trận đấu/thử thách PvP khác.`, 'pvp_already_in_battle');
        }

        let challengerTeam;
        try {
            challengerTeam = await getPokemonTeamForPvp(userId, mode, db);
        } catch (error) {
            return sendEphemeralReply(message.channel, `<@${userId}> Lỗi đội hình của bạn: ${error.message}`, 'pvp_challenger_team_error');
        }

        let opponentTeamCheck;
        try {
            opponentTeamCheck = await getPokemonTeamForPvp(opponentId, mode, db);
        } catch (error) {
            return sendEphemeralReply(message.channel, `<@${opponentId}> Lỗi đội hình của đối thủ: ${error.message}`, 'pvp_opponent_team_check_error');
        }
        
        const challengeMessage = await message.channel.send({
            content: `<@${opponentId}>, ${userDisplayName} đã thách đấu bạn một trận PvP **${mode}v${mode}**! Bạn có muốn chấp nhận không?`,
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`pvp_accept_${userId}_${mode}`)
                            .setLabel('Chấp nhận')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`pvp_decline_${userId}`)
                            .setLabel('Từ chối')
                            .setStyle(ButtonStyle.Danger),
                    ),
            ],
        }).catch(e => {
            console.error(`[PVP_ERROR] Lỗi gửi tin nhắn thử thách PvP cho ${userId}:`, e);
            sendOwnerDM(client, `[Lỗi PvP] Lỗi gửi tin nhắn thử thách PvP cho ${userId}.`, e);
            return null;
        });

        if (!challengeMessage) return;

        pendingPvpChallenges.set(userId, {
            opponentId: opponentId,
            mode: mode,
            channelId: message.channel.id,
            messageId: challengeMessage.id,
            challengerTeam: challengerTeam, 
            opponentTeamCheck: opponentTeamCheck 
        });

        setTimeout(() => {
            if (pendingPvpChallenges.has(userId)) {
                pendingPvpChallenges.delete(userId);
                editMessageSafe(challengeMessage, {
                    content: `<@${opponentId}>, thử thách PvP từ ${userDisplayName} đã hết hạn.`,
                    components: []
                }, 'pvp_challenge_timeout');
            }
        }, 5 * 60 * 1000); 
    },

    async handleInteraction(interaction, client, db) {
        const customId = interaction.customId;
        const userId = interaction.user.id;

        try {
            if (customId.startsWith('pvp_accept_')) {
                const challengerId = customId.split('_')[2];
                const mode = parseInt(customId.split('_')[3]);

                const challenge = pendingPvpChallenges.get(challengerId);

                if (!challenge || challenge.opponentId !== userId || challenge.channelId !== interaction.channel.id) {
                    return sendEphemeralReply(interaction, 'Thử thách PvP này không hợp lệ hoặc đã hết hạn.', 'pvp_accept_invalid_challenge');
                }
                if (activePvpBattles.has(interaction.channel.id) || 
                    Array.from(activePvpBattles.values()).some(b => b.players[userId] || b.players[challengerId])) {
                    return sendEphemeralReply(interaction, 'Bạn hoặc đối thủ đã đang trong một trận đấu PvP khác.', 'pvp_accept_already_in_battle');
                }
                
                // Ghi nhận tương tác và cập nhật tin nhắn gốc (thử thách)
                const acceptedEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Thách đấu PvP đã được chấp nhận!')
                    .setDescription(`<@${userId}> đã chấp nhận lời thách đấu của <@${challengerId}>!`)
                    .setFooter({ text: 'Bắt đầu trận chiến!' })
                    .setTimestamp();
                
                await interaction.update({ embeds: [acceptedEmbed], components: [] })
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Lỗi update tin nhắn chấp nhận cho ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi update tin nhắn chấp nhận cho ${userId}.`, e);
                    });
                
                pendingPvpChallenges.delete(challengerId); 

                let opponentTeam;
                try {
                    opponentTeam = await getPokemonTeamForPvp(userId, mode, db);
                } catch (error) {
                    console.error(`[PVP_INTERACTION_ERROR] Lỗi khi lấy đội hình đối thủ cho ${userId}:`, error); 
                    sendOwnerDM(client, `[Lỗi PvP] Lỗi khi lấy đội hình đối thủ cho người dùng ${userId}.`, error);
                    return sendEphemeralReply(interaction, `Lỗi đội hình của bạn: ${error.message}`, 'pvp_accept_opponent_team_error');
                }

                const challengerTeam = challenge.challengerTeam;

                const battleState = initializePvpBattleState(challengerId, challengerTeam, userId, opponentTeam, mode, interaction.channel.id);
                activePvpBattles.set(interaction.channel.id, battleState); 

                const challengerActivePokemon = challengerTeam[0];
                const opponentActivePokemon = opponentTeam[0];

                if (challengerActivePokemon.speed > opponentActivePokemon.speed) {
                    battleState.activePlayerId = challengerId;
                    battleState.lastBattleAction = `💨 ${challengerActivePokemon.name} (Tốc độ: ${challengerActivePokemon.speed}) nhanh hơn ${opponentActivePokemon.name} (Tốc độ: ${opponentActivePokemon.speed})! ${client.users.cache.get(challengerId).username} đi trước.`;
                } else if (opponentActivePokemon.speed > challengerActivePokemon.speed) {
                    battleState.activePlayerId = userId;
                    battleState.lastBattleAction = `💨 ${opponentActivePokemon.name} (Tốc độ: ${opponentActivePokemon.speed}) nhanh hơn ${challengerActivePokemon.name} (Tốc độ: ${challengerActivePokemon.speed})! ${client.users.cache.get(userId).username} đi trước.`;
                } else {
                    battleState.activePlayerId = challengerId;
                    battleState.lastBattleAction = `💨 ${challengerActivePokemon.name} và ${opponentActivePokemon.name} có cùng tốc độ (${challengerActivePokemon.speed}). ${client.users.cache.get(challengerId).username} đi trước.`;
                }
                battleState.turn = 1;

                const battleEmbed = await generatePvpBattleEmbed(battleState, client);
                const battleMessage = await interaction.channel.send({ embeds: [battleEmbed] })
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Lỗi gửi tin nhắn trận đấu chính cho ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi gửi tin nhắn trận đấu chính cho ${userId}.`, e);
                        activePvpBattles.delete(interaction.channel.id); 
                        return null;
                    });
                if (!battleMessage) return;
                battleState.battleMessageId = battleMessage.id; 

                const currentPlayer = battleState.players[battleState.activePlayerId];
                const activePokemon = currentPlayer.team[currentPlayer.activePokemonIndex];
                const skillButtons = generateSkillButtons(activePokemon, battleState.activePlayerId);

                let ephemeralSkillMessage;
                try {
                    ephemeralSkillMessage = await interaction.channel.send({
                        content: `<@${battleState.activePlayerId}>, đến lượt bạn! Chọn kỹ năng cho **${activePokemon.name}**:`,
                        components: skillButtons,
                        flags: MessageFlags.Ephemeral 
                    });
                    battleState.players[battleState.activePlayerId].ephemeralMessageId = ephemeralSkillMessage.id; 
                } catch (e) {
                    console.error(`[PVP_INTERACTION_ERROR] Lỗi gửi tin nhắn kỹ năng ephemeral cho ${battleState.activePlayerId}:`, e);
                    sendOwnerDM(client, `[Lỗi PvP] Lỗi gửi tin nhắn kỹ năng ephemeral cho ${battleState.activePlayerId}.`, e);
                }


            } else if (customId.startsWith('pvp_decline_')) {
                const challengerId = customId.split('_')[2];
                const challenge = pendingPvpChallenges.get(challengerId);

                if (!challenge || challenge.opponentId !== userId || challenge.channelId !== interaction.channel.id) {
                    return sendEphemeralReply(interaction, 'Thử thách PvP này không hợp lệ hoặc đã hết hạn.', 'pvp_decline_invalid_challenge');
                }

                pendingPvpChallenges.delete(challengerId); 

                // Ghi nhận tương tác và cập nhật tin nhắn gốc (thử thách)
                const declinedEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Thách đấu PvP đã bị từ chối!')
                    .setDescription(`<@${userId}> đã từ chối lời thách đấu của <@${challengerId}>.`)
                    .setFooter({ text: 'Trận chiến đã bị hủy.' })
                    .setTimestamp();

                await interaction.update({ embeds: [declinedEmbed], components: [] })
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Lỗi update tin nhắn từ chối cho ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi update tin nhắn từ chối cho ${userId}.`, e);
                    });

                await interaction.channel.send({ content: `<@${challengerId}>, ${interaction.user.username} đã từ chối thử thách PvP của bạn.`, })
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Lỗi gửi tin nhắn từ chối PvP cho ${challengerId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi gửi tin nhắn từ chối PvP cho ${challengerId}.`, e);
                    });

            } else if (customId.startsWith('pvp_skill_')) {
                // Ghi nhận tương tác ngay lập tức
                await interaction.deferUpdate()
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Không thể deferUpdate cho pvp_skill_ ${customId} từ ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Không thể deferUpdate cho pvp_skill_ ${customId} từ ${userId}.`, e);
                        return; 
                    });

                const [_, __, playerId, skillId] = customId.split('_'); 
                
                const battleState = activePvpBattles.get(interaction.channel.id);

                if (!battleState || battleState.activePlayerId !== userId || playerId !== userId) {
                    return sendEphemeralReply(interaction, 'Đây không phải lượt của bạn hoặc trận đấu đã kết thúc/không hợp lệ.', 'pvp_skill_invalid_turn');
                }

                deleteEphemeralMessageSafe(interaction.channel, battleState.players[userId].ephemeralMessageId, 'pvp_skill_delete_ephemeral');
                battleState.players[userId].ephemeralMessageId = null; 

                const currentPlayerState = battleState.players[userId];
                const opponentPlayerId = Object.keys(battleState.players).find(id => id !== userId);
                const opponentPlayerState = battleState.players[opponentPlayerId];

                const activePokemon = currentPlayerState.team[currentPlayerState.activePokemonIndex];
                const opponentPokemon = opponentPlayerState.team[opponentPlayerState.activePokemonIndex];

                const selectedSkill = activePokemon.skills.find(s => s.skill_id === parseInt(skillId));

                if (!selectedSkill) {
                    return sendEphemeralReply(interaction, 'Kỹ năng không hợp lệ hoặc không tìm thấy. Vui lòng thử lại.', 'pvp_skill_not_found');
                }

                const attackResult = calculateDamage(activePokemon, opponentPokemon, selectedSkill);
                
                let logEntry = '';
                if (attackResult.hit) {
                    opponentPokemon.current_hp -= attackResult.damage;
                    logEntry = `L${battleState.turn}: ${activePokemon.name} dùng **${selectedSkill.name}** gây **${attackResult.damage} sát thương**!`;
                    if (attackResult.crit) logEntry += ' (Chí mạng!)';
                    if (attackResult.effectiveness === 2.0) logEntry += ' (Siêu hiệu quả!)';
                    else if (attackResult.effectiveness === 0.5) logEntry += ' (Không hiệu quả lắm.)';
                    else if (attackResult.effectiveness === 0) logEntry += ' (Không có tác dụng!)';
                    logEntry += ` > ${opponentPokemon.name} còn **${Math.max(0, opponentPokemon.current_hp)}/${opponentPokemon.max_hp} HP**`;
                } else {
                    logEntry = `L${battleState.turn}: ${activePokemon.name} dùng **${selectedSkill.name}** nhưng trượt!`;
                }
                battleState.lastBattleAction = logEntry; 

                const battleEmbed = await generatePvpBattleEmbed(battleState, client);
                const battleMessage = await interaction.channel.messages.fetch(battleState.battleMessageId);
                await editMessageSafe(battleMessage, { embeds: [battleEmbed] }, 'pvp_skill_update_battle_embed');


                if (opponentPokemon.current_hp <= 0) {
                    battleState.lastBattleAction += `\n> ${opponentPokemon.name} đã bị hạ gục!`; 
                    opponentPlayerState.activePokemonIndex++; 

                    if (opponentPlayerState.activePokemonIndex >= opponentPlayerState.team.length) {
                        await endPvpBattle(interaction.channel.id, userId, client, db, battleState); 
                        return;
                    } else {
                        const nextOpponentPokemon = opponentPlayerState.team[opponentPlayerState.activePokemonIndex];
                        battleState.lastBattleAction += `\n> ${client.users.cache.get(opponentPlayerId).username} đã đưa ra **${nextOpponentPokemon.name}**!`; 
                        const updatedBattleEmbed = await generatePvpBattleEmbed(battleState, client);
                        await editMessageSafe(battleMessage, { embeds: [updatedBattleEmbed] }, 'pvp_skill_update_battle_embed_new_pokemon');
                    }
                }

                if (activePvpBattles.has(interaction.channel.id)) { 
                    battleState.activePlayerId = opponentPlayerId;
                    battleState.turn++;

                    const nextPlayer = battleState.players[battleState.activePlayerId];
                    const nextActivePokemon = nextPlayer.team[nextPlayer.activePokemonIndex];
                    const nextSkillButtons = generateSkillButtons(nextActivePokemon, battleState.activePlayerId);

                    try {
                        const nextEphemeralSkillMessage = await interaction.channel.send({
                            content: `<@${battleState.activePlayerId}>, đến lượt bạn! Chọn kỹ năng cho **${nextActivePokemon.name}**:`,
                            components: nextSkillButtons,
                            flags: MessageFlags.Ephemeral 
                        });
                        battleState.players[battleState.activePlayerId].ephemeralMessageId = nextEphemeralSkillMessage.id; 
                    } catch (e) {
                        console.error(`[PVP_INTERACTION_ERROR] Lỗi gửi tin nhắn kỹ năng ephemeral lượt kế tiếp cho ${battleState.activePlayerId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi gửi tin nhắn kỹ năng ephemeral lượt kế tiếp cho ${battleState.activePlayerId}.`, e);
                    }
                }

            } else if (customId.startsWith('pvp_forfeit_')) {
                // Ghi nhận tương tác ngay lập tức
                await interaction.deferUpdate()
                    .catch(e => {
                        console.error(`[PVP_INTERACTION_ERROR] Không thể deferUpdate cho pvp_forfeit_ ${customId} từ ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi PvP] Không thể deferUpdate cho pvp_forfeit_ ${customId} từ ${userId}.`, e);
                        return; 
                    });

                const [_, __, playerId] = customId.split('_');
                const battleState = activePvpBattles.get(interaction.channel.id);

                if (!battleState || playerId !== userId) {
                    return sendEphemeralReply(interaction, 'Bạn không thể đầu hàng trận đấu này.', 'pvp_forfeit_invalid_turn');
                }
                
                deleteEphemeralMessageSafe(interaction.channel, battleState.players[userId].ephemeralMessageId, 'pvp_forfeit_delete_ephemeral');
                battleState.players[userId].ephemeralMessageId = null; 

                const winnerId = Object.keys(battleState.players).find(id => id !== userId);
                battleState.lastBattleAction = `\n**${interaction.user.username} đã đầu hàng trận đấu!**`; 
                await endPvpBattle(interaction.channel.id, winnerId, client, db, battleState);
            }
        } catch (error) {
            console.error(`[PVP_INTERACTION_ERROR] Lỗi chung khi xử lý tương tác PvP cho ${userId} (${customId}):`, error);
            sendOwnerDM(client, `[Lỗi Tương tác PvP] Lỗi chung khi người dùng ${userId} tương tác với PvP command (CustomId: ${customId}).`, error);
            // Cố gắng phản hồi lỗi cuối cùng
            if (interaction.deferred || interaction.replied) { 
                await interaction.editReply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.', components: [] })
                    .catch(e => {
                        console.error("Lỗi khi chỉnh sửa phản hồi lỗi ephemeral sau lỗi PvP:", e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi khi chỉnh sửa phản hồi lỗi ephemeral sau lỗi PvP cho ${userId}.`, e);
                    });
            } else {
                await interaction.reply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.', flags: MessageFlags.Ephemeral })
                    .catch(e => {
                        console.error("Lỗi khi gửi phản hồi lỗi ephemeral sau lỗi PvP:", e);
                        sendOwnerDM(client, `[Lỗi PvP] Lỗi khi gửi phản hồi lỗi ephemeral sau lỗi PvP cho ${userId}.`, e);
                    });
            }
        }
    }
};

/**
 * Kết thúc trận đấu PvP và dọn dẹp.
 * @param {string} channelId ID kênh.
 * @param {string} winnerId ID người chiến thắng.
 * @param {object} client Discord client.
 * @param {object} db Knex database instance.
 * @param {object} battleState Trạng thái cuối cùng của trận đấu.
 */
async function endPvpBattle(channelId, winnerId, client, db, battleState) {
    const winnerUser = await client.users.fetch(winnerId).catch(e => {
        console.error(`[PVP_END_ERROR] Không thể fetch người thắng ${winnerId}:`, e);
        sendOwnerDM(client, `[Lỗi PvP End] Không thể fetch người thắng ${winnerId}.`, e);
        return { username: `Người dùng ${winnerId}` }; 
    });
    const loserId = Object.keys(battleState.players).find(id => id !== winnerId);
    const loserUser = await client.users.fetch(loserId).catch(e => {
        console.error(`[PVP_END_ERROR] Không thể fetch người thua ${loserId}:`, e);
        sendOwnerDM(client, `[Lỗi PvP End] Không thể fetch người thua ${loserId}.`, e);
        return { username: `Người dùng ${loserId}` }; 
    });

    battleState.lastBattleAction += `\n--- Trận đấu kết thúc! ---`; 
    battleState.lastBattleAction += `\n👑 Người chiến thắng: **${winnerUser.username}**`; 
    battleState.lastBattleAction += `\n💔 Người thua cuộc: **${loserUser.username}**`; 

    for (const playerId in battleState.players) {
        const player = battleState.players[playerId];
        for (const pokemon of player.team) {
            try {
                await db('user_pokemons')
                    .where('id', pokemon.id)
                    .update({ current_hp: pokemon.max_hp }); 
            } catch (e) {
                console.error(`[PVP_END_ERROR] Lỗi cập nhật HP Pokemon ${pokemon.id} của ${playerId}:`, e);
                sendOwnerDM(client, `[Lỗi PvP End] Lỗi cập nhật HP Pokemon ${pokemon.id} của ${playerId}.`, e);
            }
        }
    }

    const finalEmbed = await generatePvpBattleEmbed(battleState, client);
    let battleMessage;
    try {
        battleMessage = await client.channels.cache.get(channelId).messages.fetch(battleState.battleMessageId);
        await editMessageSafe(battleMessage, { embeds: [finalEmbed], components: [] }, 'pvp_end_update_final_embed');
    } catch (e) {
        if (e.code === 10008) { 
            console.warn(`[PVP_WARN] Tin nhắn trận đấu chính đã bị xóa khi kết thúc, không thể cập nhật.`);
        } else {
            console.error(`[PVP_END_ERROR] Lỗi chỉnh sửa tin nhắn trận đấu cuối cùng cho kênh ${channelId}:`, e);
            sendOwnerDM(client, `[Lỗi PvP End] Lỗi chỉnh sửa tin nhắn trận đấu cuối cùng cho kênh ${channelId}.`, e);
        }
    }

    try {
        await client.channels.cache.get(channelId).send(`🎉 Trận đấu PvP giữa **${winnerUser.username}** và **${loserUser.username}** đã kết thúc! **${winnerUser.username}** là người chiến thắng!`);
    } catch (e) {
        console.error(`[PVP_END_ERROR] Lỗi gửi tin nhắn kết thúc trận đấu cho kênh ${channelId}:`, e);
        sendOwnerDM(client, `[Lỗi PvP End] Lỗi gửi tin nhắn kết thúc trận đấu cho kênh ${channelId}.`, e);
    }

    activePvpBattles.delete(channelId);

    deleteEphemeralMessageSafe(client.channels.cache.get(channelId), battleState.players[loserId]?.ephemeralMessageId, 'pvp_end_delete_loser_ephemeral');
}
