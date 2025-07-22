// commands/boss.js
const { handleBossDungeon } = require('../utils/dame/bossDungeonLogic'); // ĐÃ CẬP NHẬT ĐƯỜNG DẪN

module.exports = {
    name: 'boss',
    description: `Thử thách boss phó bản với Pokémon đã chọn của bạn để nhận phần thưởng. Cooldown: 8 giờ.`,
    aliases: ['raid', 'dungeon'],
    usage: '',
    cooldown: 5, // Cooldown ngắn cho lệnh để tránh spam

    async execute(message, args, client, db) {
        // Chỉ cần gọi hàm xử lý chính từ module mới
        await handleBossDungeon(message, client, db);
    },
};
