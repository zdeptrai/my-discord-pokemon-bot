// commands/status.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
// Đã bỏ import spawnManager và marketplaceCleanup vì không còn sử dụng trong lệnh này

module.exports = {
    name: 'status',
    description: 'Hiển thị trạng thái hiện tại của bot và tài nguyên.',
    aliases: ['stats', 'botinfo', 'health'],
    usage: '',
    cooldown: 10,

    async execute(message, args, client, db) {
        const userId = message.author.id;

        // --- Thông tin Bot ---
        const uptime = process.uptime(); // Thời gian hoạt động của tiến trình Node.js (giây)
        const ping = client.ws.ping; // Ping đến Discord API (ms)
        const memoryUsage = process.memoryUsage(); // Sử dụng bộ nhớ (bytes)

        const guildCount = client.guilds.cache.size;
        const channelCount = client.channels.cache.size;
        const userCount = client.users.cache.size; // Lưu ý: chỉ những người dùng trong cache

        // --- Chuyển đổi uptime sang định dạng dễ đọc ---
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days} ngày, ${hours} giờ, ${minutes} phút, ${seconds} giây`;

        // --- Chuyển đổi bộ nhớ sang MB ---
        const rssMem = (memoryUsage.rss / 1024 / 1024).toFixed(2); // Resident Set Size - tổng bộ nhớ được cấp phát cho tiến trình
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2); // Heap Used - bộ nhớ mà Node.js đang sử dụng

        // --- Kiểm tra trạng thái Database ---
        let dbStatus = 'Không xác định';
        try {
            await db.raw('SELECT 1'); // Thử một truy vấn đơn giản
            dbStatus = '✅ Đã kết nối';
        } catch (error) {
            dbStatus = `❌ Lỗi kết nối: ${error.message.substring(0, 50)}...`;
        }

        // --- Tạo Embed ---
        const statusEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Trạng Thái Hoạt Động Của Bot 📊')
            .setDescription('Thông tin tổng quan về hiệu suất và kết nối của bot.')
            .addFields(
                { name: 'Thời gian hoạt động', value: `\`${uptimeString}\``, inline: false },
                { name: 'Ping Discord API', value: `\`${ping}ms\``, inline: true },
                { name: 'Sử dụng RAM', value: `\`${heapUsed} MB (Heap) / ${rssMem} MB (Tổng)\``, inline: true },
                { name: 'Số lượng Guild', value: `\`${guildCount}\``, inline: true },
                { name: 'Số lượng Kênh', value: `\`${channelCount}\``, inline: true },
                { name: 'Số lượng Người dùng', value: `\`${userCount}\``, inline: true },
                { name: 'Trạng thái Database', value: `\`${dbStatus}\``, inline: false }
                // Đã bỏ các trường 'Quản lý Spawn' và 'Dọn dẹp Marketplace'
            )
            .setFooter({ text: `Yêu cầu bởi ${message.author.username}` })
            .setTimestamp();

        await message.channel.send({ embeds: [statusEmbed] }).catch(e => console.error("Could not send status message:", e));
    },
};
