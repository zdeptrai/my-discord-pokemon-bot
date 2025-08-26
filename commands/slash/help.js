// commands/slash/help.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const logger = require('../../utils/logger');

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1388067185574023208&permissions=8&scope=bot%20applications.commands';
const SUPPORT_SERVER_URL = 'https://discord.gg/GDBw6jSY2Z';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị thông tin và danh sách các lệnh của bot.'),

    async execute(interaction, client, db) {
        // SỬA CÁC DÒNG NÀY ĐỂ TRUY CẬP VÀO COLLECTION
        const helpCommandId = client.slashCommandIds.get('help') || 'ID_CHUA_CO';
        const giveawayCommandId = client.slashCommandIds.get('giveaway') || 'ID_CHUA_CO';
        const imageCommandId = client.slashCommandIds.get('image') || 'ID_CHUA_CO';
        const askCommandId = client.slashCommandIds.get('ask') || 'ID_CHUA_CO';
        const bxhCommandId = client.slashCommandIds.get('bxh') || 'ID_CHUA_CO';
        const profileCommandId = client.slashCommandIds.get('profile') || 'ID_CHUA_CO';
        const weatherCommandId = client.slashCommandIds.get('weather') || 'ID_CHUA_CO';
        const pingCommandId = client.slashCommandIds.get('ping') || 'ID_CHUA_CO';
        const infoCommandId = client.slashCommandIds.get('info') || 'ID_CHUA_CO';

        const helpEmbed = new EmbedBuilder()
            .setTitle(`📚 Hướng dẫn sử dụng ${client.user.username}`)
            .setDescription(
                `Chào mừng bạn đến với ${client.user.username}, một bot mạnh mẽ để hỗ trợ các hoạt động của bạn trên Discord!\n\n` +
                `**Cách sử dụng lệnh:**\n` +
                `Gõ \`/\`, sau đó chọn một lệnh từ danh sách gợi ý. Điền các thông tin cần thiết và nhấn Enter để thực thi.`
            )
            .addFields(
                {
                    name: '🎮 Các lệnh chính',
                    value:
                        `• </help:${helpCommandId}>: Hiển thị hướng dẫn này.\n` +
                        `• </giveaway:${giveawayCommandId}>: Tạo một giveaway mới.\n` +
                        `• </image:${imageCommandId}> anime [type]: Lấy ảnh anime ngẫu nhiên.\n` +
                        `• </ask:${askCommandId}>: Hỏi một câu hỏi cho bot.\n` +
                        `• </bxh:${bxhCommandId}>: Xem bảng xếp hạng.\n` +
                        `• </profile:${profileCommandId}>: Xem thông tin cá nhân của bạn.\n` +
                        `• </weather:${weatherCommandId}>: Xem thông tin thời tiết.\n`
                    , inline: false
                },
                {
                    name: '💡 Gợi ý',
                    value: 'Để xem chi tiết cách dùng từng lệnh, bạn có thể nhấp vào các lệnh trên hoặc gõ `/<tên_lệnh>` và Discord sẽ hiển thị mô tả đầy đủ.',
                    inline: false
                },
                {
                    name: '❓ Hỗ trợ & Liên hệ',
                    value: 'Nếu bạn có bất kỳ câu hỏi, góp ý hay báo lỗi, hãy tham gia server hỗ trợ của chúng tôi!',
                    inline: false
                }
            )
            .setColor('#7289DA')
            .setFooter({ text: `Bot được phát triển bởi Owner của bạn | Phiên bản 1.0` })
            .setTimestamp();

        const inviteButton = new ButtonBuilder()
            .setLabel('Mời Bot')
            .setStyle(ButtonStyle.Link)
            .setURL(INVITE_URL);

        const supportButton = new ButtonBuilder()
            .setLabel('Server Hỗ trợ')
            .setStyle(ButtonStyle.Link)
            .setURL(SUPPORT_SERVER_URL);

        const actionRow = new ActionRowBuilder()
            .addComponents(inviteButton, supportButton);

        await interaction.editReply({
            embeds: [helpEmbed],
            components: [actionRow],
            flags: 0 
        });

        logger.info(`[HELP_COMMAND]`, `Người dùng ${interaction.user.tag} đã yêu cầu lệnh /help.`);
    },
};