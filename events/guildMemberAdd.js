// events/guildMemberAdd.js
const { EmbedBuilder } = require('discord.js');
const { db } = require('../db'); 

// CUSTOM_WELCOME_IMAGE_URL của bạn
const CUSTOM_WELCOME_IMAGE_URL = 'https://cdn3.emoji.gg/emojis/3167-march-thumbs-up.png'; 

module.exports = {
    name: 'guildMemberAdd', 
    once: false, 

    async execute(member, client) {
        const guildId = member.guild.id;
        const userId = member.id; 
        const userDisplayName = member.displayName; 

        try {
            const guildSettings = await db('guild_settings')
                .where('guild_id', guildId)
                .select('welcome_channel_id')
                .first();

            // --- Gửi tin nhắn chào mừng vào kênh (như hiện tại) ---
            if (guildSettings && guildSettings.welcome_channel_id) {
                const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcome_channel_id);

                if (welcomeChannel) {
                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#7289DA') 
                        .setTitle(`👋 Chào Mừng ${userDisplayName} Đến Với ${member.guild.name}! 👋`)
                        .setDescription(
                            `Chào mừng <@${userId}>! Chúng tôi rất vui khi bạn đã tham gia server của chúng tôi. ` +
                            `Hãy cùng khám phá và kết nối với mọi người nhé!`
                        )
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 })) 
                        .setImage(CUSTOM_WELCOME_IMAGE_URL) 
                        .addFields(
                            { 
                                name: '✨ Bắt đầu tại đây:', 
                                value: `• Rules Sever : <#1267119224782983239>\n` + // Thay thế ID_KENH_QUY_TAC
                                       `• Events : <#1229092817197076641>`, // Thay thế ID_KENH_THONG_BAO
                                inline: false 
                            },
                            {
                                name: '💬 Kênh trò chuyện:',
                                value: `• EvilHunterTycoon : <#1394538921819508796>\n` + // Thay thế ID_KENH_TRO_CHUYEN_CHUNG
                                       `• HeartWoodOnline : <#1270533057425969202>\n` + // Thay thế ID_KENH_GIAI_TRI_1
                                       `• Pokemon : <#1393240528929165505>\n` ,                                
                                inline: false
                            },
                            
                        )
                        .setFooter({ text: `Chúc bạn có những giây phút vui vẻ tại đây!` })
                        .setTimestamp();

                    await welcomeChannel.send({ embeds: [welcomeEmbed] });
                } else {
                    console.warn(`[WELCOME_EVENT_WARN] Kênh chào mừng (ID: ${guildSettings.welcome_channel_id}) không tìm thấy trong guild (ID: ${guildId}).`);
                }
            }

            // Phần gửi tin nhắn DM chào mừng đã được loại bỏ theo yêu cầu.

        } catch (error) {
            console.error(`[WELCOME_EVENT_ERROR] Lỗi khi xử lý sự kiện guildMemberAdd cho người dùng ${userId} trong guild ${guildId}:`, error);
        }
    },
};
