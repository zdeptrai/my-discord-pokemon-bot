// utils/loaders/eventLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { sendOwnerDM } = require('../errors/errorReporter'); 

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
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client, db));
                    }
                } else {
                    console.warn(`[WARNING] Event handler tại ${filePath} thiếu thuộc tính "name" hoặc "execute" bắt buộc.`);
                }
            } catch (error) {
                console.error(`[ERROR] Lỗi khi tải event handler từ ${filePath}:`, error);
                sendOwnerDM(client, `[Lỗi Tải Event Handler] Bot không thể tải event handler từ file: ${file}`, error);
            }
        }
        console.log(`[INFO] Đã tải ${eventFiles.length} event handlers từ thư mục 'handlers'.`);
    } else {
        console.warn(`[WARNING] Thư mục 'handlers' không tồn tại tại ${handlersPath}. Không có event handler nào được tải.`);
    }
}

module.exports = { loadDiscordEventHandlers };
