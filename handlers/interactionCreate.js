// handlers/interactionCreate.js
const { Events, Collection, MessageFlags } = require('discord.js');
const { sendOwnerDM, logErrorToFile } = require('../utils/errors/errorReporter'); // Cập nhật import
const starterSelectionModule = require('../interactions/handleStarterSelection'); 
const pvpCommandModule = require('../commands/pvp'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, db) { 
        // --- Xử lý Slash Commands ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`[ERROR] Không tìm thấy Slash Command ${interaction.commandName}.`);
                // Lỗi ít nghiêm trọng: ghi log
                logErrorToFile('SLASH_COMMAND_NOT_FOUND', interaction.user.tag, `Không tìm thấy Slash Command ${interaction.commandName}.`, null);
                return;
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
                    return interaction.reply({ content: `Vui lòng đợi thêm ${timeLeft.toFixed(1)} giây trước khi sử dụng lệnh \`${command.name}\` một lần nữa.`, flags: MessageFlags.Ephemeral });
                }
            }

            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            try {
                await command.execute(interaction, client, db); 
            } catch (error) {
                console.error(`[SLASH_COMMAND_ERROR] Lỗi khi thực thi Slash Command ${interaction.commandName}:`, error);
                
                // Lỗi nghiêm trọng: ghi log VÀ gửi DM
                logErrorToFile('SLASH_COMMAND_EXECUTION_ERROR', interaction.user.tag, `Lỗi khi thực thi Slash Command ${interaction.commandName}`, error);
                sendOwnerDM(client, `[Lỗi Slash Command] Lỗi khi thực thi Slash Command \`${interaction.commandName}\` bởi ${interaction.user.tag}.`, error);
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Đã xảy ra lỗi khi thực hiện lệnh này!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Đã xảy ra lỗi khi thực hiện lệnh này!', flags: MessageFlags.Ephemeral });
                }
            }
        }
        // --- Xử lý Button và Select Menu Interactions ---
        else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const skipDeferCustomIdPrefixes = [
                'prev_page', 'next_page', 'close_skill_view', 'market_', 'help_', 
                'shop_', 'select_starter_', 'pvp_', 'profile_', 'learnskill_', 'forget_skill_', 
            ];
            const shouldSkipDefer = skipDeferCustomIdPrefixes.some(prefix => interaction.customId.startsWith(prefix));

            if (!shouldSkipDefer) {
                try {
                    await interaction.deferUpdate();
                } catch (e) {
                    console.error(`[LỖI_DEFER] Không thể deferUpdate cho CustomID: ${interaction.customId}:`, e);
                    // Lỗi ít nghiêm trọng: ghi log
                    logErrorToFile('DEFER_UPDATE_FAILED', interaction.user.tag, `Không thể deferUpdate cho CustomID: ${interaction.customId}`, e);
                    
                    if (!interaction.replied && !interaction.deferred) { 
                        await interaction.reply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn (tương tác đã hết hạn hoặc đã được xử lý).', flags: MessageFlags.Ephemeral }).catch(err => console.error("Lỗi khi gửi phản hồi lỗi ngay lập tức sau khi deferUpdate thất bại:", err));
                    }
                    return; 
                }
            }

            let handled = false;

            try {
                if (interaction.customId.startsWith('select_starter_')) {
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
                    console.warn(`[INTERACTION_WARNING] Tương tác '${interaction.customId}' từ ${interaction.user.tag} không được xử lý bởi bất kỳ handler định tuyến nào.`);
                }
            } catch (error) {
                console.error(`[COMPONENT_INTERACTION_ERROR] Lỗi khi xử lý tương tác component '${interaction.customId}':`, error);
                
                // Lỗi nghiêm trọng: ghi log VÀ gửi DM
                logErrorToFile('COMPONENT_INTERACTION_EXECUTION_ERROR', interaction.user.tag, `Lỗi khi xử lý tương tác component: ${interaction.customId}`, error);
                sendOwnerDM(client, `[Lỗi Tương tác Component] Lỗi khi xử lý tương tác component \`${interaction.customId}\` bởi ${interaction.user.tag}.`, error);
                
                if (interaction.deferred || interaction.replied) { 
                    await interaction.editReply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.', components: [] }).catch(err => console.error("Lỗi khi chỉnh sửa phản hồi lỗi ephemeral:", err));
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
