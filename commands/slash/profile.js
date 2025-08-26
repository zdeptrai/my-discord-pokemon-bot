// commands/slash/profile.js
const { SlashCommandBuilder, EmbedBuilder, InteractionFlags } = require('discord.js');
const { getOrCreateUserProfile, getLevelUpXP, getRoleByLevelAndPath } = require('../../utils/managers/xpManager');
const { db } = require('../../db/index');
const logger = require('../../utils/logger');
const { updateUserRole } = require('../../utils/managers/xpManager');


// Cooldown storage
const cooldowns = new Map();
const COOLDOWN_SECONDS = 10;

function createProgressBar(progress) {
    const filledBlocks = '█';
    const emptyBlocks = '░';
    const totalBlocks = 10;
    const filledCount = Math.floor((progress / 100) * totalBlocks);
    const emptyCount = totalBlocks - filledCount;
    return `${filledBlocks.repeat(filledCount)}${emptyBlocks.repeat(emptyCount)}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Xem hồ sơ tu luyện hoặc hấp thụ linh thạch.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Chọn một người dùng để xem hồ sơ của họ.')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('hapthu')
                .setDescription('Số Linh Thạch muốn hấp thụ. (Để trống để hấp thụ tất cả)')
                .setRequired(false)),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amountToAbsorb = interaction.options.getInteger('hapthu');
        const userId = interaction.user.id;

        // Logic cho hành động 'hapthu'
        if (amountToAbsorb !== null) {
            const lastUse = cooldowns.get(userId);
            if (lastUse && (Date.now() - lastUse < COOLDOWN_SECONDS * 1000)) {
                const timeLeft = ((COOLDOWN_SECONDS * 1000) - (Date.now() - lastUse)) / 1000;
                // Nếu cần phản hồi ephemeral, không sử dụng editReply. Thay vào đó, dùng followUp.
                // Điều này tránh xung đột với deferReply toàn cục không phải ephemeral.
                return interaction.followUp({
                    content: `Bạn cần phải nghỉ ngơi. Vui lòng đợi thêm **${timeLeft.toFixed(1)}** giây trước khi hấp thụ tiếp.`,
                    ephemeral: true
                });
            }

            const userProfile = await getOrCreateUserProfile(userId, db);
            const initialLinhThach = Number(userProfile.linh_thach) || 0;

            if (initialLinhThach === 0) {
                return interaction.editReply({ content: 'Bạn không có Linh Thạch nào để hấp thụ!' });
            }
            
            if (amountToAbsorb <= 0) {
                return interaction.editReply({ content: 'Số lượng Linh Thạch phải lớn hơn 0!' });
            }

            let finalAmountToAbsorb = amountToAbsorb;
            if (finalAmountToAbsorb > initialLinhThach) {
                finalAmountToAbsorb = initialLinhThach;
            }

            let totalXpGained = 0;
            for (let i = 0; i < finalAmountToAbsorb; i++) {
                totalXpGained += Math.floor(Math.random() * (20 - 5 + 1)) + 5;
            }

            const oldLevel = Number(userProfile.level);
            let newLevel = oldLevel;
            let newXp = Number(userProfile.xp) + totalXpGained;
            const newLinhThach = initialLinhThach - finalAmountToAbsorb;
            let levelUpCount = 0;

            while (newXp >= getLevelUpXP(newLevel)) {
                newXp -= getLevelUpXP(newLevel);
                newLevel++;
                levelUpCount++;
            }

            await db('user_profiles')
                .where({ user_id: userId })
                .update({
                    linh_thach: newLinhThach,
                    xp: newXp,
                    level: newLevel
                });
            
            cooldowns.set(userId, Date.now());

            const newRoleConfig = getRoleByLevelAndPath(newLevel, userProfile.path_type);
            const newRealm = newRoleConfig ? newRoleConfig.name : 'Vô Danh';
            const roleColor = newRoleConfig ? newRoleConfig.color : '#4F46E5';

            const replyEmbed = new EmbedBuilder()
                .setColor(roleColor)
                .setTitle('<:linh_thach:1408018585846157312> Hấp Thụ Linh Thạch Thành Công! <:linh_thach:1408018585846157312>')
                .setDescription(`Đã hấp thụ **${finalAmountToAbsorb}** Linh Thạch và chuyển hóa thành **${totalXpGained}** XP.`)
                .addFields(
                    { name: 'Cấp độ mới', value: `Level **${newLevel}**`, inline: true },
                    { name: 'XP hiện tại', value: `${newXp}`, inline: true },
                    { name: 'Linh Thạch còn lại', value: `<:linh_thach:1408018585846157312> **${newLinhThach}**`, inline: true }
                )
                .setFooter({ text: 'Bạn đã tiến gần hơn đến cảnh giới cao hơn!' })
                .setTimestamp();
            
            if (levelUpCount > 0) {
                replyEmbed.setDescription(`Đã hấp thụ **${finalAmountToAbsorb}** Linh Thạch và đột phá ${levelUpCount} cảnh giới!`)
                    .setTitle(`🎉 Chúc mừng Đột Phá! 🎉`)
                    .addFields(
                        { name: 'Cảnh giới mới', value: newRealm, inline: true }
                    );
            }

            await interaction.editReply({ embeds: [replyEmbed] });

            const member = await interaction.guild.members.fetch(userId);
            if (member) {
                await updateUserRole(member, newLevel, userProfile.path_type);
            }

        } else {
            // Logic cho hành động 'view' (mặc định nếu không có tùy chọn 'hapthu')
            const userToView = targetUser || interaction.user;
            const userProfile = await getOrCreateUserProfile(userToView.id, db);
            
            const currentLevel = Number(userProfile.level);
            const currentXP = Number(userProfile.xp);
            const pathType = userProfile.path_type;
            const linhThach = Number(userProfile.linh_thach) || 0;

            const xpToNextLevel = getLevelUpXP(currentLevel);
            const progress = Math.min((currentXP / xpToNextLevel) * 100, 100);
            
            const currentRoleConfig = getRoleByLevelAndPath(currentLevel, pathType);
            const currentRealm = currentRoleConfig ? currentRoleConfig.name : 'Vô Danh';
            const roleColor = currentRoleConfig ? currentRoleConfig.color : '#4F46E5';

            const progressBar = createProgressBar(progress);

            const profileTitle = pathType === 'tien' ? `Hồ sơ Tu Tiên của ${userToView.username}` : `Hồ sơ Tu Ma của ${userToView.username}`;
            const profileDescription = `**Cảnh giới:** ${currentRealm}`;

            const profileEmbed = new EmbedBuilder()
                .setColor(roleColor)
                .setTitle(profileTitle)
                .setDescription(profileDescription)
                .setThumbnail(userToView.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Cấp độ', value: `Level **${currentLevel}**`, inline: true },
                    { name: 'Tổng XP', value: `${currentXP} / ${xpToNextLevel}`, inline: true },
                    { name: 'Linh Thạch', value: `<:linh_thach:1408018585846157312> **${linhThach}**`, inline: true },
                    { name: 'Tiến độ', value: `${progressBar} **${progress.toFixed(2)}%**`, inline: false }
                )
                .setFooter({ text: 'Chúc bạn sớm đột phá!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [profileEmbed] });
        }
    },
};