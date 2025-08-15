const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config(); // Đảm bảo dotenv được tải để truy cập các biến môi trường

// Lấy các biến môi trường từ file .env
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT;
const GUILD_ID = process.env.DISCORD_GUILDS;

if (!TOKEN || !CLIENT_ID) {
    console.error("Lỗi: Vui lòng đảm bảo DISCORD_TOKEN và CLIENT_ID được đặt trong file .env của bạn.");
    process.exit(1);
}

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFilesOrFolders = fs.readdirSync(foldersPath);

for (const item of commandFilesOrFolders) {
    const itemPath = path.join(foldersPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
        // Đây là một thư mục, duyệt qua các file bên trong
        const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(itemPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.warn(`[Cảnh báo] Lệnh tại ${filePath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
            }
        }
    } else if (stat.isFile() && item.endsWith('.js')) {
        // Đây là một file .js nằm trực tiếp trong thư mục commands
        const command = require(itemPath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[Cảnh báo] Lệnh tại ${itemPath} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
        }
    }
}

// Khởi tạo REST module
const rest = new REST().setToken(TOKEN);

(async () => {
    try {
        console.log(`Đang bắt đầu làm mới ${commands.length} lệnh ứng dụng (/).`);

        let data;
        if (GUILD_ID) {
            // Đăng ký lệnh cục bộ (cho Guild cụ thể)
            console.log(`Đang đăng ký ${commands.length} lệnh mới cho Guild ID: ${GUILD_ID}...`);
            data = await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands },
            );
            console.log(`Đã đăng ký thành công ${data.length} lệnh ứng dụng cho Guild ID: ${GUILD_ID}.`);
        } else {
            // Đăng ký lệnh toàn cục (cho tất cả các Guild mà bot có mặt)
            console.log(`Đang đăng ký ${commands.length} lệnh mới toàn cục...`);
            data = await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
            console.log(`Đã đăng ký thành công ${data.length} lệnh ứng dụng toàn cục.`);
        }
    } catch (error) {
        console.error("Lỗi khi triển khai lệnh:", error);
    }
})();
