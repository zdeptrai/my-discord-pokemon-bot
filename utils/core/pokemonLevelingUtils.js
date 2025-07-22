// utils/pokemonLevelingUtils.js
// Không cần import db ở đây nữa vì các hàm này chỉ tính toán, không tương tác trực tiếp với db

// Giới hạn thời gian huấn luyện tối đa để tính EXP mỗi lần thu thập
const MAX_TRAINING_HOURS_PER_COLLECT = 24;

/**
 * Tính toán lượng kinh nghiệm cần thiết để đạt cấp độ tiếp theo.
 * Công thức này đảm bảo cấp độ càng cao, EXP cần càng nhiều.
 * Ví dụ:
 * - Lv 1 -> Lv 2: 100 EXP
 * - Lv 2 -> Lv 3: 200 EXP
 * - Lv 3 -> Lv 4: 300 EXP
 * ...
 * @param {number} currentLevel - Cấp độ hiện tại của Pokémon.
 * @returns {number} Lượng EXP cần thiết để lên cấp tiếp theo.
 */
function calculateExpToNextLevel(currentLevel) {
    if (currentLevel >= 100) return Infinity; // Max level, không cần thêm EXP
    return currentLevel * 100;
}

/**
 * Tính toán EXP nhận được từ huấn luyện dựa trên cấp độ và thời gian.
 * Pokémon cấp cao sẽ nhận được EXP ít hơn so với nhu cầu của chúng, khuyến khích battle.
 * @param {number} currentLevel - Cấp độ hiện tại của Pokémon.
 * @param {number} durationMinutes - Thời gian huấn luyện tính bằng phút.
 * @returns {number} Lượng EXP mà Pokémon nhận được.
 */
function calculateTrainingExpGained(currentLevel, durationMinutes) {
    // EXP cơ bản mỗi phút
    let expPerMinute = 20;

    // Giảm hiệu suất EXP ở cấp độ cao hơn
    // Ví dụ:
    // - Lv 1-10: 100% expPerMinute
    // - Lv 11-20: Giảm 10%
    // - Lv 21-30: Giảm 20%
    // ...
    if (currentLevel > 20) {
        expPerMinute *= (1 - Math.floor((currentLevel - 1) / 10) * 0.05);
        if (expPerMinute < 1) expPerMinute = 1; // Đảm bảo ít nhất 1 EXP/phút
    }

    // Tăng nhẹ EXP nếu level thấp để khởi đầu nhanh hơn
    if (currentLevel <= 5) {
        expPerMinute *= 1.5; // Ví dụ: 1.5 lần EXP cho Lv 1-5
    }

    const rawExpGained = Math.floor(durationMinutes * expPerMinute);

    return rawExpGained;
}


/**
 * Tính toán chỉ số HP dựa trên base stat, IV và cấp độ.
 * @param {number} base - Chỉ số gốc của Pokémon (từ pokedex).
 * @param {number} iv - Chỉ số IV của Pokémon (0-31).
 * @param {number} lvl - Cấp độ hiện tại của Pokémon.
 * @returns {number} Giá trị chỉ số HP đã tính.
 */
const calculateHP = (base, iv, lvl) => {
    // SỬA LỖI: Đảm bảo base, iv, lvl là số hợp lệ
    const safeBase = Number(base) || 0;
    const safeIv = Number(iv) || 0;
    const safeLvl = Number(lvl) || 1; // Level không thể là 0

    return Math.floor(0.01 * (2 * safeBase + safeIv) * safeLvl) + safeLvl + 10;
};

/**
 * Tính toán chỉ số Attack, Defense, Sp.Atk, Sp.Def, Speed dựa trên base stat, IV và cấp độ.
 * @param {number} base - Chỉ số gốc của Pokémon (từ pokedex).
 * @param {number} iv - Chỉ số IV của Pokémon (0-31).
 * @param {number} lvl - Cấp độ hiện tại của Pokémon.
 * @returns {number} Giá trị chỉ số đã tính.
 */
const calculateStat = (base, iv, lvl) => {
    // SỬA LỖI: Đảm bảo base, iv, lvl là số hợp lệ
    const safeBase = Number(base) || 0;
    const safeIv = Number(iv) || 0;
    const safeLvl = Number(lvl) || 1; // Level không thể là 0

    return Math.floor(0.01 * (2 * safeBase + safeIv) * safeLvl) + 5;
};


/**
 * Kiểm tra và lên cấp cho Pokémon dựa trên EXP hiện có.
 * @param {object} userPokemon - Đối tượng Pokémon của người dùng (bao gồm level, experience, IVs).
 * @param {object} basePokemonData - Đối tượng dữ liệu gốc của Pokémon (bao gồm base stats).
 * @returns {object} { leveledUp, newLevel, newExperience, newStats, initialStats }
 */
async function checkAndLevelUpPokemon(userPokemon, basePokemonData) {
    let leveledUp = false;
    let newLevel = Number(userPokemon.level) || 1; // Đảm bảo là số, mặc định 1
    let newExperience = Number(userPokemon.experience) || 0; // Đảm bảo là số, mặc định 0

    const initialStats = {
        hp: Number(userPokemon.max_hp) || 0,
        attack: Number(userPokemon.attack) || 0,
        defense: Number(userPokemon.defense) || 0,
        special_attack: Number(userPokemon.special_attack) || 0,
        special_defense: Number(userPokemon.special_defense) || 0,
        speed: Number(userPokemon.speed) || 0,
    };
    let updatedStats = { ...initialStats };

    while (newLevel < 100 && newExperience >= calculateExpToNextLevel(newLevel)) {
        const expNeeded = calculateExpToNextLevel(newLevel);
        newExperience -= expNeeded;
        newLevel++;
        leveledUp = true;

        // Tính lại chỉ số cho cấp độ mới
        // Đảm bảo basePokemonData.hp và userPokemon.hp_iv là số
        updatedStats.hp = calculateHP(
            Number(basePokemonData.base_hp) || 0, // ĐÃ SỬA: dùng basePokemonData.base_hp
            Number(userPokemon.hp_iv) || 0,
            newLevel
        );
        updatedStats.attack = calculateStat(
            Number(basePokemonData.base_attack) || 0, // ĐÃ SỬA
            Number(userPokemon.attack_iv) || 0,
            newLevel
        );
        updatedStats.defense = calculateStat(
            Number(basePokemonData.base_defense) || 0, // ĐÃ SỬA
            Number(userPokemon.defense_iv) || 0,
            newLevel
        );
        updatedStats.special_attack = calculateStat(
            Number(basePokemonData.base_special_attack) || 0, // ĐÃ SỬA
            Number(userPokemon.special_attack_iv) || 0,
            newLevel
        );
        updatedStats.special_defense = calculateStat(
            Number(basePokemonData.base_special_defense) || 0, // ĐÃ SỬA
            Number(userPokemon.special_defense_iv) || 0,
            newLevel
        );
        updatedStats.speed = calculateStat(
            Number(basePokemonData.base_speed) || 0, // ĐÃ SỬA
            Number(userPokemon.speed_iv) || 0,
            newLevel
        );

        // Cần hồi máu đầy đủ sau khi lên cấp (tăng max_hp)
        updatedStats.current_hp = updatedStats.hp; // Set current HP to new max HP
    }

    // Đảm bảo không vượt quá level 100
    if (newLevel > 100) {
        newLevel = 100;
        newExperience = 0; // Không nhận thêm EXP nếu đã max level
    }

    return {
        leveledUp,
        newLevel,
        newExperience,
        newStats: updatedStats,
        initialStats: initialStats // Trả về chỉ số ban đầu để so sánh
    };
}


module.exports = {
    MAX_TRAINING_HOURS_PER_COLLECT,
    calculateExpToNextLevel,
    calculateTrainingExpGained,
    checkAndLevelUpPokemon,
    calculateHP,
    calculateStat,
};