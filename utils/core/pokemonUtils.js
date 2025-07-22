// utils/pokemonUtils.js
const { db } = require('../../db'); // Đảm bảo bạn đã import db

/**
 * Lấy URL sprite của Pokémon.
 * @param {number} pokedexId - Pokedex ID của Pokémon.
 * @param {string} type - 'front', 'back', 'official', 'shiny_front', 'shiny_back'.
 * @param {boolean} isShiny - True nếu là shiny, False nếu không.
 * @returns {string} URL của sprite.
 */
function getPokemonSpriteUrl(pokedexId, type = 'front', isShiny = false) {
    // Đây là ví dụ về URL, bạn có thể thay đổi tùy thuộc vào nguồn dữ liệu của bạn
    // Ví dụ từ PokeAPI (cần điều chỉnh nếu bạn dùng dữ liệu khác)
    const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
    const shinyPath = isShiny ? 'shiny/' : '';

    switch (type) {
        case 'front':
            return `${baseUrl}${shinyPath}${pokedexId}.png`;
        case 'back':
            return `${baseUrl}back/${shinyPath}${pokedexId}.png`;
        case 'official': // Thường là official artwork, không có shiny
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
        case 'shiny_front':
            return `${baseUrl}shiny/${pokedexId}.png`;
        case 'shiny_back':
            return `${baseUrl}back/shiny/${pokedexId}.png`;
        default:
            return `${baseUrl}${shinyPath}${pokedexId}.png`;
    }
}

/**
 * Lấy tên Pokémon từ pokedex_id, có tính đến trạng thái mega/biệt danh.
 * @param {object} dbInstance - Instance của Knex database.
 * @param {number} pokedexId - Pokedex ID của Pokémon.
 * @param {boolean} isMegaEvolved - True nếu là dạng Mega.
 * @returns {Promise<string>} Tên Pokémon.
 */
async function getPokemonName(dbInstance, pokedexId, isMegaEvolved = false) {
    let pokemonData;
    if (isMegaEvolved) {
        // Nếu có dạng Mega, giả sử bạn có cách để lưu trữ hoặc tính toán pokedex_id của dạng Mega
        // Hiện tại, chúng ta sẽ chỉ lấy tên từ pokedex_id chính.
        // Bạn có thể cần một logic phức tạp hơn ở đây nếu bạn có các pokedex_id riêng cho từng dạng Mega.
        pokemonData = await dbInstance('pokemons').where({ pokedex_id: pokedexId }).first();
        if (pokemonData && pokemonData.name) {
            // Đây là một ví dụ đơn giản. Tên Mega có thể được lưu riêng hoặc được thêm tiền tố/hậu tố.
            // Ví dụ: 'Charizard-Mega-X'
            return pokemonData.name.replace(/-\w+/g, '') + '-Mega'; // Chỉ là ví dụ, điều chỉnh tùy theo dữ liệu của bạn
        }
    } else {
        pokemonData = await dbInstance('pokemons').where({ pokedex_id: pokedexId }).first();
    }

    return pokemonData ? pokemonData.name : 'Unknown Pokémon';
}

/**
 * Viết hoa chữ cái đầu tiên của một chuỗi.
 * @param {string} string - Chuỗi cần viết hoa.
 * @returns {string} Chuỗi đã viết hoa chữ cái đầu tiên.
 */
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Tính toán chỉ số cuối cùng của Pokémon dựa trên chỉ số cơ bản, cấp độ và IVs.
 * Đây là một công thức đơn giản để bắt đầu.
 * @param {object} pokedexBaseStats Dữ liệu chỉ số cơ bản của Pokémon từ bảng `pokemons` (e.g., { hp, attack, ... })
 * @param {number} level Cấp độ hiện tại của Pokémon
 * @param {object} ivs Các chỉ số IV của Pokémon (e.g., { hp_iv, attack_iv, ... }), mặc định là 0 nếu không có
 * @returns {object} Các chỉ số đã tính toán (hp, attack, defense, special_attack, special_defense, speed)
 */
function getPokemonStats(pokedexBaseStats, level, ivs = {}) {
    const hp_iv = ivs.hp_iv || 0;
    const attack_iv = ivs.attack_iv || 0;
    const defense_iv = ivs.defense_iv || 0;
    const special_attack_iv = ivs.special_attack_iv || 0;
    const special_defense_iv = ivs.special_defense_iv || 0;
    const speed_iv = ivs.speed_iv || 0;

    const calculateStat = (base, iv, isHp = false) => {
        const safeBase = Number(base) || 0;
        const safeIv = Number(iv) || 0;
        const safeLevel = Number(level) || 1;

        let stat = Math.floor(0.01 * (2 * safeBase + safeIv) * safeLevel);
        if (isHp) {
            stat += safeLevel + 10;
        } else {
            stat += 5;
        }
        return Math.max(1, stat);
    };

    return {
        hp: calculateStat(pokedexBaseStats.hp, hp_iv, true),
        attack: calculateStat(pokedexBaseStats.attack, attack_iv),
        defense: calculateStat(pokedexBaseStats.defense, defense_iv),
        special_attack: calculateStat(pokedexBaseStats.special_attack, special_attack_iv),
        special_defense: calculateStat(pokedexBaseStats.special_defense, special_defense_iv),
        speed: calculateStat(pokedexBaseStats.speed, speed_iv),
    };
}

/**
 * Chọn một Pokémon Mythical ngẫu nhiên làm boss từ bảng `pokemons`.
 * ĐÃ SỬA: Thay 'Mystical' thành 'Mythical'
 * @param {object} dbInstance Knex instance
 * @returns {Promise<object|null>} Thông tin Pokémon boss hoặc null nếu không tìm thấy
 */
async function getRandomMysticalBoss(dbInstance) {
    try {
        // Lấy tất cả Pokémon có rarity là 'Mythical'
        const mythicalPokemons = await dbInstance('pokemons')
            .where('rarity', 'Mythical') // ĐÃ SỬA TỪ 'Mystical' SANG 'Mythical'
            .select('*');

        if (mythicalPokemons.length === 0) {
            console.warn('[BOSS_SELECT_WARN] Không tìm thấy Pokémon nào có rarity "Mythical" trong database.');
            return null;
        }

        // Chọn một Pokémon ngẫu nhiên từ danh sách
        const randomIndex = Math.floor(Math.random() * mythicalPokemons.length);
        return mythicalPokemons[randomIndex];
    } catch (error) {
        console.error('[BOSS_SELECT_ERROR] Lỗi khi chọn boss Mythical ngẫu nhiên:', error);
        return null;
    }
}


module.exports = {
    getPokemonSpriteUrl,
    getPokemonName,
    capitalizeFirstLetter,
    getPokemonStats,
    getRandomMysticalBoss,
};
