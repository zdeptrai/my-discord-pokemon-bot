// utils/managers/cleanupManager.js
const spawnManager = require('./spawnManager'); 
const { sendOwnerDM } = require('../errors/errorReporter'); 
const logger = require('../logger'); // <-- Thêm dòng này

/**
 * Đăng ký các trình xử lý sự kiện để dọn dẹp khi bot tắt.
 * @param {object} client Đối tượng Discord client.
 * @param {object} db Đối tượng Knex database instance.
 */
function setupCleanupHandlers(client, db) {
    const cleanup = async () => {
        logger.info('[BOT_SHUTDOWN]', 'Đang tắt bot...'); // Thay thế console.log
        spawnManager.stopSpawnManager();
        if (db) {
            await db.destroy();
            logger.info('[DB_CONNECTION]', 'Kết nối database đã đóng.'); // Thay thế console.log
        }
        client.destroy();
        logger.info('[BOT_SHUTDOWN]', 'Bot đã tắt sạch sẽ.'); // Thay thế console.log
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    process.on('unhandledRejection', (reason, promise) => {
        logger.fatal('[FATAL_ERROR]', 'Unhandled Rejection at:', promise, 'reason:', reason); // Thay thế console.error bằng logger.fatal
        sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Unhandled Rejection phát hiện!`, reason instanceof Error ? reason : new Error(String(reason)));
    });

    process.on('uncaughtException', (err) => {
        logger.fatal('[FATAL_ERROR]', 'Uncaught Exception:', err); // Thay thế console.error bằng logger.fatal
        sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Uncaught Exception phát hiện! Bot sẽ tắt.`, err)
            .finally(() => {
                process.exit(1);
            });
    });
}

module.exports = { setupCleanupHandlers };