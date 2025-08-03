// utils/errors/errorReporter.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

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
    } catch (fileError) {
        console.error(`[LỖI_GHI_FILE] Không thể ghi log vào file:`, fileError);
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
        console.error("[ERROR_REPORTING] Không tìm thấy OWNER_DISCORD_ID trong config. Không thể gửi DM lỗi.");
        return;
    }

    try {
        const owner = await client.users.fetch(ownerId);
        if (owner) {
            let dmMessage = `**[THÔNG BÁO LỖI BOT]**\n${messageContent}`;
            if (error) {
                const stackTrace = error.stack ? error.stack.substring(0, 1500) + (error.stack.length > 1500 ? '...' : '') : 'Không có stack trace.';
                dmMessage += `\n\`\`\`javascript\n${stackTrace}\n\`\`\``;
            }
            await owner.send(dmMessage);
            console.log(`[ERROR_REPORTING] Đã gửi DM lỗi cho chủ bot (${owner.tag}).`);
        } else {
            console.warn(`[ERROR_REPORTING] Không tìm thấy người dùng chủ bot với ID: ${ownerId}.`);
        }
    } catch (dmError) {
        console.error(`[ERROR_REPORTING] Lỗi khi gửi DM lỗi cho chủ bot:`, dmError);
    }
}

module.exports = { sendOwnerDM, logErrorToFile };
