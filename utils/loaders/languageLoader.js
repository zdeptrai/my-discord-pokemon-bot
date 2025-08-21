// utils/loaders/languageLoader.js
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const logger = require('../logger'); 

/**
 * Tải các file ngôn ngữ từ thư mục 'languages' vào client.languages.
 * @param {Client} client - Đối tượng client của Discord.
 */
function loadLanguages(client) {
    client.languages = new Collection(); 
    logger.info('[LANG_LOADER]', 'Bắt đầu tải các file ngôn ngữ.');

    const langPath = path.join(process.cwd(), 'languages'); 
    
    // Kiểm tra sự tồn tại của thư mục ngôn ngữ
    if (!fs.existsSync(langPath)) {
        logger.fatal(`[LANG_LOADER_FATAL]`, `Thư mục ngôn ngữ không tồn tại: ${langPath}. Bot không thể hoạt động mà không có ngôn ngữ.`);
        // Rất quan trọng: Nếu không có thư mục ngôn ngữ, bot không nên tiếp tục.
        process.exit(1); 
        return; // Đảm bảo thoát
    }

    const langFiles = fs.readdirSync(langPath).filter(file => file.endsWith('.json'));

    // Kiểm tra xem có file ngôn ngữ nào không
    if (langFiles.length === 0) {
        logger.fatal(`[LANG_LOADER_FATAL]`, `Không tìm thấy file .json nào trong thư mục ngôn ngữ: ${langPath}. Bot không thể hoạt động mà không có ngôn ngữ.`);
        process.exit(1); 
        return; // Đảm bảo thoát
    }

    // Tải từng file ngôn ngữ
    for (const file of langFiles) {
        const langCode = file.replace('.json', '');
        try {
            const langData = require(path.join(langPath, file));
            client.languages.set(langCode, langData);
            logger.info(`[LANG_LOADER]`, `✅Đã tải ngôn ngữ: ${langCode}.`);
        } catch (error) {
            logger.error(`[LANG_LOADER_ERROR]`, `Lỗi khi tải file ngôn ngữ ${file}:`, error);
        }
    }

    // Sau khi tải, kiểm tra xem các ngôn ngữ cốt lõi có tồn tại không
    // (Giả định 'en' là ngôn ngữ mặc định/cần thiết nhất để bot hoạt động trơn tru)
    if (!client.languages.has('en')) {
        logger.fatal("[LANG_LOADER_FATAL]", "Không tìm thấy hoặc không tải được ngôn ngữ 'en'. Đây là ngôn ngữ mặc định và cần thiết. Bot sẽ thoát.");
        process.exit(1);
    }
    
    // Bạn có thể thêm kiểm tra cho 'vi' hoặc 'zh-CN' ở cấp độ WARN nếu chúng không bắt buộc
    if (!client.languages.has('vi')) {
        logger.warn("[LANG_LOADER_WARN]", "Không tìm thấy hoặc không tải được ngôn ngữ 'vi'. Một số người dùng có thể không nhận được bản dịch tiếng Việt.");
    }
    if (!client.languages.has('zh-CN')) {
        logger.warn("[LANG_LOADER_WARN]", "Không tìm thấy hoặc không tải được ngôn ngữ 'zh-CN'. Một số người dùng có thể không nhận được bản dịch tiếng Trung.");
    }

    logger.info('[LANG_LOADER]', `✅ Hoàn tất tải các file ngôn ngữ. Tổng số ngôn ngữ đã tải: ${client.languages.size}.`);
}

module.exports = { loadLanguages };