const knexConfig = require('./knexfile');
const pgKnex = require('knex')(knexConfig.development);

// --- Danh sách các quy tắc tiến hóa tùy chỉnh (Mega, Gigantamax, Regional Forms) ---
// Dữ liệu này được bạn cung cấp.
const CUSTOM_EVOLUTIONS = [
    { from_pokemon_name: 'venusaur', to_pokemon_name: 'venusaur-mega', required_item_name: 'Venusaurite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'charizard', to_pokemon_name: 'charizard-mega-x', required_item_name: 'Charizardite X', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'charizard', to_pokemon_name: 'charizard-mega-y', required_item_name: 'Charizardite Y', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'blastoise', to_pokemon_name: 'blastoise-mega', required_item_name: 'Blastoisinite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'beedrill', to_pokemon_name: 'beedrill-mega', required_item_name: 'Beedrillite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'pidgeot', to_pokemon_name: 'pidgeot-mega', required_item_name: 'Pidgeotite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'alakazam', to_pokemon_name: 'alakazam-mega', required_item_name: 'Alakazite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'slowbro', to_pokemon_name: 'slowbro-mega', required_item_name: 'Slowbronite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'gengar', to_pokemon_name: 'gengar-mega', required_item_name: 'Gengarite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'kangaskhan', to_pokemon_name: 'kangaskhan-mega', required_item_name: 'Kangaskhanite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'pinsir', to_pokemon_name: 'pinsir-mega', required_item_name: 'Pinsirite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'gyarados', to_pokemon_name: 'gyarados-mega', required_item_name: 'Gyaradosite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'aerodactyl', to_pokemon_name: 'aerodactyl-mega', required_item_name: 'Aerodactylite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'mewtwo', to_pokemon_name: 'mewtwo-mega-x', required_item_name: 'Mewtwonite X', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'mewtwo', to_pokemon_name: 'mewtwo-mega-y', required_item_name: 'Mewtwonite Y', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'ampharos', to_pokemon_name: 'ampharos-mega', required_item_name: 'Ampharosite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'scizor', to_pokemon_name: 'scizor-mega', required_item_name: 'Scizorite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'heracross', to_pokemon_name: 'heracross-mega', required_item_name: 'Heracronite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'houndoom', to_pokemon_name: 'houndoom-mega', required_item_name: 'Houndoominite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'tyranitar', to_pokemon_name: 'tyranitar-mega', required_item_name: 'Tyranitarite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'blaziken', to_pokemon_name: 'blaziken-mega', required_item_name: 'Blazikenite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'swampert', to_pokemon_name: 'swampert-mega', required_item_name: 'Swampertite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'sceptile', to_pokemon_name: 'sceptile-mega', required_item_name: 'Sceptilite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'gardevoir', to_pokemon_name: 'gardevoir-mega', required_item_name: 'Gardevoirite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'mawile', to_pokemon_name: 'mawile-mega', required_item_name: 'Mawilite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'aggron', to_pokemon_name: 'aggron-mega', required_item_name: 'Aggronite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'medicham', to_pokemon_name: 'medicham-mega', required_item_name: 'Medichamite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'manectric', to_pokemon_name: 'manectric-mega', required_item_name: 'Manectite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'sharpedo', to_pokemon_name: 'sharpedo-mega', required_item_name: 'Sharpedonite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'camerupt', to_pokemon_name: 'camerupt-mega', required_item_name: 'Cameruptite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'altaria', to_pokemon_name: 'altaria-mega', required_item_name: 'Altarianite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'banette', to_pokemon_name: 'banette-mega', required_item_name: 'Banettite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'absol', to_pokemon_name: 'absol-mega', required_item_name: 'Absolite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'glalie', to_pokemon_name: 'glalie-mega', required_item_name: 'Glalitite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'salamence', to_pokemon_name: 'salamence-mega', required_item_name: 'Salamencite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'metagross', to_pokemon_name: 'metagross-mega', required_item_name: 'Metagrossite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'latias', to_pokemon_name: 'latias-mega', required_item_name: 'Latiasite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'latios', to_pokemon_name: 'latios-mega', required_item_name: 'Latiosite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'rayquaza', to_pokemon_name: 'rayquaza-mega', required_item_name: 'Rayquazite', evolution_type: 'mega_evolution', trigger_method: 'use-item' }, // Rayquaza đặc biệt không dùng vật phẩm
    { from_pokemon_name: 'lopunny', to_pokemon_name: 'lopunny-mega', required_item_name: 'Lopunnite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'gallade', to_pokemon_name: 'gallade-mega', required_item_name: 'Galladite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'audino', to_pokemon_name: 'audino-mega', required_item_name: 'Audinite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'diancie', to_pokemon_name: 'diancie-mega', required_item_name: 'Diancite', evolution_type: 'mega_evolution', trigger_method: 'use-item' },

    // --- Gigantamax Evolutions --- (Tất cả đều dùng G-Max Soup)
    { from_pokemon_name: 'charizard', to_pokemon_name: 'charizard-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'butterfree', to_pokemon_name: 'butterfree-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'pikachu', to_pokemon_name: 'pikachu-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'meowth', to_pokemon_name: 'meowth-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'machamp', to_pokemon_name: 'machamp-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'gengar', to_pokemon_name: 'gengar-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'kingler', to_pokemon_name: 'kingler-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'lapras', to_pokemon_name: 'lapras-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'eevee', to_pokemon_name: 'eevee-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'snorlax', to_pokemon_name: 'snorlax-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'garbodor', to_pokemon_name: 'garbodor-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'rillaboom', to_pokemon_name: 'rillaboom-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'cinderace', to_pokemon_name: 'cinderace-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'inteleon', to_pokemon_name: 'inteleon-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'corviknight', to_pokemon_name: 'corviknight-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'orbeetle', to_pokemon_name: 'orbeetle-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'drednaw', to_pokemon_name: 'drednaw-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'coalossal', to_pokemon_name: 'coalossal-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'flapple', to_pokemon_name: 'flapple-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'appletun', to_pokemon_name: 'appletun-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'sandaconda', to_pokemon_name: 'sandaconda-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'toxtricity-amped', to_pokemon_name: 'toxtricity-amped-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'centiskorch', to_pokemon_name: 'centiskorch-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'hatterene', to_pokemon_name: 'hatterene-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'grimmsnarl', to_pokemon_name: 'grimmsnarl-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'alcremie', to_pokemon_name: 'alcremie-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'copperajah', to_pokemon_name: 'copperajah-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'duraludon', to_pokemon_name: 'duraludon-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'urshifu-single-strike', to_pokemon_name: 'urshifu-single-strike-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'urshifu-rapid-strike', to_pokemon_name: 'urshifu-rapid-strike-gigantamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' },
    { from_pokemon_name: 'eternatus', to_pokemon_name: 'eternatus-eternamax', required_item_name: 'G-Max Soup', evolution_type: 'gigantamax_evolution', trigger_method: 'use-item' }, // Eternamax cũng có thể coi là Gigantamax về mặt logic

    // --- Regional Stone Evolutions (Alolan, Galarian, Hisuian) ---
    // Các cặp này là tiến hóa từ dạng gốc Kanto sang dạng khu vực bằng đá
    { from_pokemon_name: 'vulpix', to_pokemon_name: 'vulpix-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' }, // Thay 'item' thành 'use-item'
    { from_pokemon_name: 'sandshrew', to_pokemon_name: 'sandshrew-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'diglett', to_pokemon_name: 'diglett-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'geodude', to_pokemon_name: 'geodude-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'grimer', to_pokemon_name: 'grimer-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'rattata', to_pokemon_name: 'rattata-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'raichu', to_pokemon_name: 'raichu-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'marowak', to_pokemon_name: 'marowak-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'persian', to_pokemon_name: 'persian-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'muk', to_pokemon_name: 'muk-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'golem', to_pokemon_name: 'golem-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'dugtrio', to_pokemon_name: 'dugtrio-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'exeggutor', to_pokemon_name: 'exeggutor-alola', required_item_name: 'Alolan Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },

    // Galarian Forms
    { from_pokemon_name: 'meowth', to_pokemon_name: 'meowth-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'ponyta', to_pokemon_name: 'ponyta-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'farfetchd', to_pokemon_name: 'farfetchd-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'zigzagoon', to_pokemon_name: 'zigzagoon-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'darumaka', to_pokemon_name: 'darumaka-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'yamask', to_pokemon_name: 'yamask-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'stunfisk', to_pokemon_name: 'stunfisk-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'corsola', to_pokemon_name: 'corsola-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'slowpoke', to_pokemon_name: 'slowpoke-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'zapdos', to_pokemon_name: 'zapdos-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'moltres', to_pokemon_name: 'moltres-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'articuno', to_pokemon_name: 'articuno-galar', required_item_name: 'Galarian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },

    // Hisuian Forms
    { from_pokemon_name: 'growlithe', to_pokemon_name: 'growlithe-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'voltorb', to_pokemon_name: 'voltorb-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'qwilfish', to_pokemon_name: 'qwilfish-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'sneasel', to_pokemon_name: 'sneasel-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'basculin', to_pokemon_name: 'basculin-white-striped', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'zorua', to_pokemon_name: 'zorua-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'goomy', to_pokemon_name: 'goomy-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'lilligant', to_pokemon_name: 'lilligant-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'zoroark', to_pokemon_name: 'zoroark-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
    { from_pokemon_name: 'goodra', to_pokemon_name: 'goodra-hisui', required_item_name: 'Hisuian Stone', evolution_type: 'regional_form', trigger_method: 'use-item' },
];

async function populateCustomEvolutions() {
    console.log('Bắt đầu điền dữ liệu tiến hóa tùy chỉnh (Mega, Gigantamax, Regional) vào PostgreSQL...');

    try {
        // --- Lấy lại tất cả items từ DB để tạo itemNameIdMap ---
        const allItemsInDb = await pgKnex('items').select('item_id', 'name');
        const itemNameIdMap = new Map();
        for (const item of allItemsInDb) {
            itemNameIdMap.set(item.name.toLowerCase().replace(/\s/g, '-'), item.item_id);
            itemNameIdMap.set(item.name.toLowerCase(), item.item_id); // Dùng cho tên không có dấu gạch ngang
        }
        console.log('Đã tạo map ánh xạ tên vật phẩm sang ID.');

        // --- Hàm để lấy Pokemon Pokedex ID từ DB dựa trên tên (bao gồm cả dạng) ---
        async function getPokemonPokedexIdByName(pokemonName) {
            const result = await pgKnex('pokemons')
                .select('pokedex_id')
                .where('name', pokemonName)
                .first();
            if (!result) {
                console.error(`Lỗi: Không tìm thấy Pokémon với tên '${pokemonName}' trong DB. Bỏ qua tiến hóa này.`);
                return null;
            }
            return result.pokedex_id;
        }

        const customEvolutionDataToInsert = [];

        for (const customEvo of CUSTOM_EVOLUTIONS) {
            const fromPokedexId = await getPokemonPokedexIdByName(customEvo.from_pokemon_name);
            const toPokedexId = await getPokemonPokedexIdByName(customEvo.to_pokemon_name);
            let requiredItemId = null;

            if (customEvo.required_item_name) {
                // Chuyển tên item sang dạng chuẩn hóa để khớp với map
                const itemNameNormalized = customEvo.required_item_name.toLowerCase().replace(/\s/g, '-');
                requiredItemId = itemNameIdMap.get(itemNameNormalized) || itemNameIdMap.get(customEvo.required_item_name.toLowerCase()); // Thử cả hai dạng
                if (!requiredItemId) {
                    console.warn(`Cảnh báo: Không tìm thấy item '${customEvo.required_item_name}' trong DB. Tiến hóa '${customEvo.from_pokemon_name}' -> '${customEvo.to_pokemon_name}' sẽ không có required_item_id.`);
                }
            }

            if (fromPokedexId && toPokedexId) {
                customEvolutionDataToInsert.push({
                    pokedex_id: fromPokedexId, // Đã đổi từ from_pokedex_id
                    evolves_to_pokedex_id: toPokedexId, // Đã đổi từ to_pokedex_id
                    required_level: customEvo.minimum_level || null, // Đã đổi từ minimum_level
                    required_item_id: requiredItemId,
                    trigger_method: customEvo.trigger_method,
                    evolution_type: customEvo.evolution_type || null,
                });
            }
        }

        // --- Chèn dữ liệu vào bảng evolutions ---
        if (customEvolutionDataToInsert.length > 0) {
            const existingEvolutions = await pgKnex('evolutions').select('pokedex_id', 'evolves_to_pokedex_id', 'trigger_method', 'required_item_id'); // Đã đổi tên cột
            const newEvolutionsFiltered = customEvolutionDataToInsert.filter(newEvo => {
                return !existingEvolutions.some(existingEvo =>
                    existingEvo.pokedex_id === newEvo.pokedex_id && // Đã đổi tên cột
                    existingEvo.evolves_to_pokedex_id === newEvo.evolves_to_pokedex_id && // Đã đổi tên cột
                    existingEvo.trigger_method === newEvo.trigger_method &&
                    existingEvo.required_item_id === newEvo.required_item_id
                );
            });

            if (newEvolutionsFiltered.length > 0) {
                await pgKnex.batchInsert('evolutions', newEvolutionsFiltered, 100);
                console.log(`Đã nhập thành công ${newEvolutionsFiltered.length} quy tắc tiến hóa tùy chỉnh vào PostgreSQL.`);
            } else {
                console.log('Không có quy tắc tiến hóa tùy chỉnh mới nào để nhập (có thể đã tồn tại).');
            }
        } else {
            console.log('Không có quy tắc tiến hóa tùy chỉnh nào để nhập.');
        }

        console.log('\n--- Quá trình điền dữ liệu tiến hóa tùy chỉnh hoàn tất! ---');

    } catch (error) {
        console.error('Đã xảy ra lỗi nghiêm trọng trong quá trình điền dữ liệu tiến hóa tùy chỉnh:', error);
        console.error('Chi tiết lỗi (nếu có):', error.message);
    } finally {
        if (pgKnex) {
            await pgKnex.destroy();
        }
    }
}

populateCustomEvolutions();