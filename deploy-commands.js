// deploy-commands.js
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config(); // Đảm bảo dotenv được tải để truy cập các biến môi trường

// Lấy các biến môi trường từ file .env
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT;
// GUILD_ID là tùy chọn. Nếu bạn muốn triển khai lệnh toàn cục, hãy bỏ qua hoặc để trống.
// Nếu bạn muốn triển khai lệnh cục bộ cho một guild cụ thể (thường dùng khi phát triển), hãy điền ID guild vào đây.
const GUILD_ID = process.env.DISCORD_GUILDS; // Ví dụ: 'YOUR_GUILD_ID_HERE'

if (!TOKEN || !CLIENT_ID) {
    console.error("Lỗi: Vui lòng đảm bảo DISCORD_TOKEN và CLIENT_ID được đặt trong file .env của bạn.");
    process.exit(1);
}

const commands = [];
// Lấy đường dẫn đến thư mục chứa các lệnh
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    // Kiểm tra xem lệnh có thuộc tính 'data' (SlashCommandBuilder) không
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.warn(`[Cảnh báo] Lệnh tại ${path.join(commandsPath, file)} thiếu thuộc tính "data" hoặc "execute" bắt buộc.`);
    }
}

// Khởi tạo REST module
const rest = new REST().setToken(TOKEN);

(async () => {
    try {
        console.log(`Đang bắt đầu làm mới ${commands.length} lệnh ứng dụng (/).`);

        // --- XÓA CÁC LỆNH CŨ (TÙY CHỌN) ---
        // Cảnh báo: Việc xóa lệnh toàn cục có thể mất đến 1 giờ để có hiệu lực.
        // Chỉ nên thực hiện khi bạn chắc chắn muốn xóa tất cả lệnh cũ.

        // Xóa tất cả lệnh toàn cục (Global Commands)
        // console.log('Đang xóa tất cả lệnh toàn cục cũ...');
        // await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        // console.log('Đã xóa tất cả lệnh toàn cục cũ thành công.');

        // Xóa tất cả lệnh cục bộ cho một Guild cụ thể (Guild Commands)
        // Nếu bạn đang phát triển, đây là cách nhanh nhất để xóa và cập nhật lệnh.
        if (GUILD_ID) {
            console.log(`Đang xóa tất cả lệnh cục bộ cũ cho Guild ID: ${GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
            console.log(`Đã xóa tất cả lệnh cục bộ cũ cho Guild ID: ${GUILD_ID} thành công.`);
        } else {
            console.warn('Cảnh báo: Không có GUILD_ID được cung cấp trong .env. Sẽ không xóa lệnh cục bộ.');
        }

        // --- ĐĂNG KÝ CÁC LỆNH MỚI ---
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
        // Và dĩ nhiên, hãy bắt lỗi!
        console.error("Lỗi khi triển khai lệnh:", error);
    }
})();
