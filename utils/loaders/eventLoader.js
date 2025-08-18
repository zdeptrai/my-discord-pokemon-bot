// utils/loaders/eventLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { sendOwnerDM } = require('../errors/errorReporter'); 
const logger = require('../logger'); // <-- Thêm dòng này

/**
 * Tải tất cả các event handlers của Discord.js từ thư mục 'handlers' và đăng ký chúng.
 * @param {object} client Đối tượng Discord client.
 * @param {string} handlersPath Đường dẫn đến thư mục handlers.
 * @param {object} db Đối tượng Knex database instance.
 */
function loadDiscordEventHandlers(client, handlersPath, db) {
    if (fs.existsSync(handlersPath)) {
        const eventFiles = fs.readdirSync(handlersPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(handlersPath, file);
            try {
                const event = require(filePath);
                if ('name' in event && 'execute' in event) {
                    // SỬA ĐỔI QUAN TRỌNG: Truyền client và db vào hàm execute
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client, db)); 
                        logger.debug('[EVENT_LOADER_DEBUG]', `Đã đăng ký event handler "once" cho sự kiện "${event.name}" từ ${file}.`);
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client, db));
                        logger.debug('[EVENT_LOADER_DEBUG]', `Đã đăng ký event handler "on" cho sự kiện "${event.name}" từ ${file}.`);
                    }
                } else {
                    logger.warn(`[EVENT_LOADER_WARN]`, `Event handler tại ${filePath} thiếu thuộc tính "name" hoặc "execute" bắt buộc. Bỏ qua.`); // Thay thế console.warn
                }
            } catch (error) {
                logger.error(`[EVENT_LOADER_ERROR]`, `Lỗi khi tải event handler từ ${filePath}:`, error); // Thay thế console.error
                sendOwnerDM(client, `[Lỗi Tải Event Handler] Bot không thể tải event handler từ file: \`${file}\``, error);
            }
        }
    } else {
        logger.warn(`[EVENT_LOADER_WARN]`, `Thư mục 'handlers' không tồn tại tại ${handlersPath}. Không có event handler nào được tải.`); // Thay thế console.warn
    }
}

module.exports = { loadDiscordEventHandlers };