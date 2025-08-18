// utils/managers/eventManager.js
// File này đã được chuyển từ utils/ sang events/ để quản lý tập trung các logic liên quan đến sự kiện.
const logger = require('../logger'); // <-- Thêm dòng này

// Đối tượng lưu trữ trạng thái của sự kiện
// Chỉ một sự kiện có thể diễn ra tại một thời điểm cho đơn giản
let eventState = {
    active: false,
    channelId: null,      // ID kênh nơi sự kiện đang diễn ra
    endTime: null,        // Thời gian kết thúc sự kiện (timestamp)
    winnerId: null,       // ID người chiến thắng (nếu có)
    eventMessageId: null, // ID tin nhắn thông báo sự kiện (để cập nhật)
    timeoutId: null,      // ID của setTimeout để hủy sự kiện khi hết giờ
    lastRoll: null,       // Lưu trữ kết quả roll gần nhất
    lastRollerId: null    // ID người chơi roll gần nhất
};

const EVENT_DURATION_MINUTES = 15; // Thời lượng mặc định của sự kiện là 15 phút

/**
 * Bắt đầu một sự kiện tung xúc xắc.
 * @param {string} channelId ID của kênh nơi sự kiện được bắt đầu.
 * @returns {object} Trạng thái sự kiện mới hoặc lỗi nếu đã có sự kiện.
 */
function startEvent(channelId) {
    if (eventState.active) {
        const errorMessage = `Đã có một sự kiện đang diễn ra tại <#${eventState.channelId}>. Vui lòng đợi sự kiện đó kết thúc.`;
        logger.warn('[EVENT_MANAGER_WARN]', errorMessage); // Sử dụng logger.warn cho trường hợp này
        throw new Error(errorMessage);
    }

    eventState.active = true;
    eventState.channelId = channelId;
    eventState.endTime = Date.now() + EVENT_DURATION_MINUTES * 60 * 1000;
    eventState.winnerId = null;
    eventState.lastRoll = null;
    eventState.lastRollerId = null;

    // Thiết lập timeout để tự động kết thúc sự kiện
    eventState.timeoutId = setTimeout(() => {
        logger.info(`[EVENT_MANAGER_TIMEOUT]`, `Sự kiện tại kênh ${channelId} đã hết giờ.`); // Log bằng logger.info
        endEvent(); // Kết thúc sự kiện khi hết giờ
    }, EVENT_DURATION_MINUTES * 60 * 1000);

    logger.info(`[EVENT_MANAGER_START]`, `Sự kiện đã bắt đầu tại kênh ${channelId}, kết thúc lúc ${new Date(eventState.endTime).toLocaleString()}.`); // Log bằng logger.info
    return { ...eventState }; // Trả về bản sao trạng thái
}

/**
 * Kết thúc sự kiện đang diễn ra.
 * @param {string|null} winnerId ID của người chiến thắng, nếu có.
 */
function endEvent(winnerId = null) {
    if (eventState.timeoutId) {
        clearTimeout(eventState.timeoutId);
        eventState.timeoutId = null;
    }

    const wasActive = eventState.active; // Kiểm tra xem sự kiện có đang hoạt động không trước khi reset
    
    eventState.active = false;
    eventState.winnerId = winnerId;
    // Giữ channelId và eventMessageId một lát để có thể gửi tin nhắn kết thúc
    // Sau đó sẽ reset hoàn toàn
    const finalState = { ...eventState }; // Lưu trạng thái cuối cùng trước khi reset

    eventState.channelId = null;
    eventState.endTime = null;
    eventState.eventMessageId = null;
    eventState.lastRoll = null;
    eventState.lastRollerId = null;

    if (wasActive) { // Chỉ log kết thúc nếu thực sự có sự kiện đang hoạt động
        logger.info(`[EVENT_MANAGER_END]`, `Sự kiện đã kết thúc. Người thắng: ${winnerId || 'Không có'}.`); // Log bằng logger.info
    } else {
        logger.debug(`[EVENT_MANAGER_DEBUG]`, `Hàm endEvent được gọi nhưng không có sự kiện nào đang hoạt động.`);
    }
    
    return finalState;
}

/**
 * Kiểm tra xem có sự kiện nào đang hoạt động trong kênh cụ thể không.
 * @param {string} channelId ID của kênh cần kiểm tra.
 * @returns {boolean} True nếu sự kiện đang hoạt động trong kênh này, ngược lại False.
 */
function isEventActiveInChannel(channelId) {
    // Không cần log cho hàm này vì nó được gọi rất thường xuyên
    return eventState.active && eventState.channelId === channelId && Date.now() < eventState.endTime;
}

/**
 * Lấy trạng thái hiện tại của sự kiện.
 * @returns {object} Bản sao của đối tượng eventState.
 */
function getEventState() {
    // Không cần log cho hàm này
    return { ...eventState };
}

/**
 * Lưu ID tin nhắn thông báo sự kiện.
 * @param {string} messageId ID của tin nhắn.
 */
function setEventMessageId(messageId) {
    eventState.eventMessageId = messageId;
    logger.info(`[EVENT_MANAGER]`, `Đã lưu ID tin nhắn sự kiện: ${messageId}`); // Log bằng logger.info
}

/**
 * Cập nhật kết quả roll gần nhất.
 * @param {string} userId ID người chơi đã roll.
 * @param {number[]} rollResult Mảng 3 số kết quả roll.
 */
function updateLastRoll(userId, rollResult) {
    eventState.lastRoll = rollResult;
    eventState.lastRollerId = userId;
    logger.info(`[EVENT_MANAGER]`, `Cập nhật roll gần nhất: ${rollResult.join(', ')} bởi người dùng ${userId}`); // Log bằng logger.info, định dạng rollResult
}

module.exports = {
    startEvent,
    endEvent,
    isEventActiveInChannel,
    getEventState,
    setEventMessageId,
    updateLastRoll,
    EVENT_DURATION_MINUTES
};