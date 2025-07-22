// handlers/interactionCreate.js
const { Events, Collection, MessageFlags } = require('discord.js');
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 
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
            // Danh sách các customId mà handlers/interactionCreate.js nên BỎ QUA việc deferUpdate
            // vì các lệnh tương ứng (viewskill, market, help, shop, starter selection, pvp, profile) sẽ tự xử lý defer/update thông qua Collector của chúng.
            const skipDeferCustomIdPrefixes = [
                'prev_page', 
                'next_page', 
                'close_skill_view', 
                'market_', 
                'help_', 
                'shop_', 
                'select_starter_', 
                'pvp_', 
                'profile_', // THÊM TIỀN TỐ PROFILE VÀO ĐÂY
            ];

            // Kiểm tra xem customId có bắt đầu bằng bất kỳ tiền tố nào cần bỏ qua defer không
            const shouldSkipDefer = skipDeferCustomIdPrefixes.some(prefix => interaction.customId.startsWith(prefix));

            // Chỉ deferUpdate nếu customId KHÔNG nằm trong danh sách bỏ qua
            if (!shouldSkipDefer) {
                try {
                    await interaction.deferUpdate();
                } catch (e) {
                    console.error(`[LỖI_DEFER] Không thể deferUpdate cho CustomID: ${interaction.customId}:`, e);
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
                    } else {
                        console.warn(`[WARNING] Lệnh mypokemons hoặc handleInteraction của nó không tìm thấy cho CustomID: ${interaction.customId}`);
                    }
                } 
                else if (interaction.customId.startsWith('catch_ball_')) { 
                    const catchCommand = client.commands.get('catch'); 
                    if (catchCommand && catchCommand.handleCatchInteraction) { 
                        await catchCommand.handleCatchInteraction(interaction, client, db);
                        handled = true;
                    } else {
                        console.warn(`[WARNING] Lệnh catch hoặc handleCatchInteraction của nó không tìm thấy cho CustomID: ${interaction.customId}`);
                    }
                }
                else if (interaction.customId.startsWith('pvp_')) { 
                    if (pvpCommandModule && pvpCommandModule.handleInteraction) { 
                        await pvpCommandModule.handleInteraction(interaction, client, db);
                        handled = true;
                    } else {
                        console.warn(`[WARNING] Lệnh pvp hoặc handleInteraction của nó không tìm thấy cho CustomID: ${interaction.customId}`);
                    }
                }
                // KHÔNG CÓ LOGIC ĐỊNH TUYẾN LẠI CHO VIEWSKILL, MARKET, HELP, SHOP HOẶC PROFILE Ở ĐÂY NỮA
                // Vì Collector của chúng sẽ tự xử lý các tương tác của chúng.

                if (!handled) {
                    console.warn(`[INTERACTION_WARNING] Tương tác '${interaction.customId}' từ ${interaction.user.tag} không được xử lý bởi bất kỳ handler định tuyến nào.`);
                }

            } catch (error) {
                console.error(`[COMPONENT_INTERACTION_ERROR] Lỗi khi xử lý tương tác component '${interaction.customId}':`, error);
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
