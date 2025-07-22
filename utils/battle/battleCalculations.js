// utils/battle/battleCalculations.js

/**
 * Tính toán EXP cần thiết để lên cấp tiếp theo.
 * @param {number} currentLevel
 * @returns {number}
 */
const calculateExpToNextLevel = (currentLevel) => {
    if (currentLevel >= 100) return 0; // Đã đạt cấp tối đa
    return currentLevel * 100;
};

/**
 * Tính toán HP tối đa của Pokémon dựa trên chỉ số gốc, IV và cấp độ.
 * Công thức: floor(0.01 * (2 * base + iv) * lvl) + lvl + 10
 * @param {number} base - HP base của Pokémon.
 * @param {number} iv - Chỉ số IV HP (0-31).
 * @param {number} lvl - Cấp độ của Pokémon.
 * @returns {number}
*/
const calculateHP = (base, iv, lvl) => {
    return Math.floor(0.01 * (2 * base + iv) * lvl) + lvl + 10;
};

/**
 * Tính toán chỉ số (Attack, Defense, Special Attack, Special Defense, Speed) của Pokémon.
 * Công thức: floor(0.01 * (2 * base + iv) * lvl) + 5
 * @param {number} base - Chỉ số base của Pokémon.
 * @param {number} iv - Chỉ số IV tương ứng (0-31).
 * @param {number} lvl - Cấp độ của Pokémon.
 * @returns {number}
*/
const calculateStat = (base, iv, lvl) => {
    return Math.floor(0.01 * (2 * base + iv) * lvl) + 5;
};

/**
 * Tạo ra một chỉ số IV ngẫu nhiên (0-31).
 * @returns {number}
*/
const generateIV = () => Math.floor(Math.random() * 32);

/**
 * Tính toán cấp độ ngẫu nhiên cho Pokémon hoang dã dựa trên cấp độ của Pokémon người chơi.
 * @param {number} userLevel - Cấp độ của Pokémon người chơi.
 * @returns {number}
*/
const calculateWildPokemonLevel = (userLevel) => {
    let minWildLevel, maxWildLevel;
    if (userLevel <= 2) {
        minWildLevel = 1;
        maxWildLevel = 3;
    } else {
        minWildLevel = Math.max(1, userLevel - 5);
        maxWildLevel = userLevel + 5;
    }
    return Math.floor(Math.random() * (maxWildLevel - minWildLevel + 1)) + minWildLevel;
};

// --- CÁC HÀM MỚI CHO EXP VÀ POKECOIN ---

/**
 * Tính toán lượng EXP mà Pokémon nhận được sau trận chiến.
 * @param {object} userPokemon - Đối tượng Pokémon của người dùng (sau trận đấu).
 * @param {object} wildPokemon - Đối tượng Pokémon hoang dã (sau trận đấu).
 * @returns {number} Lượng EXP mà userPokemon nhận được.
*/
const calculateExpGain = (userPokemon, wildPokemon) => {
    const BASE_EXP_WIN = 30; // EXP cơ bản khi thắng
    const LEVEL_DIFFERENCE_FACTOR = 0.02; // Hệ số ảnh hưởng bởi chênh lệch cấp độ
    const WILD_LEVEL_MULTIPLIER = 1.9; // Mỗi cấp độ wild pokemon thêm EXP

    let exp = BASE_EXP_WIN;

    // Ảnh hưởng của cấp độ Pokémon hoang dã
    exp += wildPokemon.level * WILD_LEVEL_MULTIPLIER;

    // Ảnh hưởng của cấp độ Pokémon người dùng so với wild Pokémon
    const levelDiff = wildPokemon.level - userPokemon.level;
    exp += levelDiff * LEVEL_DIFFERENCE_FACTOR * BASE_EXP_WIN;

    exp = Math.max(10, Math.round(exp));

    return exp;
};

/**
 * Tính toán lượng Pokecoin mà người dùng nhận được sau trận chiến.
 * @param {object} userPokemon - Đối tượng Pokémon của người dùng.
 * @param {object} wildPokemon - Đối tượng Pokémon hoang dã.
 * @returns {number} Lượng Pokecoin mà người dùng nhận được.
*/
const calculatePokecoinGain = (userPokemon, wildPokemon) => {
    const BASE_POKECOIN_WIN = 40; // Pokecoin cơ bản khi thắng
    const WILD_LEVEL_FACTOR = 1; // Mỗi cấp độ wild pokemon thêm Pokecoin
    const RARITY_MULTIPLIER = { // Hệ số nhân theo độ hiếm của wild Pokemon
        'common': 1.0,
        'uncommon': 1.2,
        'rare': 1.5,
        'epic': 2.0,
        'legendary': 3.0,
        'mythical': 4.0
    };

    let pokecoins = BASE_POKECOIN_WIN;

    pokecoins += wildPokemon.level * WILD_LEVEL_FACTOR;

    const rarityFactor = RARITY_MULTIPLIER[wildPokemon.rarity.toLowerCase()] || 1.0;
    pokecoins *= rarityFactor;

    pokecoins = Math.max(5, Math.round(pokecoins));

    return pokecoins;
};

/**
 * Lấy các hệ số điều chỉnh sát thương cho trận chiến.
 * Hàm này có thể được mở rộng để tính toán động dựa trên cấp độ người chơi/wild,
 * trạng thái đặc biệt, hoặc cài đặt độ khó.
 *
 * @returns {object} Một đối tượng chứa:
 * - playerDamageDealtMultiplier: Hệ số nhân sát thương người chơi gây ra (mặc định 1.0).
 * - playerDamageTakenMultiplier: Hệ số nhân sát thương người chơi nhận vào (mặc định 1.0).
 * (LƯU Ý: Hàm này có thể không còn cần thiết nếu sử dụng calculateSimpleBattleDamage trực tiếp)
 */
const getBattleDamageModifiers = () => {
    // Giá trị này có thể được điều chỉnh để làm cho trận đấu dễ hơn hoặc khó hơn.
    // Ví dụ:
    // const playerDamageDealtMultiplier = 1.0; // Người chơi gây ra 100% sát thương
    // const playerDamageTakenMultiplier = 1.0; // Người chơi nhận 100% sát thương

    // Nếu bạn muốn trận đấu dễ hơn, hãy tăng playerDamageDealtMultiplier hoặc giảm playerDamageTakenMultiplier.
    // Ví dụ:
    // return {
    //     playerDamageDealtMultiplier: 1.2, // Gây thêm 20% sát thương
    //     playerDamageTakenMultiplier: 0.8, // Nhận ít hơn 20% sát thương
    // };

    // Với việc sử dụng calculateSimpleBattleDamage, hàm này có thể trở nên thừa
    // hoặc chỉ dùng để điều chỉnh sát thương cuối cùng sau khi calculateSimpleBattleDamage đã tính toán.
    return {
        playerDamageDealtMultiplier: 1.5, // Mặc định: người chơi gây sát thương bình thường
        playerDamageTakenMultiplier: 0.2, // Mặc định: người chơi nhận sát thương bình thường
    };
};

/**
 * Tính toán sát thương đơn giản cho các trận chiến luyện cấp.
 * Công thức này bỏ qua chỉ số phòng thủ của đối thủ và hiệu quả hệ.
 * @param {object} attackerStats Chỉ số đã tính của Pokémon tấn công (hp, attack, special_attack, level)
 * @param {object} skillData Dữ liệu của kỹ năng được sử dụng ({ name, type, category, power, accuracy })
 * @returns {object} { damage: number, hit: boolean, crit: boolean }
 */
function calculateSimpleBattleDamage(attackerStats, skillData) {
    let attackStat;
    const skillPower = Number(skillData.power) || 0;
    const skillCategory = skillData.category;
    const skillAccuracy = Number(skillData.accuracy) || 100;

    // Nếu skillPower là 0 (ví dụ: Status move), không gây sát thương
    if (skillPower === 0 || skillCategory === 'Status') {
        return { damage: 0, hit: true, crit: false };
    }

    // Xác định chỉ số tấn công dựa trên loại kỹ năng
    if (skillCategory === 'Special') {
        attackStat = attackerStats.special_attack;
    } else { // Mặc định là 'Physical'
        attackStat = attackerStats.attack;
    }

    // Đảm bảo chỉ số tấn công không phải là 0
    attackStat = Math.max(1, Number(attackStat) || 1);
    const attackerLevel = Number(attackerStats.level) || 1;

    // --- Kiểm tra độ chính xác (Accuracy) ---
    const hitChance = Math.random() * 100;
    if (hitChance > skillAccuracy) {
        return { damage: 0, hit: false, crit: false }; // Bỏ lỡ đòn đánh
    }

    // --- Tính toán sát thương cơ bản (Công thức đơn giản hóa) ---
    // Damage = (Level * Power * Attack_Stat / SCALE_CONSTANT) * Critical * Random_Factor
    // SCALE_CONSTANT: Hệ số điều chỉnh để cân bằng sát thương. Điều chỉnh giá trị này để làm cho trận đấu dễ/khó hơn.
    const DAMAGE_SCALE_CONSTANT = 100; // Bạn có thể thay đổi giá trị này (ví dụ: 50 để sát thương cao hơn, 200 để sát thương thấp hơn)

    // Critical Hit (Ví dụ: 6.25% cơ hội cho 1.5x sát thương)
    let crit = 1;
    let isCrit = false;
    if (Math.random() < 0.0625) { // 1/16 chance
        crit = 1.5;
        isCrit = true;
    }

    // Random factor: 0.85 to 1.0
    const randomFactor = (Math.random() * (1.0 - 0.85) + 0.85);

    let damage = Math.floor(
        (attackerLevel * skillPower * attackStat / DAMAGE_SCALE_CONSTANT) *
        crit * randomFactor
    );

    return {
        damage: Math.max(1, damage), // Sát thương tối thiểu là 1 (trừ khi miễn nhiễm)
        hit: true,
        crit: isCrit,
        // effectiveness không còn được trả về vì chúng ta đã bỏ qua nó
    };
}


module.exports = {
    calculateExpToNextLevel,
    calculateHP,
    calculateStat,
    generateIV,
    calculateWildPokemonLevel,
    calculateExpGain,
    calculatePokecoinGain,
    getBattleDamageModifiers,
    calculateSimpleBattleDamage, // ĐÃ THÊM HÀM MỚI NÀY
};
