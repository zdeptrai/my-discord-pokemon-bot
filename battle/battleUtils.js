const { db } = require('../db'); // Đảm bảo dòng này tồn tại để truy cập database

/**
 * Tính toán sát thương trong trận đấu, bao gồm hiệu quả hệ, STAB, chí mạng và sai số ngẫu nhiên.
 * @param {object} attackerPokemon - Dữ liệu Pokémon tấn công (đã có đủ chỉ số: attack, special_attack, level, v.v.)
 * @param {object} defenderPokemon - Dữ liệu Pokémon phòng thủ (đã có đủ chỉ số: defense, special_defense, type1, type2, v.v.)
 * @param {object} skill - Dữ liệu skill được sử dụng (có thuộc tính power, category, và type)
 * @returns {object} { damage: number, message: string }
 */
async function calculateDamage(attackerPokemon, defenderPokemon, skill) {
    console.log(`[DAMAGE_CALC] Bắt đầu tính sát thương cho ${attackerPokemon.nickname || attackerPokemon.pokemon_name} dùng ${skill.name} lên ${defenderPokemon.nickname || defenderPokemon.pokemon_name}`);

    let damage = 0;
    let message = '';
    let typeEffectivenessMultiplier = 1.0;
    let effectivenessMessage = '';
    let stabMultiplier = 1.0; // Same-Type Attack Bonus
    let criticalHitMultiplier = 1.0; // Critical Hit
    let randomMultiplier = 1.0; // Random Variance

    const skillPower = skill.power || 0;
    const skillCategory = skill.category ? skill.category.toLowerCase() : 'physical'; // Mặc định là physical nếu không rõ
    const attackingSkillType = skill.type; // Lấy hệ của chiêu thức từ skill

    let attackStat;
    let defenseStat;

    // --- 1. Xác định chỉ số tấn công và phòng thủ dựa trên loại skill ---
    if (skillCategory === 'physical') {
        // Đảm bảo sử dụng chỉ số ATK của Pokemon tấn công và DEF của Pokemon phòng thủ
        attackStat = attackerPokemon.attack || attackerPokemon.base_attack;
        defenseStat = defenderPokemon.defense || defenderPokemon.base_defense;
    } else if (skillCategory === 'special') {
        // Đảm bảo sử dụng chỉ số SP.ATK của Pokemon tấn công và SP.DEF của Pokemon phòng thủ
        attackStat = attackerPokemon.special_attack || attackerPokemon.base_special_attack;
        defenseStat = defenderPokemon.special_defense || defenderPokemon.base_special_defense;
    } else {
        // Nếu skill không có category tấn công (ví dụ: status skill), hoặc category không xác định
        message = `${attackerPokemon.nickname || attackerPokemon.pokemon_name} đã sử dụng ${skill.name} nhưng không gây sát thương!`;
        console.log(`[DAMAGE_CALC] Skill ${skill.name} là ${skillCategory} và không gây sát thương.`);
        return { damage: 0, message };
    }

    // Đảm bảo các chỉ số không phải là 0 để tránh chia cho 0 hoặc sát thương không hợp lý
    // Mức tối thiểu là 1 để tránh lỗi logic chia.
    attackStat = Math.max(1, attackStat || 1); // Nếu chỉ số không tồn tại hoặc là 0, mặc định là 1
    defenseStat = Math.max(1, defenseStat || 1); // Nếu chỉ số không tồn tại hoặc là 0, mặc định là 1

    console.log(`[DAMAGE_CALC] Attacker Level: ${attackerPokemon.level}, Skill Power: ${skillPower}, Attack Stat: ${attackStat}, Defense Stat: ${defenseStat}`);

    // --- 2. Tính toán hiệu quả hệ (Type Effectiveness) ---
    if (attackingSkillType) {
        const defenderTypes = [defenderPokemon.type1];
        if (defenderPokemon.type2 && defenderPokemon.type2 !== null) {
            defenderTypes.push(defenderPokemon.type2);
        }
        console.log(`[DAMAGE_CALC] Attacking Type: ${attackingSkillType}, Defender Types: ${defenderTypes.join(', ')}`);

        let totalTypeMultiplier = 1.0;
        for (const defType of defenderTypes) {
            if (!defType) continue;

            const effectiveness = await db('type_effectiveness')
                .where({
                    attacking_type: attackingSkillType,
                    defending_type: defType
                })
                .first();

            // Nếu không tìm thấy mối quan hệ trong database, mặc định là 1.0
            totalTypeMultiplier *= (effectiveness ? effectiveness.multiplier : 1.0);
            console.log(`[DAMAGE_CALC]   vs ${defType}: ${effectiveness ? effectiveness.multiplier : 1.0}, Current Total Multiplier: ${totalTypeMultiplier}`);
        }
        typeEffectivenessMultiplier = totalTypeMultiplier;
    }

    // Xác định thông điệp hiệu quả hệ
    if (typeEffectivenessMultiplier >= 2.0) {
        effectivenessMessage = ' (Rất hiệu quả!)';
    } else if (typeEffectivenessMultiplier === 0.0) {
        effectivenessMessage = ' (Không có tác dụng!)';
    } else if (typeEffectivenessMultiplier <= 0.5) {
        effectivenessMessage = ' (Không hiệu quả lắm...)';
    } else {
        effectivenessMessage = ''; // Bình thường
    }
    console.log(`[DAMAGE_CALC] Type Effectiveness Multiplier: ${typeEffectivenessMultiplier}`);

    // --- 3. Tính toán STAB (Same-Type Attack Bonus) ---
    // Kiểm tra nếu hệ của chiêu thức trùng với một trong các hệ của Pokémon tấn công
    if (attackingSkillType &&
        (attackerPokemon.type1 === attackingSkillType || attackerPokemon.type2 === attackingSkillType)) {
        stabMultiplier = 1.5; // Hệ số STAB thường là 1.5
        console.log(`[DAMAGE_CALC] STAB Applied (x${stabMultiplier})`);
    }

    // --- 4. Tính toán Critical Hit (Đòn chí mạng) ---
    // Xác suất chí mạng (ví dụ: 6.25% hay 1/16, có thể thay đổi)
    const criticalHitChance = 1 / 16; // Hoặc 0.0625
    if (Math.random() < criticalHitChance) {
        criticalHitMultiplier = 1.5; // Hệ số chí mạng thường là 1.5 (từ Gen VI trở đi)
        effectivenessMessage += ' (Chí mạng!)'; // Thêm vào thông điệp
        console.log(`[DAMAGE_CALC] Critical Hit! (x${criticalHitMultiplier})`);
    }

    // --- 5. Tính toán Random Variance (Sai số ngẫu nhiên) ---
    // Sát thương ngẫu nhiên từ 0.85 đến 1.0
    randomMultiplier = (Math.floor(Math.random() * (100 - 85 + 1)) + 85) / 100;
    console.log(`[DAMAGE_CALC] Random Multiplier: ${randomMultiplier}`);


    // --- 6. Công thức tính sát thương cuối cùng ---
    // Damage = (((2 * Level / 5 + 2) * SkillPower * AttackStat / DefenseStat) / 50) + 2
    // Sau đó nhân với STAB, Type Effectiveness, Critical Hit, và Random
    const attackerLevel = attackerPokemon.level || 1; // Đảm bảo level không phải là undefined/null
    let baseDamage = Math.floor(
        (((2 * attackerLevel / 5 + 2) * skillPower * attackStat / defenseStat) / 50) + 2
    );
    console.log(`[DAMAGE_CALC] Base Damage: ${baseDamage}`);

    damage = Math.floor(baseDamage * stabMultiplier * typeEffectivenessMultiplier * criticalHitMultiplier * randomMultiplier);

    // Đảm bảo sát thương luôn dương và ít nhất là 1, trừ khi hiệu quả hệ là 0.0
    if (typeEffectivenessMultiplier === 0.0) {
        damage = 0;
        message = `**${attackerPokemon.nickname || attackerPokemon.pokemon_name || 'Pokémon'}** đã dùng **${skill.name}** nhưng **không có tác dụng** lên **${defenderPokemon.nickname || defenderPokemon.pokemon_name || 'Pokémon'}**!`;
    } else {
        damage = Math.max(1, damage); // Sát thương tối thiểu là 1 nếu có tác dụng
        message = `**${attackerPokemon.nickname || attackerPokemon.pokemon_name || 'Pokémon'}** đã dùng **${skill.name}** và gây **${damage}** sát thương lên **${defenderPokemon.nickname || defenderPokemon.pokemon_name || 'Pokémon'}**!${effectivenessMessage}`;
    }

    console.log(`[DAMAGE_CALC] Final Damage: ${damage}, Message: ${message}`);
    return { damage, message };
}

/**
 * Tính toán HP tối đa của Pokémon dựa trên base stats, IV, EV và level.
 * Đây là công thức chuẩn của game Pokémon.
 * @param {number} baseHp - Chỉ số HP gốc của loài Pokémon.
 * @param {number} ivHp - Chỉ số Individual Value (IV) của HP (0-31).
 * @param {number} evHp - Chỉ số Effort Value (EV) của HP (0-255, nhưng tối đa 63 cho một stat).
 * @param {number} level - Cấp độ hiện tại của Pokémon.
 * @returns {number} HP tối đa của Pokémon.
 */
function calculateMaxHp(baseHp, ivHp, evHp, level) {
    if (baseHp === undefined || ivHp === undefined || evHp === undefined || level === undefined) {
         console.warn(`[BattleUtils] Thiếu dữ liệu để tính HP tối đa: baseHp=${baseHp}, ivHp=${ivHp}, evHp=${evHp}, level=${level}. Trả về 100.`);
         return 100; // Trả về giá trị mặc định để tránh lỗi
    }
    const finalEvHp = Math.min(252, evHp); // EV tối đa cho 1 stat là 252 (để chia hết cho 4)
    
    const hp = Math.floor((2 * baseHp + ivHp + Math.floor(finalEvHp / 4)) * level / 100) + level + 10;
    return hp;
}

/**
 * Tạo thanh máu cho Pokémon.
 * @param {number} currentHp - HP hiện tại.
 * @param {number} maxHp - HP tối đa.
 * @param {number} barLength - Độ dài của thanh máu (số ký tự).
 * @returns {string} Thanh máu dưới dạng chuỗi ký tự.
 */
function generateHpBar(currentHp, maxHp, barLength = 10) {
    if (maxHp <= 0) return '[---]'; // Tránh lỗi chia cho 0
    const percentage = Math.max(0, Math.min(1, currentHp / maxHp)); // Đảm bảo percentage nằm trong khoảng [0, 1]
    const filledBlocks = Math.round(barLength * percentage);
    const emptyBlocks = barLength - filledBlocks;
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    return `[${bar}]`;
}

module.exports = {
    calculateDamage,
    generateHpBar,
    calculateMaxHp // Đảm bảo hàm này được export
};