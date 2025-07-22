// deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const CLIENT_ID = process.env.DISCORD_CLIENT;   // Sử dụng DISCORD_CLIENT
const GUILD_ID = process.env.DISCORD_GUILDS;    // Sử dụng DISCORD_GUILDS
const BOT_TOKEN = process.env.DISCORD_TOKEN;    // Sử dụng DISCORD_TOKEN

if (!CLIENT_ID || !BOT_TOKEN) {
    console.error("Thiếu DISCORD_CLIENT hoặc DISCORD_TOKEN trong file .env. Vui lòng kiểm tra lại.");
    process.exit(1);
}

const commands = [];
// Lấy tất cả các file lệnh từ thư mục commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // Đảm bảo lệnh có thuộc tính 'data' (cho Slash Command) và 'execute'
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.warn(`[WARNING] Lệnh tại ${file} thiếu thuộc tính "data" hoặc "execute" bắt buộc cho Slash Command.`);
    }
}

// Khởi tạo REST module
const rest = new REST().setToken(BOT_TOKEN);

// Lấy đối số từ dòng lệnh (ví dụ: node deploy-commands.js clear)
const args = process.argv.slice(2);
const shouldClear = args.includes('clear');

// Triển khai hoặc xóa lệnh
(async () => {
    try {
        if (shouldClear) {
            console.log(`Bắt đầu xóa tất cả các lệnh ứng dụng (/).`);

            let data;
            if (GUILD_ID) {
                // Xóa lệnh CỤ THỂ CHO MỘT GUILD
                console.log(`Đang xóa lệnh cho Guild ID: ${GUILD_ID}`);
                data = await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                    { body: [] }, // Gửi mảng trống để xóa tất cả lệnh
                );
            } else {
                // Xóa lệnh TOÀN CỤC
                console.log("Đang xóa lệnh TOÀN CỤC (không có GUILD_ID được cung cấp).");
                data = await rest.put(
                    Routes.applicationCommands(CLIENT_ID),
                    { body: [] }, // Gửi mảng trống để xóa tất cả lệnh
                );
            }
            console.log(`Đã xóa thành công ${data.length} lệnh ứng dụng (/).`);
            console.log("Bạn có thể cần đợi một vài phút để thay đổi hiển thị trên Discord.");
        } else {
            console.log(`Bắt đầu làm mới ${commands.length} lệnh ứng dụng (/).`);

            let data;
            if (GUILD_ID) {
                // Triển khai lệnh CỤ THỂ CHO MỘT GUILD
                console.log(`Đang triển khai lệnh cho Guild ID: ${GUILD_ID}`);
                data = await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                    { body: commands },
                );
            } else {
                // Triển khai lệnh TOÀN CỤC
                console.log("Đang triển khai lệnh TOÀN CỤC (không có GUILD_ID được cung cấp).");
                data = await rest.put(
                    Routes.applicationCommands(CLIENT_ID),
                    { body: commands },
                );
            }

            console.log(`Đã làm mới thành công ${data.length} lệnh ứng dụng (/).`);
        }
    } catch (error) {
        console.error("Lỗi khi triển khai/xóa lệnh:", error);
    }
})();
