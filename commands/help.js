// commands/help.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PREFIX } = require('../config'); // Import PREFIX từ config để hiển thị
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

const COMMANDS_PER_PAGE = 7; // Số lượng lệnh hiển thị trên mỗi trang

module.exports = {
    name: 'help',
    description: 'Hiển thị hướng dẫn và danh sách các lệnh của bot.',
    cooldown: 5, // Thời gian hồi chiêu

    async execute(message, args, client, db) {
        const userId = message.author.id; // Lấy userId để xử lý tương tác nút

        // Định nghĩa tất cả các lệnh và mô tả của chúng
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
            // Thêm các lệnh khác vào đây khi bạn phát triển bot
        ];

        const totalPages = Math.ceil(allCommands.length / COMMANDS_PER_PAGE);
        let currentPage = parseInt(args[0]) || 1;
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const generateEmbed = (page) => {
            const start = (page - 1) * COMMANDS_PER_PAGE;
            const end = start + COMMANDS_PER_PAGE;
            const commandsToShow = allCommands.slice(start, end);

            const embed = new EmbedBuilder()
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
            return embed;
        };

        const generateButtons = (page) => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_prev_${page}`)
                        .setLabel('Trang trước')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId(`help_next_${page}`)
                        .setLabel('Trang sau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages),
                );
        };

        const initialEmbed = generateEmbed(currentPage);
        const initialButtons = generateButtons(currentPage);

        let replyMessage;
        try {
            // Gửi tin nhắn phản hồi chính bằng channel.send
            replyMessage = await message.channel.send({
                embeds: [initialEmbed],
                components: [initialButtons],
                fetchReply: true // Quan trọng để lấy đối tượng tin nhắn đã gửi
            });
        } catch (e) {
            console.error("[HELP_COMMAND_ERROR] Could not send help message:", e);
            sendOwnerDM(client, `[Lỗi Help Command] Lỗi khi gửi tin nhắn help cho ${userId}.`, e);
            return; // Thoát nếu không gửi được tin nhắn
        }

        // Tạo collector để lắng nghe tương tác nút bấm
        const collector = replyMessage.createMessageComponentCollector({
            filter: i => i.user.id === userId && i.customId.startsWith('help_'),
            time: 120000 // Collector sẽ hoạt động trong 120 giây
        });

        collector.on('collect', async interaction => {
            // Đảm bảo chỉ xử lý nếu đó là một button interaction
            if (!interaction.isButton()) return;

            const [_, action, pageNum] = interaction.customId.split('_');
            let newPage = parseInt(pageNum);

            if (action === 'prev') {
                newPage--;
            } else if (action === 'next') {
                newPage++;
            }

            // Đảm bảo trang mới nằm trong giới hạn
            if (newPage < 1) newPage = 1;
            if (newPage > totalPages) newPage = totalPages;

            // Nếu trang không đổi, chỉ cần cập nhật tương tác mà không cần re-render embed/buttons
            if (newPage === currentPage) {
                try {
                    await interaction.update({}); // Gửi một update rỗng để acknowledge tương tác
                } catch (updateError) {
                    if (updateError.code === 10062 || updateError.code === 40060) {
                        console.warn(`[HELP_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                    } else {
                        console.error(`[HELP_COLLECTOR_ERROR] Lỗi khi cập nhật tương tác rỗng cho ${userId}:`, updateError);
                        sendOwnerDM(client, `[Lỗi Help Collector] Lỗi khi cập nhật tương tác rỗng cho ${userId}.`, updateError);
                    }
                }
                return;
            }

            currentPage = newPage; // Cập nhật currentPage

            const newEmbed = generateEmbed(currentPage);
            const newButtons = generateButtons(currentPage);

            try {
                // Cập nhật tin nhắn gốc của bot
                await interaction.update({
                    embeds: [newEmbed],
                    components: [newButtons]
                });
            } catch (updateError) {
                if (updateError.code === 10062 || updateError.code === 40060) {
                    console.warn(`[HELP_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                } else {
                    console.error(`[HELP_COLLECTOR_ERROR] Lỗi khi cập nhật tin nhắn help trong collector cho ${userId}:`, updateError);
                    sendOwnerDM(client, `[Lỗi Help Collector] Lỗi khi cập nhật tin nhắn phân trang cho ${userId}.`, updateError);
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            // Khi collector kết thúc (hết thời gian hoặc dừng thủ công), vô hiệu hóa các nút
            if (replyMessage) { // Đảm bảo replyMessage tồn tại
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`help_prev_${currentPage}`)
                            .setLabel('Trang trước')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`help_next_${currentPage}`)
                            .setLabel('Trang sau')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                    );
                try {
                    // Kiểm tra xem tin nhắn có còn tồn tại và có thể chỉnh sửa không
                    const fetchedMessage = await message.channel.messages.fetch(replyMessage.id).catch(() => null);
                    if (fetchedMessage && fetchedMessage.editable) {
                        await fetchedMessage.edit({ components: [disabledRow] });
                    }
                } catch (e) {
                    // Bắt lỗi Unknown Message (10008) nếu tin nhắn đã bị xóa
                    if (e.code === 10008) {
                        console.warn(`[HELP_COLLECTOR_WARN] Tin nhắn help đã bị xóa, không thể vô hiệu hóa nút.`);
                    } else {
                        console.error("Could not disable help buttons:", e);
                        sendOwnerDM(client, `[Lỗi Help Collector End] Lỗi khi vô hiệu hóa nút cho ${userId}.`, e);
                    }
                }
            }
        });

        // Tin nhắn lệnh của người dùng (message) sẽ được xử lý xóa ở index.js hoặc global.
        // Tin nhắn phản hồi của bot (replyMessage) sẽ tự động bị vô hiệu hóa nút sau 120s bởi collector.
    },
};
