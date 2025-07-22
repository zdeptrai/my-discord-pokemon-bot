// utils/loaders/commandLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const { sendOwnerDM } = require('../errors/errorReporter'); 

/**
 * Tải tất cả các lệnh từ thư mục 'commands' và lưu vào client.commands.
 * @param {object} client Đối tượng Discord client.
 * @param {string} commandsPath Đường dẫn đến thư mục commands.
 */
function loadCommands(client, commandsPath) {
    client.commands = new Collection();
    client.cooldowns = new Collection(); 
    client.slashCooldowns = new Collection(); 

    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                } else if ('name' in command && 'execute' in command) {
                    client.commands.set(command.name, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => client.commands.set(alias, command));
                    }
                } else {
                    console.warn(`[WARNING] Lệnh tại ${filePath} thiếu thuộc tính "name"/"data" hoặc "execute" bắt buộc.`);
                }
            } catch (error) {
                console.error(`[ERROR] Lỗi khi tải lệnh từ ${filePath}:`, error);
                sendOwnerDM(client, `[Lỗi Tải Lệnh] Bot không thể tải lệnh từ file: ${file}`, error);
            }
        }
        console.log(`[INFO] Đã tải ${client.commands.size} lệnh.`);
    } else {
        console.warn(`[WARNING] Thư mục 'commands' không tồn tại tại ${commandsPath}. Không có lệnh nào được tải.`);
    }
}

module.exports = { loadCommands };
