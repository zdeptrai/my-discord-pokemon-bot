// utils/errors/errorReporter.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
const logger = require('../logger'); // <-- Thêm dòng này

// Định nghĩa đường dẫn tới file log
const logFilePath = path.join(__dirname, '..', '..', 'bot-errors.log');

/**
 * Ghi thông tin lỗi vào một file log.
 * @param {string} errorType Loại lỗi (ví dụ: 'SLASH_COMMAND_NOT_FOUND').
 * @param {string | null} userTag Tên người dùng gây ra lỗi. Sử dụng null nếu không có.
 * @param {string} errorMessage Thông điệp lỗi.
 * @param {Error|any} [errorObject] Đối tượng lỗi đầy đủ để trích xuất stack trace.
 */
async function logErrorToFile(errorType, userTag, errorMessage, errorObject) {
    const timestamp = new Date().toISOString();
    let logContent = `[${timestamp}] [${errorType}]`;

    if (userTag) {
        logContent += ` bởi ${userTag}`;
    }

    logContent += `\nLỗi: ${errorMessage}`;

    if (errorObject && errorObject.stack) {
        logContent += `\nStack Trace:\n${errorObject.stack}`;
    } else if (errorObject) {
        logContent += `\nChi tiết: ${JSON.stringify(errorObject, null, 2)}`;
    }

    logContent += '\n' + '='.repeat(50) + '\n';

    try {
        await fs.appendFile(logFilePath, logContent, 'utf8');
        // Không log INFO ở đây vì đây là chức năng ghi log, tránh vòng lặp vô hạn nếu logger tự gọi logErrorToFile
    } catch (fileError) {
        logger.error(`[ERROR_REPORTER_ERROR]`, `Không thể ghi log vào file ${logFilePath}:`, fileError); // Thay thế console.error
    }
}

/**
 * Gửi tin nhắn DM chứa thông báo lỗi đến chủ bot.
 * @param {object} client Đối tượng Discord client.
 * @param {string} messageContent Nội dung tin nhắn lỗi.
 * @param {Error|any} [error] Đối tượng lỗi (tùy chọn).
 */
async function sendOwnerDM(client, messageContent, error) {
    const ownerId = client.config.OWNER_DISCORD_ID;
    if (!ownerId) {
        logger.error("[ERROR_REPORTER_ERROR]", "Không tìm thấy OWNER_DISCORD_ID trong config. Không thể gửi DM lỗi."); // Thay thế console.error
        return;
    }

    try {
        const owner = await client.users.fetch(ownerId);
        if (owner) {
            let dmMessage = `**[THÔNG BÁO LỖI BOT]**\n${messageContent}`;
            if (error) {
                // Giới hạn độ dài stack trace để tránh vượt quá giới hạn ký tự của Discord DM
                const stackTrace = error.stack ? error.stack.substring(0, 1500) + (error.stack.length > 1500 ? '\n...' : '') : 'Không có stack trace.';
                dmMessage += `\n\`\`\`javascript\n${stackTrace}\n\`\`\``;
            }
            await owner.send(dmMessage);
            logger.info(`[ERROR_REPORTER]`, `Đã gửi DM lỗi cho chủ bot (${owner.tag}).`); // Thay thế console.log
        } else {
            logger.warn(`[ERROR_REPORTER_WARN]`, `Không tìm thấy người dùng chủ bot với ID: ${ownerId}.`); // Thay thế console.warn
        }
    } catch (dmError) {
        logger.error(`[ERROR_REPORTER_ERROR]`, `Lỗi khi gửi DM lỗi cho chủ bot:`, dmError); // Thay thế console.error
    }
}

module.exports = { sendOwnerDM, logErrorToFile };