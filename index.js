// index.js
require('dotenv').config(); // <-- Xóa dòng này khi dùng trên Replit

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

client.config = {
    PREFIX: process.env.PREFIX || '!',
    OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID, 
    OWNER_DISCORD_NAME: process.env.OWNOR_DISCORD_NAME, // Lỗi chính tả ở đây: OWNER_DISCORD_NAME
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