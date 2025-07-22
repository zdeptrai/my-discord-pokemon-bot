// utils/managers/cleanupManager.js
const spawnManager = require('./spawnManager'); // Cập nhật đường dẫn (trong cùng thư mục managers)
const { sendOwnerDM } = require('../errors/errorReporter'); // Cập nhật đường dẫn

/**
 * Đăng ký các trình xử lý sự kiện để dọn dẹp khi bot tắt.
 * @param {object} client Đối tượng Discord client.
 * @param {object} db Đối tượng Knex database instance.
 */
function setupCleanupHandlers(client, db) {
    const cleanup = async () => {
        console.log('[SHUTDOWN] Đang tắt bot...');
        spawnManager.stopSpawnManager();
        if (db) {
            await db.destroy();
            console.log('[SHUTDOWN] Kết nối database đã đóng.');
        }
        client.destroy();
        console.log('[SHUTDOWN] Bot đã tắt sạch sẽ.');
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    process.on('unhandledRejection', (reason, promise) => {
        console.error('[FATAL_ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
        sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Unhandled Rejection phát hiện!`, reason instanceof Error ? reason : new Error(String(reason)));
    });

    process.on('uncaughtException', (err) => {
        console.error('[FATAL_ERROR] Uncaught Exception:', err);
        sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Uncaught Exception phát hiện! Bot sẽ tắt.`, err)
                .finally(() => {
                    process.exit(1);
                });
    });
}

module.exports = { setupCleanupHandlers };
