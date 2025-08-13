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
// Sau đó, khi bot sẵn sàng, nó sẽ chạy các hàm khởi tạo khác
client.login(process.env.DISCORD_TOKEN);

// --- TẢI CÁC TÁC VỤ KHI BOT SẴN SÀNG ---
// Tất cả các tác vụ khởi tạo đều nằm trong sự kiện 'ready' để đảm bảo bot đã đăng nhập
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
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // URL chỉ cần thiết cho trạng thái STREAMING
            }],
            status: 'online' // Bạn có thể đặt là 'idle', 'dnd' (do not disturb), 'online'
        });
        console.log(`[BOT_CORE] Đã cập nhật trạng thái bot thành công.`);
    } catch (error) {
        console.warn(`[BOT_CORE_WARN] Không thể đặt trạng thái bot:`, error);
    }

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
