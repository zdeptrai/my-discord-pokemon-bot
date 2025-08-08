// handlers/messageCreate.js
const { Events, MessageFlags, Collection } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { deleteMessageWithTimeout } = require('../utils/core/commonUtils'); 
const { sendOwnerDM, logErrorToFile } = require('../utils/errors/errorReporter'); // Thêm logErrorToFile

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) { 
        const client = message.client;
        const db = client.db;

        if (message.author.bot || message.webhookId) return;

        if (!message.content.startsWith(client.config.PREFIX)) return;

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
            // Ghi lỗi vào file log thay vì gửi DM
            logErrorToFile('COMMAND_EXECUTION_ERROR', message.author.tag, `Lỗi khi thực thi lệnh '${commandName}'`, error); 
            await message.reply({ 
                content: `<@${userId}> Đã có lỗi xảy ra khi thực thi lệnh này! Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send ephemeral error message:", e));
        }
    },
};
