// handlers/messageCreate.js
const { Events, MessageFlags, Collection } = require('discord.js');
// Các import khác không đổi
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { deleteMessageWithTimeout } = require('../utils/core/commonUtils'); 
const { logErrorToFile, sendOwnerDM } = require('../utils/errors/errorReporter'); 
const { getRandomInt, spawnPokemon } = require('../utils/managers/spawnManager');
const logger = require('../utils/logger'); 

const { addXPAndCheckLevelUp, getOrCreateUserProfile } = require('../utils/managers/xpManager'); 
const { createPathSelectorEmbed } = require('../utils/ui/pathSelector');

const everyoneEmojis = ['<a:emoji_47:1240253109754789898>', '<:z001:1412234455510290564>', '<:OO:1395293183268749373>', '<:batngo:1239113374340481095>', '<:fuck:1394925773407912009>', '<:z002:1412236719331348532>', '<:z004:1412242927828209705>'];
const botMentionEmojis = ['<a:emoji_47:1240253109754789898>', '<:z001:1412234455510290564>', '<:OO:1395293183268749373>', '<:batngo:1239113374340481095>', '<:fuck:1394925773407912009>', '<:z002:1412236719331348532>', '<:z004:1412242927828209705>'];

async function reactWithEmojis(message, emojis) {
    for (const emoji of emojis) {
        try {
            await message.react(emoji);
        } catch (error) {
            logger.error(`[EMOJI_REACTION_ERROR] Không thể phản ứng với emoji "${emoji}":`, error);
        }
    }
}

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) { 
        const client = message.client;
        const db = client.db;

        if (message.author.bot || message.webhookId) {
            return;
        }

        logger.message('[MESSAGE_CREATE]', `Tin nhắn mới từ ${message.author.tag} tại kênh ${message.channel.name}: "${message.content}"`);
        
        if (message.mentions.everyone) {
            await reactWithEmojis(message, everyoneEmojis);
        }
        
        if (message.mentions.has(client.user)) {
            await reactWithEmojis(message, botMentionEmojis);
        }

        // Kiểm tra xem tin nhắn có phải là lệnh không
        if (!message.content.startsWith(client.config.PREFIX)) {
            // Nếu không phải lệnh, xử lý XP
            const userProfile = await getOrCreateUserProfile(message.author.id, db);
            if (!userProfile) return;

            if (!userProfile.path_type) {
                try {
                    const { embed, row } = createPathSelectorEmbed(message.author.id);
                    await message.reply({ embeds: [embed], components: [row] });
                } catch (e) {
                    logger.error('[PATH_SELECTOR_ERROR]', `Không thể gửi embed chọn lối đi cho ${message.author.tag}:`, e);
                }
                return; 
            }
            await addXPAndCheckLevelUp(message, db);
            return;
        }
        
        // --- LOGIC XỬ LÝ LỆNH TIỀN TỐ ---
        const args = message.content.slice(client.config.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command || command.data) { 
            logger.debug(`[DEBUG_HELP] Lệnh ${commandName} có data:`, command ? !!command.data : 'Không tìm thấy lệnh');
            return;
        }

        // Kiểm tra đăng ký người dùng, ngoại trừ các lệnh được miễn
        const excludedCommands = ['start', 'help', 'setchannel', 'pvp', 'st', 'startev', 'roll'];
        if (!excludedCommands.includes(commandName)) { 
            const registered = await isUserRegistered(message.author.id, db); 
            if (!registered) {
                try {
                    await message.reply({ content: `<@${message.author.id}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký và bắt đầu.`, flags: MessageFlags.Ephemeral });
                } catch (e) {
                    logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn báo chưa đăng ký:`, e);
                }
                return;
            }
        }

        // --- XỬ LÝ COOLDOWN VÀ THỰC THI LỆNH ---
        const { cooldowns } = client;
        if (!cooldowns.has(command.name)) cooldowns.set(command.name, new Collection());

        const now = Date.now(); 
        const timestamps = cooldowns.get(command.name);
        const cooldownAmount = (command.cooldown || 3) * 1000; 

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                try {
                    await message.reply({ content: `<@${message.author.id}> Vui lòng đợi thêm ${timeLeft} giây trước khi sử dụng lại lệnh \`${command.name}\`.`, flags: MessageFlags.Ephemeral });
                } catch (e) {
                    logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn cooldown:`, e);
                }
                return;
            }
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

        try {
            await command.execute(message, args, client, db); 
        } catch (error) {
            logger.error(`[COMMAND_EXECUTION_ERROR] Lỗi khi thực thi lệnh '${commandName}' của ${message.author.tag}:`, error);
            logErrorToFile('COMMAND_EXECUTION_ERROR', message.author.tag, `Lỗi khi thực thi lệnh '${commandName}'`, error); 
            try {
                await message.reply({ content: `<@${message.author.id}> Đã có lỗi xảy ra khi thực thi lệnh này! Vui lòng thử lại sau.`, flags: MessageFlags.Ephemeral });
            } catch (e) {
                logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn lỗi:`, e);
            }
        }

        // Xóa tin nhắn lệnh gốc nếu có thể
        if (message.deletable && !message.flags.has(MessageFlags.Ephemeral) && !message.reference) {
            await deleteMessageWithTimeout(message, 100, `User command: ${commandName}`);
        }
    },
};