// commands/help.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { PREFIX } = require('../config');
const { sendOwnerDM } = require('../utils/errors/errorReporter');

const COMMANDS_PER_PAGE = 7;

module.exports = {
    name: 'helps',
    description: 'Hiển thị hướng dẫn và danh sách các lệnh của bot.',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;

        const allCommands = [
            `\`${PREFIX}start\` - Bắt đầu hành trình của bạn và chọn Pokemon khởi đầu.`,
            `\`${PREFIX}mypokemon\` - Xem danh sách và chọn Pokemon chính của bạn.`,
            `\`${PREFIX}profile\` - Kiểm tra số Pokecoin và vật phẩm của bạn.`,
            `\`${PREFIX}battle\` - Dùng để luyện cấp cho Pokemon.`,
            `\`${PREFIX}train\` - Gửi Pokemon đi huấn luyện (Tối đa 24h).`,
            `\`${PREFIX}ctrain\` - Nhận về Pokemon đưa đi huấn luyện.`,
            `\`${PREFIX}vskill\` - Xem danh sách skill của Pokemon.`,
            `\`${PREFIX}lskill\` - Học skill cho Pokemon.`,
            `\`${PREFIX}evolve\` - Tiến hóa Pokemon dạng thường.`,
            `\`${PREFIX}form\` - Tiến hóa Pokemon dạng đặc biệt.`,
            `\`${PREFIX}useitem\` - Tăng chỉ số cho Pokemon.`,
            `\`${PREFIX}shop\` - Xem danh sách vật phẩm có trong cửa hàng.`,
            `\`${PREFIX}buy\` - Mua vật phẩm có trong cửa hàng.`,
            `\`${PREFIX}sell\` - Bán Pokemon cho Bot.`,
            `\`${PREFIX}sellpokemon\` - Đăng bán Pokemon lên thị trường (Tối đa 24h).`,
            `\`${PREFIX}sellitem\` - Đăng bán Item lên thị trường (Tối đa 24h).`,
            `\`${PREFIX}market\` - Xem danh sách vật phẩm trên thị trường.`,
            `\`${PREFIX}buymk\` - Mua vật phẩm trên thị trường.`,
            `\`${PREFIX}cancelmk\` - Rút vật phẩm khỏi thị trường.`,
            `\`${PREFIX}nickname\` - Thay đổi nickname Pokemon.`,
            `\`${PREFIX}boss\` - Đánh boss để nhận những phần thưởng hấp dẫn.`,
            '**Các lệnh cao cấp hơn vui lòng liên hệ admin để kích hoạt.**'
        ];

        const totalPages = Math.ceil(allCommands.length / COMMANDS_PER_PAGE);
        let currentPage = 1;

        const generateEmbed = (page) => {
            const start = (page - 1) * COMMANDS_PER_PAGE;
            const end = start + COMMANDS_PER_PAGE;
            const commandsToShow = allCommands.slice(start, end);

            return new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📚 Hướng Dẫn Sử Dụng Bot')
                .setDescription(
                    'Chào mừng đến với thế giới của những điều không tưởng! Hãy bắt đầu cuộc phiêu lưu Pokemon của bạn.\n\n' +
                    '**Các lệnh tiền tố hiện có:**\n' +
                    commandsToShow.join('\n') + '\n\n' +
                    `Để xem lại hướng dẫn này, hãy dùng lại lệnh \`${PREFIX}help\`.`
                )
                .setFooter({ text: `Trang ${page}/${totalPages} | Powered by Demonking` })
                .setTimestamp();
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_prev`)
                        .setLabel('Trang trước')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId(`help_next`)
                        .setLabel('Trang sau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages),
                );
        };

        let replyMessage;
        try {
            replyMessage = await message.reply({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)],
                fetchReply: true
            });
        } catch (e) {
            console.error("[HELP_COMMAND_ERROR] Could not reply with help message:", e);
            sendOwnerDM(client, `[Lỗi Help Command] Lỗi khi gửi tin nhắn help cho ${userId}.`, e);
            return;
        }

        const collector = replyMessage.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId.startsWith('help_'),
            time: 120000
        });

        collector.on('collect', async interaction => {
            if (!interaction.isButton()) return;
            
            // Xử lý logic cập nhật trang
            if (interaction.customId === 'help_prev' && currentPage > 1) {
                currentPage--;
            } else if (interaction.customId === 'help_next' && currentPage < totalPages) {
                currentPage++;
            } else {
                // Nếu không có thay đổi trang, chỉ cần cập nhật rỗng để tránh lỗi
                // và bỏ qua các bước cập nhật khác.
                try {
                    await interaction.update({});
                } catch (updateError) {
                    console.error(`[HELP_COLLECTOR_ERROR] Lỗi khi cập nhật tương tác rỗng:`, updateError);
                }
                return;
            }

            // Gửi cập nhật sau khi xử lý logic trang
            try {
                await interaction.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            } catch (updateError) {
                console.error(`[HELP_COLLECTOR_ERROR] Lỗi khi cập nhật tin nhắn:`, updateError);
                sendOwnerDM(client, `[Lỗi Help Collector] Lỗi khi cập nhật tin nhắn phân trang cho ${userId}.`, updateError);
            }
        });

        collector.on('end', async (collected, reason) => {
            if (!replyMessage || !replyMessage.editable) return;
            
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_prev_disabled`)
                        .setLabel('Trang trước')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`help_next_disabled`)
                        .setLabel('Trang sau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                );
            try {
                await replyMessage.edit({ components: [disabledRow] }).catch(console.error);
            } catch (e) {
                console.error("Could not disable help buttons:", e);
                sendOwnerDM(client, `[Lỗi Help Collector End] Lỗi khi vô hiệu hóa nút cho ${userId}.`, e);
            }
        });
    },
};