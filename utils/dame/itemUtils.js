// utils/dame/itemUtils.js
const { db } = require('../../db'); // Đảm bảo import instance db của bạn

/**
 * Chọn một vật phẩm ngẫu nhiên từ bảng `items` có cột `value` là NULL.
 * @param {object} dbInstance Knex instance
 * @returns {object|null} Thông tin vật phẩm được chọn hoặc null nếu không tìm thấy
 */
async function getRandomRewardItem(dbInstance) {
    try {
        // Lấy tất cả các item có cột 'value' là NULL
        const rewardItems = await dbInstance('items')
            .whereNull('value') // Lọc theo cột 'value' là NULL
            .select('*');

        if (rewardItems.length === 0) {
            console.warn('[ITEM_SELECT_WARN] Không tìm thấy vật phẩm nào có cột "value" là NULL trong database để làm phần thưởng.');
            return null;
        }

        // Chọn một item ngẫu nhiên từ danh sách
        const randomIndex = Math.floor(Math.random() * rewardItems.length);
        return rewardItems[randomIndex];
    } catch (error) {
        console.error('[ITEM_SELECT_ERROR] Lỗi khi chọn vật phẩm ngẫu nhiên làm phần thưởng:', error);
        return null;
    }
}

/**
 * Thêm hoặc cập nhật số lượng item trong kho của người dùng (bảng `user_inventory_items`).
 * @param {string} userId Discord ID của người dùng
 * @param {number} itemId ID của vật phẩm
 * @param {number} quantity Số lượng muốn thêm (hoặc trừ nếu là số âm)
 * @param {object} dbInstance Knex instance (hoặc transaction instance)
 * @returns {Promise<void>}
 */
async function addOrUpdateUserItem(userId, itemId, quantity, dbInstance) {
    try {
        // Tìm xem người dùng đã có item này chưa trong bảng user_inventory_items
        const userItem = await dbInstance('user_inventory_items') // SỬ DỤNG BẢNG ĐÚNG TÊN
            .where({ user_discord_id: userId, item_id: itemId })
            .first();

        if (userItem) {
            // Nếu đã có, cập nhật số lượng
            await dbInstance('user_inventory_items') // SỬ DỤNG BẢNG ĐÚNG TÊN
                .where({ user_discord_id: userId, item_id: itemId })
                .increment('quantity', quantity)
                .update('updated_at', dbInstance.fn.now());
        } else {
            // Nếu chưa có, tạo bản ghi mới
            await dbInstance('user_inventory_items').insert({ // SỬ DỤNG BẢNG ĐÚNG TÊN
                user_discord_id: userId,
                item_id: itemId,
                quantity: quantity,
                created_at: dbInstance.fn.now(),
                updated_at: dbInstance.fn.now()
            });
        }
    } catch (error) {
        console.error(`[ADD_USER_ITEM_ERROR] Lỗi khi thêm/cập nhật item ${itemId} cho người dùng ${userId}:`, error);
        throw new Error(`Không thể thêm/cập nhật vật phẩm của bạn. ${error.message}`);
    }
}

module.exports = {
    getRandomRewardItem,
    addOrUpdateUserItem,
};
