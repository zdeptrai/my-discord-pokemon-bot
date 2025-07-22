// handlers/clientReady.js
const { Events, ActivityType } = require('discord.js');
const spawnManager = require('../utils/managers/spawnManager'); 
const marketplaceCleanup = require('../utils/managers/marketplaceCleanup'); // Import toàn bộ module
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) { 
        console.log(`[BOT_READY] Đã đăng nhập với tên ${client.user.tag}!`);

        client.user.setActivity(client.config.BOT_STATUS_MESSAGE, { type: ActivityType[client.config.BOT_STATUS_TYPE] });
        console.log(`[BOT_STATUS] Đã đặt trạng thái: ${client.config.BOT_STATUS_TYPE} ${client.config.BOT_STATUS_MESSAGE}`);

        try {
            await client.db.raw('SELECT 1'); 
            console.log('[DATABASE] Kết nối database thành công!');
        } catch (err) {
            console.error('[DATABASE_ERROR] Kết nối database thất bại:', err);
            sendOwnerDM(client, `[Lỗi Database] Bot không thể kết nối database!`, err);
            process.exit(1);
        }
        console.log('[INFO] Sẵn sàng nhận lệnh tiền tố và Slash Commands!');

        // Khởi động Spawn Manager
        spawnManager.startSpawnManager(client, client.db); 

        // Khởi chạy và lên lịch dọn dẹp Marketplace
        await marketplaceCleanup.cleanupExpiredListings(client); // Chạy lần đầu ngay khi bot khởi động
        marketplaceCleanup.scheduleCleanup(client); // Lên lịch chạy định kỳ
    },
};
