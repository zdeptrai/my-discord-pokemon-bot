// utils/core/pokemonStats.js

/**
 * A utility function to calculate a single Pokémon stat.
 * @param {number} baseStat The base stat of the Pokémon species.
 * @param {number} iv The Pokémon's current IV stat (0-31).
 * @param {number} level The Pokémon's level.
 * @param {boolean} isHP A flag to indicate if the stat is HP.
 * @returns {number} The calculated stat value.
 */
function calculateSingleStat(baseStat, iv, level, isHP = false) {
    // Formula for calculating basic Pokémon stats (without EVs)
    const stat = Math.floor(0.01 * (2 * baseStat + iv) * level);
    if (isHP) {
        return stat + level + 10;
    }
    return stat + 5;
}

/**
 * Recalculates and updates all stats of a Pokémon in the database.
 * @param {number} pokemonId The ID of the Pokémon in the user_pokemons table.
 * @param {object} db The database connection object (Knex instance).
 */
async function recalculatePokemonStats(pokemonId, db) {
    try {
        // --- ĐÃ SỬA: Sử dụng cú pháp Knex.js để lấy thông tin Pokémon ---
        const userPokemon = await db('user_pokemons')
            .where({ id: pokemonId })
            .first();
        
        if (!userPokemon) {
            console.error(`[RECALC_STATS_ERROR] Could not find Pokémon with ID: ${pokemonId}`);
            return;
        }

        // --- ĐÃ SỬA: Sử dụng cú pháp Knex.js để lấy chỉ số cơ bản ---
        const baseStats = await db('pokemons')
            .where({ pokedex_id: userPokemon.pokedex_id })
            .first();

        if (!baseStats) {
            console.error(`[RECALC_STATS_ERROR] Could not find base stats for pokedex_id: ${userPokemon.pokedex_id}`);
            return;
        }

        // Recalculate all stats
        const newMaxHp = calculateSingleStat(baseStats.hp, userPokemon.hp_iv, userPokemon.level, true);
        const newAttack = calculateSingleStat(baseStats.attack, userPokemon.attack_iv, userPokemon.level);
        const newDefense = calculateSingleStat(baseStats.defense, userPokemon.defense_iv, userPokemon.level);
        const newSpAttack = calculateSingleStat(baseStats.special_attack, userPokemon.special_attack_iv, userPokemon.level);
        const newSpDefense = calculateSingleStat(baseStats.special_defense, userPokemon.special_defense_iv, userPokemon.level);
        const newSpeed = calculateSingleStat(baseStats.speed, userPokemon.speed_iv, userPokemon.level);

        // --- ĐÃ SỬA: Sử dụng cú pháp Knex.js để cập nhật các chỉ số ---
        await db('user_pokemons')
            .where({ id: pokemonId })
            .update({
                max_hp: newMaxHp,
                attack: newAttack,
                defense: newDefense,
                special_attack: newSpAttack,
                special_defense: newSpDefense,
                speed: newSpeed
            });

        console.log(`[RECALC_STATS_SUCCESS] Updated stats for Pokémon ID: ${pokemonId}`);

    } catch (error) {
        console.error(`[RECALC_STATS_ERROR] Error while recalculating stats for Pokémon ID ${pokemonId}:`, error);
    }
}

module.exports = {
    recalculatePokemonStats,
};
