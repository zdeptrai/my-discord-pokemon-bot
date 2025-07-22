// utils/pokemonData.js

const POKEMON_DATA = {
    'bulbasaur': {
        name: 'Bulbasaur',
        imageUrl: 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/001.png'
    },
    'charmander': {
        name: 'Charmander',
        imageUrl: 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/004.png'
    },
    'squirtle': {
        name: 'Squirtle',
        name: 'Squirtle',
        imageUrl: 'https://assets.pokemon.com/assets/cms2/img/pokedex/full/007.png'
    }
    // Thêm các Pokémon khác nếu bạn muốn mở rộng lựa chọn
};

/**
 * Lấy thông tin của một Pokémon dựa trên ID (tên lowercase).
 * @param {string} pokemonId - ID của Pokémon (ví dụ: 'bulbasaur').
 * @returns {object|null} Đối tượng chứa tên và imageUrl của Pokémon, hoặc null nếu không tìm thấy.
 */
function getPokemonInfo(pokemonId) {
    return POKEMON_DATA[pokemonId.toLowerCase()] || null;
}

module.exports = {
    getPokemonInfo
};