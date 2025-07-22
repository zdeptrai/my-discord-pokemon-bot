// utils/channelUtils.js
const { db } = require('../../db');

/**
 * Kiểm tra xem một kênh có được phép cho một loại kênh cụ thể (market, battle, spawn) trong guild hay không.
 * @param {string} guildId - ID của guild (server).
 * @param {string} channelId - ID của kênh cần kiểm tra.
 * @param {string} channelType - Loại kênh để kiểm tra ('market', 'battle', 'spawn').
 * @returns {boolean} True nếu kênh được phép, False nếu không.
 */
async function isChannelAllowed(guildId, channelId, channelType) {
    try {
        const dbColumnMap = {
            'market': 'market_channel_ids',
            'battle': 'battle_channel_ids',
            'spawn': 'spawn_channel_ids'
        };

        const dbColumn = dbColumnMap[channelType];

        if (!dbColumn) {
            console.warn(`[CHANNEL_UTIL_WARN] Loại kênh không hợp lệ được yêu cầu: ${channelType}`);
            return false;
        }

        const guildSettings = await db('guild_settings')
            .where({ guild_id: guildId })
            .first();

        if (!guildSettings || !guildSettings[dbColumn]) {
            // Nếu không có cài đặt cho guild hoặc cột đó trống, mặc định cho phép mọi kênh
            // HOẶC bạn có thể quyết định mặc định là KHÔNG cho phép nếu chưa thiết lập.
            // Hiện tại tôi sẽ mặc định KHÔNG cho phép nếu chưa có cài đặt.
            return false; // Mặc định: KHÔNG cho phép nếu chưa có kênh nào được thiết lập.
        }

        try {
            const allowedChannelIds = JSON.parse(guildSettings[dbColumn]);
            if (!Array.isArray(allowedChannelIds) || allowedChannelIds.length === 0) {
                 return false; // Mặc định: KHÔNG cho phép nếu mảng rỗng
            }
            return allowedChannelIds.includes(channelId);
        } catch (e) {
            console.error(`[CHANNEL_UTIL_ERROR] Lỗi phân tích JSON cho ${dbColumn} trong guild ${guildId}:`, e);
            return false; // Lỗi khi parse cũng coi như không được phép
        }

    } catch (error) {
        console.error(`[CHANNEL_UTIL_ERROR] Lỗi khi kiểm tra kênh cho guild ${guildId}, channel ${channelId}, type ${channelType}:`, error);
        return false;
    }
}

module.exports = {
    isChannelAllowed
};