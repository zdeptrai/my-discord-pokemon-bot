// utils/managers/onlineLinhThachManager.js

const logger = require('../logger');
const { getOrCreateUserProfile } = require('./xpManager'); // Tái sử dụng hàm getOrCreateUserProfile từ xpManager

// --- CẤU HÌNH LINH THẠCH ONLINE ---
const ONLINE_REWARD_INTERVAL_MS = 10 * 60 * 1000; // 10 phút
const LINGTHACH_PER_ONLINE_INTERVAL = 5; // Số Linh Thạch nhận được mỗi 10 phút online

/**
 * @description Hàm chính để kiểm tra và cấp Linh Thạch cho người dùng online.
 * @param {Client} client Đối tượng Discord Client.
 * @param {object} db Đối tượng knex database instance.
 */
async function rewardOnlineUsers(client, db) {
    logger.info('ONLINE_LING_THACH', 'Bắt đầu kiểm tra và cấp Linh Thạch cho người dùng online...');
    
    // Duyệt qua tất cả các Guild (server) mà bot đang tham gia
    for (const guild of client.guilds.cache.values()) {
        try {
            // Fetch tất cả thành viên của guild, bao gồm cả presence (trạng thái online/offline)
            // Đảm bảo bot có quyền hạn (intent) GuildMembers và GuildPresences
            const members = await guild.members.fetch({ withPresences: true }); 
            
            // Duyệt qua từng thành viên
            for (const member of members.values()) {
                // Bỏ qua nếu là bot hoặc không có presence (ví dụ: offline hoàn toàn, không hiển thị trạng thái)
                if (member.user.bot || !member.presence) {
                    continue;
                }

                const status = member.presence.status;

                // Kiểm tra nếu trạng thái là 'online', 'idle' (chờ), hoặc 'dnd' (không làm phiền)
                if (['online', 'idle', 'dnd'].includes(status)) {
                    // Lấy hoặc tạo hồ sơ người dùng
                    const userProfile = await getOrCreateUserProfile(member.id, guild.id, db);
                    
                    // Đảm bảo linh_thach là số, mặc định 0 nếu null/undefined
                    const currentLinhThach = Number(userProfile.linh_thach) || 0; 
                    const newLinhThach = currentLinhThach + LINGTHACH_PER_ONLINE_INTERVAL;

                    // Cập nhật số Linh Thạch trong database
                    await db('user_profiles')
                        .where({ user_id: member.id, guild_id: guild.id })
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

/**
 * @description Khởi động bộ đếm thời gian (interval) để cấp Linh Thạch cho người dùng online.
 * @param {Client} client Đối tượng Discord Client.
 * @param {object} db Đối tượng knex database instance.
 */
function startOnlineLinhThachReward(client, db) {
    // Chạy lần đầu tiên ngay khi bot khởi động để cấp ngay Linh Thạch
    rewardOnlineUsers(client, db); 

    // Sau đó chạy định kỳ theo khoảng thời gian đã cấu hình
    setInterval(() => rewardOnlineUsers(client, db), ONLINE_REWARD_INTERVAL_MS);
    logger.info('ONLINE_LING_THACH', `Đã khởi động cơ chế cấp Linh Thạch online, mỗi ${ONLINE_REWARD_INTERVAL_MS / (60 * 1000)} phút.`);
}

module.exports = { startOnlineLinhThachReward };