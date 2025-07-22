// commands/startev.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const eventManager = require('../events/eventManager'); // Import eventManager

module.exports = {
    name: 'startev',
    description: 'Kích hoạt một sự kiện tung xúc xắc trong 15 phút. Người chơi nào roll được 3 số giống nhau sẽ thắng!',
    aliases: ['startevent', 'se'],
    usage: '',
    cooldown: 5, // Cooldown dài hơn để tránh spam sự kiện

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const channelId = message.channel.id;

        // THÊM: Kiểm tra quyền chỉ cho phép chủ bot sử dụng lệnh này
        if (client.config.OWNER_DISCORD_ID && userId !== client.config.OWNER_DISCORD_ID) {
            // ĐÃ SỬA: Dùng message.channel.send() thay vì message.reply() để tránh lỗi Unknown Message
            return message.channel.send({ 
                content: `<@${userId}> Bạn không có quyền để bắt đầu sự kiện này. Chỉ chủ bot mới có thể sử dụng lệnh \`!startev\`.`, 
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send startev permission message:", e));
        }

        try {
            const eventInfo = eventManager.startEvent(channelId);

            const endTime = new Date(eventInfo.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            const eventEmbed = new EmbedBuilder()
                .setColor('#FFD700') // Màu vàng cho sự kiện
                .setTitle('🎉 SỰ KIỆN TUNG XÚC XẮC ĐÃ BẮT ĐẦU! 🎉')
                .setDescription(`Hãy là người đầu tiên roll được 3 số giống nhau để giành chiến thắng!`)
                .addFields(
                    { name: 'Kênh sự kiện', value: `<#${channelId}>`, inline: true },
                    { name: 'Thời gian kết thúc', value: `${eventManager.EVENT_DURATION_MINUTES} phút (Kết thúc lúc: ${endTime})`, inline: true },
                    { name: 'Cách tham gia', value: `Sử dụng lệnh \`${client.config.PREFIX}roll\` trong kênh này.`, inline: false },
                    { name: 'Điều kiện thắng', value: 'Roll được 3 xúc xắc có số giống nhau (`6-6-6`)', inline: false },
                    { name: 'Kết quả Roll gần nhất', value: 'Chưa có ai roll.', inline: false } // Sẽ được cập nhật bởi lệnh !roll
                )
                .setFooter({ text: `Sự kiện được khởi tạo bởi ${message.author.username}` })
                .setTimestamp();

            const eventMessage = await message.channel.send({ embeds: [eventEmbed] });
            eventManager.setEventMessageId(eventMessage.id); // Lưu ID tin nhắn để cập nhật sau

            // Cập nhật thời gian còn lại mỗi phút
            const updateInterval = setInterval(async () => {
                const currentEventState = eventManager.getEventState();
                if (!currentEventState.active || currentEventState.channelId !== channelId) {
                    clearInterval(updateInterval); // Dừng cập nhật nếu sự kiện đã kết thúc hoặc chuyển kênh
                    return;
                }

                const remainingTimeMs = currentEventState.endTime - Date.now();
                if (remainingTimeMs <= 0) {
                    clearInterval(updateInterval);
                    return;
                }

                const remainingMinutes = Math.ceil(remainingTimeMs / (1000 * 60));
                
                // Cập nhật mô tả để hiển thị thời gian còn lại
                const updatedEmbed = EmbedBuilder.from(eventEmbed) // Tạo bản sao của embed gốc
                    .setDescription(`Hãy là người đầu tiên roll được 3 số giống nhau để giành chiến thắng!\nThời gian còn lại: **${remainingMinutes} phút**`);
                
                // Cập nhật trường "Kết quả Roll gần nhất"
                if (currentEventState.lastRoll) {
                    const rollerUser = await client.users.fetch(currentEventState.lastRollerId).catch(() => null);
                    const rollerName = rollerUser ? rollerUser.username : 'Người chơi không xác định';
                    updatedEmbed.spliceFields(4, 1, { // spliceFields(index, deleteCount, newField)
                        name: 'Kết quả Roll gần nhất', 
                        value: `**${rollerName}** đã roll: \`${currentEventState.lastRoll.join('-')}\``, 
                        inline: false 
                    });
                } else {
                     updatedEmbed.spliceFields(4, 1, { 
                        name: 'Kết quả Roll gần nhất', 
                        value: 'Chưa có ai roll.', 
                        inline: false 
                    });
                }

                try {
                    await eventMessage.edit({ embeds: [updatedEmbed] });
                } catch (editError) {
                    console.error(`[STARTEV_ERROR] Lỗi khi cập nhật tin nhắn sự kiện:`, editError);
                    clearInterval(updateInterval); // Dừng cập nhật nếu không thể chỉnh sửa tin nhắn
                }
            }, 60 * 1000); // Cập nhật mỗi phút

        } catch (error) {
            console.error(`[STARTEV_COMMAND_ERROR] Lỗi khi bắt đầu sự kiện:`, error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi bắt đầu sự kiện: ${error.message}`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send startev error message:", e));
        }
    },
};
