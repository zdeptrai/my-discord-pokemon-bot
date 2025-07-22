// config.js
require('dotenv').config();

module.exports = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN, 
    OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID || '1204924067661094933',
    OWNER_DISCORD_NAME: process.env.OWNER_DISCORD_NAME || 'ᴅᴇᴍᴏɴᴋɪɴɢ',
    
    // Đã thay đổi PREFIX từ 'p!' thành '!'
    PREFIX: '!', 
    BOT_NAME: 'Demonking',
    BOT_STATUS_MESSAGE: 'J97',
    BOT_STATUS_TYPE: 'Listening',

    BOT_DESCRIPTION:
        'Chào mừng đến với PokéBot! Hãy bắt đầu cuộc phiêu lưu Pokémon của bạn tại đây.\n\n' +
        '**Các lệnh cơ bản:**\n' +
        '`!start` - Bắt đầu hành trình của bạn và chọn Pokémon khởi đầu.\n' +
        '`!catch` - Bắt Pokémon hoang dã xuất hiện trong kênh.\n' +
        '`!mypokemon` - Xem danh sách Pokémon của bạn.\n' +
        '`!help` - Xem lại hướng dẫn này hoặc các lệnh khác.\n\n' +
        'Hãy khám phá thế giới Pokémon và trở thành Huấn luyện viên vĩ đại nhất!',
};