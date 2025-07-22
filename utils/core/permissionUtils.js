// utils/core/permissionUtils.js
const { PermissionsBitField } = require('discord.js');
const { db } = require('../../db'); 

/**
 * Kiểm tra xem người dùng có quyền quản trị viên Discord trên guild hay không (quyền ADMINISTRATOR).
 * Lệnh setchannel (để thiết lập kênh cho bot) NÊN chỉ được dùng bởi người có quyền này.
 * @param {GuildMember} member - Đối tượng GuildMember của người dùng.
 * @returns {boolean} True nếu người dùng là quản trị viên Discord, ngược lại False.
 */
async function hasDiscordAdministratorPermission(member) {
    if (!member || !member.permissions) {
        return false;
    }
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

/**
 * Kiểm tra xem người dùng có được đánh dấu là admin bot trong bảng 'admins' hay không.
 * (Dành cho các lệnh admin "trong game" của bot, ví dụ: cấp vật phẩm, điều chỉnh dữ liệu người chơi).
 * @param {string} userId - ID Discord của người dùng.
 * @returns {boolean} True nếu người dùng là admin bot, ngược lại False.
 */
async function isBotAdmin(userId) {
    try {
        const adminEntry = await db('admins') 
            .where({ user_discord_id: userId })
            .first(); 
        return !!adminEntry; 
    } catch (error) {
        console.error(`[PERMISSION_UTIL_ERROR] Lỗi khi kiểm tra quyền admin bot cho user ${userId}:`, error);
        return false;
    }
}

/**
 * Kiểm tra xem người dùng có phải là quản trị viên bot (tức là có quyền Discord Administrator HOẶC được đánh dấu là admin trong DB).
 * Sử dụng hàm này cho các lệnh admin của bot, ví dụ: cấp đồ, chỉnh sửa dữ liệu người chơi...
 * @param {GuildMember} member - Đối tượng GuildMember của người dùng.
 * @returns {boolean} True nếu người dùng là quản trị viên bot, ngược lại False.
 */
async function isUserBotAdmin(member) {
    const userId = member.id;
    const hasDiscordAdmin = await hasDiscordAdministratorPermission(member);
    const isDbAdmin = await isBotAdmin(userId);

    return hasDiscordAdmin || isDbAdmin;
}

/**
 * Kiểm tra xem người dùng có phải là chủ bot (OWNER_DISCORD_ID) hay không.
 * @param {string} userId - ID Discord của người dùng.
 * @param {object} client - Đối tượng Discord client (để truy cập client.config.OWNER_DISCORD_ID).
 * @returns {boolean} True nếu người dùng là chủ bot, ngược lại False.
 */
function isBotOwner(userId, client) {
    return userId === client.config.OWNER_DISCORD_ID;
}


module.exports = {
    hasDiscordAdministratorPermission,
    isBotAdmin,
    isUserBotAdmin,
    isBotOwner // THÊM HÀM NÀY
};
