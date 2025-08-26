// config.js
require('dotenv').config();

module.exports = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN, 
    OWNER_DISCORD_ID: process.env.OWNER_DISCORD_ID || '1204924067661094933',
    OWNER_DISCORD_NAME: process.env.OWNER_DISCORD_NAME || 'ᴅᴇᴍᴏɴᴋɪɴɢ',
    
    // Đã thay đổi PREFIX từ 'p!' thành '!'
    PREFIX: '!', 
    BOT_NAME: 'Demonking',
    BOT_STATUS_MESSAGE: 'Hello, I\'m bot by z',
    BOT_STATUS_TYPE: 'Custom',

    // Thêm phần này để quản lý trạng thái bật/tắt của lệnh
    COMMAND_TOGGLES: {
        ask: true,     // Đặt true để bật, false để tắt
        leaderboard: true, // Ví dụ: lệnh leaderboard đang tắt
        profile: true,
        giveaway: true,
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
        random: true,

    }
}