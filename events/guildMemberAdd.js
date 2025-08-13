// events/guildMemberAdd.js
const { Events, EmbedBuilder } = require('discord.js');
const { logErrorToFile } = require('../utils/errors/errorReporter'); 

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
        const userDisplayName = member.displayName; 

        // Truy cập đối tượng Knex database từ client
        const db = client.db;

        try {
            const guildSettings = await db('guild_settings')
                .where('guild_id', guildId)
                .select('welcome_channel_id')
                .first();

            if (guildSettings && guildSettings.welcome_channel_id) {
                const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcome_channel_id);

                if (welcomeChannel) {
                    // Tạo danh sách các kênh quan trọng từ cấu hình
                    const fields = [];
                    for (const [title, channelIds] of Object.entries(importantChannelIds)) {
                        const channelList = channelIds.map(id => `• <#${id}>`).join('\n');
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
                        .addFields(fields) // Sử dụng danh sách fields được tạo động
                        .setFooter({ text: `Chúc bạn có những giây phút vui vẻ tại đây!` })
                        .setTimestamp();

                    // Gửi tin nhắn và tag người dùng mới
                    await welcomeChannel.send({ content: `${member.toString()}`, embeds: [welcomeEmbed] });

                } else {
                    console.warn(`[WELCOME_EVENT_WARN] Kênh chào mừng (ID: ${guildSettings.welcome_channel_id}) không tìm thấy trong guild (ID: ${guildId}).`);
                }
            } else {
                console.warn(`[WELCOME_EVENT_WARN] Không có kênh chào mừng nào được thiết lập cho guild (ID: ${guildId}).`);
            }

        } catch (error) {
            console.error(`[WELCOME_EVENT_ERROR] Lỗi khi xử lý sự kiện guildMemberAdd cho người dùng ${userId} trong guild ${guildId}:`, error);
            logErrorToFile('WELCOME_EVENT_ERROR', member.user.tag, `Lỗi khi xử lý guildMemberAdd`, error);
        }
    },
};
