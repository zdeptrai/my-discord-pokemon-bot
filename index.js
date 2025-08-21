// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

// Import cấu hình của bot (đã có sẵn)
const config = require('./config'); // <-- Dòng này phải nằm ở đây để config được tải sớm

// Import logger mới
const logger = require('./utils/logger'); 

// Import các loader và manager
const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader'); 
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 
const { startSpawnManager } = require('./utils/managers/spawnManager');
const { loadLanguages } = require('./utils/loaders/languageLoader'); 
const { printCommandTable } = require('./utils/display/commandTablePrinter'); 

// Khởi tạo Client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildPresences,
    ],
});

// Gán cấu hình bot từ file config.js vào client
client.config = config; // <-- Gán config đã import vào client.config

// Import và gán instance database
const { db } = require('./db');
client.db = db;

// Khởi tạo Collections cần thiết cho bot
client.commands = new Collection();
client.cooldowns = new Collection(); 
client.slashCooldowns = new Collection(); 
client.userLanguagePreferences = new Collection(); 

// --- ĐĂNG NHẬP BOT ---
// Sử dụng DISCORD_BOT_TOKEN như đã định nghĩa trong config.js của bạn
client.login(process.env.DISCORD_BOT_TOKEN); 

// --- XỬ LÝ SỰ KIỆN KHI BOT ĐÃ SẴN SÀNG ---
client.once('ready', async () => {
    logger.info(`[BOT_CORE]`, `✅ ${client.user.tag} đã sẵn sàng!`); 

    // --- Tải TẤT CẢ các thành phần khi bot khởi động ---
    loadLanguages(client); 
    
    // 2. Cấu hình trạng thái bot
    try {
        let statusType;
        // Sử dụng client.config cho các giá trị cấu hình bot
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
        logger.info(`[BOT_CORE]`, `✅ Đã cập nhật trạng thái bot thành công.`); 
    } catch (error) {
        logger.warn(`[BOT_CORE_WARN]`, `Không thể đặt trạng thái bot:`, error); 
    }

    // 3. Khởi động các Manager
    startSpawnManager(client, client.db);
    logger.pokemon(`[BOT_CORE]`, `Đã khởi động Spawn Manager.`); 

    setupCleanupHandlers(client, client.db);
    logger.pokemon(`[BOT_CORE]`, `Đã thiết lập Cleanup Handlers.`); 

    // 4. Tải Commands (sử dụng loader hiện có)
    const allCommandStatuses = []; // Mảng tổng hợp trạng thái của tất cả các lệnh

    const commandsDir = path.join(__dirname, 'commands');
    const slashCommandsDir = path.join(commandsDir, 'slash');

    // Tải các lệnh từ thư mục "commands" (chứa prefix commands)
    if (fs.existsSync(commandsDir)) {
        // Gọi loadCommands với commandsDir (đường dẫn thư mục)
        allCommandStatuses.push(...loadCommands(client, commandsDir)); // <-- Truyền client vào hàm loadCommands
    } else {
        logger.warn(`[BOT_CORE_WARN]`, `Thư mục commands không tồn tại: ${commandsDir}`);
    }

    // Tải các lệnh từ thư mục "slash" (chứa slash commands)
    if (fs.existsSync(slashCommandsDir)) {
        // Gọi loadCommands với slashCommandsDir (đường dẫn thư mục)
        allCommandStatuses.push(...loadCommands(client, slashCommandsDir)); // <-- Truyền client vào hàm loadCommands
    } else {
        logger.warn(`[BOT_CORE_WARN]`, `Thư mục Slash Commands không tồn tại: ${slashCommandsDir}`);
    }

    // Gọi hàm từ file riêng biệt
    printCommandTable(allCommandStatuses); 
    logger.info(`[BOT_CORE]`, `✅ Hoàn tất tải và hiển thị trạng thái các lệnh.`);

    // 5. Tải Discord.js Event Handlers (bao gồm cả interactionCreate)
    const handlerDirectories = [
        path.join(__dirname, 'handlers'), 
        path.join(__dirname, 'events') 
    ];

    for (const dirPath of handlerDirectories) {
        if (fs.existsSync(dirPath)) {
            loadDiscordEventHandlers(client, dirPath, client.db);
        } else {
            logger.warn(`[BOT_CORE_WARN]`, `Thư mục event handler không tồn tại: ${dirPath}`); 
        }
    }
    logger.info(`[BOT_CORE]`, `✅ Đã tải tất cả các Event Handlers.`);
});