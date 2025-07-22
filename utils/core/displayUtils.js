// utils/displayUtils.js

/**
 * Tạo thanh HP trực quan.
 * @param {number} currentHp - HP hiện tại.
 * @param {number} maxHp - HP tối đa.
 * @param {number} length - Chiều dài của thanh HP (số ký tự).
 * @returns {string} Chuỗi biểu diễn thanh HP.
 */
function generateHpBar(currentHp, maxHp, length = 10) {
    // Đảm bảo HP hiện tại không nhỏ hơn 0
    const safeCurrentHp = Math.max(0, currentHp);
    // Đảm bảo HP tối đa lớn hơn 0 để tránh chia cho 0
    const safeMaxHp = Math.max(1, maxHp); 

    const percentage = safeCurrentHp / safeMaxHp;
    const filledLength = Math.round(length * percentage);
    // Đảm bảo emptyLength không âm
    const emptyLength = Math.max(0, length - filledLength); 

    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);

    return `[${filledBar}${emptyBar}] \`${safeCurrentHp}/${safeMaxHp}\``;
}

module.exports = {
    generateHpBar,
    // Bạn có thể thêm các hàm tiện ích hiển thị khác vào đây sau này
};
