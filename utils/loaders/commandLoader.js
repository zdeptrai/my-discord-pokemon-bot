// utils/loader/commandsLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { sendOwnerDM } = require('../errors/errorReporter'); 
const logger = require('../logger'); // <-- Thêm dòng này

/**
 * Tải tất cả các lệnh từ một thư mục cụ thể và thêm vào client.commands.
 * @param {object} client Đối tượng Discord client.
 * @param {string} commandsPath Đường dẫn đến thư mục commands cần tải.
 */
function loadCommands(client, commandsPath) {
    logger.info('[COMMAND_LOADER]', `Bắt đầu tải lệnh từ đường dẫn: ${commandsPath}`); // Log bắt đầu tải
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Slash Command "${command.data.name}" từ ${file}.`);
                } else if ('name' in command && 'execute' in command) {
                    client.commands.set(command.name, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => client.commands.set(alias, command));
                        logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Prefix Command "${command.name}" và các alias (${command.aliases.join(', ')}) từ ${file}.`);
                    } else {
                         logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Prefix Command "${command.name}" từ ${file}.`);
                    }
                } else {
                    logger.warn(`[COMMAND_LOADER_WARN]`, `Lệnh tại ${filePath} thiếu thuộc tính "name"/"data" hoặc "execute" bắt buộc. Bỏ qua.`); // Thay thế console.warn
                }
            } catch (error) {
                logger.error(`[COMMAND_LOADER_ERROR]`, `Lỗi khi tải lệnh từ ${filePath}:`, error); // Thay thế console.error
                sendOwnerDM(client, `[Lỗi Tải Lệnh] Bot không thể tải lệnh từ file: \`${file}\``, error);
            }
        }
        logger.info(`[COMMAND_LOADER]`, `Đã tải ${commandFiles.length} lệnh từ ${commandsPath}. Tổng số lệnh hiện tại: ${client.commands.size}.`); // Thay thế console.log
    } else {
        logger.warn(`[COMMAND_LOADER_WARN]`, `Thư mục 'commands' không tồn tại tại ${commandsPath}. Không có lệnh nào được tải.`); // Thay thế console.warn
    }
}

module.exports = { loadCommands };