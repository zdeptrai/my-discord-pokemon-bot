// index.js
// require('dotenv').config(); // <-- XÓA DÒNG NÀY KHI CHẠY TRÊN REPLIT

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Cập nhật đường dẫn require cho các module đã di chuyển
const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader'); 
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 

// Khởi tạo client và config
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, 
    ],
});

// Thêm kiểm tra biến môi trường (tùy chọn nhưng nên có)
if (!process.env.DISCORD_TOKEN) {
    console.error('Lỗi: Biến môi trường DISCORD_TOKEN không được thiết lập.');
    process.exit(1); // Thoát ứng dụng nếu thiếu token
}
if (!process.env.DATABASE_URL) {
    console.error('Lỗi: Biến môi trường DATABASE_URL không được thiết lập.');
    process.exit(1); // Thoát ứng dụng nếu thiếu DATABASE_URL
}
// Thêm kiểm tra cho các biến khác nếu bạn muốn bot không chạy khi thiếu config quan trọng
if (!process.env.OWNER_DISCORD_ID) {
    console.warn('Cảnh báo: Biến môi trường OWNER_DISCORD_ID không được thiết lập. Các tính năng liên quan đến chủ sở hữu có thể không hoạt động.');
}


client.config = {
    PREFIX: process.env.PREFIX || '!',
    OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID, 
    OWNER_DISCORD_NAME: process.env.OWNER_DISCORD_NAME, // <-- SỬA LỖI CHÍNH TẢ Ở ĐÂY
    BOT_STATUS_MESSAGE: process.env.BOT_STATUS_MESSAGE || 'Hello, I\'m Bot by z',
    BOT_STATUS_TYPE: process.env.BOT_STATUS_TYPE || 'Custom',
};

// Import database instance (giữ nguyên vị trí db.js)
const { db } = require('./db');
client.db = db; // Gán db vào client để dễ dàng truy cập trong các module khác

// --- Tải Commands ---
const commandsPath = path.join(__dirname, 'commands');
loadCommands(client, commandsPath);

// --- Tải Discord.js Event Handlers ---
// Các event handler của Discord.js (ClientReady, MessageCreate, InteractionCreate)
// sẽ được tải từ thư mục 'handlers'
const handlersPath = path.join(__dirname, 'handlers');
loadDiscordEventHandlers(client, handlersPath, db);

// --- Setup các trình xử lý lỗi process và dọn dẹp ---
setupCleanupHandlers(client, db);

// --- Đăng nhập bot ---
client.login(process.env.DISCORD_TOKEN);