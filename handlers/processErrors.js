// handlers/processErrors.js
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Cập nhật đường dẫn

module.exports = {
    name: 'processErrors', 
    once: false, 

    execute(client, db) { 
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
        console.log('[INFO] Đã thiết lập các trình xử lý lỗi process.');
    },
};
