// events/messageResponses.js

module.exports = {
    async handleMessageResponse(message, client) {
        // Luôn bỏ qua tin nhắn từ bot hoặc từ webhook để tránh lặp vô hạn
        if (message.author.bot || message.webhookId) return false;

        // Lấy ID của bot (để kiểm tra xem có ai tag bot không)
        const botId = client.user.id;
        // Lấy tên hiển thị của người gửi tin nhắn trong server (nickname)
        // message.member sẽ có sẵn khi tin nhắn đến từ một Guild (server)
        const senderDisplayName = message.member ? message.member.displayName : message.author.displayName;

        // Tên của chủ bot từ cấu hình (vẫn cần để bot phản hồi khi ai đó gọi tên chủ bot)
        const ownerName = client.config.OWNER_DISCORD_NAME; 
        const ownerId = client.config.OWNER_DISCORD_ID; // Có thể dùng để loại trừ phản hồi chính mình nếu chủ bot là người gửi

        // Các từ khóa khác mà bạn muốn bot phản hồi
        const keywords = ['hey bot', 'bot', 'z']; // THÊM/SỬA CÁC TỪ KHÓA BẠN MUỐN

        // Chuyển nội dung tin nhắn về chữ thường để so sánh không phân biệt hoa thường
        const content = message.content.toLowerCase();

        // 1. Kiểm tra nếu bot bị tag trực tiếp (@TênBot)
        if (message.mentions.users.has(botId)) {
            const responses = [
                `Dạ, **${senderDisplayName}** gọi gì đấy?`,
                `Tôi đây, **${senderDisplayName}**!`,
                `Có tôi đây, **${senderDisplayName}**. Bạn cần gì nào?`,
                `Sao vậy, **${senderDisplayName}**? Tôi nghe đây.`,
                `Hmm? Có ai đó nhắc tới tôi hả?`
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            await message.reply(randomResponse);
            return true; // Báo hiệu đã xử lý tin nhắn
        }

        // 2. Kiểm tra nếu tin nhắn chứa tên của chủ bot
        // Chỉ phản hồi nếu người gửi không phải là chủ bot để tránh bot tự phản hồi chính mình
        if (ownerName && message.author.id !== ownerId) {
            const ownerNameLower = ownerName.toLowerCase();
            if (content.includes(ownerNameLower)) {
                const responses = [
                    `**${senderDisplayName}** đang nói về chủ nhân của tôi đó hả?`,
                    `À, **${senderDisplayName}** đang nhắc đến ${ownerName} hả?`,
                    `Tôi thay mặt ${ownerName} đây, có chuyện gì không **${senderDisplayName}**?`,
                    `${ownerName} đang bận, có gì để tôi nhắn lại nhé, **${senderDisplayName}**!`
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                await message.reply(randomResponse);
                return true;
            }
        }

        // 3. Kiểm tra nếu tin nhắn chứa các từ khóa chỉ định
        for (const keyword of keywords) {
            if (content.includes(keyword.toLowerCase())) {
                const responses = [
                    `Tôi có thể giúp gì cho **${senderDisplayName}** không?`,
                    `**${senderDisplayName}** vừa nhắc đến tôi à?`,
                    `Vâng, tôi nghe đây, **${senderDisplayName}**!`,
                    `Chào **${senderDisplayName}**! Bạn cần gì?`
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                await message.reply(randomResponse);
                return true;
            }
        }

        return false; // Không có phản hồi nào được kích hoạt
    },
};