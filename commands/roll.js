// commands/roll.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const eventManager = require('../utils/managers/eventManager'); // Import eventManager

module.exports = {
    name: 'roll',
    description: 'Tung 3 xúc xắc để tham gia sự kiện.', // Cập nhật mô tả cho sự kiện
    aliases: ['dice'],
    usage: '',
    cooldown: 3, // Cooldown cho mỗi lần roll

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const channelId = message.channel.id;
        const currentEventState = eventManager.getEventState();
        const userAvatarURL = message.author.displayAvatarURL({ dynamic: true, format: 'png', size: 256 });

        // Kiểm tra xem có sự kiện nào đang hoạt động trong kênh này không
        if (!eventManager.isEventActiveInChannel(channelId)) {
            return message.channel.send({ 
                content: `<@${userId}> Không có sự kiện tung xúc xắc nào đang diễn ra trong kênh này. Sử dụng \`${client.config.PREFIX}startev\` để bắt đầu một sự kiện!`, 
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send roll no event message:", e));
        }

        try {
            // Tạo 3 số ngẫu nhiên từ 1 đến 6
            const roll1 = Math.floor(Math.random() * 6) + 1;
            const roll2 = Math.floor(Math.random() * 6) + 1;
            const roll3 = Math.floor(Math.random() * 6) + 1;
            const rollResult = [roll1, roll2, roll3];
            const total = roll1 + roll2 + roll3;

            // Cập nhật kết quả roll gần nhất vào eventManager
            eventManager.updateLastRoll(userId, rollResult);

            // Tạo embed kết quả roll cho người dùng (sử dụng cấu trúc cũ của bạn)
            const rollEmbed = new EmbedBuilder()
                .setColor('#FFD700') // Màu vàng gold cho may mắn
                .setTitle('🎲 Kết Quả Đổ Xúc Xắc! 🎲')
                .setDescription(`**${message.author.displayName}** đã đổ xúc xắc!`)
                .addFields(
                    { name: '🎲', value: `${roll1}`, inline: true },
                    { name: '🎲', value: `${roll2}`, inline: true },
                    { name: '🎲', value: `${roll3}`, inline: true },
                    { name: 'Tổng Điểm', value: `**${total}**`, inline: false }
                )
                .setThumbnail(userAvatarURL)
                .setAuthor({ 
                    name: message.author.displayName, 
                    iconURL: userAvatarURL 
                })
                .setFooter({ text: 'Chúc bạn may mắn lần sau!' })
                .setTimestamp();

            // ĐÃ SỬA: Kiểm tra điều kiện thắng cụ thể là 6-6-6
            if (roll1 === 6 && roll2 === 6 && roll3 === 6) { 
                // Người chơi đã thắng sự kiện!
                eventManager.endEvent(userId); // Kết thúc sự kiện, gán người thắng
                
                rollEmbed.setDescription(`**${message.author.displayName}** đã đổ xúc xắc và giành chiến thắng!`);
                rollEmbed.addFields({ name: '🎉 CHÚC MỪNG!', value: 'Bạn đã roll được 3 số `6` và giành chiến thắng sự kiện!', inline: false }); // Cập nhật tin nhắn thắng
                rollEmbed.setColor('#00FF00'); // Màu xanh lá cây cho người thắng
                rollEmbed.setFooter({ text: `Sự kiện kết thúc vào ${new Date().toLocaleTimeString('vi-VN')}` });

                // Cập nhật tin nhắn sự kiện chính
                const eventMessageId = currentEventState.eventMessageId;
                if (eventMessageId) {
                    try {
                        const eventMessage = await message.channel.messages.fetch(eventMessageId);
                        const winnerUser = await client.users.fetch(userId);
                        const finalEventEmbed = new EmbedBuilder()
                            .setColor('#00FF00') // Màu xanh lá cây cho người thắng
                            .setTitle('🏆 SỰ KIỆN KẾT THÚC! NGƯỜI CHIẾN THẮNG! 🏆')
                            .setDescription(`Chúc mừng <@${userId}> đã là người đầu tiên roll được \`${rollResult.join(' - ')}\` và giành chiến thắng sự kiện!`)
                            .addFields(
                                { name: 'Kết quả thắng', value: `\`${rollResult.join(' - ')}\``, inline: true },
                                { name: 'Người chiến thắng', value: `<@${userId}> (${winnerUser.username})`, inline: true },
                                { name: 'Phần thưởng', value: 'Phần thưởng sẽ được trao sau!', inline: false } // TODO: Thêm logic trao thưởng
                            )
                            .setFooter({ text: `Sự kiện kết thúc vào ${new Date().toLocaleTimeString('vi-VN')}` })
                            .setTimestamp();
                        await eventMessage.edit({ embeds: [finalEventEmbed], components: [] }); // Xóa nút nếu có
                    } catch (editError) {
                        console.error(`[ROLL_COMMAND_ERROR] Lỗi khi cập nhật tin nhắn sự kiện (người thắng):`, editError);
                    }
                }
                // Gửi tin nhắn công khai thông báo người thắng
                await message.channel.send(`🎉🎉🎉 CHÚC MỪNG <@${userId}> ĐÃ GIÀNH CHIẾN THẮNG SỰ KIỆN TUNG XÚC XẮC! 🎉🎉🎉`);

            } else {
                // Cập nhật tin nhắn sự kiện chính với kết quả roll mới nhất (nếu không thắng)
                const eventMessageId = currentEventState.eventMessageId;
                if (eventMessageId) {
                    try {
                        const eventMessage = await message.channel.messages.fetch(eventMessageId);
                        const originalEventEmbed = eventMessage.embeds[0]; 
                        if (originalEventEmbed) {
                            const updatedEventEmbed = EmbedBuilder.from(originalEventEmbed)
                                .spliceFields(4, 1, { 
                                    name: 'Kết quả Roll gần nhất', 
                                    value: `**${message.author.username}** đã roll: \`${rollResult.join('-')}\``, 
                                    inline: false 
                                });
                            await eventMessage.edit({ embeds: [updatedEventEmbed] });
                        }
                    } catch (editError) {
                        console.error(`[ROLL_COMMAND_ERROR] Lỗi khi cập nhật tin nhắn sự kiện (roll):`, editError);
                    }
                }
            }

            // Gửi kết quả roll cho người dùng (ephemeral)
            await message.channel.send({ 
                content: `<@${userId}>`, 
                embeds: [rollEmbed], 
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send roll result message:", e));

        } catch (error) {
            console.error('[ROLL_COMMAND_ERROR] Lỗi khi thực hiện lệnh roll:', error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi đổ xúc xắc. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send generic roll error message:", e));
        }
    },
};
