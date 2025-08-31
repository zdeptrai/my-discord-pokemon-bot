// utils/managers/xpManager.js
const { EmbedBuilder } = require('discord.js');
const logger = require('../logger'); 

// --- HỆ THỐNG CẤP ĐỘ VÀ VAI TRÒ TU LUYỆN ---
const XP_COOLDOWN_MS = 10 * 1000;
const MIN_MESSAGE_LENGTH = 5;
const MIN_XP_PER_MESSAGE = 20;
const MAX_XP_PER_MESSAGE = 35;

// --- HỆ THỐNG LINH THẠCH MỚI ---
const LINGTHACH_DROP_CHANCE = 0.25;
const MIN_LINGTHACH_PER_DROP = 5;
const MAX_LINGTHACH_PER_DROP = 10;

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

function getLevelUpXP(level) {
    return Math.floor(Math.pow(level, 2) * 100);
}

/**
 * @description Lấy hồ sơ người dùng từ database hoặc tạo hồ sơ mới nếu chưa có.
 * @param {string} userId ID của người dùng Discord.
 * @param {object} db Đối tượng knex database instance.
 * @returns {Promise<object>} Hồ sơ người dùng bao gồm cả path_type.
 */
async function getOrCreateUserProfile(userId, db) {
    let profile = await db('user_profiles').where({ user_id: userId }).first(); 
    if (!profile) {
        const [insertedRow] = await db('user_profiles').insert({
            user_id: userId,
            xp: 0,
            level: 1,
            last_xp_message_time: new Date(),
            linh_thach: 0,
            path_type: null, // SỬA: Khởi tạo là null để người dùng có thể chọn sau
        }).returning('*');
        profile = insertedRow;
        logger.info('PROFILE_MANAGER', `Đã tạo hồ sơ người dùng mới cho ${userId}.`);
    }
    return profile;
}

function getRoleByLevelAndPath(level, path_type) {
    const sortedRoles = [...XP_ROLES_CONFIG].filter(r => r.path === path_type).sort((a, b) => b.level - a.level);
    return sortedRoles.find(r => level >= r.level);
}

async function updateUserRole(member, level, pathType) {
    // NOTE: This function still requires a Discord guild member and will only work
    // in a guild context.
    const newRoleConfig = getRoleByLevelAndPath(level, pathType);

    if (!newRoleConfig) {
        logger.warn('USER_ROLE_UPDATE_WARN', `Không tìm thấy vai trò cho cấp độ ${level} và con đường ${pathType}.`);
        return;
    }

    let newRole = member.guild.roles.cache.find(role => role.name === newRoleConfig.name);
    if (!newRole) {
        try {
            logger.info('USER_ROLE_UPDATE', `Role "${newRoleConfig.name}" không tồn tại. Đang tạo...`);
            newRole = await member.guild.roles.create({
                name: newRoleConfig.name,
                color: newRoleConfig.color,
                permissions: [],
                position: member.guild.roles.cache.size - 1,
                reason: `Đã tự động tạo cho hệ thống tu luyện.`,
            });
            logger.info('USER_ROLE_UPDATE', `Role "${newRoleConfig.name}" đã được tạo thành công.`);
        } catch (error) {
            logger.error('USER_ROLE_UPDATE_ERROR', `Bot thiếu quyền 'MANAGE_ROLES' hoặc vai trò của bot không đủ cao để tạo role "${newRoleConfig.name}":`, error);
            return;
        }
    }

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

async function addXPAndCheckLevelUp(message, db) {
    const { author, guild } = message;

    if (author.bot || !guild) {
        return;
    }

    const userProfile = await getOrCreateUserProfile(author.id, db); 
    if (!userProfile) {
        return;
    }

    // THÊM: Nếu người dùng chưa chọn phe, yêu cầu họ chọn và dừng việc tính XP
    if (!userProfile.path_type) {
        await message.channel.send({
            content: `Chào mừng bạn đến với thế giới tu luyện! Để bắt đầu hành trình, bạn cần chọn con đường của mình. Vui lòng sử dụng lệnh \`/start\` để chọn Tiên hoặc Ma!`,
            ephemeral: true
        });
        return; // Dừng việc tính XP cho đến khi họ chọn
    }

    const now = new Date();
    const lastXPTime = userProfile.last_xp_message_time ? new Date(userProfile.last_xp_message_time) : null;
    if (lastXPTime && (now - lastXPTime < XP_COOLDOWN_MS)) {
        logger.debug('XP_MANAGER_DEBUG', `Người dùng ${author.tag} đang trong thời gian hồi chiêu XP. Bỏ qua.`);
        return;
    }

    if (message.content.length < MIN_MESSAGE_LENGTH) {
        logger.debug('XP_MANAGER_DEBUG', `Tin nhắn của ${author.tag} quá ngắn (${message.content.length} ký tự). Bỏ qua.`);
        return;
    }

    const xpToAdd = Number(Math.floor(Math.random() * (MAX_XP_PER_MESSAGE - MIN_XP_PER_MESSAGE + 1)) + MIN_XP_PER_MESSAGE);
    const oldLevel = Number(userProfile.level);
    const currentXP = Number(userProfile.xp);
    
    userProfile.xp = currentXP + xpToAdd;
    userProfile.last_xp_message_time = now;
    
    logger.info('XP_MANAGER', `Người dùng ${author.tag} đã nhận được ${xpToAdd} XP. Tổng hiện tại: ${userProfile.xp}.`);

    let linhThachGained = 0;
    const currentLinhThach = Number(userProfile.linh_thach) || 0; 
    if (Math.random() < LINGTHACH_DROP_CHANCE) {
        linhThachGained = Math.floor(Math.random() * (MAX_LINGTHACH_PER_DROP - MIN_LINGTHACH_PER_DROP + 1)) + MIN_LINGTHACH_PER_DROP;
        userProfile.linh_thach = currentLinhThach + linhThachGained;
        logger.info('LING_THACH_DROP', `Người dùng ${author.tag} đã tìm thấy ${linhThachGained} Linh Thạch. Tổng: ${userProfile.linh_thach}.`);
    } else {
        userProfile.linh_thach = currentLinhThach;
    }

    const xpToNextLevel = getLevelUpXP(oldLevel);
    let leveledUp = false;

    if (userProfile.xp >= xpToNextLevel) {
        userProfile.level++;
        userProfile.xp = userProfile.xp - xpToNextLevel;
        leveledUp = true;
        logger.info('XP_MANAGER', `Người dùng ${author.tag} đã lên cấp ${userProfile.level}!`);
    }

    await db('user_profiles')
        .where({ user_id: author.id })
        .update({
            xp: Number(userProfile.xp),
            level: Number(userProfile.level),
            last_xp_message_time: now,
            linh_thach: Number(userProfile.linh_thach)
        });
    
    if (leveledUp) {
        const newRoleConfig = getRoleByLevelAndPath(userProfile.level, userProfile.path_type);
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
            )
            .setTimestamp();

        try {
            await message.channel.send({ embeds: [embed] });
            logger.info('XP_MANAGER', `Đã gửi thông báo lên cấp cho ${author.tag} ở kênh ${message.channel.name}.`);
        } catch (embedError) {
            logger.error('XP_MANAGER_ERROR', `Không thể gửi thông báo lên cấp cho ${author.id}:`, embedError);
        }
        
        const member = await guild.members.fetch(author.id);
        if (member) {
            await updateUserRole(member, userProfile.level, userProfile.path_type);
        } else {
            logger.warn('XP_MANAGER_WARN', `Không tìm thấy thành viên Discord cho ID ${author.id} để cập nhật vai trò.`);
        }
    }
}

module.exports = {
    addXPAndCheckLevelUp,
    getLevelUpXP,
    getOrCreateUserProfile,
    updateUserRole,
    XP_ROLES_CONFIG,
    getRoleByLevelAndPath,
    LINGTHACH_DROP_CHANCE,
    MIN_LINGTHACH_PER_DROP,
    MAX_LINGTHACH_PER_DROP
};