// commands/slash/leaderboard.js

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getOrCreateUserProfile, getLevelUpXP, getRoleByLevelAndPath } = require('../../utils/managers/xpManager');
const { db } = require('../../db/index'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bxh')
        .setDescription('Xem bảng xếp hạng top 10 người tu luyện trong server.'),
    
    async execute(interaction) {

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        try {
            // 1. Lấy danh sách top 10 người dùng với logic sắp xếp mới: Level giảm dần, sau đó XP giảm dần
            const topUsers = await db('user_profiles')
                .select('*')
                .where({ guild_id: guildId })
                .orderBy('level', 'desc')
                .orderBy('xp', 'desc')
                .limit(10);
            
            // 2. Lấy hồ sơ của người dùng hiện tại để xác định thứ hạng
            const userProfile = await getOrCreateUserProfile(userId, guildId, db);
            
            // Logic để xác định thứ hạng: Đếm những người có cấp độ cao hơn HOẶC có cùng cấp độ nhưng XP cao hơn
            const userRankResult = await db('user_profiles')
                .count('user_id as count')
                .where({ guild_id: guildId })
                .andWhere(builder => {
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
                const member = await interaction.guild.members.fetch(user.user_id).catch(() => null);

                // Nếu không tìm thấy thành viên trong server (đã rời đi), bỏ qua
                if (!member) continue;

                const roleConfig = getRoleByLevelAndPath(user.level, user.path_type);
                const roleName = roleConfig ? roleConfig.name : 'Vô Danh';

                // Tính toán thanh tiến trình XP
                const xpToNextLevel = getLevelUpXP(user.level);
                const xpForNextLevel = (user.xp / xpToNextLevel) * 100;
                const progress = Math.min(xpForNextLevel, 100);
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
                .setColor('#FFD700') // Màu vàng gold tượng trưng cho bảng xếp hạng
                .setTitle('🏆 Bảng Xếp Hạng Tu Luyện 🏆')
                .setDescription(
                    `Đây là 10 người tu luyện mạnh nhất trong server! ` +
                    `\nThứ hạng của bạn: **#${userRank}**`
                )
                .addFields(leaderboardFields)
                .setTimestamp()
                .setFooter({ text: 'Hãy tu luyện chăm chỉ để leo lên đỉnh!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[LEADERBOARD_ERROR]', error);
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
    const filledCount = Math.floor((progress / 100) * totalBlocks);
    const emptyCount = totalBlocks - filledCount;
    return `${filledBlocks.repeat(filledCount)}${emptyBlocks.repeat(emptyCount)}`;
}
