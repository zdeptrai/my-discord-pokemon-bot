// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Cập nhật đường dẫn require cho các module đã di chuyển
const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader');
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 
const { startSpawnManager } = require('./utils/managers/spawnManager'); // Đã thêm: Import spawn manager

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
    OWNER_DISCORD_NAME: process.env.OWNER_DISCORD_NAME,
    BOT_STATUS_MESSAGE: process.env.BOT_STATUS_MESSAGE || 'Hello, I\'m Bot by z',
    BOT_STATUS_TYPE: process.env.BOT_STATUS_TYPE || 'Custom',
};

// Import database instance
const { db } = require('./db');
client.db = db; // Gán db vào client để dễ dàng truy cập trong các module khác

// --- ĐĂNG NHẬP BOT TRƯỚC HẾT ---
client.login(process.env.DISCORD_TOKEN);

// --- TẢI CÁC TÁC VỤ KHI BOT SẴN SÀNG ---
client.once('ready', async () => {
    console.log(`[BOT_CORE] ${client.user.tag} đã sẵn sàng!`);

    // --- Cập nhật trạng thái của bot ---
    try {
        let statusType;
        switch (client.config.BOT_STATUS_TYPE.toUpperCase()) {
            case 'PLAYING':
                statusType = ActivityType.Playing;
                break;
            case 'STREAMING':
                statusType = ActivityType.Streaming;
                break;
            case 'LISTENING':
                statusType = ActivityType.Listening;
                break;
            case 'WATCHING':
                statusType = ActivityType.Watching;
                break;
            case 'COMPETING':
                statusType = ActivityType.Competing;
                break;
            case 'CUSTOM':
            default:
                statusType = ActivityType.Custom;
                break;
        }

        client.user.setPresence({
            activities: [{
                name: client.config.BOT_STATUS_MESSAGE,
                type: statusType,
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
            }],
            status: 'online'
        });
        console.log(`[BOT_CORE] Đã cập nhật trạng thái bot thành công.`);
    } catch (error) {
        console.warn(`[BOT_CORE_WARN] Không thể đặt trạng thái bot:`, error);
    }

    // --- Khởi động Spawn Manager ---
    // Đây là bước quan trọng để kích hoạt tính năng spawn Pokémon
    startSpawnManager(client, db); 
    console.log(`[BOT_CORE] Đã khởi động Spawn Manager.`);

    // --- Setup các trình xử lý lỗi process và dọn dẹp ---
    setupCleanupHandlers(client, db);

    // --- Tải Commands ---
    const commandsPath = path.join(__dirname, 'commands');
    loadCommands(client, commandsPath);

    // --- Tải Discord.js Event Handlers từ CẢ HAI thư mục ---
    const handlerDirectories = [
        path.join(__dirname, 'handlers'),
        path.join(__dirname, 'events')
    ];

    for (const dirPath of handlerDirectories) {
        if (fs.existsSync(dirPath)) {
            loadDiscordEventHandlers(client, dirPath, db);
        } else {
            console.warn(`[BOT_CORE_WARN] Thư mục event handler không tồn tại: ${dirPath}`);
        }
    }
});
