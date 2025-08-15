const { Events, MessageFlags, Collection } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { deleteMessageWithTimeout } = require('../utils/core/commonUtils'); 
const { logErrorToFile } = require('../utils/errors/errorReporter'); 
const { getRandomInt, spawnPokemon } = require('../utils/managers/spawnManager');

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
        } catch (error) {
            console.error(`[EMOJI_REACTION_ERROR] Không thể phản ứng với emoji "${emoji}":`, error);
        }
    }
}

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) { 
        const client = message.client;
        const db = client.db;

        if (message.author.bot || message.webhookId) return;

        // Phản ứng emoji khi có @everyone hoặc tag bot
        if (message.mentions.everyone) {
            await reactWithEmojis(message, everyoneEmojis);
        }
        
        if (message.mentions.has(client.user)) {
            await reactWithEmojis(message, botMentionEmojis);
        }

        // --- XỬ LÝ HỆ THỐNG XP & CẤP ĐỘ ---
        // Chúng ta sẽ xử lý XP cho mọi tin nhắn không phải là lệnh.
        if (!message.content.startsWith(client.config.PREFIX)) {
            // Lấy hồ sơ người dùng để kiểm tra path_type
            const userProfile = await getOrCreateUserProfile(message.author.id, message.guild.id, db);

            // Nếu người dùng chưa chọn lối đi tu luyện
            if (!userProfile.path_type) {
                // Tạo và gửi embed để người dùng chọn
                const { embed, row } = createPathSelectorEmbed(message.author.id);
                
                await message.reply({ 
                    embeds: [embed], 
                    components: [row] 
                });
                
                return; // Dừng xử lý XP cho đến khi người dùng chọn xong
            }

            // Nếu người dùng đã chọn lối đi, tiếp tục xử lý XP như bình thường
            await addXPAndCheckLevelUp(message, db);
            
            return;
        }
        
        // --- LOGIC XỬ LÝ LỆNH ---
        const args = message.content.slice(client.config.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command || command.data) { 
            return;
        }

        const userId = message.author.id;
        
        if (commandName !== 'start' && commandName !== 'help' && commandName !== 'setchannel' && commandName !== 'pvp' && commandName !== 'st' && commandName !== 'startev' && commandName !== 'roll') { 
            const registered = await isUserRegistered(userId, db); 
            if (!registered) {
                await message.reply({
                    content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký và bắt đầu.`,
                    flags: MessageFlags.Ephemeral 
                }).catch(e => console.error("Could not send ephemeral reply to unregistered user message:", e));
                return;
            }
        }

        const { cooldowns } = client;

        if (!cooldowns.has(command.name)) {
            cooldowns.set(command.name, new Collection());
        }

        const now = Date.now(); 
        const timestamps = cooldowns.get(command.name);
        const defaultCooldownDuration = 3; 
        const cooldownAmount = (command.cooldown || defaultCooldownDuration) * 1000; 

        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

            if (now < expirationTime) {
                await message.reply({
                    content: `<@${userId}> Vui lòng đợi thêm ${((expirationTime - now) / 1000).toFixed(1)} giây trước khi sử dụng lại lệnh \`${command.name}\`.`,
                    flags: MessageFlags.Ephemeral 
                }).catch(e => console.error("Could not send ephemeral cooldown message:", e));
                return;
            }
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

        try {
            await command.execute(message, args, client, db); 

            if (message.deletable && !message.flags.has(MessageFlags.Ephemeral) && !message.reference) {
                await deleteMessageWithTimeout(message, 100, `User command: ${commandName}`);
            }
        } catch (error) {
            console.error(`[COMMAND_EXECUTION_ERROR] Lỗi khi thực thi lệnh '${commandName}':`, error);
            logErrorToFile('COMMAND_EXECUTION_ERROR', message.author.tag, `Lỗi khi thực thi lệnh '${commandName}'`, error); 
            await message.reply({ 
                content: `<@${userId}> Đã có lỗi xảy ra khi thực thi lệnh này! Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send ephemeral error message:", e));
        }
    },
};
