// utils/managers/xpManager.js

const { EmbedBuilder } = require('discord.js');
const logger = require('../logger'); 

// --- HỆ THỐNG CẤP ĐỘ VÀ VAI TRÒ TU LUYỆN ---
// Bạn có thể thay đổi các giá trị này để phù hợp với bot của mình.

const XP_COOLDOWN_MS = 10 * 1000; // Thời gian hồi chiêu để nhận XP: 10 giây
const MIN_MESSAGE_LENGTH = 5; // Độ dài tin nhắn tối thiểu để nhận XP
const MIN_XP_PER_MESSAGE = 20; // Lượng XP tối thiểu nhận được
const MAX_XP_PER_MESSAGE = 35; // Lượng XP tối đa nhận được

// --- HỆ THỐNG LINH THẠCH MỚI ---
const LINGTHACH_DROP_CHANCE = 0.25; // 25% cơ hội nhận Linh Thạch mỗi tin nhắn hợp lệ
const MIN_LINGTHACH_PER_DROP = 5; // Lượng Linh Thạch tối thiểu nhận được
const MAX_LINGTHACH_PER_DROP = 10; // Lượng Linh Thạch tối đa nhận được

// Cấu hình các cấp độ và vai trò cho cả hai con đường tu tiên và tu ma
const XP_ROLES_CONFIG = [
    // Tu Tiên
    { level: 1, name: 'Luyện Khí Sơ Kỳ', path: 'tien', color: '#88a8d1' },
    { level: 4, name: 'Luyện Khí Trung Kỳ', path: 'tien', color: '#6889c2' },
    { level: 8, name: 'Luyện Khí Hậu Kỳ', path: 'tien', color: '#4567b5' },
    { level: 11, name: 'Trúc Cơ Sơ Kỳ', path: 'tien', color: '#b9de8b' },
    { level: 14, name: 'Trúc Cơ Trung Kỳ', path: 'tien', color: '#9dcb69' },
    { level: 18, name: 'Trúc Cơ Hậu Kỳ', path: 'tien', color: '#74b94c' },
    { level: 21, name: 'Kết Đan', path: 'tien', color: '#f7d377' },
    { level: 26, name: 'Kim Đan', path: 'tien', color: '#f5c542' },
    { level: 31, name: 'Nguyên Anh Sơ Kỳ', path: 'tien', color: '#b668f4' },
    { level: 36, name: 'Nguyên Anh Đại Viên Mãn', path: 'tien', color: '#a63cf4' },
    { level: 41, name: 'Hóa Thần', path: 'tien', color: '#f46868' },
    { level: 46, name: 'Hợp Thể', path: 'tien', color: '#e83e3e' },
    { level: 51, name: 'Đại Thừa', path: 'tien', color: '#89e9f6' },
    { level: 61, name: 'Độ Kiếp', path: 'tien', color: '#42e1f5' },
    { level: 71, name: 'Nhân Tiên', path: 'tien', color: '#82d385' },
    { level: 81, name: 'Địa Tiên', path: 'tien', color: '#5eb361' },
    { level: 91, name: 'Thiên Tiên', path: 'tien', color: '#439e46' },
    { level: 101, name: 'Thần Tiên', path: 'tien', color: '#2b782e' },
    
    // Tu Ma
    { level: 1, name: 'Luyện Ma Sơ Kỳ', path: 'ma', color: '#4a148c' },
    { level: 4, name: 'Luyện Ma Trung Kỳ', path: 'ma', color: '#5e35b1' },
    { level: 8, name: 'Luyện Ma Hậu Kỳ', path: 'ma', color: '#673ab7' },
    { level: 11, name: 'Cốt Ma Sơ Kỳ', path: 'ma', color: '#4e342e' },
    { level: 14, name: 'Cốt Ma Trung Kỳ', path: 'ma', color: '#5d4037' },
    { level: 18, name: 'Cốt Ma Hậu Kỳ', path: 'ma', color: '#6d4c41' },
    { level: 21, name: 'Huyết Ma', path: 'ma', color: '#b71c1c' },
    { level: 26, name: 'Ma Đan', path: 'ma', color: '#d32f2f' },
    { level: 31, name: 'Nguyên Ma Sơ Kỳ', path: 'ma', color: '#6a1b9a' },
    { level: 36, name: 'Nguyên Ma Vô Thường', path: 'ma', color: '#4a148c' },
    { level: 41, name: 'Hóa Ma', path: 'ma', color: '#311b92' },
    { level: 46, name: 'Hợp Hồn', path: 'ma', color: '#1a237e' },
    { level: 51, name: 'Đại Ma', path: 'ma', color: '#006064' },
    { level: 61, name: 'Luyện Quỷ', path: 'ma', color: '#004d40' },
    { level: 71, name: 'Ma Tướng', path: 'ma', color: '#4e342e' },
    { level: 81, name: 'Ma Vương', path: 'ma', color: '#5d4037' },
    { level: 91, name: 'Ma Hoàng', path: 'ma', color: '#6d4c41' },
    { level: 101, name: 'Ma Tôn', path: 'ma', color: '#000000' },
];


/**
 * @description Tính toán lượng XP cần thiết để lên cấp độ tiếp theo.
 * Công thức: (level ^ 2) * 100
 * @param {number} level Cấp độ hiện tại của người dùng.
 * @returns {number} Lượng XP cần thiết.
 */
function getLevelUpXP(level) {
    return Math.floor(Math.pow(level, 2) * 100);
}


/**
 * @description Lấy hồ sơ người dùng từ database hoặc tạo hồ sơ mới nếu chưa có.
 * @param {string} userId ID của người dùng Discord.
 * @param {string} guildId ID của máy chủ.
 * @param {object} db Đối tượng knex database instance.
 * @returns {Promise<object>} Hồ sơ người dùng bao gồm cả path_type.
 */
async function getOrCreateUserProfile(userId, guildId, db) {
    let profile = await db('user_profiles').where({ user_id: userId, guild_id: guildId }).first();
    if (!profile) {
        // Tạo hồ sơ mới nếu không tìm thấy
        const [insertedRow] = await db('user_profiles').insert({
            user_id: userId,
            guild_id: guildId,
            xp: 0,
            level: 1,
            last_xp_message_time: new Date(),
            linh_thach: 0 // <-- Khởi tạo linh_thach
        }).returning('*');
        profile = insertedRow;
        logger.info('PROFILE_MANAGER', `Đã tạo hồ sơ người dùng mới cho ${userId} trong guild ${guildId}.`);
    }
    return profile;
}

/**
 * @description Lấy vai trò (cảnh giới) của người dùng dựa trên cấp độ và con đường tu luyện.
 * @param {number} level Cấp độ hiện tại của người dùng.
 * @param {string} path_type Con đường tu luyện của người dùng ('tien' hoặc 'ma').
 * @returns {object|null} Đối tượng vai trò tương ứng hoặc null nếu không tìm thấy.
*/
function getRoleByLevelAndPath(level, path_type) {
    const sortedRoles = [...XP_ROLES_CONFIG].filter(r => r.path === path_type).sort((a, b) => b.level - a.level);
    return sortedRoles.find(r => level >= r.level);
}


/**
 * @description Tìm và tạo role nếu cần, sau đó cập nhật role cho người dùng.
 * @param {GuildMember} member Thành viên Discord.
 * @param {number} level Cấp độ hiện tại của người dùng.
 * @param {string} pathType Con đường tu luyện của người dùng ('tien' hoặc 'ma').
 */
async function updateUserRole(member, level, pathType) {
    // 1. Tìm vai trò phù hợp dựa trên cấp độ và con đường
    const newRoleConfig = getRoleByLevelAndPath(level, pathType);

    if (!newRoleConfig) {
        logger.warn('USER_ROLE_UPDATE_WARN', `Không tìm thấy vai trò cho cấp độ ${level} và con đường ${pathType}.`);
        return;
    }

    // 2. Kiểm tra và tạo vai trò nếu chưa tồn tại
    let newRole = member.guild.roles.cache.find(role => role.name === newRoleConfig.name);
    if (!newRole) {
        try {
            logger.info('USER_ROLE_UPDATE', `Role "${newRoleConfig.name}" không tồn tại. Đang tạo...`);
            newRole = await member.guild.roles.create({
                name: newRoleConfig.name,
                color: newRoleConfig.color,
                permissions: [],
                position: member.guild.roles.cache.size - 1, // Đặt role ở gần trên cùng
                reason: `Đã tự động tạo cho hệ thống tu luyện.`,
            });
            logger.info('USER_ROLE_UPDATE', `Role "${newRoleConfig.name}" đã được tạo thành công.`);
        } catch (error) {
            logger.error('USER_ROLE_UPDATE_ERROR', `Bot thiếu quyền 'MANAGE_ROLES' hoặc vai trò của bot không đủ cao để tạo role "${newRoleConfig.name}":`, error);
            return;
        }
    }

    // 3. Xóa các vai trò tu luyện cũ và chỉ thêm vai trò mới nếu cần
    try {
        const rolesToRemove = member.roles.cache
            .filter(role => XP_ROLES_CONFIG.some(config => config.name === role.name))
            .filter(role => role.id !== newRole.id);

        if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove, `Đã lên cấp tu luyện mới: ${newRoleConfig.name}`);
            logger.info('USER_ROLE_UPDATE', `Đã xóa các vai trò cũ cho ${member.user.tag}.`);
        }

        if (!member.roles.cache.has(newRole.id)) {
            await member.roles.add(newRole, `Đã lên cấp tu luyện: ${newRoleConfig.name}`);
            logger.info('USER_ROLE_UPDATE', `Đã gán vai trò "${newRoleConfig.name}" cho người dùng ${member.user.tag}.`);
        } else {
            logger.debug('USER_ROLE_UPDATE_DEBUG', `Người dùng ${member.user.tag} đã có vai trò "${newRoleConfig.name}". Không cần gán lại.`);
        }
    } catch (error) {
        logger.error('USER_ROLE_UPDATE_ERROR', `Lỗi khi cập nhật vai trò cho người dùng ${member.user.tag}:`, error);
    }
}


/**
 * @description Xử lý việc thêm XP và kiểm tra lên cấp.
 * @param {Message} message Đối tượng tin nhắn Discord.
 * @param {object} db Đối tượng knex database instance.
 * @returns {Promise<void>}
 */
async function addXPAndCheckLevelUp(message, db) {
    const { author, guild } = message;

    // Bỏ qua bot
    if (author.bot) {
        return;
    }

    // Lấy hoặc tạo hồ sơ người dùng
    // Đảm bảo cột 'linh_thach' đã có trong profile khi được trả về
    const userProfile = await getOrCreateUserProfile(author.id, guild.id, db);
    const now = new Date();

    // Kiểm tra thời gian hồi chiêu
    const lastXPTime = userProfile.last_xp_message_time ? new Date(userProfile.last_xp_message_time) : null;
    if (lastXPTime && (now - lastXPTime < XP_COOLDOWN_MS)) {
        logger.debug('XP_MANAGER_DEBUG', `Người dùng ${author.tag} đang trong thời gian hồi chiêu XP. Bỏ qua.`);
        return; // Dừng lại nếu đang trong thời gian hồi chiêu
    }

    // Kiểm tra độ dài tin nhắn
    if (message.content.length < MIN_MESSAGE_LENGTH) {
        logger.debug('XP_MANAGER_DEBUG', `Tin nhắn của ${author.tag} quá ngắn (${message.content.length} ký tự). Bỏ qua.`);
        return;
    }

    // Logic cấp XP
    const xpToAdd = Number(Math.floor(Math.random() * (MAX_XP_PER_MESSAGE - MIN_XP_PER_MESSAGE + 1)) + MIN_XP_PER_MESSAGE);
    const oldLevel = Number(userProfile.level);
    const currentXP = Number(userProfile.xp);
    
    userProfile.xp = currentXP + xpToAdd;
    userProfile.last_xp_message_time = now;

    let linhThachGained = 0;
    // Logic cấp Linh Thạch
    // Đảm bảo userProfile.linh_thach là số, nếu không thì đặt mặc định là 0
    const currentLinhThach = Number(userProfile.linh_thach) || 0; 
    if (Math.random() < LINGTHACH_DROP_CHANCE) {
        linhThachGained = Math.floor(Math.random() * (MAX_LINGTHACH_PER_DROP - MIN_LINGTHACH_PER_DROP + 1)) + MIN_LINGTHACH_PER_DROP;
        userProfile.linh_thach = currentLinhThach + linhThachGained;
        logger.info('LING_THACH_DROP', `Người dùng ${author.tag} đã tìm thấy ${linhThachGained} Linh Thạch. Tổng: ${userProfile.linh_thach}.`);
    } else {
        userProfile.linh_thach = currentLinhThach; // Đảm bảo giá trị được giữ nguyên nếu không có drop
    }


    // Kiểm tra lên cấp
    const xpToNextLevel = getLevelUpXP(oldLevel);
    let leveledUp = false;

    if (userProfile.xp >= xpToNextLevel) {
        userProfile.level++;
        userProfile.xp = userProfile.xp - xpToNextLevel; // Giữ lại XP thừa
        leveledUp = true;
        logger.info('XP_MANAGER', `Người dùng ${author.tag} đã lên cấp ${userProfile.level}!`);
    }

    // Cập nhật database
    await db('user_profiles')
        .where({ user_id: author.id, guild_id: guild.id })
        .update({
            xp: Number(userProfile.xp), // Đảm bảo là số trước khi cập nhật
            level: Number(userProfile.level), // Đảm bảo là số trước khi cập nhật
            last_xp_message_time: now,
            linh_thach: Number(userProfile.linh_thach) // <-- Cập nhật linh_thach
        });
    
    // Nếu lên cấp, thông báo và cập nhật role
    if (leveledUp) {
        // Tìm cảnh giới hiện tại
        const newRoleConfig = getRoleByLevelAndPath(userProfile.level, userProfile.path_type || 'tien');
        const newRealm = newRoleConfig ? newRoleConfig.name : 'Vô Danh';
        
        const embed = new EmbedBuilder()
            .setColor('#10b981')
            .setTitle(`🎉 Chúc mừng Đột Phá! 🎉`)
            .setDescription(`**<@${author.id}>** đã đạt tới Cấp Độ ${userProfile.level}!`)
            .setThumbnail(author.displayAvatarURL())
            .addFields(
                { name: 'Cấp độ mới', value: `${oldLevel} ➡️ ${userProfile.level}`, inline: true },
                { name: 'XP hiện tại', value: `${userProfile.xp}`, inline: true },
                { name: 'Cảnh giới hiện tại', value: newRealm, inline: true }
                // KHÔNG THÊM LINH THẠCH vào đây nếu bạn muốn người dùng dùng lệnh /profile để kiểm tra
            )
            .setTimestamp();

        try {
            await message.channel.send({ embeds: [embed] });
            logger.info('XP_MANAGER', `Đã gửi thông báo lên cấp cho ${author.tag} ở kênh ${message.channel.name}.`);
        } catch (embedError) {
            logger.error('XP_MANAGER_ERROR', `Không thể gửi thông báo lên cấp cho ${author.tag} ở kênh ${message.channel.name}:`, embedError);
        }
        
        const member = await guild.members.fetch(author.id);
        if (member) {
            await updateUserRole(member, userProfile.level, userProfile.path_type || 'tien');
        } else {
            logger.warn('XP_MANAGER_WARN', `Không tìm thấy thành viên Discord cho ID ${author.id} để cập nhật vai trò.`);
        }
    }

    // KHÔNG THÔNG BÁO LINH THẠCH NẾU KHÔNG LÊN CẤP, CHỈ CẬP NHẬT DATABASE VÀ LOG
    // Nếu bạn muốn người dùng dùng lệnh /profile để kiểm tra, không cần thêm code ở đây.
}


module.exports = {
    addXPAndCheckLevelUp,
    getLevelUpXP,
    getOrCreateUserProfile,
    updateUserRole,
    XP_ROLES_CONFIG,
    getRoleByLevelAndPath,
    // Export các hằng số Linh Thạch để dễ dàng truy cập và quản lý
    LINGTHACH_DROP_CHANCE,
    MIN_LINGTHACH_PER_DROP,
    MAX_LINGTHACH_PER_DROP
};