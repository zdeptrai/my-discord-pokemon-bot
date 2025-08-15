const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Tạo một embed và các nút bấm để người dùng chọn con đường tu luyện.
 * @param {string} userId ID của người dùng.
 * @returns {{embed: EmbedBuilder, row: ActionRowBuilder}} Embed và Action Row.
 */
function createPathSelectorEmbed(userId) {
    // Tạo embed thông báo
    const embed = new EmbedBuilder()
        .setColor('#5c6c9a') // Màu sắc trung tính, liên quan đến tu luyện
        .setTitle('⚔️ Chọn Con Đường Tu Luyện ⚔️')
        .setDescription(
            `Chào mừng, <@${userId}>! Để bắt đầu hành trình tu luyện, ` +
            `bạn cần chọn con đường của mình.` +
            `\n\n**Tu Tiên** đại diện cho chính đạo, thiên về tu dưỡng tâm tính, tích lũy công đức.` +
            `\n**Tu Ma** đại diện cho tà đạo, thiên về sức mạnh bạo liệt, bất chấp thủ đoạn.` +
            `\n\n**Lựa chọn của bạn sẽ quyết định cảnh giới tương lai!**`
        )
        .setThumbnail('https://cdn.discordapp.com/emojis/1155981324792672326.webp')
        .setFooter({ text: 'Hãy suy nghĩ kỹ, vì đây là lựa chọn duy nhất của bạn!' })
        .setTimestamp();

    // Tạo các nút bấm
    const selectButtonTien = new ButtonBuilder()
        .setCustomId('path_tien') // ID duy nhất để bot nhận diện
        .setLabel('Chọn Tu Tiên')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨');

    const selectButtonMa = new ButtonBuilder()
        .setCustomId('path_ma') // ID duy nhất để bot nhận diện
        .setLabel('Chọn Tu Ma')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('😈');
        
    const row = new ActionRowBuilder().addComponents(selectButtonTien, selectButtonMa);

    return { embed, row };
}

module.exports = { createPathSelectorEmbed };
