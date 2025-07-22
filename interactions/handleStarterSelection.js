// interactions/handleStarterSelection.js
const { EmbedBuilder } = require('discord.js');
const { registerUser } = require('../utils/core/userUtils'); // ĐÃ SỬA ĐƯỜNG DẪN
const { getPokemonInfo } = require('../utils/core/pokemonData'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

/**
 * Xử lý tương tác khi người dùng chọn Pokémon khởi đầu.
 * @param {Interaction} interaction - Đối tượng tương tác từ Discord.
 * @param {object} db - Đối tượng kết nối cơ sở dữ liệu Knex.
 */
async function handleStarterSelection(interaction, db) { 
    const userId = interaction.user.id;
    const starterId = interaction.customId.replace('select_starter_', '');

    const pokemonInfo = getPokemonInfo(starterId);

    if (!pokemonInfo) {
        console.error(`[STARTER_ERROR] Không tìm thấy thông tin cho Pokémon ID: ${starterId} khi người dùng ${userId} chọn.`);
        sendOwnerDM(interaction.client, `[Lỗi Starter] Không tìm thấy thông tin Pokémon ID: ${starterId} khi ${interaction.user.tag} chọn.`, new Error(`Pokémon ID ${starterId} not found.`));
        try {
            await interaction.update({
                content: 'Đã xảy ra lỗi khi chọn Pokémon. Vui lòng thử lại.',
                embeds: [],
                components: []
            });
        } catch (e) {
            console.error("Could not update interaction for unknown pokemon:", e);
            sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác sau lỗi Pokémon không tìm thấy cho ${userId}.`, e);
        }
        return;
    }

    try {
        // Đăng ký người dùng và Pokémon khởi đầu vào database
        await registerUser(userId, pokemonInfo.name, db); 

        // Gửi tin nhắn xác nhận với tên và hình ảnh Pokémon
        const confirmationEmbed = new EmbedBuilder()
            .setColor(0x00FF00) 
            .setTitle(`🎉 Chúc mừng, ${interaction.user.username}!`)
            .setDescription(`Bạn đã chọn **${pokemonInfo.name}** làm Pokémon khởi đầu của mình!`)
            .setImage(pokemonInfo.imageUrl) 
            .setTimestamp()
            .setFooter({ text: 'Hành trình của bạn đã bắt đầu!' });

        // Cập nhật tin nhắn gốc (chọn Pokémon) thành tin nhắn xác nhận
        try {
            await interaction.update({
                embeds: [confirmationEmbed],
                components: [] // Xóa các nút bấm sau khi chọn
            });
        } catch (e) {
            console.error("Could not update interaction with confirmation:", e);
            sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác với xác nhận cho ${userId}.`, e);
        }

        console.log(`[START] Người dùng ${interaction.user.tag} đã chọn ${pokemonInfo.name} làm Pokémon khởi đầu.`);

    } catch (error) {
        console.error(`[STARTER_ERROR] Lỗi khi xử lý chọn Pokémon cho ${interaction.user.tag}:`, error);
        sendOwnerDM(interaction.client, `[Lỗi Starter] Lỗi khi xử lý chọn Pokémon cho ${interaction.user.tag}.`, error);
        try {
            await interaction.update({
                content: 'Đã xảy ra lỗi khi đăng ký Pokémon của bạn. Vui lòng thử lại sau.',
                embeds: [],
                components: []
            });
        } catch (e) {
            console.error("Could not update interaction for error:", e);
            sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác sau lỗi chung cho ${userId}.`, e);
        }
    }
}

module.exports = {
    handleStarterSelection
};
