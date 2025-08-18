// handlers/processErrors.js
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 
const logger = require('../utils/logger'); // <-- Thêm dòng này

module.exports = {
    name: 'processErrors', 
    once: false, 

    execute(client, db) { 
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('[FATAL_ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
            sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Unhandled Rejection phát hiện!`, reason instanceof Error ? reason : new Error(String(reason)))
                .catch(dmError => logger.error('[SEND_DM_ERROR]', 'Không thể gửi DM cho chủ bot về unhandledRejection:', dmError)); // Log nếu gửi DM thất bại
        });

        process.on('uncaughtException', (err) => {
            logger.error('[FATAL_ERROR] Uncaught Exception:', err);
            sendOwnerDM(client, `[Lỗi Nghiêm Trọng] Uncaught Exception phát hiện! Bot sẽ tắt.`, err)
                .catch(dmError => logger.error('[SEND_DM_ERROR]', 'Không thể gửi DM cho chủ bot về uncaughtException:', dmError)) // Log nếu gửi DM thất bại
                .finally(() => {
                    logger.info('[PROCESS_EXIT]', 'Đang tắt process do Uncaught Exception.');
                    process.exit(1);
                });
        });
        logger.info('[INFO] Đã thiết lập các trình xử lý lỗi process.');
    },
};