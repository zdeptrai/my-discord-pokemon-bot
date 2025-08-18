// utils/dame/battleCalculations.js
const logger = require('../logger'); // <-- Thêm dòng này

// Bảng ánh xạ hiệu quả hệ (Type Effectiveness)
// Nguồn: Dựa trên quy tắc của Pokémon games (simplified for initial implementation)
const typeEffectiveness = {
    'normal': {
        'rock': 0.5, 'ghost': 0, 'steel': 0.5
    },
    'fire': {
        'grass': 2.0, 'ice': 2.0, 'bug': 2.0, 'steel': 2.0,
        'fire': 0.5, 'water': 0.5, 'rock': 0.5, 'dragon': 0.5
    },
    'water': {
        'fire': 2.0, 'ground': 2.0, 'rock': 2.0,
        'water': 0.5, 'grass': 0.5, 'dragon': 0.5
    },
    'grass': {
        'water': 2.0, 'ground': 2.0, 'rock': 2.0,
        'fire': 0.5, 'grass': 0.5, 'poison': 0.5, 'flying': 0.5, 'bug': 0.5, 'dragon': 0.5, 'steel': 0.5
    },
    'electric': {
        'water': 2.0, 'flying': 2.0,
        'grass': 0.5, 'electric': 0.5, 'dragon': 0.5, 'ground': 0 // Ground is immune
    },
    'ice': {
        'grass': 2.0, 'ground': 2.0, 'flying': 2.0, 'dragon': 2.0,
        'fire': 0.5, 'water': 0.5, 'ice': 0.5, 'steel': 0.5
    },
    'fighting': {
        'normal': 2.0, 'ice': 2.0, 'rock': 2.0, 'dark': 2.0, 'steel': 2.0,
        'poison': 0.5, 'flying': 0.5, 'psychic': 0.5, 'bug': 0.5, 'fairy': 0.5, 'ghost': 0 // Ghost is immune
    },
    'poison': {
        'grass': 2.0, 'fairy': 2.0,
        'poison': 0.5, 'ground': 0.5, 'rock': 0.5, 'ghost': 0.5, 'steel': 0.5 // Steel is immune
    },
    'ground': {
        'fire': 2.0, 'electric': 2.0, 'poison': 2.0, 'rock': 2.0, 'steel': 2.0,
        'grass': 0.5, 'bug': 0.5, 'flying': 0 // Flying is immune
    },
    'flying': {
        'grass': 2.0, 'fighting': 2.0, 'bug': 2.0,
        'electric': 0.5, 'rock': 0.5, 'steel': 0.5
    },
    'psychic': {
        'fighting': 2.0, 'poison': 2.0,
        'psychic': 0.5, 'steel': 0.5, 'dark': 0 // Dark is immune
    },
    'bug': {
        'grass': 2.0, 'psychic': 2.0, 'dark': 2.0,
        'fighting': 0.5, 'flying': 0.5, 'poison': 0.5, 'ghost': 0.5, 'steel': 0.5, 'fire': 0.5, 'fairy': 0.5
    },
    'rock': {
        'fire': 2.0, 'ice': 2.0, 'flying': 2.0, 'bug': 2.0,
        'fighting': 0.5, 'ground': 0.5, 'steel': 0.5
    },
    'ghost': {
        'psychic': 2.0, 'ghost': 2.0,
        'dark': 0.5, 'normal': 0 // Normal is immune
    },
    'dragon': {
        'dragon': 2.0,
        'steel': 0.5, 'fairy': 0 // Fairy is immune
    },
    'steel': {
        'ice': 2.0, 'rock': 2.0, 'fairy': 2.0,
        'fire': 0.5, 'water': 0.5, 'electric': 0.5, 'steel': 0.5
    },
    'dark': {
        'psychic': 2.0, 'ghost': 2.0,
        'fighting': 0.5, 'dark': 0.5, 'fairy': 0.5
    },
    'fairy': {
        'fighting': 2.0, 'dragon': 2.0, 'dark': 2.0,
        'fire': 0.5, 'poison': 0.5, 'steel': 0.5
    }
};

/**
 * Tính toán hệ số hiệu quả hệ.
 * @param {string} attackingType Loại kỹ năng tấn công.
 * @param {string[]} defendingTypes Mảng các loại của Pokémon phòng thủ (có thể có 1 hoặc 2 loại).
 * @returns {number} Hệ số sát thương (0, 0.5, 1, 2).
 */
function getTypeEffectiveness(attackingType, defendingTypes) {
    let multiplier = 1.0;
    const atkTypeLower = attackingType.toLowerCase();
    logger.debug('[TYPE_EFFECTIVENESS]', `Tính hiệu quả hệ: Tấn công: ${attackingType}, Phòng thủ: ${defendingTypes.join(', ')}`);

    for (const defType of defendingTypes) {
        const defTypeLower = defType.toLowerCase();
        if (typeEffectiveness[atkTypeLower] && typeEffectiveness[atkTypeLower][defTypeLower] !== undefined) {
            multiplier *= typeEffectiveness[atkTypeLower][defTypeLower];
            logger.debug('[TYPE_EFFECTIVENESS]', `  - ${attackingType} vs ${defType}: Nhân ${typeEffectiveness[atkTypeLower][defTypeLower]}, Tổng: ${multiplier}`);
        } else {
            logger.debug('[TYPE_EFFECTIVENESS]', `  - Không có hiệu quả đặc biệt cho ${attackingType} vs ${defType}.`);
        }
    }
    logger.debug('[TYPE_EFFECTIVENESS]', `Hệ số hiệu quả cuối cùng: ${multiplier}`);
    return multiplier;
}

/**
 * Tính toán sát thương từ người tấn công gây ra cho người phòng thủ, có tính đến kỹ năng và hiệu quả hệ.
 * @param {object} attackerStats Chỉ số đã tính của Pokémon tấn công (hp, attack, defense, special_attack, special_defense, speed, level, type1, type2)
 * @param {object} defenderStats Chỉ số đã tính của Pokémon phòng thủ (hp, attack, defense, special_attack, special_defense, speed, level, type1, type2)
 * @param {object} skillData Dữ liệu của kỹ năng được sử dụng ({ name, type, category, power, accuracy })
 * @returns {object} { damage: number, hit: boolean, crit: boolean, effectiveness: number }
 */
function calculateDamage(attackerStats, defenderStats, skillData) {
    logger.debug('[CALCULATE_DAMAGE_START]', `Tính toán sát thương: ${attackerStats.name} (${attackerStats.level}) dùng ${skillData.name} lên ${defenderStats.name} (${defenderStats.level})`);
    
    let attackStat;
    let defenseStat;
    const skillPower = Number(skillData.power) || 0;
    const skillCategory = skillData.category;
    const skillAccuracy = Number(skillData.accuracy) || 100;

    if (skillPower === 0 || skillCategory === 'Status') {
        logger.debug('[CALCULATE_DAMAGE_SKIP]', `Skill "${skillData.name}" có Power 0 hoặc Category "Status". Sát thương: 0.`);
        return { damage: 0, hit: true, crit: false, effectiveness: 1.0 };
    }

    if (skillCategory === 'Special') {
        attackStat = attackerStats.special_attack;
        defenseStat = defenderStats.special_defense;
        logger.debug('[CALCULATE_DAMAGE_CATEGORY]', `Skill "${skillData.name}" là Special. ATK: ${attackStat}, DEF: ${defenseStat}`);
    } else { // Mặc định là Physical
        attackStat = attackerStats.attack;
        defenseStat = defenderStats.defense;
        logger.debug('[CALCULATE_DAMAGE_CATEGORY]', `Skill "${skillData.name}" là Physical. ATK: ${attackStat}, DEF: ${defenseStat}`);
    }

    attackStat = Math.max(1, Number(attackStat) || 1);
    defenseStat = Math.max(1, Number(defenseStat) || 1);
    const attackerLevel = Number(attackerStats.level) || 1;
    logger.debug('[CALCULATE_DAMAGE_STATS]', `Level: ${attackerLevel}, Power: ${skillPower}, Attacker ATK: ${attackStat}, Defender DEF: ${defenseStat}`);

    const hitChance = Math.random() * 100;
    if (hitChance > skillAccuracy) {
        logger.debug('[CALCULATE_DAMAGE_MISS]', `Skill "${skillData.name}" trượt! (Tỉ lệ trúng: ${skillAccuracy}%, Roll: ${hitChance.toFixed(2)}%)`);
        return { damage: 0, hit: false, crit: false, effectiveness: 1.0 };
    }
    logger.debug('[CALCULATE_DAMAGE_HIT]', `Skill "${skillData.name}" trúng! (Tỉ lệ trúng: ${skillAccuracy}%, Roll: ${hitChance.toFixed(2)}%)`);


    const defenderTypes = [];
    if (defenderStats.type1) defenderTypes.push(defenderStats.type1);
    if (defenderStats.type2) defenderTypes.push(defenderStats.type2);
    const effectivenessMultiplier = getTypeEffectiveness(skillData.type, defenderTypes);

    if (effectivenessMultiplier === 0) {
        logger.debug('[CALCULATE_DAMAGE_IMMUNE]', `Skill "${skillData.name}" không có tác dụng do hiệu quả hệ (multiplier: 0).`);
        return { damage: 0, hit: true, crit: false, effectiveness: 0 };
    }

    let stab = 1;
    if (attackerStats.type1 && attackerStats.type1.toLowerCase() === skillData.type.toLowerCase() ||
        attackerStats.type2 && attackerStats.type2.toLowerCase() === skillData.type.toLowerCase()) {
        stab = 1.5;
        logger.debug('[CALCULATE_DAMAGE_STAB]', `STAB (Same-Type Attack Bonus) áp dụng (x1.5).`);
    } else {
        logger.debug('[CALCULATE_DAMAGE_STAB]', `Không áp dụng STAB.`);
    }

    let crit = 1;
    let isCrit = false;
    const critChanceRoll = Math.random();
    if (critChanceRoll < 0.0625) { // 6.25% cơ hội crit (1/16)
        crit = 1.5;
        isCrit = true;
        logger.debug('[CALCULATE_DAMAGE_CRIT]', `Đòn đánh chí mạng! (x1.5) (Roll: ${critChanceRoll.toFixed(4)})`);
    } else {
        logger.debug('[CALCULATE_DAMAGE_CRIT]', `Không chí mạng. (Roll: ${critChanceRoll.toFixed(4)})`);
    }

    const randomFactor = (Math.random() * (1.0 - 0.85) + 0.85); // Từ 0.85 đến 1.0
    logger.debug('[CALCULATE_DAMAGE_RANDOM]', `Hệ số ngẫu nhiên: ${randomFactor.toFixed(4)}`);

    let damage = Math.floor(
        (((2 * attackerLevel / 5 + 2) * skillPower * attackStat / defenseStat) / 50 + 2) *
        stab * effectivenessMultiplier * crit * randomFactor
    );

    damage = Math.max(1, damage); // Sát thương tối thiểu là 1
    logger.debug('[CALCULATE_DAMAGE_RESULT]', `Sát thương cuối cùng gây ra: ${damage}. Hit: true, Crit: ${isCrit}, Effectiveness: ${effectivenessMultiplier}`);

    return {
        damage: damage,
        hit: true,
        crit: isCrit,
        effectiveness: effectivenessMultiplier
    };
}

module.exports = {
    typeEffectiveness, 
    getTypeEffectiveness,
    calculateDamage,
};