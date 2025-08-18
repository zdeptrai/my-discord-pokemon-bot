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

    // Thêm phần này để quản lý trạng thái bật/tắt của lệnh
    COMMAND_TOGGLES: {
        ask: true,     // Đặt true để bật, false để tắt
        leaderboard: true, // Ví dụ: lệnh leaderboard đang tắt
        profile: true,
        weather: true,
        battle: true,
        boss: true,
        buy: true,
        buymarket: true,
        catch: true,
        collecttrain: true,
        evolve: true,
        getinvite: false,
        help: true,
        learnskill: true,
        market: true,
        mypokemons: true,
        nickname: true,
        profile: true,
        pvp: true,
        roll: true,
        sell: true,
        sellitem: true,
        sellpokemon: true,
        servers: false,
        setchannel: true,
        setteam: true,
        shop: true,
        spawn: true,
        start: true,
        startev: true,
        status: true,
        train: true,
        transform: true,
        useitem: true,
        viewskill: true,
        withdraw: true,

        // Thêm tất cả các tên lệnh của bạn vào đây với giá trị true/false tương ứng
        // Đảm bảo tên lệnh ở đây khớp với tên file lệnh (ví dụ: ask.js -> "ask")
    }
}