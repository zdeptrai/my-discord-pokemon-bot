// commands/slash/profile.js

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUserProfile, getLevelUpXP, getRoleByLevelAndPath } = require('../../utils/managers/xpManager');
const { db } = require('../../db/index'); 

module.exports = {
    // Cấu hình lệnh slash command
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Xem hồ sơ tu luyện của bạn hoặc của người dùng khác.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Chọn một người dùng để xem hồ sơ của họ')
                .setRequired(false)),
    
    // Xử lý logic khi lệnh được gọi
    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        // Lấy dữ liệu hồ sơ người dùng từ database
        const userProfile = await getOrCreateUserProfile(targetUser.id, guildId, db);
        const currentLevel = Number(userProfile.level);
        const currentXP = Number(userProfile.xp);
        const pathType = userProfile.path_type; // Lấy lối đi tu luyện của người dùng

        // Tính toán XP cần thiết để lên cấp tiếp theo
        const xpToNextLevel = getLevelUpXP(currentLevel);
        const xpForNextLevel = (currentXP / xpToNextLevel) * 100;
        const progress = Math.min(xpForNextLevel, 100);

        // Tìm vai trò tu luyện hiện tại dựa trên level VÀ path_type
        const currentRoleConfig = getRoleByLevelAndPath(currentLevel, pathType);
        const currentRealm = currentRoleConfig ? currentRoleConfig.name : 'Vô Danh';
        const roleColor = currentRoleConfig ? currentRoleConfig.color : '#4F46E5';

        // Tạo thanh tiến trình XP
        const progressBar = createProgressBar(progress);

        // Tạo tiêu đề và mô tả phù hợp với lối đi tu luyện
        const profileTitle = pathType === 'tien' ? `Hồ sơ Tu Tiên của ${targetUser.username}` : `Hồ sơ Tu Ma của ${targetUser.username}`;
        const profileDescription = `**Cảnh giới:** ${currentRealm}`;

        // Tạo Embed để hiển thị thông tin
        const profileEmbed = new EmbedBuilder()
            .setColor(roleColor)
            .setTitle(profileTitle)
            .setDescription(profileDescription)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Cấp độ', value: `Level **${currentLevel}**`, inline: true },
                { name: 'Tổng XP', value: `${currentXP} / ${xpToNextLevel}`, inline: true },
                { name: 'Tiến độ', value: `${progressBar} **${progress.toFixed(2)}%**`, inline: false }
            )
            .setFooter({ text: 'Chúc bạn sớm đột phá!' })
            .setTimestamp();

        // Gửi Embed về kênh
        await interaction.editReply({ embeds: [profileEmbed] });
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
