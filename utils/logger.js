// utils/logger.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const moment = require('moment-timezone'); 
const chalk = require('chalk');

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
    MESSAGE: 5 
};

// Cấu hình từ .env cho Console Output
const CONSOLE_CONFIG = {
    debug: process.env.CONSOLE_LOG_DEBUG === 'true',
    info: process.env.CONSOLE_LOG_INFO === 'true',
    warn: process.env.CONSOLE_LOG_WARN === 'true',
    error: process.env.CONSOLE_LOG_ERROR === 'true',
    fatal: process.env.CONSOLE_LOG_FATAL === 'true',
    message: process.env.CONSOLE_LOG_MESSAGE === 'true', // <-- Thêm cấu hình cho console message log
};

// Cấu hình từ .env cho File Logging
const FILE_LOG_CONFIG = {
    enableDebug: process.env.ENABLE_DEBUG_FILE_LOGGING === 'true',
    enableInfo: process.env.ENABLE_INFO_FILE_LOGGING === 'true',
    enableWarn: process.env.ENABLE_WARN_FILE_LOGGING === 'true',
    enableError: process.env.ENABLE_ERROR_FILE_LOGGING === 'true', // Error và Fatal sẽ cùng file
    enableMessage: process.env.ENABLE_MESSAGE_FILE_LOGGING === 'true', // <-- Thêm cấu hình cho file message log
    debugFile: process.env.DEBUG_LOG_FILE || 'debug.log',
    infoFile: process.env.INFO_LOG_FILE || 'info.log',
    warnFile: process.env.WARN_LOG_FILE || 'warn.log',
    errorFile: process.env.ERROR_LOG_FILE || 'error.log', // File cho ERROR và FATAL
    messageFile: process.env.MESSAGE_LOG_FILE || 'messages.log', // <-- Tên file cho log tin nhắn
    maxSizeMB: parseInt(process.env.LOG_FILE_MAX_SIZE_MB) || 10, // Đặt mặc định 10MB nếu không có
    maxBackups: parseInt(process.env.LOG_FILE_MAX_BACKUPS) || 5 // Đặt mặc định 5 backups nếu không có
};

const LOG_DIR = path.join(process.cwd(), 'logs');

// Đảm bảo thư mục logs tồn tại
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// --- Định nghĩa màu sắc cho Console Output ---
// Màu sắc theo cấp độ log
const LEVEL_COLORS = {
    DEBUG: chalk.hex('#9370DB'), // MediumPurple
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red,
    FATAL: chalk.bgRed.white, // Nền đỏ, chữ trắng cho FATAL để nổi bật
    MESSAGE: chalk.gray, // <-- Màu sắc cho log tin nhắn (ví dụ: xám)
};

// Màu sắc cho các tag cụ thể (ví dụ Pokémon, Discord Events, DB, v.v.)
const TAG_COLORS = {
    // Pokémon
    POKEMON_SPAWN: chalk.cyan,
    POKEMON_CATCH: chalk.greenBright,
    POKEMON_CLEANUP: chalk.magenta,
    POKEMON_SPAWN_ERROR: chalk.red.bold, // Ưu tiên màu ERROR, nhưng có thể thêm bold
    POKEMON_SPAWN_WARN: chalk.yellow.bold,
    POKEMON_CLEANUP_WARN: chalk.yellow,
    POKEMON_SPAWN_MANAGER: chalk.blueBright,

    // General Discord Bot
    SLASH_COMMAND_HANDLER_ERROR: chalk.red,
    COMPONENT_INTERACTION_HANDLER_ERROR: chalk.red,
    DEFER_UPDATE_FAILED: chalk.red,
    SLASH_COMMAND_NOT_FOUND: chalk.red,
    COMMAND_EXECUTION: chalk.blue,
    INTERACTION_WARNING: chalk.yellow,
    DISCORD_EVENT: chalk.green,
    BOT_STARTUP: chalk.greenBright,
    BOT_SHUTDOWN: chalk.redBright,
    MESSAGE_CREATE: chalk.hex('#A9A9A9'), // DarkGray cho tag MESSAGE_CREATE
    MESSAGE_SKIP: chalk.hex('#808080'), // Grey cho tag MESSAGE_SKIP
    MESSAGE_MENTION: chalk.hex('#FFD700'), // Gold cho tag MESSAGE_MENTION

    // Database
    DB_CONNECTION: chalk.rgb(255, 165, 0), // Orange
    DB_ERROR: chalk.red.bold,
    
    // XP & Roles
    XP_MANAGER: chalk.yellowBright,
    USER_ROLE_UPDATE: chalk.cyan,
    PROFILE_MANAGER: chalk.green,

    // Error Reporter
    ERROR_REPORT: chalk.bgRed.white,
    
    // Nếu có module khác, thêm vào đây:
    // YOUR_MODULE: chalk.hex('#FF5733'), 
};

/**
 * Hàm hỗ trợ để áp dụng màu sắc cho console output.
 * @param {string} levelName - Tên cấp độ log (DEBUG, INFO, WARN, ERROR, FATAL, MESSAGE).
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {string} message - Tin nhắn đã được định dạng.
 * @returns {string} Tin nhắn đã được thêm màu sắc.
 */
function colorizeForConsole(levelName, tag, message) {
    let coloredTag = tag;
    let coloredLevel = LEVEL_COLORS[levelName](`[${levelName}]`);

    // Áp dụng màu sắc cho tag nếu có định nghĩa
    // Tìm kiếm tag khớp hoàn toàn hoặc tag bắt đầu bằng
    const specificTagColorKey = Object.keys(TAG_COLORS).find(key => 
        tag === `[${key}]` || tag.startsWith(`[${key}] `) // Kiểm tra cả khớp hoàn toàn và tiền tố
    );

    if (specificTagColorKey) {
        coloredTag = TAG_COLORS[specificTagColorKey](tag);
    } else {
        // Nếu không có màu tag cụ thể, sử dụng màu level cho cả tag
        coloredTag = LEVEL_COLORS[levelName](tag);
    }
    
    // Áp dụng màu cho toàn bộ tin nhắn dựa trên level
    const messageColorFunc = LEVEL_COLORS[levelName];
    return `${coloredTag} ${coloredLevel} ${messageColorFunc(message)}`;
}

/**
 * Thực hiện log rotation (xoay vòng log file).
 * Khi file log đạt kích thước tối đa, nó sẽ được đổi tên thành backup và tạo file mới.
 * @param {string} filePath - Đường dẫn đầy đủ đến file log.
 * @param {number} maxSizeMB - Kích thước tối đa của file log tính bằng MB.
 * @param {number} maxBackups - Số lượng file backup tối đa.
 */
function rotateLogFile(filePath, maxSizeMB, maxBackups) {
    if (maxSizeMB === 0 || !fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB >= maxSizeMB) {
        // Xóa các file backup cũ nhất nếu vượt quá giới hạn
        for (let i = maxBackups; i >= 1; i--) {
            const oldBackupPath = `${filePath}.${i}`;
            if (fs.existsSync(oldBackupPath)) {
                fs.unlinkSync(oldBackupPath);
            }
            if (i > 1) {
                const prevBackupPath = `${filePath}.${i - 1}`;
                if (fs.existsSync(prevBackupPath)) {
                    fs.renameSync(prevBackupPath, oldBackupPath);
                }
            }
        }
        // Đổi tên file hiện tại thành backup đầu tiên
        fs.renameSync(filePath, `${filePath}.1`);
    }
}

/**
 * Ghi tin nhắn vào file log cụ thể.
 * @param {string} levelName - Tên cấp độ log (DEBUG, INFO, WARN, ERROR, FATAL, MESSAGE)
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn hoặc dữ liệu cần log.
 */
function writeToFile(levelName, tag, ...messages) {
    let filePath;
    let enabled = false;
    let currentMaxSizeMB = FILE_LOG_CONFIG.maxSizeMB;
    let currentMaxBackups = FILE_LOG_CONFIG.maxBackups;

    switch (levelName) {
        case 'DEBUG': 
            filePath = path.join(LOG_DIR, FILE_LOG_CONFIG.debugFile);
            enabled = FILE_LOG_CONFIG.enableDebug;
            break;
        case 'INFO':
            filePath = path.join(LOG_DIR, FILE_LOG_CONFIG.infoFile);
            enabled = FILE_LOG_CONFIG.enableInfo;
            break;
        case 'WARN':
            filePath = path.join(LOG_DIR, FILE_LOG_CONFIG.warnFile);
            enabled = FILE_LOG_CONFIG.enableWarn;
            break;
        case 'ERROR':
        case 'FATAL': 
            filePath = path.join(LOG_DIR, FILE_LOG_CONFIG.errorFile);
            enabled = FILE_LOG_CONFIG.enableError;
            break;
        case 'MESSAGE': // <-- Xử lý cấp độ MESSAGE
            filePath = path.join(LOG_DIR, FILE_LOG_CONFIG.messageFile);
            enabled = FILE_LOG_CONFIG.enableMessage;
            currentMaxSizeMB = parseInt(process.env.MESSAGE_LOG_FILE_MAX_SIZE_MB) || 10; // Cấu hình riêng cho message log
            currentMaxBackups = parseInt(process.env.MESSAGE_LOG_FILE_MAX_BACKUPS) || 7; // Cấu hình riêng cho message log
            break;
        default:
            return; 
    }

    if (!enabled) return;

    rotateLogFile(filePath, currentMaxSizeMB, currentMaxBackups); // Truyền tham số cấu hình riêng

    const timestamp = moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss.SSS');
    let logMessage = `[${timestamp}] [${levelName}] ${tag}`;
    
    const formattedMessages = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                // Sử dụng JSON.stringify với khoảng trắng để dễ đọc trong file log
                return JSON.stringify(msg, null, 2); 
            } catch (e) {
                // Fallback nếu không thể stringify object
                return String(msg); 
            }
        }
        return String(msg);
    });

    logMessage += ` ${formattedMessages.join(' ')}\n`;

    fs.appendFile(filePath, logMessage, (err) => {
        if (err) {
            console.error(`[LOGGER_ERROR] Lỗi khi ghi log vào file ${filePath}:`, err);
        }
    });
}

/**
 * Hàm log thông tin chung. Có thể hiển thị trên console và/hoặc ghi vào file info.log.
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn hoặc dữ liệu cần log.
 */
function info(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    if (CONSOLE_CONFIG.info) {
        console.log(colorizeForConsole('INFO', tag, formattedMessage));
    }
    writeToFile('INFO', tag, ...messages);
}

/**
 * Hàm log debug. Chỉ hiển thị trên console khi CONSOLE_CONFIG.debug=true và/hoặc ghi vào file debug.log.
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn hoặc dữ liệu debug cần log.
 */
function debug(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    if (CONSOLE_CONFIG.debug) {
        console.log(colorizeForConsole('DEBUG', tag, formattedMessage));
    }
    writeToFile('DEBUG', tag, ...messages);
}

/**
 * Hàm log cảnh báo. Có thể hiển thị trên console và/hoặc ghi vào file warn.log.
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn cảnh báo cần log.
 */
function warn(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    if (CONSOLE_CONFIG.warn) {
        console.warn(colorizeForConsole('WARN', tag, formattedMessage));
    }
    writeToFile('WARN', tag, ...messages);
}

/**
 * Hàm log lỗi. Có thể hiển thị trên console và/hoặc ghi vào file error.log.
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn lỗi cần log.
 */
function error(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    if (CONSOLE_CONFIG.error) {
        console.error(colorizeForConsole('ERROR', tag, formattedMessage));
    }
    writeToFile('ERROR', tag, ...messages);
}

/**
 * Hàm log lỗi nghiêm trọng. Có thể hiển thị trên console và/hoặc ghi vào file error.log.
 * Dùng cho các lỗi khiến ứng dụng không thể tiếp tục hoạt động.
 * @param {string} tag - Thẻ hoặc tiền tố cho log.
 * @param {...any} messages - Các tin nhắn lỗi nghiêm trọng cần log.
 */
function fatal(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    if (CONSOLE_CONFIG.fatal) {
        console.error(colorizeForConsole('FATAL', tag, formattedMessage));
    }
    writeToFile('FATAL', tag, ...messages);
    // Có thể thêm logic thoát ứng dụng tại đây nếu là lỗi thực sự nghiêm trọng
    // process.exit(1); 
}

/**
 * Hàm log tin nhắn Discord. Ghi vào file messages.log riêng biệt.
 * @param {string} tag - Thẻ hoặc tiền tố cho log (ví dụ: '[MESSAGE_CONTENT]').
 * @param {...any} messages - Nội dung tin nhắn và các thông tin liên quan.
 */
function message(tag, ...messages) {
    const formattedMessage = messages.map(msg => {
        if (typeof msg === 'object' && msg !== null) {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return String(msg);
            }
        }
        return String(msg);
    }).join(' ');

    // Bạn có thể chọn có hiển thị message log trên console hay không
    if (CONSOLE_CONFIG.message) { 
        console.log(colorizeForConsole('MESSAGE', tag, formattedMessage));
    }
    writeToFile('MESSAGE', tag, ...messages);
}


module.exports = {
    info, 
    debug,
    warn,
    error,
    fatal,
    message 
}