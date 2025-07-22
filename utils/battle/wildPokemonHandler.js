// utils/battle/wildPokemonHandler.js
const { db } = require('../../db'); // Import db từ thư mục gốc
const { generateIV, calculateHP, calculateStat, calculateWildPokemonLevel } = require('./battleCalculations');

/**
 * Lấy dữ liệu cơ bản của một Pokémon hoang dã ngẫu nhiên từ database và tính toán chỉ số của nó.
 * @param {object} userPokemon - Đối tượng Pokémon của người chơi để tính toán cấp độ Pokémon hoang dã.
 * @returns {Promise<object|null>} Đối tượng Pokémon hoang dã đã được khởi tạo chỉ số, hoặc null nếu không tìm thấy.
 */
async function getAndInitializeWildPokemon(userPokemon) {
    try {
        const totalPokemonsResult = await db('pokemons').count('pokedex_id as count').first();
        const totalPokemonsCount = totalPokemonsResult ? parseInt(totalPokemonsResult.count) : 0;

        if (totalPokemonsCount === 0) {
            console.warn('[WILD_POKEMON_HANDLER_WARN] Không có Pokémon nào trong database để tạo Pokémon hoang dã.');
            return null;
        }

        const randomOffset = Math.floor(Math.random() * totalPokemonsCount);

        const wildPokemonBaseData = await db('pokemons')
            .offset(randomOffset)
            .limit(1)
            .first();

        if (!wildPokemonBaseData) {
            console.error('[WILD_POKEMON_HANDLER_ERROR] Không tìm thấy Pokémon hoang dã sau khi truy vấn ngẫu nhiên.');
            return null;
        }

        // Tính toán cấp độ và chỉ số cho Pokémon hoang dã
        const wildPokemonLevel = calculateWildPokemonLevel(userPokemon.level);

        const wildHpIv = generateIV();
        const wildAttackIv = generateIV();
        const wildDefenseIv = generateIV();
        const wildSpAttackIv = generateIV();
        const wildSpDefenseIv = generateIV();
        const wildSpeedIv = generateIV();

        const wildMaxHp = calculateHP(wildPokemonBaseData.hp, wildHpIv, wildPokemonLevel);
        const wildAttack = calculateStat(wildPokemonBaseData.attack, wildAttackIv, wildPokemonLevel);
        const wildDefense = calculateStat(wildPokemonBaseData.defense, wildDefenseIv, wildPokemonLevel);
        const wildSpecialAttack = calculateStat(wildPokemonBaseData.special_attack, wildSpAttackIv, wildPokemonLevel);
        const wildSpecialDefense = calculateStat(wildPokemonBaseData.special_defense, wildSpDefenseIv, wildPokemonLevel);
        const wildSpeed = calculateStat(wildPokemonBaseData.speed, wildSpeedIv, wildPokemonLevel);

        return {
            ...wildPokemonBaseData,
            current_hp: wildMaxHp,
            max_hp: wildMaxHp,
            level: wildPokemonLevel,
            attack: wildAttack,
            defense: wildDefense,
            special_attack: wildSpecialAttack,
            special_defense: wildSpecialDefense,
            speed: wildSpeed,
            pokemon_name: wildPokemonBaseData.name // Đảm bảo có thuộc tính này cho hiển thị
        };

    } catch (error) {
        console.error('[WILD_POKEMON_HANDLER_ERROR] Lỗi khi lấy hoặc khởi tạo Pokémon hoang dã:', error);
        return null;
    }
}

module.exports = {
    getAndInitializeWildPokemon,
};