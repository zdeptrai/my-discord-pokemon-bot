// handlers/modalSubmit.js
const { Events, EmbedBuilder, ActivityType, MessageFlags } = require('discord.js'); // <-- THÊM MessageFlags TẠI ĐÂY
const logger = require('../utils/logger');
const ms = require('ms');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client, db) {
        if (!interaction.isModalSubmit() || interaction.customId !== 'giveawayModal') {
            return;
        }

        const durationString = interaction.fields.getTextInputValue('giveawayDuration');
        const winnersString = interaction.fields.getTextInputValue('giveawayWinners');
        const prize = interaction.fields.getTextInputValue('giveawayPrize');
        const description = interaction.fields.getTextInputValue('giveawayDescription');

        let durationMs;
        try {
            durationMs = ms(durationString);
            if (!durationMs || durationMs < 0) {
                throw new Error('Thời gian không hợp lệ hoặc quá ngắn.');
            }
        } catch (error) {
            logger.warn(`[GIVEAWAY_MODAL]`, `Người dùng ${interaction.user.tag} nhập thời gian không hợp lệ: "${durationString}". Chi tiết:`, error.message);
            await interaction.reply({
                content: '🚫 Thời gian giveaway không hợp lệ. Vui lòng sử dụng định dạng như `10m`, `1h`, `3d`.',
                flags: MessageFlags.Ephemeral 
            });
            return;
        }

        let numberOfWinners = 1;
        if (winnersString) {
            numberOfWinners = parseInt(winnersString);
            if (isNaN(numberOfWinners) || numberOfWinners <= 0) {
                logger.warn(`[GIVEAWAY_MODAL]`, `Người dùng ${interaction.user.tag} nhập số người thắng không hợp lệ: "${winnersString}".`);
                await interaction.reply({
                    content: '🚫 Số lượng người thắng không hợp lệ. Vui lòng nhập một số nguyên dương.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        const endTime = Date.now() + durationMs;

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(`🎉 GIVEAWAY: ${prize}`)
            .setDescription(
                `Reaction 🎉 vào tin nhắn này để tham gia!\n\n` +
                `**Thời gian còn lại:** <t:${Math.round(endTime / 1000)}:R>\n` +
                `**Số người thắng:** ${numberOfWinners}\n` +
                `**Người tạo:** ${interaction.user}\n` +
                (description ? `\n${description}` : '')
            )
            .setColor(0xFFD700)
            .setFooter({ text: 'Chúc may mắn!' })
            .setTimestamp(endTime);

        // --- CÁCH XỬ LÝ PHẢN HỒI MODAL ĐỂ TRÁNH CẢNH BÁO fetchReply VÀ ephemeral ---
        // 1. Gửi một phản hồi "đang xử lý" tạm thời cho interaction
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // 2. Gửi tin nhắn giveaway chính thức vào kênh
        const giveawayChannel = interaction.channel;
        const giveawayMessage = await giveawayChannel.send({ embeds: [giveawayEmbed] });

        // 3. Chỉnh sửa phản hồi "đang xử lý" ban đầu để thông báo thành công
        await interaction.editReply({
            content: `🎉 Giveaway cho **"${prize}"** đã được tạo thành công! Xem tại ${giveawayMessage.url}`,
            flags: MessageFlags.Ephemeral
        });

        // Thêm reaction 🎉 vào tin nhắn Giveaway
        await giveawayMessage.react('🎉');

        logger.info(`[GIVEAWAY_MODAL]`, `Giveaway "${prize}" của ${interaction.user.tag} đã được tạo thành công. Tin nhắn ID: ${giveawayMessage.id}`);

        // --- LƯU TRỮ GIVEAWAY VÀO DATABASE ---
        try {
            await db('giveaways').insert({
                message_id: giveawayMessage.id,
                channel_id: giveawayMessage.channel.id,
                guild_id: giveawayMessage.guild.id,
                prize: prize,
                description: description,
                winner_count: numberOfWinners,
                end_time: new Date(endTime),
                creator_id: interaction.user.id,
                is_ended: false,
                winners: null
            });
            logger.info(`[DATABASE]`, `Đã lưu giveaway "${giveawayMessage.id}" vào database.`);
        } catch (dbError) {
            logger.error(`[DATABASE_ERROR]`, `Lỗi khi lưu giveaway vào database:`, dbError);
            // Cảnh báo: sendOwnerDM có thể cần `flags: MessageFlags.Ephemeral` nếu là DM
            // Tuy nhiên, vì đây là hàm gửi DM trực tiếp, nó không phải là interaction reply.
            // nên không cần thay đổi.
            sendOwnerDM(client, `[Lỗi Giveaway Database] Không thể lưu giveaway vào database. ID tin nhắn: \`${giveawayMessage.id}\``, dbError);
        }

        // --- HẸN GIỜ KẾT THÚC GIVEAWAY ---
        setTimeout(async () => {
            await handleGiveawayEnd(giveawayMessage.id, client, db);
        }, durationMs);
    },
};

/**
 * Hàm xử lý kết thúc giveaway và chọn người thắng.
 * (Không có thay đổi trong hàm này liên quan đến ephemeral/flags)
 */
async function handleGiveawayEnd(messageId, client, db) {
    logger.info(`[GIVEAWAY_END]`, `Bắt đầu xử lý kết thúc giveaway cho tin nhắn ID: ${messageId}`);

    try {
        const giveawayData = await db('giveaways')
            .where({ message_id: messageId, is_ended: false })
            .first();

        if (!giveawayData) {
            logger.warn(`[GIVEAWAY_END_WARN]`, `Không tìm thấy giveaway đang hoạt động với ID tin nhắn: ${messageId} hoặc nó đã kết thúc.`);
            return;
        }

        const { channel_id, prize, winner_count, creator_id, guild_id } = giveawayData;

        const guild = await client.guilds.fetch(guild_id).catch(err => {
            logger.error(`[GIVEAWAY_END_ERROR]`, `Không thể tìm thấy guild ${guild_id} khi kết thúc giveaway:`, err);
            return null;
        });
        if (!guild) return;

        const channel = await guild.channels.fetch(channel_id).catch(err => {
            logger.error(`[GIVEAWAY_END_ERROR]`, `Không thể tìm thấy kênh ${channel_id} khi kết thúc giveaway:`, err);
            return null;
        });
        if (!channel || !channel.isTextBased()) {
            logger.warn(`[GIVEAWAY_END_WARN]`, `Kênh ${channel_id} không phải kênh văn bản hoặc không tồn tại.`);
            return;
        }

        const giveawayMessage = await channel.messages.fetch(messageId).catch(err => {
            logger.error(`[GIVEAWAY_END_ERROR]`, `Không thể tìm thấy tin nhắn giveaway ${messageId} trong kênh ${channel_id}:`, err);
            return null;
        });

        if (!giveawayMessage) {
            await db('giveaways').where({ message_id: messageId }).update({ is_ended: true });
            logger.warn(`[GIVEAWAY_END_WARN]`, `Tin nhắn giveaway ${messageId} đã bị xóa. Đánh dấu đã kết thúc trong DB.`);
            return;
        }

        const reaction = giveawayMessage.reactions.cache.get('🎉');
        if (!reaction) {
            logger.warn(`[GIVEAWAY_END_WARN]`, `Không có reaction 🎉 trên tin nhắn giveaway ${messageId}.`);
            await giveawayMessage.reply({ content: '🎉 Giveaway kết thúc! Không có người tham gia nào.', allowedMentions: { repliedUser: false }});
            await db('giveaways').where({ message_id: messageId }).update({ is_ended: true });
            return;
        }

        const users = await reaction.users.fetch();
        const participants = users.filter(user => !user.bot);

        if (participants.size === 0) {
            logger.info(`[GIVEAWAY_END]`, `Không có người tham gia hợp lệ cho giveaway ${messageId}.`);
            await giveawayMessage.reply({ content: '🎉 Giveaway kết thúc! Không có người tham gia hợp lệ nào.', allowedMentions: { repliedUser: false }});
            await db('giveaways').where({ message_id: messageId }).update({ is_ended: true });
            return;
        }

        const shuffledParticipants = Array.from(participants.values()).sort(() => 0.5 - Math.random());
        const actualWinners = shuffledParticipants.slice(0, Math.min(winner_count, participants.size));

        const winnerMentions = actualWinners.map(winner => `<@${winner.id}>`).join(', ');

        if (actualWinners.length > 0) {
            const winnerEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY KẾT THÚC! 🎉')
                .setDescription(
                    `Chúc mừng ${winnerMentions} đã thắng **${prize}**!\n\n` +
                    `Người tạo giveaway: <@${creator_id}>`
                )
                .setColor(0x00FF00)
                .setTimestamp();
            
            await channel.send({ embeds: [winnerEmbed] });
            logger.info(`[GIVEAWAY_END]`, `Đã thông báo người thắng cho giveaway ${messageId}: ${winnerMentions}`);
        } else {
            await channel.send({ content: `🎉 Giveaway cho **${prize}** kết thúc! Không có người tham gia hợp lệ.` });
            logger.warn(`[GIVEAWAY_END_WARN]`, `Không có người thắng hợp lệ được chọn cho giveaway ${messageId}.`);
        }

        await db('giveaways').where({ message_id: messageId }).update({
            is_ended: true,
            winners: JSON.stringify(actualWinners.map(w => w.id))
        });
        logger.info(`[DATABASE]`, `Đã cập nhật trạng thái kết thúc và người thắng cho giveaway ${messageId} trong database.`);

        await giveawayMessage.reactions.removeAll().catch(error => {
            logger.warn(`[GIVEAWAY_END_WARN]`, `Không thể xóa reaction của tin nhắn giveaway ${messageId}:`, error);
        });

    } catch (error) {
        logger.error(`[GIVEAWAY_END_ERROR]`, `Lỗi nghiêm trọng khi kết thúc giveaway ${messageId}:`, error);
        sendOwnerDM(client, `[Lỗi Giveaway End] Bot gặp lỗi khi kết thúc giveaway ID \`${messageId}\`:\n\`\`\`${error.message}\`\`\``, error);
    }
}