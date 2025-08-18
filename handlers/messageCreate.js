// handlers/messageCreate.js
const { Events, MessageFlags, Collection } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { deleteMessageWithTimeout } = require('../utils/core/commonUtils'); 
const { logErrorToFile } = require('../utils/errors/errorReporter'); 
const { getRandomInt, spawnPokemon } = require('../utils/managers/spawnManager');
const logger = require('../utils/logger'); // <-- Đảm bảo đã import logger

// Import các chức năng cần thiết từ xpManager và các file mới
const { addXPAndCheckLevelUp, getOrCreateUserProfile } = require('../utils/managers/xpManager'); 
const { createPathSelectorEmbed } = require('../utils/ui/pathSelector');

// --- ĐỊNH NGHĨA CÁC EMOJI TÙY CHỈNH DÙNG CHO BOT ---
const everyoneEmojis = ['✅', '🎉', '📢'];
const botMentionEmojis = ['🤖', '👋', '👀'];
// --- KẾT THÚC ĐỊNH NGHĨA ---

async function reactWithEmojis(message, emojis) {
    for (const emoji of emojis) {
        try {
            await message.react(emoji);
            logger.debug(`[EMOJI_REACTION_SUCCESS] Đã phản ứng với emoji "${emoji}" trên tin nhắn của ${message.author.tag}.`);
        } catch (error) {
            logger.error(`[EMOJI_REACTION_ERROR] Không thể phản ứng với emoji "${emoji}" trên tin nhắn của ${message.author.tag}:`, error);
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
            // Sử dụng tag MESSAGE_SKIP để dễ dàng phân biệt trong log message nếu cần
            // logger.message('[MESSAGE_SKIP]', `Bỏ qua tin nhắn từ bot hoặc webhook: ${message.author.tag} (${message.author.id})`);
            return;
        }

        // --- GHI LOG TIN NHẮN VÀO FILE RIÊNG ---
        // Sử dụng logger.message để ghi log tin nhắn vào file messages.log
        logger.message('[MESSAGE_CREATE]', `Tin nhắn mới từ ${message.author.tag} (${message.author.id}) tại kênh ${message.channel.name} (${message.channel.id}): "${message.content}"`);
        
        // Bạn có thể giữ hoặc xóa dòng logger.info dưới đây tùy theo nhu cầu.
        // Nếu muốn có một cái nhìn tổng quan về số lượng tin nhắn trong log chính (bot.log), hãy giữ lại.
        // Nếu muốn log chính hoàn toàn sạch sẽ khỏi chi tiết tin nhắn, hãy xóa nó.
        // logger.info('[MESSAGE_RECEIVED_SUMMARY]', `Tin nhắn từ ${message.author.tag} tại ${message.channel.name}.`);


        // Phản ứng emoji khi có @everyone hoặc tag bot
        if (message.mentions.everyone) {
            logger.debug('[MESSAGE_MENTION]', `Tin nhắn có nhắc đến @everyone.`);
            await reactWithEmojis(message, everyoneEmojis);
        }
        
        if (message.mentions.has(client.user)) {
            logger.debug('[MESSAGE_MENTION]', `Tin nhắn có nhắc đến bot.`);
            await reactWithEmojis(message, botMentionEmojis);
        }

        // --- XỬ LÝ HỆ THỐNG XP & CẤP ĐỘ ---
        // Chúng ta sẽ xử lý XP cho mọi tin nhắn không phải là lệnh.
        if (!message.content.startsWith(client.config.PREFIX)) {
            logger.debug('[MESSAGE_TYPE]', `Tin nhắn không phải là lệnh. Xử lý XP.`);
            // Lấy hồ sơ người dùng để kiểm tra path_type
            const userProfile = await getOrCreateUserProfile(message.author.id, message.guild.id, db);

            // Nếu người dùng chưa chọn lối đi tu luyện
            if (!userProfile.path_type) {
                logger.info('[PATH_SELECTION_REQUIRED]', `Người dùng ${message.author.tag} chưa chọn lối đi. Yêu cầu chọn lối đi.`);
                // Tạo và gửi embed để người dùng chọn
                const { embed, row } = createPathSelectorEmbed(message.author.id);
                
                try {
                    await message.reply({ 
                        embeds: [embed], 
                        components: [row] 
                    });
                    logger.debug('[PATH_SELECTOR_SENT]', `Đã gửi embed chọn lối đi cho ${message.author.tag}.`);
                } catch (e) {
                    logger.error('[PATH_SELECTOR_ERROR]', `Không thể gửi embed chọn lối đi cho ${message.author.tag}:`, e);
                }
                
                return; // Dừng xử lý XP cho đến khi người dùng chọn xong
            }

            // Nếu người dùng đã chọn lối đi, tiếp tục xử lý XP như bình thường
            logger.debug('[XP_PROCESSING]', `Người dùng ${message.author.tag} đã chọn lối đi. Tiến hành cộng XP.`);
            await addXPAndCheckLevelUp(message, db);
            
            return;
        }
        
        // --- LOGIC XỬ LÝ LỆNH ---
        logger.debug('[MESSAGE_TYPE]', `Tin nhắn là lệnh. Bắt đầu xử lý lệnh.`);
        const args = message.content.slice(client.config.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        logger.debug('[COMMAND_PARSED]', `Lệnh: "${commandName}", Đối số: "${args.join(' ')}"`);

        const command = client.commands.get(commandName);

        if (!command || command.data) { 
            logger.debug('[COMMAND_INVALID]', `Lệnh "${commandName}" không hợp lệ hoặc là Slash Command. Bỏ qua.`);
            return;
        }

        const userId = message.author.id;
        
        // Kiểm tra đăng ký người dùng cho các lệnh yêu cầu đăng ký
        if (!['start', 'help', 'setchannel', 'pvp', 'st', 'startev', 'roll'].includes(commandName)) { 
            logger.debug('[USER_REGISTRATION_CHECK]', `Kiểm tra đăng ký cho lệnh "${commandName}" từ người dùng ${userId}.`);
            const registered = await isUserRegistered(userId, db); 
            if (!registered) {
                logger.info('[UNREGISTERED_USER]', `Người dùng ${message.author.tag} chưa đăng ký và cố gắng sử dụng lệnh "${commandName}".`);
                try {
                    await message.reply({
                        content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký và bắt đầu.`,
                        flags: MessageFlags.Ephemeral 
                    });
                    logger.debug('[UNREGISTERED_MESSAGE_SENT]', `Đã gửi thông báo chưa đăng ký cho ${userId}.`);
                } catch (e) {
                    logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn báo chưa đăng ký cho ${userId}:`, e);
                }
                return;
            }
        }

        // --- XỬ LÝ COOLDOWN ---
        const { cooldowns } = client;

        if (!cooldowns.has(command.name)) {
            logger.debug('[COOLDOWN_INIT]', `Khởi tạo cooldown collection cho lệnh "${command.name}".`);
            cooldowns.set(command.name, new Collection());
        }

        const now = Date.now(); 
        const timestamps = cooldowns.get(command.name);
        const defaultCooldownDuration = 3; 
        const cooldownAmount = (command.cooldown || defaultCooldownDuration) * 1000; 

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                logger.info('[COOLDOWN_ACTIVE]', `Người dùng ${message.author.tag} đang trong thời gian cooldown cho lệnh "${command.name}". Còn lại ${timeLeft}s.`);
                try {
                    await message.reply({
                        content: `<@${userId}> Vui lòng đợi thêm ${timeLeft} giây trước khi sử dụng lại lệnh \`${command.name}\`.`,
                        flags: MessageFlags.Ephemeral 
                    });
                    logger.debug('[COOLDOWN_MESSAGE_SENT]', `Đã gửi tin nhắn cooldown cho ${userId}.`);
                } catch (e) {
                    logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn cooldown cho ${userId}:`, e);
                }
                return;
            }
        }

        timestamps.set(message.author.id, now);
        logger.debug('[COOLDOWN_SET]', `Thiết lập cooldown cho ${userId} trên lệnh "${command.name}".`);
        setTimeout(() => {
            timestamps.delete(message.author.id);
            logger.debug('[COOLDOWN_CLEARED]', `Đã xóa cooldown cho ${userId} trên lệnh "${command.name}".`);
        }, cooldownAmount);

        // --- THỰC THI LỆNH ---
        try {
            logger.info('[COMMAND_EXECUTION]', `Thực thi lệnh "${commandName}" cho người dùng ${message.author.tag}.`);
            await command.execute(message, args, client, db); 

            // Xóa tin nhắn lệnh gốc nếu có thể và không phải là ephemeral hoặc reply
            if (message.deletable && !message.flags.has(MessageFlags.Ephemeral) && !message.reference) {
                await deleteMessageWithTimeout(message, 100, `User command: ${commandName}`);
                logger.debug('[MESSAGE_DELETED]', `Đã xóa tin nhắn lệnh gốc của ${message.author.tag} cho lệnh "${commandName}".`);
            }
        } catch (error) {
            logger.error(`[COMMAND_EXECUTION_ERROR] Lỗi khi thực thi lệnh '${commandName}' của ${message.author.tag}:`, error);
            logErrorToFile('COMMAND_EXECUTION_ERROR', message.author.tag, `Lỗi khi thực thi lệnh '${commandName}'`, error); 
            try {
                await message.reply({ 
                    content: `<@${userId}> Đã có lỗi xảy ra khi thực thi lệnh này! Vui lòng thử lại sau.`,
                    flags: MessageFlags.Ephemeral 
                });
                logger.debug('[COMMAND_ERROR_MESSAGE_SENT]', `Đã gửi tin nhắn lỗi thực thi lệnh cho ${userId}.`);
            } catch (e) {
                logger.error('[REPLY_ERROR]', `Không thể gửi tin nhắn lỗi thực thi lệnh cho ${userId}:`, e);
            }
        }
    },
};