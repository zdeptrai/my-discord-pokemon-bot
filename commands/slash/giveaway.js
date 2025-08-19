// commands/slash/giveaway.js
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require('discord.js');
const logger = require('../../utils/logger'); // Import logger

module.exports = {
    // Định nghĩa Slash Command
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Tạo một giveaway mới trên server.'),
    
    // Xử lý khi lệnh Slash được gọi
    async execute(interaction, client, db) { // Đảm bảo db được truyền vào đây
        // Tạo một Modal để thu thập thông tin giveaway
        const modal = new ModalBuilder()
            .setCustomId('giveawayModal') // ID duy nhất cho Modal này
            .setTitle('Tạo Giveaway Mới');

        // Tạo các trường nhập liệu cho Modal
        const durationInput = new TextInputBuilder()
            .setCustomId('giveawayDuration')
            .setLabel('Thời gian Giveaway (ví dụ: 10m, 1h, 3d)')
            .setPlaceholder('Ex: 10m, 1h, 3d')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const winnersInput = new TextInputBuilder()
            .setCustomId('giveawayWinners')
            .setLabel('Số lượng người thắng (mặc định: 1)')
            .setPlaceholder('Ex: 1')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const prizeInput = new TextInputBuilder()
            .setCustomId('giveawayPrize')
            .setLabel('Phần thưởng Giveaway')
            .setPlaceholder('Ex: ...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('giveawayDescription')
            .setLabel('Mô tả thêm (tùy chọn)')
            .setPlaceholder('Thêm chi tiết về giveaway...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

        // Thêm các trường nhập liệu vào Modal
        // Mỗi ActionRowBuilder chỉ có thể chứa tối đa 1 TextInputBuilder
        modal.addComponents(
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(winnersInput),
            new ActionRowBuilder().addComponents(prizeInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        // Hiển thị Modal cho người dùng
        await interaction.showModal(modal);

        logger.info(`[GIVEAWAY_COMMAND]`, `Người dùng ${interaction.user.tag} đã mở modal tạo giveaway.`);
    },
};