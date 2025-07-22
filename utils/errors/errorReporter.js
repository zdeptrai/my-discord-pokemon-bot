// utils/errors/errorReporter.js

const { EmbedBuilder } = require('discord.js');

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

module.exports = { sendOwnerDM };
