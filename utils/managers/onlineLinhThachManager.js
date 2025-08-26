// utils/managers/onlineLinhThachManager.js

const logger = require('../logger');
const { getOrCreateUserProfile } = require('./xpManager'); 

const ONLINE_REWARD_INTERVAL_MS = 10 * 60 * 1000;
const LINGTHACH_PER_ONLINE_INTERVAL = 5;

async function rewardOnlineUsers(client, db) {
    logger.info('ONLINE_LING_THACH', 'Bắt đầu kiểm tra và cấp Linh Thạch cho người dùng online...');
    
    for (const guild of client.guilds.cache.values()) {
        try {
            const members = await guild.members.fetch({ withPresences: true }); 
            
            for (const member of members.values()) {
                if (member.user.bot || !member.presence) {
                    continue;
                }

                const status = member.presence.status;

                if (['online', 'idle', 'dnd'].includes(status)) {
                    const userProfile = await getOrCreateUserProfile(member.id, db);
                    
                    if (!userProfile) {
                        logger.warn('ONLINE_LING_THACH_WARN', `Không tìm thấy hoặc không thể tạo hồ sơ cho người dùng ${member.user.tag}. Bỏ qua cấp Linh Thạch.`);
                        continue;
                    }

                    const currentLinhThach = Number(userProfile.linh_thach) || 0; 
                    const newLinhThach = currentLinhThach + LINGTHACH_PER_ONLINE_INTERVAL;

                    await db('user_profiles')
                        .where({ user_id: member.id })
                        .update({ linh_thach: newLinhThach });
                    
                    logger.info('ONLINE_LING_THACH', `Đã cấp ${LINGTHACH_PER_ONLINE_INTERVAL} Linh Thạch cho ${member.user.tag}. Tổng: ${newLinhThach}. (Server: ${guild.name})`);
                }
            }
        } catch (error) {
            logger.error('ONLINE_LING_THACH_ERROR', `Lỗi khi xử lý guild ${guild.name}:`, error);
        }
    }
    logger.info('ONLINE_LING_THACH', 'Hoàn tất kiểm tra và cấp Linh Thạch cho người dùng online.');
}

function startOnlineLinhThachReward(client, db) {
    rewardOnlineUsers(client, db); 
    setInterval(() => rewardOnlineUsers(client, db), ONLINE_REWARD_INTERVAL_MS);
    logger.info('ONLINE_LING_THACH', `Đã khởi động cơ chế cấp Linh Thạch online, mỗi ${ONLINE_REWARD_INTERVAL_MS / (60 * 1000)} phút.`);
}

module.exports = { startOnlineLinhThachReward };