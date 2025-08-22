// handlers/interactionCreate.js
const { Events, Collection, MessageFlags } = require('discord.js');
const { sendOwnerDM, logErrorToFile } = require('../utils/errors/errorReporter');
const starterSelectionModule = require('../interactions/handleStarterSelection');
const pvpCommandModule = require('../commands/pvp');
const { updateUserRole, getOrCreateUserProfile, getRoleByLevelAndPath } = require('../utils/managers/xpManager');
const logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, db) {
        // --- Xử lý Slash Commands ---
        if (interaction.isChatInputCommand()) {

            await interaction.deferReply().catch(err => {
                logger.error('INTERACTION_CREATE_ERROR', `Lỗi khi deferReply cho lệnh ${interaction.commandName}:`, err);
            });
            if (interaction.replied || interaction.deferred) {
                const command = client.commands.get(interaction.commandName);

                if (!command) {
                    logger.error(`[SLASH_COMMAND_HANDLER_ERROR]`, `Không tìm thấy Slash Command ${interaction.commandName}.`);
                    logErrorToFile('SLASH_COMMAND_NOT_FOUND', interaction.user.tag, `Không tìm thấy Slash Command ${interaction.commandName}.`, null);
                    // Dùng flags thay cho ephemeral
                    return interaction.followUp({ content: 'Lệnh này không tồn tại!', flags: MessageFlags.Ephemeral });
                }

                const { slashCooldowns } = client;
                if (!slashCooldowns.has(command.name)) {
                    slashCooldowns.set(command.name, new Collection());
                }

                const now = Date.now();
                const timestamps = slashCooldowns.get(command.name);
                const cooldownAmount = (command.cooldown || 3) * 1000;

                if (timestamps.has(interaction.user.id)) {
                    const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                    if (now < expirationTime) {
                        const timeLeft = (expirationTime - now) / 1000;
                        // Dùng flags thay cho ephemeral
                        return interaction.followUp({ content: `Vui lòng đợi thêm ${timeLeft.toFixed(1)} giây trước khi sử dụng lệnh \`${command.name}\` một lần nữa.`, flags: MessageFlags.Ephemeral });
                    }
                }

                timestamps.set(interaction.user.id, now);
                setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

                try {
                    await command.execute(interaction, client, db);
                } catch (error) {
                    logger.error(`[SLASH_COMMAND_HANDLER_ERROR]`, `Lỗi khi thực thi Slash Command ${interaction.commandName}:`, error);
                    logErrorToFile('SLASH_COMMAND_EXECUTION_ERROR', interaction.user.tag, `Lỗi khi thực thi Slash Command ${interaction.commandName}`, error);
                    sendOwnerDM(client, `[Lỗi Slash Command] Lỗi khi thực thi Slash Command \`${interaction.commandName}\` bởi ${interaction.user.tag}.`, error);
                    // Dùng flags thay cho ephemeral
                    await interaction.followUp({ content: 'Đã xảy ra lỗi khi thực hiện lệnh này!', flags: MessageFlags.Ephemeral });
                }
            }
        }
        // --- Xử lý Button và Select Menu Interactions ---
        else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            try {
                await interaction.deferUpdate();
            } catch (e) {
                logger.error(`[COMPONENT_INTERACTION_HANDLER_ERROR]`, `Không thể deferUpdate cho CustomID: ${interaction.customId}:`, e);
                logErrorToFile('DEFER_UPDATE_FAILED', interaction.user.tag, `Không thể deferUpdate cho CustomID: ${interaction.customId}`, e);
                return;
            }

            let handled = false;
            try {
                if (interaction.customId === 'path_tien' || interaction.customId === 'path_ma') {
                    const originalAuthorId = interaction.message.reference?.messageId ? (await interaction.channel.messages.fetch(interaction.message.reference.messageId)).author.id : null;

                    if (originalAuthorId === null || interaction.user.id !== originalAuthorId) {
                        // Dùng flags thay cho ephemeral
                        return interaction.followUp({
                            content: 'Bạn không phải là người đã bắt đầu cuộc trò chuyện này. Vui lòng gửi tin nhắn của riêng bạn để nhận nút bấm.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const userId = interaction.user.id;
                    const guildId = interaction.guild.id;
                    const path = interaction.customId.replace('path_', '');

                    await db('user_profiles')
                        .where({ user_id: userId, guild_id: guildId })
                        .update({ path_type: path });

                    const userProfile = await getOrCreateUserProfile(userId, guildId, db);
                    const member = await interaction.guild.members.fetch(userId);
                    if (member) {
                        await updateUserRole(member, userProfile.level, path);
                    }

                    const pathName = path === 'tien' ? 'Tu Tiên' : 'Tu Ma';
                    const roleConfig = getRoleByLevelAndPath(userProfile.level, path);
                    const roleName = roleConfig ? roleConfig.name : 'Vô Danh';

                    await interaction.editReply({
                        content: `**<@${userId}>** đã chọn con đường **${pathName}**! Hành trình của bạn bắt đầu với cảnh giới **${roleName}**.`,
                        embeds: [],
                        components: []
                    });

                    handled = true;
                }
                else if (interaction.customId.startsWith('select_starter_')) {
                    await starterSelectionModule.handleStarterSelection(interaction, db);
                    handled = true;
                }
                else if (interaction.customId.startsWith('mypokemons_') || interaction.customId.startsWith('select_pokemon_from_mypkmn_')) {
                    const mypokemonsCommand = client.commands.get('mypokemons');
                    if (mypokemonsCommand && mypokemonsCommand.handleInteraction) {
                        await mypokemonsCommand.handleInteraction(interaction, client, db);
                        handled = true;
                    }
                }
                else if (interaction.customId.startsWith('catch_ball_')) {
                    const catchCommand = client.commands.get('catch');
                    if (catchCommand && catchCommand.handleCatchInteraction) {
                        await catchCommand.handleCatchInteraction(interaction, client, db);
                        handled = true;
                    }
                }
                else if (interaction.customId.startsWith('pvp_')) {
                    if (pvpCommandModule && pvpCommandModule.handleInteraction) {
                        await pvpCommandModule.handleInteraction(interaction, client, db);
                        handled = true;
                    }
                }
                else if (interaction.customId.startsWith('learnskill_') || interaction.customId.startsWith('forget_skill_')) {
                    const learnskillCommand = client.commands.get('learnskill');
                    if (learnskillCommand && learnskillCommand.handleInteraction) {
                        await learnskillCommand.handleInteraction(interaction, client, db);
                        handled = true;
                    }
                }
                if (!handled) {
                    logger.warn(`[COMPONENT_INTERACTION_HANDLER_WARN]`, `Tương tác '${interaction.customId}' từ ${interaction.user.tag} không được xử lý bởi bất kỳ handler định tuyến nào.`);
                }
            } catch (error) {
                logger.error(`[COMPONENT_INTERACTION_HANDLER_ERROR]`, `Lỗi khi xử lý tương tác component '${interaction.customId}':`, error);
                logErrorToFile('COMPONENT_INTERACTION_EXECUTION_ERROR', interaction.user.tag, `Lỗi khi xử lý tương tác component: ${interaction.customId}`, error);
                sendOwnerDM(client, `[Lỗi Tương tác Component] Lỗi khi xử lý tương tác component \`${interaction.customId}\` bởi ${interaction.user.tag}.`, error);

                if (interaction.deferred) {
                    await interaction.editReply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.', components: [] }).catch(err => logger.error("Lỗi khi chỉnh sửa phản hồi lỗi ephemeral:", err));
                } else {
                    // Dòng này đã được sửa
                    await interaction.reply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn.', flags: MessageFlags.Ephemeral }).catch(err => logger.error("Lỗi khi gửi phản hồi lỗi ngay lập tức:", err));
                }
            }
        }
        else if (interaction.isAutocomplete()) {
            // Xử lý Autocomplete nếu có
        } else if (interaction.isModalSubmit()) {
            // Xử lý Modal Submit nếu có
        }
    },
};