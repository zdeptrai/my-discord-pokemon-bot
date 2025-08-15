// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');

const { sendOwnerDM } = require('./utils/errors/errorReporter'); 
const { loadCommands } = require('./utils/loaders/commandLoader');
const { loadDiscordEventHandlers } = require('./utils/loaders/eventLoader'); 
const { setupCleanupHandlers } = require('./utils/managers/cleanupManager'); 
const { startSpawnManager } = require('./utils/managers/spawnManager');

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
client.db = db;

// Khởi tạo Collection Lệnh và Cooldowns một lần duy nhất ở đây
client.commands = new Collection();
client.cooldowns = new Collection(); 
client.slashCooldowns = new Collection(); 

client.login(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`[BOT_CORE] ${client.user.tag} đã sẵn sàng!`);

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

    startSpawnManager(client, client.db);
    console.log(`[BOT_CORE] Đã khởi động Spawn Manager.`);

    setupCleanupHandlers(client, client.db);

    // --- Tải Commands từ cả hai thư mục commands và slash ---
    const fxCommandsPath = path.join(__dirname, 'commands');
    loadCommands(client, fxCommandsPath);

    const slashCommandsPath = path.join(__dirname, 'commands', 'slash');
    loadCommands(client, slashCommandsPath);

    // --- Tải Discord.js Event Handlers từ CẢ HAI thư mục ---
    const handlerDirectories = [
        path.join(__dirname, 'handlers'),
        path.join(__dirname, 'events')
    ];

    for (const dirPath of handlerDirectories) {
        if (fs.existsSync(dirPath)) {
            loadDiscordEventHandlers(client, dirPath, client.db);
        } else {
            console.warn(`[BOT_CORE_WARN] Thư mục event handler không tồn tại: ${dirPath}`);
        }
    }
});
