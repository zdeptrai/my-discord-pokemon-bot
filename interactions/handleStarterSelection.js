// interactions/handleStarterSelection.js
const { EmbedBuilder } = require('discord.js');
const { registerUser } = require('../utils/core/userUtils');
const { getPokemonInfo } = require('../utils/core/pokemonData');
const { sendOwnerDM } = require('../utils/errors/errorReporter');
const logger = require('../utils/logger');

/**
 * Xử lý tương tác khi người dùng chọn Pokémon khởi đầu.
 * @param {Interaction} interaction - Đối tượng tương tác từ Discord.
 * @param {object} db - Đối tượng kết nối cơ sở dữ liệu Knex.
 */
async function handleStarterSelection(interaction, db) {
    const userId = interaction.user.id;
    const starterId = interaction.customId.replace('select_starter_', '');

    // ⚠️ QUAN TRỌNG: KHÔNG DÙNG deferUpdate() TẠI ĐÂY NỮA.
    // interactionCreate đã defer sẵn rồi, chúng ta chỉ cần editReply.

    logger.info('[STARTER_SELECTION]', `Người dùng ${interaction.user.tag} (${userId}) đang cố gắng chọn Pokémon khởi đầu với ID: ${starterId}`);

    const pokemonInfo = getPokemonInfo(starterId);

    if (!pokemonInfo) {
        const errorMessage = `Không tìm thấy thông tin cho Pokémon ID: ${starterId} khi người dùng ${interaction.user.tag} (${userId}) chọn.`;
        logger.error('[STARTER_ERROR]', errorMessage);
        await sendOwnerDM(interaction.client, `[Lỗi Starter] ${errorMessage}`, new Error(`Pokémon ID ${starterId} not found.`));
        try {
            await interaction.editReply({
                content: 'Đã xảy ra lỗi khi chọn Pokémon. Vui lòng thử lại.',
                embeds: [],
                components: []
            });
            logger.warn('[STARTER_WARN]', `Đã cố gắng cập nhật tương tác cho lỗi Pokémon không tìm thấy cho ${userId}.`);
        } catch (e) {
            logger.error('[STARTER_ERROR_INTERACTION_UPDATE]', `Không thể cập nhật tương tác sau lỗi Pokémon không tìm thấy cho ${userId}:`, e);
            await sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác sau lỗi Pokémon không tìm thấy cho ${userId}.`, e);
        }
        return;
    }

    try {
        logger.debug('[STARTER_DB_REGISTER]', `Đang đăng ký người dùng ${userId} với Pokémon ${pokemonInfo.name} vào database.`);
        await registerUser(userId, pokemonInfo.name, db);
        logger.info('[STARTER_DB_SUCCESS]', `Người dùng ${interaction.user.tag} (${userId}) đã đăng ký thành công với Pokémon khởi đầu: ${pokemonInfo.name}.`);

        const confirmationEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`🎉 Chúc mừng, ${interaction.user.username}!`)
            .setDescription(`Bạn đã chọn **${pokemonInfo.name}** làm Pokémon khởi đầu của mình!`)
            .setImage(pokemonInfo.imageUrl)
            .setTimestamp()
            .setFooter({ text: 'Hành trình của bạn đã bắt đầu!' });

        try {
            await interaction.editReply({
                embeds: [confirmationEmbed],
                components: []
            });
            logger.info('[STARTER_CONFIRMATION_SENT]', `Đã gửi xác nhận chọn ${pokemonInfo.name} cho người dùng ${userId}.`);
        } catch (e) {
            logger.error('[STARTER_ERROR_INTERACTION_UPDATE]', `Không thể cập nhật tương tác với xác nhận cho ${userId}:`, e);
            await sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác với xác nhận cho ${userId}.`, e);
        }
    } catch (error) {
        logger.error('[STARTER_ERROR_REGISTRATION]', `Lỗi khi xử lý đăng ký Pokémon khởi đầu cho ${interaction.user.tag} (${userId}):`, error);
        await sendOwnerDM(interaction.client, `[Lỗi Starter] Lỗi khi xử lý chọn Pokémon cho ${interaction.user.tag}.`, error);
        try {
            await interaction.editReply({
                content: 'Đã xảy ra lỗi khi đăng ký Pokémon của bạn. Vui lòng thử lại sau.',
                embeds: [],
                components: []
            });
            logger.warn('[STARTER_WARN]', `Đã cố gắng cập nhật tương tác cho lỗi đăng ký chung cho ${userId}.`);
        } catch (e) {
            logger.error('[STARTER_ERROR_INTERACTION_UPDATE]', `Không thể cập nhật tương tác sau lỗi chung cho ${userId}:`, e);
            await sendOwnerDM(interaction.client, `[Lỗi Starter] Không thể cập nhật tương tác sau lỗi chung cho ${userId}.`, e);
        }
    }
}

module.exports = {
    handleStarterSelection
};