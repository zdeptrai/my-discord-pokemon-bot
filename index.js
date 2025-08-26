// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

const config = require('./config'); 
const logger = require('./utils/logger'); 
const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader'); 
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 
const { startSpawnManager } = require('./utils/managers/spawnManager');
const { loadLanguages } = require('./utils/loaders/languageLoader'); 
const { printCommandTable } = require('./utils/display/commandTablePrinter'); 
const { startOnlineLinhThachReward } = require('./utils/managers/onlineLinhThachManager'); 

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

client.config = config; 
const { db } = require('./db');
client.db = db;

// Khởi tạo tất cả Collections cần thiết
client.commands = new Collection();
client.cooldowns = new Collection(); 
client.slashCooldowns = new Collection(); 
client.userLanguagePreferences = new Collection(); 
client.handlers = new Collection();
client.slashCommandIds = new Collection(); // THÊM DÒNG NÀY

// --- Tải các handlers tiện ích ---
const handlersPath = path.join(__dirname, 'handlers');
if (fs.existsSync(handlersPath)) {
    const handlerFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));
    for (const file of handlerFiles) {
        const filePath = path.join(handlersPath, file);
        const handler = require(filePath);
        if ('name' in handler && 'execute' in handler) {
            client.handlers.set(handler.name, handler);
            logger.info(`[HANDLER_LOADER]`, `✅ Đã tải handler: ${handler.name}`);
        } else {
            logger.warn(`[HANDLER_LOADER_WARN]`, `File ${file} không phải là một handler hợp lệ.`);
        }
    }
} else {
    logger.warn(`[BOT_CORE_WARN]`, `Thư mục handlers không tồn tại: ${handlersPath}`);
}
logger.info(`[BOT_CORE]`, `✅ Hoàn tất tải tất cả các Handlers tiện ích.`);

// --- Tải các lệnh (commands) ---
const allCommandStatuses = []; 
const commandsDir = path.join(__dirname, 'commands');
const slashCommandsDir = path.join(commandsDir, 'slash');
if (fs.existsSync(commandsDir)) {
    allCommandStatuses.push(...loadCommands(client, commandsDir)); 
} else {
    logger.warn(`[BOT_CORE_WARN]`, `Thư mục commands không tồn tại: ${commandsDir}`);
}
if (fs.existsSync(slashCommandsDir)) {
    allCommandStatuses.push(...loadCommands(client, slashCommandsDir)); 
} else {
    logger.warn(`[BOT_CORE_WARN]`, `Thư mục Slash Commands không tồn tại: ${slashCommandsDir}`);
}
printCommandTable(allCommandStatuses); 
logger.info(`[BOT_CORE]`, `✅ Hoàn tất tải và hiển thị trạng thái các lệnh.`);

// --- Đăng nhập bot ---
client.login(process.env.DISCORD_BOT_TOKEN); 

// --- Xử lý sự kiện khi bot đã sẵn sàng ---
client.once('ready', async () => {
    logger.info(`[BOT_CORE]`, `✅ ${client.user.tag} đã sẵn sàng!`); 

    // --- Tải ID của các lệnh đã được deploy ---
    try {
        const applicationCommands = await client.application.commands.fetch();
        for (const [id, command] of applicationCommands) {
            if (client.commands.has(command.name)) {
                client.slashCommandIds.set(command.name, command.id);
            }
        }
        logger.info('[SLASH_COMMAND_IDS]', `Đã tải thành công ID của ${client.slashCommandIds.size} lệnh slash.`);
    } catch (error) {
        logger.error('[SLASH_COMMAND_IDS_ERROR]', `Không thể lấy ID của các lệnh slash:`, error);
    }
    
    // ... (các logic khác trong ready event không đổi) ...
    loadLanguages(client); 
    
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
        logger.info(`[BOT_CORE]`, `✅ Đã cập nhật trạng thái bot thành công.`); 
    } catch (error) {
        logger.warn(`[BOT_CORE_WARN]`, `Không thể đặt trạng thái bot:`, error); 
    }

    startSpawnManager(client, client.db);
    logger.pokemon(`[BOT_CORE]`, `Đã khởi động Spawn Manager.`); 

    setupCleanupHandlers(client, client.db);
    logger.pokemon(`[BOT_CORE]`, `Đã thiết lập Cleanup Handlers.`); 

    startOnlineLinhThachReward(client, client.db); 

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