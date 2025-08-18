// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Import logger mới
const logger = require('./utils/logger'); // <-- Đảm bảo dòng này đúng đường dẫn

// Import các loader và manager
const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader');
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 
const { startSpawnManager } = require('./utils/managers/spawnManager');
const { loadLanguages } = require('./utils/loaders/languageLoader'); 

// Khởi tạo Client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, 
    ],
});

// Cấu hình bot
client.config = {
    PREFIX: process.env.PREFIX || '!',
    OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID, 
    OWNER_DISCORD_NAME: process.env.OWNER_DISCORD_NAME,
    BOT_STATUS_MESSAGE: process.env.BOT_STATUS_MESSAGE || 'Hello, I\'m Bot by z',
    BOT_STATUS_TYPE: process.env.BOT_STATUS_TYPE || 'Custom',
};

// Import và gán instance database
const { db } = require('./db');
client.db = db;

// Khởi tạo Collections cần thiết cho bot
client.commands = new Collection();
client.cooldowns = new Collection(); 
client.slashCooldowns = new Collection(); 
client.userLanguagePreferences = new Collection(); 

// --- ĐĂNG NHẬP BOT ---
client.login(process.env.DISCORD_TOKEN);

// --- XỬ LÝ SỰ KIỆN KHI BOT ĐÃ SẴN SÀNG ---
client.once('ready', async () => {
    logger.info(`[BOT_CORE]`, `${client.user.tag} đã sẵn sàng!`); // Đã thay đổi từ logger.log thành logger.info

    // --- Tải TẤT CẢ các thành phần khi bot khởi động ---
    loadLanguages(client); // 1. Tải ngôn ngữ trước tiên
    
    // 2. Cấu hình trạng thái bot
    try {
        let statusType;
        switch (client.config.BOT_STATUS_TYPE.toUpperCase()) {
            case 'PLAYING': statusType = ActivityType.Playing; break;
            case 'STREAMING': statusType = ActivityType.Playing; break; 
            case 'LISTENING': statusType = ActivityType.Listening; break;
            case 'WATCHING': statusType = ActivityType.Watching; break;
            case 'COMPETING': statusType = ActivityType.Competing; break;
            case 'CUSTOM': default: statusType = ActivityType.Custom; break;
        }

        client.user.setPresence({
            activities: [{
                name: client.config.BOT_STATUS_MESSAGE,
                type: statusType,
                url: client.config.BOT_STATUS_TYPE.toUpperCase() === 'STREAMING' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : undefined 
            }],
            status: 'online'
        });
        logger.info(`[BOT_CORE]`, `Đã cập nhật trạng thái bot thành công.`); // Đã thay đổi từ logger.log thành logger.info
    } catch (error) {
        logger.warn(`[BOT_CORE_WARN]`, `Không thể đặt trạng thái bot:`, error); // Giữ nguyên logger.warn
    }

    // 3. Khởi động các Manager
    startSpawnManager(client, client.db);
    logger.info(`[BOT_CORE]`, `Đã khởi động Spawn Manager.`); // Đã thay đổi từ logger.log thành logger.info

    setupCleanupHandlers(client, client.db);
    logger.info(`[BOT_CORE]`, `Đã thiết lập Cleanup Handlers.`); // Đã thay đổi từ logger.log thành logger.info

    // 4. Tải Commands (sử dụng loader hiện có)
    const commandsDir = path.join(__dirname, 'commands');
    const slashCommandsDir = path.join(commandsDir, 'slash');
    
    loadCommands(client, commandsDir); 
    loadCommands(client, slashCommandsDir); 
    logger.info(`[BOT_CORE]`, `✅ Đã tải tất cả các lệnh.`); // Đã thay đổi từ logger.log thành logger.info

    // 5. Tải Discord.js Event Handlers (bao gồm cả interactionCreate)
    const handlerDirectories = [
        path.join(__dirname, 'handlers'), 
        path.join(__dirname, 'events')    
    ];

    for (const dirPath of handlerDirectories) {
        if (fs.existsSync(dirPath)) {
            loadDiscordEventHandlers(client, dirPath, client.db);
        } else {
            logger.warn(`[BOT_CORE_WARN]`, `Thư mục event handler không tồn tại: ${dirPath}`); // Giữ nguyên logger.warn
        }
    }
    logger.info(`[BOT_CORE]`, `✅ Đã tải tất cả các Event Handlers.`); // Đã thay đổi từ logger.log thành logger.info
});