// handlers/messageCreate.js
const { Events, MessageFlags, Collection } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils'); 
const { deleteMessageWithTimeout } = require('../utils/core/commonUtils'); 
const { handleMessageResponse } = require('../events/messageResponses');
const { sendOwnerDM } = require('../utils/errors/errorReporter'); 

module.exports = {
    name: Events.MessageCreate,
    once: false,
    // SỬA ĐỔI: Chỉ nhận 'message' làm tham số
    async execute(message) { 
        // client và db có thể truy cập qua message.client và message.client.db
        const client = message.client;
        const db = client.db;

        if (message.author.bot || message.webhookId) return;

        const handledByResponse = await handleMessageResponse(message, client);
        if (handledByResponse) {
            return;
        }

        if (!message.content.startsWith(client.config.PREFIX)) return;

        const args = message.content.slice(client.config.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);

        if (!command || command.data) { 
            return;
        }

        const userId = message.author.id;

        try {
            if (message.deletable && !message.flags.has(MessageFlags.Ephemeral) && !message.reference) {
                await deleteMessageWithTimeout(message, 100, `User command: ${commandName}`);
            }
        } catch (error) {
            console.error(`[DELETE_MESSAGE_ERROR] Không thể xóa tin nhắn lệnh '${message.id}' (Lệnh: ${commandName}):`, error.message);
            sendOwnerDM(client, `[Lỗi Xóa Tin Nhắn] Bot không thể xóa tin nhắn lệnh '${message.id}' (Lệnh: ${commandName})`, error);
        }

        if (commandName !== 'start' && commandName !== 'help' && commandName !== 'setchannel' && commandName !== 'pvp' && commandName !== 'st' && commandName !== 'startev' && commandName !== 'roll') { 
            // SỬ DỤNG db từ client.db
            const registered = await isUserRegistered(userId, db); 
            if (!registered) {
                await message.channel.send({
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
                await message.channel.send({
                    content: `<@${userId}> Vui lòng đợi thêm ${((expirationTime - now) / 1000).toFixed(1)} giây trước khi sử dụng lại lệnh \`${command.name}\`.`,
                    flags: MessageFlags.Ephemeral 
                }).catch(e => console.error("Could not send ephemeral cooldown message:", e));
                return;
            }
        }

        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

        try {
            // Truyền db vào command.execute
            await command.execute(message, args, client, db); 
        } catch (error) {
            console.error(`[COMMAND_EXECUTION_ERROR] Lỗi khi thực thi lệnh '${commandName}':`, error);
            sendOwnerDM(client, `[Lỗi Thực Thi Lệnh] Lệnh: \`${commandName}\` bởi <@${userId}>`, error);
            await message.channel.send({ 
                content: `<@${userId}> Đã có lỗi xảy ra khi thực thi lệnh này! Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral 
            }).catch(e => console.error("Could not send ephemeral error message:", e));
        }
    },
};
