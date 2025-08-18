// handlers/clientReady.js
const { Events, ActivityType } = require('discord.js');
const spawnManager = require('../utils/managers/spawnManager'); 
const marketplaceCleanup = require('../utils/managers/marketplaceCleanup'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 
const logger = require('../utils/logger'); // <-- Thêm dòng này

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) { 
        logger.info('[BOT_READY]', `Đã đăng nhập với tên ${client.user.tag}!`);

        client.user.setActivity(client.config.BOT_STATUS_MESSAGE, { type: ActivityType[client.config.BOT_STATUS_TYPE] });
        logger.info('[BOT_STATUS]', `Đã đặt trạng thái: ${client.config.BOT_STATUS_TYPE} ${client.config.BOT_STATUS_MESSAGE}`);

        try {
            await client.db.raw('SELECT 1'); 
            logger.info('[DATABASE_CONNECT]', 'Kết nối database thành công!');
        } catch (err) {
            logger.error('[DATABASE_ERROR]', 'Kết nối database thất bại:', err);
            await sendOwnerDM(client, `[Lỗi Database] Bot không thể kết nối database!`, err)
                .catch(dmError => logger.error('[SEND_DM_ERROR]', 'Không thể gửi DM cho chủ bot về lỗi database:', dmError));
            process.exit(1);
        }
        logger.info('[BOT_STATUS]', 'Sẵn sàng nhận lệnh tiền tố và Slash Commands!');

        // Khởi động Spawn Manager
        logger.info('[SPAWN_MANAGER]', 'Khởi động Spawn Manager...');
        spawnManager.startSpawnManager(client, client.db); 

        // Khởi chạy và lên lịch dọn dẹp Marketplace
        logger.info('[MARKETPLACE_CLEANUP]', 'Thực hiện dọn dẹp Marketplace lần đầu và lên lịch dọn dẹp định kỳ.');
        await marketplaceCleanup.cleanupExpiredListings(client)
            .catch(err => logger.error('[MARKETPLACE_CLEANUP_ERROR]', 'Lỗi khi dọn dẹp Marketplace lần đầu:', err));
        marketplaceCleanup.scheduleCleanup(client); 
    },
};