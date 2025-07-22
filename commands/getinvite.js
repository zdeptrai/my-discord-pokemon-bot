// commands/getinvite.js
const { EmbedBuilder, MessageFlags, PermissionsBitField, ChannelType } = require('discord.js');
const { isBotOwner } = require('../utils/core/permissionUtils'); // Import hàm isBotOwner

module.exports = {
    name: 'getinvite',
    description: 'Tạo và gửi lời mời đến một server mà bot đang tham gia (chỉ dành cho chủ bot).',
    aliases: ['invite', 'serverinvite'],
    usage: '<server_id>',
    cooldown: 5, // Cooldown để tránh spam

    async execute(message, args, client, db) { // db không cần thiết ở đây nhưng giữ lại cho đồng bộ
        const userId = message.author.id;

        // 1. Kiểm tra xem người dùng có phải là chủ bot hay không
        if (!isBotOwner(userId, client)) {
            return message.channel.send({
                content: `<@${userId}> Lệnh này chỉ dành cho chủ bot.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 2. Kiểm tra cú pháp lệnh
        if (args.length !== 1) {
            return message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của server mà bạn muốn lời mời. Ví dụ: \`${client.config.PREFIX}getinvite <server_id>\``,
                flags: MessageFlags.Ephemeral
            });
        }

        const targetGuildId = args[0];
        const guild = client.guilds.cache.get(targetGuildId); // Lấy guild từ cache

        // 3. Kiểm tra xem bot có ở trong server đó không
        if (!guild) {
            return message.channel.send({
                content: `<@${userId}> Bot không tìm thấy server với ID \`${targetGuildId}\`.`,
                flags: MessageFlags.Ephemeral
            });
        }

        let invite = null;
        let foundChannel = null;

        // 4. Tìm kênh có thể tạo lời mời
        // Ưu tiên các kênh văn bản mặc định hoặc kênh chung
        const channels = guild.channels.cache.filter(c => 
            c.type === ChannelType.GuildText && 
            c.permissionsFor(client.user).has(PermissionsBitField.Flags.CreateInstantInvite)
        ).sort((a, b) => {
            // Sắp xếp để ưu tiên các kênh phổ biến hơn (ví dụ: #general)
            if (a.name === 'general') return -1;
            if (b.name === 'general') return 1;
            return a.position - b.position;
        });

        for (const [channelId, channel] of channels) {
            try {
                // Tạo lời mời có thời hạn 1 giờ (3600 giây) và giới hạn 1 lần sử dụng
                invite = await channel.createInvite({
                    maxAge: 3600, // 1 giờ
                    maxUses: 1,   // 1 lần sử dụng
                    unique: true, // Đảm bảo lời mời là duy nhất
                    reason: `Yêu cầu lời mời bởi chủ bot (${message.author.tag}) cho server ID ${guild.id}.`
                });
                foundChannel = channel;
                break; // Đã tạo được lời mời, thoát vòng lặp
            } catch (error) {
                console.warn(`[GETINVITE_ERROR] Không thể tạo lời mời trong kênh ${channel.name} (ID: ${channel.id}) của guild ${guild.name} (ID: ${guild.id}):`, error.message);
                // Tiếp tục thử kênh khác
            }
        }

        // 5. Gửi lời mời qua DM cho chủ bot
        if (invite && foundChannel) {
            try {
                const ownerDMChannel = await client.users.fetch(userId);
                const embed = new EmbedBuilder()
                    .setColor('#00FF00') // Màu xanh lá cây
                    .setTitle(`🔗 Lời Mời Đến Server: ${guild.name}`)
                    .setDescription(`Đây là lời mời của bạn đến server **${guild.name}**:\n\n**${invite.url}**`)
                    .addFields(
                        { name: 'ID Server', value: `\`${guild.id}\``, inline: true },
                        { name: 'Kênh tạo lời mời', value: `<#${foundChannel.id}> (\`${foundChannel.name}\`)`, inline: true },
                        { name: 'Thời hạn', value: `1 giờ`, inline: true },
                        { name: 'Số lần sử dụng tối đa', value: `1 lần`, inline: true }
                    )
                    .setFooter({ text: 'Lời mời này chỉ có hiệu lực trong thời gian ngắn.' })
                    .setTimestamp();
                
                await ownerDMChannel.send({ embeds: [embed] });
                await message.channel.send({
                    content: `<@${userId}> Lời mời đến server \`${guild.name}\` đã được gửi đến DM của bạn.`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (dmError) {
                console.error(`[GETINVITE_ERROR] Không thể gửi DM lời mời cho chủ bot (${userId}):`, dmError);
                await message.channel.send({
                    content: `<@${userId}> Không thể gửi lời mời đến DM của bạn. Vui lòng kiểm tra cài đặt DM của bạn.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            await message.channel.send({
                content: `<@${userId}> Bot không có quyền tạo lời mời trong bất kỳ kênh nào của server \`${guild.name}\` (ID: \`${guild.id}\`). Vui lòng cấp quyền "Tạo lời mời tức thì" cho bot trong một kênh.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
