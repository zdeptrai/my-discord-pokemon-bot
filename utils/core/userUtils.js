// utils/userUtils.js
const { db } = require('../../db');
const STARTING_POKECOINS = 5000;
// Thêm ngưỡng IV tối thiểu
const MIN_IV_THRESHOLD = 15; // Mỗi IV sẽ tối thiểu là 15 (tối đa 31)

/**
 * Kiểm tra xem người dùng đã được đăng ký trong database chưa.
 * @param {string} userId - Discord ID của người dùng.
 * @returns {Promise<boolean>} True nếu người dùng đã đăng ký, ngược lại là False.
 */
async function isUserRegistered(userId) {
    try {
        const user = await db('users').where({ discord_id: userId }).first();
        return !!user;
    } catch (error) {
        console.error(`[DATABASE_ERROR] Lỗi khi kiểm tra đăng ký người dùng ${userId}:`, error);
        return false;
    }
}

/**
 * Đăng ký người dùng mới và cấp Pokémon khởi đầu cho họ.
 * @param {string} userId - Discord ID của người dùng.
 * @param {string} starterName - Tên của Pokémon khởi đầu (ví dụ: 'bulbasaur', 'charmander', 'squirtle').
 */
async function registerUser(userId, starterName) {
    try {
        await db('users').insert({
            discord_id: userId,
            pokecoins: STARTING_POKECOINS,
        }).onConflict('discord_id').ignore();

        console.log(`[DATABASE] Người dùng mới đã được đăng ký hoặc cập nhật: (ID ${userId}) với ${STARTING_POKECOINS} Pokecoins.`);

        const basePokemonData = await db('pokemons').whereRaw('LOWER(name) = ?', [starterName.toLowerCase()]).first();

        if (!basePokemonData) {
            throw new Error(`Không tìm thấy dữ liệu base cho Pokémon: ${starterName} trong bảng 'pokemons'. Vui lòng kiểm tra lại tên và dữ liệu trong database.`);
        }

        // --- Đã sửa: IVs từ MIN_IV_THRESHOLD đến 31 ---
        const generateIV = () => Math.floor(Math.random() * (32 - MIN_IV_THRESHOLD)) + MIN_IV_THRESHOLD;

        const hp_iv = generateIV();
        const attack_iv = generateIV();
        const defense_iv = generateIV();
        const special_attack_iv = generateIV();
        const special_defense_iv = generateIV();
        const speed_iv = generateIV();
        // --- Kết thúc sửa đổi ---

        const level = 1; // Level khởi đầu

        // --- CÔNG THỨC MỚI ĐỂ TÍNH CHỈ SỐ (đảm bảo chúng ta đang dùng phiên bản này) ---
        const calculateHP = (base, iv, lvl) => Math.floor(0.01 * (2 * base + iv) * lvl) + lvl + 10;
        const calculateStat = (base, iv, lvl) => Math.floor(0.01 * (2 * base + iv) * lvl) + 5;
        // --- KẾT THÚC CÔNG THỨC MỚI ---

        const current_hp = calculateHP(basePokemonData.hp, hp_iv, level);
        const attack_stat = calculateStat(basePokemonData.attack, attack_iv, level);
        const defense_stat = calculateStat(basePokemonData.defense, defense_iv, level);
        const special_attack_stat = calculateStat(basePokemonData.special_attack, special_attack_iv, level);
        const special_defense_stat = calculateStat(basePokemonData.special_defense, special_defense_iv, level);
        const speed_stat = calculateStat(basePokemonData.speed, speed_iv, level);

        const [pokemonRecord] = await db('user_pokemons').insert({
            user_discord_id: userId,
            pokedex_id: basePokemonData.pokedex_id,
            nickname: starterName,
            level: level,
            experience: 0,
            current_hp: current_hp,
            max_hp: current_hp,
            attack: attack_stat,
            defense: defense_stat,
            special_attack: special_attack_stat,
            special_defense: special_defense_stat,
            speed: speed_stat,
            hp_iv: hp_iv,
            attack_iv: attack_iv,
            defense_iv: defense_iv,
            special_attack_iv: special_attack_iv,
            special_defense_iv: special_defense_iv,
            speed_iv: speed_iv,
            learned_skill_ids: '[]',
        }).returning('*');

        await db('users')
            .where({ discord_id: userId })
            .update({
                starter_pokemon_id: pokemonRecord.id,
                selected_pokemon_id: pokemonRecord.id,
                updated_at: new Date()
            });

        console.log(`[DATABASE] Pokémon khởi đầu ${starterName} đã được cấp cho ${userId}.`);

    } catch (error) {
        console.error(`[DATABASE_ERROR] Lỗi trong quá trình đăng ký người dùng hoặc cấp Pokémon khởi đầu ${userId}:`, error);
        throw error;
    }
}

// Hàm chung để chọn tất cả các cột cần thiết khi lấy thông tin Pokémon
const POKEMON_SELECT_FIELDS = [
    'user_pokemons.*',
    'pokemons.name as pokemon_name',
    'pokemons.sprite_front_url as image_url',
    'pokemons.official_artwork_url as full_image_url',
    'pokemons.rarity',
    'pokemons.type1',
    'pokemons.type2',
    'pokemons.hp as base_hp',
    'pokemons.attack as base_attack',
    'pokemons.defense as base_defense',
    'pokemons.special_attack as base_special_attack',
    'pokemons.special_defense as base_special_defense',
    'pokemons.speed as base_speed',
    'pokemons.sprite_back_url'
];

/**
 * Lấy Pokémon đang được chọn của người dùng, hoặc Pokémon đầu tiên nếu chưa chọn.
 * @param {string} discordId Discord ID của người dùng.
 * @returns {Promise<Object|null>} Đối tượng Pokémon của người dùng hoặc null nếu không tìm thấy.
 */
async function getSelectedOrFirstPokemon(discordId) {
    const user = await db('users').where({ discord_id: discordId }).select('selected_pokemon_id').first();
    if (!user) {
        return null;
    }

    let targetPokemon = null;

    // 1. Cố gắng lấy Pokémon được chọn
    if (user.selected_pokemon_id) {
        targetPokemon = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where('user_pokemons.id', user.selected_pokemon_id)
            .andWhere('user_pokemons.user_discord_id', discordId)
            .select(POKEMON_SELECT_FIELDS) // Sử dụng mảng các trường đã định nghĩa
            .first();
    }

    // 2. Nếu không có Pokémon được chọn hoặc Pokémon đó không tồn tại/không thuộc về người dùng, lấy Pokémon đầu tiên
    if (!targetPokemon) {
        targetPokemon = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where('user_pokemons.user_discord_id', discordId)
            .select(POKEMON_SELECT_FIELDS) // Sử dụng mảng các trường đã định nghĩa
            .orderBy('user_pokemons.id', 'asc')
            .first();

        // Nếu tìm thấy Pokémon đầu tiên và chưa có Pokémon được chọn, cập nhật selected_pokemon_id
        if (targetPokemon && !user.selected_pokemon_id) {
            await db('users')
                .where({ discord_id: discordId })
                .update({ selected_pokemon_id: targetPokemon.id, updated_at: db.fn.now() }); // Sử dụng db.fn.now()
        }
    }

    return targetPokemon;
}

/**
 * Lấy Pokémon của người dùng bằng ID duy nhất của user_pokemon (từ bảng user_pokemons.id) hoặc bằng nickname/tên Pokedex.
 * @param {string} userId - Discord ID của người dùng.
 * @param {string} identifier - ID của user_pokemon (ví dụ: '12345') hoặc nickname/tên Pokémon (ví dụ: 'pika', 'charmander').
 * @returns {Promise<Object|null>} Đối tượng Pokémon của người dùng hoặc null nếu không tìm thấy.
 */
async function getUserPokemonByIdOrName(userId, identifier) {
    // 1. Ưu tiên tìm kiếm bằng ID của user_pokemon (từ cột 'id' trong bảng user_pokemons)
    const parsedId = parseInt(identifier);
    if (!isNaN(parsedId) && parsedId > 0) {
        const pokemonById = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where({
                'user_pokemons.user_discord_id': userId,
                'user_pokemons.id': parsedId // Tìm kiếm theo user_pokemon.id
            })
            .select(POKEMON_SELECT_FIELDS) // Sử dụng mảng các trường đã định nghĩa
            .first();

        if (pokemonById) {
            return pokemonById;
        }
    }

    // 2. Nếu không tìm thấy bằng ID user_pokemon, hoặc identifier không phải số,
    // thì tìm theo nickname hoặc tên Pokedex.
    const pokemonByNameOrNickname = await db('user_pokemons')
        .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
        .where({ user_discord_id: userId })
        .where(function() {
            this.whereRaw('LOWER(user_pokemons.nickname) = ?', [identifier.toLowerCase()])
                .orWhereRaw('LOWER(pokemons.name) = ?', [identifier.toLowerCase()]);
        })
        .select(POKEMON_SELECT_FIELDS) // Sử dụng mảng các trường đã định nghĩa
        .first();

    return pokemonByNameOrNickname;
}


module.exports = {
    isUserRegistered,
    registerUser,
    getSelectedOrFirstPokemon,
    getUserPokemonByIdOrName
};