// commands/slash/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getOrCreateUserProfile, getLevelUpXP, getRoleByLevelAndPath } = require('../../utils/managers/xpManager');
const logger = require('../../utils/logger'); // Cần import logger để xử lý lỗi

// Import db từ file chính để đảm bảo nó được khởi tạo
const db = require('../../db/index').db; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bxh')
        .setDescription('Xem bảng xếp hạng top 10 người tu luyện.'),
    
    async execute(interaction) {
        // Log rằng bot đang xử lý một tương tác
        logger.info('LEADERBOARD_COMMAND', `Người dùng ${interaction.user.tag} đã sử dụng lệnh /bxh.`);

        // Đảm bảo bot đang trong guild để fetch thành viên
        if (!interaction.guild) {
            return interaction.reply({ content: 'Lệnh này chỉ có thể sử dụng trong máy chủ.', ephemeral: true });
        }

        try {
            // 1. Lấy danh sách top 10 người dùng toàn cầu
            // Không sử dụng .where({ guild_id: guildId }) nữa
            const topUsers = await db('user_profiles')
                .select('*')
                .orderBy('level', 'desc')
                .orderBy('xp', 'desc')
                .limit(10);
            
            // Nếu không có người dùng nào, thông báo và dừng lại
            if (topUsers.length === 0) {
                return interaction.editReply({ 
                    content: 'Chưa có người dùng nào được ghi danh trên bảng xếp hạng này. Hãy là người đầu tiên!', 
                    ephemeral: true 
                });
            }

            // 2. Lấy hồ sơ của người dùng hiện tại để xác định thứ hạng
            const userProfile = await getOrCreateUserProfile(interaction.user.id, db);
            
            if (!userProfile) {
                return interaction.editReply({ 
                    content: 'Hồ sơ của bạn chưa được tạo. Vui lòng gửi một tin nhắn để khởi tạo.', 
                    ephemeral: true 
                });
            }

            // Logic để xác định thứ hạng toàn cầu: Đếm những người có cấp độ cao hơn HOẶC có cùng cấp độ nhưng XP cao hơn
            const userRankResult = await db('user_profiles')
                .count('user_id as count')
                .where(builder => {
                    builder
                        .where('level', '>', userProfile.level)
                        .orWhere(subBuilder => {
                            subBuilder
                                .where('level', '=', userProfile.level)
                                .andWhere('xp', '>', userProfile.xp);
                        });
                });
            const userRank = userRankResult[0].count + 1;

            // 3. Xây dựng bảng xếp hạng
            const leaderboardFields = [];
            const rankEmojis = ['🥇', '🥈', '🥉'];
            
            for (let i = 0; i < topUsers.length; i++) {
                const rank = i + 1;
                const user = topUsers[i];
                
                // Fetch thành viên từ guild hiện tại, vì displayName chỉ có trong guild
                const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);

                // Nếu không tìm thấy thành viên trong server (đã rời đi), bỏ qua
                // Điều này đảm bảo bảng xếp hạng chỉ hiển thị người dùng đang ở trong server
                if (!member) continue;

                const roleConfig = getRoleByLevelAndPath(user.level, user.path_type);
                const roleName = roleConfig ? roleConfig.name : 'Vô Danh';

                // Tính toán thanh tiến trình XP
                const xpToNextLevel = getLevelUpXP(user.level);
                const progress = (user.xp / xpToNextLevel) * 100;
                const progressBar = createProgressBar(progress);

                let rankString = '';
                if (rank <= 3) {
                    rankString = rankEmojis[rank - 1];
                } else {
                    rankString = `\`#${rank}\``;
                }

                leaderboardFields.push({
                    name: `${rankString} ${member.displayName} - Cảnh giới ${roleName}`,
                    value: `> Level: ${user.level} | XP: ${user.xp}\n> ${progressBar} \`${progress.toFixed(2)}%\``,
                    inline: false,
                });
            }

            // 4. Tạo embed và thêm các trường thông tin
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Bảng Xếp Hạng Tu Luyện Toàn Cầu 🏆')
                .setDescription(
                    `Đây là 10 người tu luyện mạnh nhất trên tất cả các server! ` +
                    `\nThứ hạng của bạn: **#${userRank}**`
                )
                .setFields(leaderboardFields)
                .setTimestamp()
                .setFooter({ text: 'Hãy tu luyện chăm chỉ để leo lên đỉnh!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('[LEADERBOARD_ERROR]', `Lỗi khi lấy bảng xếp hạng:`, error);
            await interaction.editReply({
                content: 'Đã có lỗi xảy ra khi lấy bảng xếp hạng. Vui lòng thử lại sau!',
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};

/**
 * @description Tạo thanh tiến trình bằng emoji.
 * @param {number} progress Phần trăm tiến độ (0-100).
 * @returns {string} Thanh tiến trình dưới dạng chuỗi emoji.
 */
function createProgressBar(progress) {
    const filledBlocks = '█';
    const emptyBlocks = '░';
    const totalBlocks = 10;
    const filledCount = Math.floor((Math.min(progress, 100) / 100) * totalBlocks);
    const emptyCount = totalBlocks - filledCount;
    return `${filledBlocks.repeat(filledCount)}${emptyBlocks.repeat(emptyCount)}`;
}