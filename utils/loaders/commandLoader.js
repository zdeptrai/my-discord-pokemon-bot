// utils/loaders/commandLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { sendOwnerDM } = require('../errors/errorReporter'); 
const logger = require('../logger'); 

/**
 * Tải tất cả các lệnh từ một thư mục cụ thể và thêm vào client.commands.
 * Ghi lại trạng thái tải của từng lệnh.
 * @param {object} client Đối tượng Discord client.
 * @param {string} commandsPath Đường dẫn đến thư mục commands cần tải.
 * @returns {Array<Object>} Một mảng các đối tượng chứa tên, kiểu và trạng thái tải của lệnh.
 */
function loadCommands(client, commandsPath) {
    logger.info('[COMMAND_LOADER]', `Bắt đầu tải lệnh từ đường dẫn: ${commandsPath}`); 
    const commandStatuses = []; // Mảng để lưu trạng thái tải của từng lệnh

    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            let commandName = file.replace('.js', ''); // Tên lệnh mặc định là tên file
            let status = '❌'; // Mặc định là thất bại
            let type = 'Unknown'; // Thêm kiểu lệnh để phân biệt (Slash/Prefix)

            try {
                // Xóa cache của module để đảm bảo tải lại mới nhất (quan trọng khi dùng hot-reload)
                delete require.cache[require.resolve(filePath)]; 
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    // Xử lý Slash Command
                    commandName = command.data.name;
                    client.commands.set(commandName, command);
                    status = '✅'; 
                    type = 'Slash';
                    logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Slash Command "${command.data.name}" từ ${file}.`);
                } else if ('name' in command && 'execute' in command) {
                    // Xử lý Prefix Command
                    commandName = command.name;
                    client.commands.set(command.name, command);
                    status = '✅';
                    type = 'Prefix';
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => client.commands.set(alias, command));
                        logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Prefix Command "${command.name}" và các alias (${command.aliases.join(', ')}) từ ${file}.`);
                    } else {
                        logger.debug('[COMMAND_LOADER_DEBUG]', `Đã tải lệnh Prefix Command "${command.name}" từ ${file}.`);
                    }
                } else {
                    // Lệnh không hợp lệ (thiếu data/name hoặc execute)
                    status = '⚠️'; // Cảnh báo
                    logger.warn(`[COMMAND_LOADER_WARN]`, `Lệnh tại ${filePath} thiếu thuộc tính "name"/"data" hoặc "execute" bắt buộc. Bỏ qua.`); 
                }
            } catch (error) {
                // Lỗi khi require hoặc thực thi lệnh (lỗi cú pháp, v.v.)
                logger.error(`[COMMAND_LOADER_ERROR]`, `Lỗi khi tải lệnh từ ${filePath}:`, error); 
                sendOwnerDM(client, `[Lỗi Tải Lệnh] Bot không thể tải lệnh từ file: \`${file}\``, error);
                status = '❌'; 
            } finally {
                // Đẩy thông tin trạng thái vào mảng, bao gồm cả kiểu lệnh
                commandStatuses.push({ name: commandName, type: type, status: status });
            }
        }
        logger.info(`[COMMAND_LOADER]`, `✅ Hoàn tất tải lệnh từ ${commandsPath}.`); 
    } else {
        logger.warn(`[COMMAND_LOADER_WARN]`, `Thư mục 'commands' không tồn tại tại ${commandsPath}. Không có lệnh nào được tải.`); 
    }
    return commandStatuses; // Trả về mảng trạng thái
}

module.exports = { loadCommands };