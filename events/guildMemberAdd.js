// events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const { logErrorToFile } = require('../utils/errors/errorReporter'); 
const logger = require('../utils/logger'); // <-- Thêm dòng này

// CUSTOM_WELCOME_IMAGE_URL của bạn
const CUSTOM_WELCOME_IMAGE_URL = 'https://cdn3.emoji.gg/emojis/3167-march-thumbs-up.png'; 

// --- CẤU HÌNH CÁC KÊNH QUAN TRỌNG ĐỂ ĐIỀU HƯỚNG ---
// Thêm ID của các kênh quan trọng vào đây để bot tự động hiển thị trong tin nhắn.
// Bạn có thể lấy ID kênh bằng cách bật Developer Mode trong Discord, chuột phải vào kênh và "Sao chép ID".
const importantChannelIds = {
    '✨ Bắt đầu tại đây:': [
        '1267119224782983239', // Rules Sever
        '1229092817197076641', // Events
    ],
    '💬 Kênh trò chuyện:': [
        '1394538921819508796', // EvilHunterTycoon
        '1270533057425969202', // HeartWoodOnline
        '1393240528929165505', // Pokemon
    ]
};

module.exports = {
    name: Events.GuildMemberAdd, 
    once: false, 

    async execute(member, client) {
        const guildId = member.guild.id;
        const userId = member.id; 
        const userTag = member.user.tag; // Sử dụng user.tag để có cả username và discriminator
        const userDisplayName = member.displayName; 

        logger.info('[GUILD_MEMBER_ADD]', `Thành viên mới "${userTag}" (${userId}) đã tham gia guild "${member.guild.name}" (${guildId}).`);

        // Truy cập đối tượng Knex database từ client
        const db = client.db;

        try {
            logger.debug('[GUILD_MEMBER_ADD]', `Đang tìm kiếm cài đặt kênh chào mừng cho guild ID: ${guildId}.`);
            const guildSettings = await db('guild_settings')
                .where('guild_id', guildId)
                .select('welcome_channel_id')
                .first();

            if (guildSettings && guildSettings.welcome_channel_id) {
                const welcomeChannelId = guildSettings.welcome_channel_id;
                const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);

                if (welcomeChannel) {
                    logger.debug('[GUILD_MEMBER_ADD]', `Tìm thấy kênh chào mừng (ID: ${welcomeChannelId}). Đang tạo Embed chào mừng.`);
                    // Tạo danh sách các kênh quan trọng từ cấu hình
                    const fields = [];
                    for (const [title, channelIds] of Object.entries(importantChannelIds)) {
                        const channelList = channelIds.map(id => {
                            const channel = member.guild.channels.cache.get(id);
                            return channel ? `• <#${id}>` : `• Kênh không tìm thấy (ID: ${id})`; // Xử lý nếu kênh không tồn tại
                        }).join('\n');
                        fields.push({ 
                            name: title, 
                            value: channelList, 
                            inline: false 
                        });
                    }

                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#7289DA') 
                        .setTitle(`👋 Chào Mừng ${userDisplayName} Đến Với ${member.guild.name}! 👋`)
                        .setDescription(`Chào mừng ${member.toString()}! Chúng tôi rất vui khi bạn đã tham gia server của chúng tôi. Hãy cùng khám phá và kết nối với mọi người nhé!`)
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 })) 
                        .setImage(CUSTOM_WELCOME_IMAGE_URL) 
                        .addFields(fields) 
                        .setFooter({ text: `Chúc bạn có những giây phút vui vẻ tại đây!` })
                        .setTimestamp();

                    // Gửi tin nhắn và tag người dùng mới
                    await welcomeChannel.send({ content: `${member.toString()}`, embeds: [welcomeEmbed] });
                    logger.info('[GUILD_MEMBER_ADD]', `Đã gửi tin nhắn chào mừng cho ${userTag} trong kênh ${welcomeChannel.name}.`);

                } else {
                    logger.warn('[WELCOME_CHANNEL_NOT_FOUND]', `Kênh chào mừng (ID: ${welcomeChannelId}) không tìm thấy trong guild "${member.guild.name}" (ID: ${guildId}).`);
                }
            } else {
                logger.warn('[WELCOME_CHANNEL_NOT_SET]', `Không có kênh chào mừng nào được thiết lập cho guild "${member.guild.name}" (ID: ${guildId}).`);
            }

        } catch (error) {
            logger.error(`[GUILD_MEMBER_ADD_ERROR] Lỗi khi xử lý sự kiện guildMemberAdd cho người dùng ${userTag} (${userId}) trong guild ${member.guild.name} (${guildId}):`, error);
            logErrorToFile('GUILD_MEMBER_ADD_ERROR', userTag, `Lỗi khi xử lý guildMemberAdd`, error);
        }
    },
};