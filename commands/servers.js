// commands/servers.js
const { EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'servers',
    description: 'Hiển thị danh sách tất cả các server mà bot đang tham gia.',
    aliases: ['guilds', 'mysv'],
    usage: '',
    cooldown: 10, // Cooldown để tránh spam

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const guilds = client.guilds.cache; // Lấy tất cả các guild mà bot đang ở trong cache

        const embed = new EmbedBuilder()
            .setColor('#7289DA') // Màu xanh Discord
            .setTitle('🌐 Các Server Bot Đang Hoạt Động 🌐')
            .setDescription(`Bot hiện đang có mặt trong **${guilds.size}** server.`);

        let count = 0;
        const maxFields = 25; // Giới hạn số lượng trường trong một Embed của Discord

        // Duyệt qua từng guild và thêm vào embed
        for (const [guildId, guild] of guilds) {
            if (count >= maxFields) {
                embed.setFooter({ text: `Và ${guilds.size - count} server khác...` });
                break; // Dừng nếu đạt giới hạn trường
            }

            // Để lấy tên chủ sở hữu, chúng ta cần fetch member hoặc dựa vào ownerId
            // guild.ownerId là ID của chủ sở hữu.
            // Để tránh các lời gọi API không cần thiết và giữ cho lệnh nhanh, chúng ta sẽ chỉ hiển thị ID.
            // Nếu bạn muốn tên người dùng, bạn sẽ cần client.users.fetch(guild.ownerId)
            // nhưng điều đó có thể làm chậm lệnh nếu bot ở trong nhiều server.

            embed.addFields({
                name: `\`${guild.name}\``,
                value: `**ID:** \`${guild.id}\`\n**Thành viên:** \`${guild.memberCount}\`\n**Chủ sở hữu ID:** \`${guild.ownerId}\``,
                inline: false // Mỗi server một trường riêng
            });
            count++;
        }

        embed.setTimestamp();
        embed.setFooter({ text: `Yêu cầu bởi ${message.author.username}` });

        await message.channel.send({ embeds: [embed] }).catch(e => console.error("Could not send servers list message:", e));
    },
};
