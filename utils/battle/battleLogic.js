// utils/battle/battleLogic.js
const { generateBattleEmbed } = require('./battleUtils');
// Đảm bảo bạn đã có calculateSimpleBattleDamage trong battleCalculations.js
const { getBattleDamageModifiers, calculateSimpleBattleDamage } = require('./battleCalculations'); 

/**
 * Thực hiện một đợt tấn công trong trận chiến.
 * ĐÃ ĐƠN GIẢN HÓA: Không tính toán phòng thủ của đối thủ.
 * @param {object} attacker - Pokémon tấn công.
 * @param {object} defender - Pokémon phòng thủ.
 * @param {boolean} isPlayerAttacker - true nếu người chơi tấn công, false nếu là CPU.
 * @returns {object} Kết quả tấn công: { damageDealt, defenderCurrentHp }
 */
const performAttack = (attacker, defender, isPlayerAttacker) => {
    // Chúng ta sẽ sử dụng hàm calculateSimpleBattleDamage đã định nghĩa
    // trong utils/battle/battleCalculations.js.
    // Để làm được điều này, chúng ta cần một đối tượng skillData.
    // Trong bối cảnh luyện cấp đơn giản, chúng ta có thể tạo một skillData mặc định.
    const defaultSkill = {
        name: 'Tấn công cơ bản', // Tên kỹ năng mặc định
        type: 'Normal',        // Loại mặc định
        category: 'Physical',  // Loại vật lý mặc định
        power: 40,             // Sức mạnh cơ bản (có thể điều chỉnh)
        accuracy: 100          // Luôn trúng
    };

    // Tính toán sát thương cơ bản mà không cần phòng thủ và hiệu quả hệ
    const attackResult = calculateSimpleBattleDamage(attacker, defaultSkill);
    let damage = attackResult.damage;

    // --- ÁP DỤNG HỆ SỐ ĐIỀU CHỈNH SÁT THƯƠNG TỔNG THỂ ---
    // Hàm getBattleDamageModifiers vẫn được giữ lại để bạn có thể điều chỉnh độ khó tổng thể
    // mà không cần thay đổi công thức sát thương cơ bản.
    const modifiers = getBattleDamageModifiers(); 

    if (isPlayerAttacker) {
        // Nếu người chơi tấn công (người chơi gây sát thương)
        damage = Math.floor(damage * modifiers.playerDamageDealtMultiplier);
    } else {
        // Nếu Pokémon hoang dã tấn công (người chơi nhận sát thương)
        damage = Math.floor(damage * modifiers.playerDamageTakenMultiplier);
    }
    // --- KẾT THÚC ÁP DỤNG HỆ SỐ ---

    // Đảm bảo sát thương không nhỏ hơn 1
    damage = Math.max(1, damage);

    const defenderCurrentHp = Math.max(0, defender.current_hp - damage);

    return {
        damageDealt: damage,
        defenderCurrentHp: defenderCurrentHp
    };
};

/**
 * Mô phỏng toàn bộ trận chiến giữa Pokémon của người chơi và Pokémon hoang dã.
 * @param {object} userPokemonCopy - Bản sao của Pokémon người chơi (để thay đổi HP).
 * @param {object} wildPokeCopy - Bản sao của Pokémon hoang dã (để thay đổi HP).
 * @param {Message} battleMessage - Đối tượng tin nhắn Discord để cập nhật embed.
 * @returns {Promise<object>} Kết quả trận chiến: { userPokemonFinal, wildPokemonFinal, battleResultType, fullBattleLog }
 */
async function simulateFullBattle(userPokemonCopy, wildPokeCopy, battleMessage) {
    const fullBattleLog = [];
    fullBattleLog.push(`Trận chiến giữa ${userPokemonCopy.nickname || userPokemonCopy.pokemon_name} (Lv.${userPokemonCopy.level}) và ${wildPokeCopy.pokemon_name} (Lv.${wildPokeCopy.level}) bắt đầu!`);

    const initialBattleEmbed = generateBattleEmbed(userPokemonCopy, wildPokeCopy, fullBattleLog, true);
    await battleMessage.edit({ embeds: [initialBattleEmbed] });

    await new Promise(resolve => setTimeout(resolve, 3000));

    let turn = 0;

    while (userPokemonCopy.current_hp > 0 && wildPokeCopy.current_hp > 0 && turn < 20) {
        turn++;
        fullBattleLog.push(`\n**--- Lượt ${turn} ---**`);

        // Người chơi tấn công
        const userAttackResult = performAttack(userPokemonCopy, wildPokeCopy, true);
        wildPokeCopy.current_hp = userAttackResult.defenderCurrentHp;
        fullBattleLog.push(`${userPokemonCopy.nickname || userPokemonCopy.pokemon_name} tấn công, gây **${userAttackResult.damageDealt} sát thương**!`);
        fullBattleLog.push(`> ${wildPokeCopy.pokemon_name} còn **${Math.max(0, wildPokeCopy.current_hp)}/${wildPokeCopy.max_hp} HP**.`);

        await battleMessage.edit({ embeds: [generateBattleEmbed(userPokemonCopy, wildPokeCopy, fullBattleLog, false)] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (wildPokeCopy.current_hp <= 0) {
            fullBattleLog.push(`${wildPokeCopy.pokemon_name} đã bị đánh bại!`);
            break;
        }

        // Pokémon hoang dã tấn công
        const wildAttackResult = performAttack(wildPokeCopy, userPokemonCopy, false);
        userPokemonCopy.current_hp = wildAttackResult.defenderCurrentHp;
        fullBattleLog.push(`${wildPokeCopy.pokemon_name} tấn công, gây **${wildAttackResult.damageDealt} sát thương**!`);
        fullBattleLog.push(`> ${userPokemonCopy.nickname || userPokemonCopy.pokemon_name} còn **${Math.max(0, userPokemonCopy.current_hp)}/${userPokemonCopy.max_hp} HP**.`);

        await battleMessage.edit({ embeds: [generateBattleEmbed(userPokemonCopy, wildPokeCopy, fullBattleLog, false)] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (userPokemonCopy.current_hp <= 0) {
            fullBattleLog.push(`${userPokemonCopy.nickname || userPokemonCopy.pokemon_name} đã bị đánh bại!`);
            break;
        }
    }

    let battleResultType = '';
    if (userPokemonCopy.current_hp <= 0) {
        battleResultType = 'lose';
    } else if (wildPokeCopy.current_hp <= 0) {
        battleResultType = 'win';
    } else {
        battleResultType = 'draw';
        fullBattleLog.push(`\nTrận chiến kết thúc sau ${turn} lượt!`);
    }

    return {
        userPokemonFinal: userPokemonCopy,
        wildPokemonFinal: wildPokeCopy,
        battleResultType: battleResultType,
        fullBattleLog: fullBattleLog
    };
}

module.exports = {
    performAttack,
    simulateFullBattle,
};
