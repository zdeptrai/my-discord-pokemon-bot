const { EmbedBuilder } = require('discord.js');
const { getPokemonSpriteUrl } = require('../utils/pokemonUtils'); // Đảm bảo đường dẫn đúng
const { generateHpBar } = require('./battleUtils'); // Đảm bảo đường dẫn đúng

/**
 * Tạo Embed hiển thị tổng quan trận đấu.
 * Hàm này nhận một đối tượng battleState duy nhất, giúp code gọn gàng và dễ quản lý hơn.
 *
 * @param {object} battleState - Đối tượng battleState chứa toàn bộ trạng thái trận đấu.
 * @returns {EmbedBuilder}
 */
async function createBattleOverviewEmbed(battleState) {
    const player1User = battleState.player1.user;
    const player2User = battleState.player2.user;

    // Truy cập dữ liệu Pokemon thông qua thuộc tính 'data'
    const player1ActivePokemonData = battleState.activePokemon[player1User.id].data;
    const player1CurrentHp = battleState.activePokemon[player1User.id].current_hp; // HP hiện tại của wrapper

    const player2ActivePokemonData = battleState.activePokemon[player2User.id].data;
    const player2CurrentHp = battleState.activePokemon[player2User.id].current_hp; // HP hiện tại của wrapper

    console.log(`[DEBUG_EMBED] Player 1 active: ${player1ActivePokemonData.nickname || player1ActivePokemonData.pokemon_name}, HP: ${player1CurrentHp}`);
    console.log(`[DEBUG_EMBED] Player 2 active: ${player2ActivePokemonData.nickname || player2ActivePokemonData.pokemon_name}, HP: ${player2CurrentHp}`);

    const turnTitle = battleState.turnCounter > 0
        ? `Lượt ${battleState.turnCounter} - ${battleState.gameOver ? 'Kết thúc' : (battleState.currentTurn === player1User.id ? player1User.username : player2User.username)}`
        : 'Trận đấu bắt đầu!';

    let battleLogSummary = '';
    if (battleState.log && battleState.log.length > 0) {
        const recentLogs = battleState.log.slice(Math.max(0, battleState.log.length - 5));
        battleLogSummary = `**Log trận đấu:**\n${recentLogs.join('\n')}`;
    } else {
        battleLogSummary =
            `Trận chiến giữa ${player1User.username} và ${player2User.username} đã bắt đầu!\n\n` +
            `${player1User.username} đưa ra **${player1ActivePokemonData.nickname || player1ActivePokemonData.pokemon_name}**.\n` +
            `${player2User.username} đưa ra **${player2ActivePokemonData.nickname || player2ActivePokemonData.pokemon_name}**.\n\n` +
            `**Log trận đấu:**`;
    }

    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Màu đỏ cho trận đấu
        .setTitle(`⚔️ ${turnTitle} ⚔️`)
        .setDescription(battleLogSummary)
        .setTimestamp();

    const player1SpriteUrl = player1ActivePokemonData.sprite_back_url || await getPokemonSpriteUrl(player1ActivePokemonData.pokedex_id, 'back');
    const player2SpriteUrl = player2ActivePokemonData.sprite_front_url || await getPokemonSpriteUrl(player2ActivePokemonData.pokedex_id, 'front');

    if (player1SpriteUrl) {
        embed.setThumbnail(player1SpriteUrl);
    } else {
        console.warn(`[EMBED_BUILDER_WARN] player1SpriteUrl rỗng hoặc không hợp lệ cho Pokémon ${player1ActivePokemonData.pokemon_name}. Sử dụng URL mặc định.`);
        embed.setThumbnail('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/0.png'); // URL mặc định
    }

    if (player2SpriteUrl) {
        embed.setImage(player2SpriteUrl);
    } else {
        console.warn(`[EMBED_BUILDER_WARN] player2SpriteUrl rỗng hoặc không hợp lệ cho Pokémon ${player2ActivePokemonData.pokemon_name}. Sử dụng URL mặc định.`);
        embed.setImage('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'); // URL mặc định
    }

    embed.addFields(
        {
            name: `🔥 ${player1User.username}'s ${player1ActivePokemonData.nickname || player1ActivePokemonData.pokemon_name} Lv.${player1ActivePokemonData.level}`,
            value: `❤️ HP: **${player1CurrentHp}/${player1ActivePokemonData.hp}** ${generateHpBar(player1CurrentHp, player1ActivePokemonData.hp)}\n` +
                   `⚔️ ATK: ${player1ActivePokemonData.attack} | 🛡️ DEF: ${player1ActivePokemonData.defense}\n` +
                   `✨ SP.ATK: ${player1ActivePokemonData.special_attack} | 💎 SP.DEF: ${player1ActivePokemonData.special_defense}\n` +
                   `⚡ SPD: ${player1ActivePokemonData.speed}`,
            inline: true
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
            name: `❄️ ${player2User.username}'s ${player2ActivePokemonData.nickname || player2ActivePokemonData.pokemon_name} Lv.${player2ActivePokemonData.level}`,
            value: `❤️ HP: **${player2CurrentHp}/${player2ActivePokemonData.hp}** ${generateHpBar(player2CurrentHp, player2ActivePokemonData.hp)}\n` +
                   `⚔️ ATK: ${player2ActivePokemonData.attack} | 🛡️ DEF: ${player2ActivePokemonData.defense}\n` +
                   `✨ SP.ATK: ${player2ActivePokemonData.special_attack} | 💎 SP.DEF: ${player2ActivePokemonData.special_defense}\n` +
                   `⚡ SPD: ${player2ActivePokemonData.speed}`,
            inline: true
        }
    )
    .setFooter({ text: 'Chúc may mắn cho cả hai người chơi!' });

    if (battleState.gameOver && battleState.winner) {
        const winnerUser = battleState.winner === player1User.id ? player1User : player2User;
        embed.setColor('#00FF00');
        embed.setTitle(`🏆 TRẬN ĐẤU KẾT THÚC! 🏆`);
        embed.setDescription(`${winnerUser.username} đã chiến thắng! 🎉\n\n` + battleLogSummary);
    } else if (battleState.gameOver && !battleState.winner) {
        embed.setColor('#FFD700');
        embed.setTitle(`⚠️ TRẬN ĐẤU KẾT THÚC VÌ LỖI ⚠️`);
    }

    return embed;
}

module.exports = {
    createBattleOverviewEmbed,
};