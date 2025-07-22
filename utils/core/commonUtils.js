// utils/commonUtils.js

/**
 * Xóa một tin nhắn sau một khoảng thời gian nhất định.
 * @param {Message} message - Đối tượng tin nhắn cần xóa.
 * @param {number} timeout - Thời gian chờ (ms) trước khi xóa tin nhắn.
 * @param {string} [logContext=''] - Ngữ cảnh để ghi log (ví dụ: "User command message", "Bot reply message").
 */
async function deleteMessageWithTimeout(message, timeout, logContext = '') {
    // Kiểm tra nhanh xem message có hợp lệ không trước khi tạo setTimeout
    if (!message || typeof message.delete !== 'function') {
        console.warn(`[DELETE_MESSAGE_WARN] Không thể xóa: Đối tượng tin nhắn không hợp lệ hoặc thiếu phương thức delete. Context: ${logContext}`);
        return;
    }

    // Sử dụng setTimeout bọc trong một Promise và await để hàm có thể hoàn thành trước khi các hàm gọi nó kết thúc
    // Điều này giúp quản lý tốt hơn logic bất đồng bộ và tránh race condition
    await new Promise(resolve => {
        setTimeout(async () => {
            try {
                // Kiểm tra lại xem message có tồn tại và có thể xóa được không
                // Điều kiện `message.deletable` là một cách an toàn để kiểm tra quyền và trạng thái tin nhắn
                if (message && message.deletable) {
                    await message.delete();
                    // console.log(`[DELETE_MESSAGE_SUCCESS] Tin nhắn (${message.id}) đã được xóa thành công. Context: ${logContext}`);
                } else {
                    // Nếu không deletable, có thể nó đã bị xóa rồi hoặc bot không có quyền
                    console.warn(`[DELETE_MESSAGE_INFO] Tin nhắn (${message.id}) không thể xóa (có thể đã bị xóa hoặc không có quyền). Context: ${logContext}`);
                }
            } catch (error) {
                // Kiểm tra mã lỗi cụ thể của DiscordAPIError
                // DiscordAPIError[10008]: Unknown Message có nghĩa là tin nhắn đã bị xóa rồi
                if (error.code === 10008) {
                    console.warn(`[DELETE_MESSAGE_INFO] Tin nhắn (${message.id}) không còn tồn tại để xóa (DiscordAPIError 10008). Context: ${logContext}`);
                } else {
                    // Ghi log các lỗi khác mà chúng ta chưa dự kiến
                    console.error(`[DELETE_MESSAGE_ERROR] Lỗi không xác định khi xóa tin nhắn (${message.id}). Context: ${logContext}:`, error);
                }
            } finally {
                resolve(); // Đảm bảo Promise được giải quyết dù có lỗi hay không
            }
        }, timeout);
    });
}

module.exports = {
    deleteMessageWithTimeout,
};