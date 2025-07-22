const path = require('path');
const knexConfig = require('./knexfile');
const axios = require('axios');

const pgKnex = require('knex')(knexConfig.development);

// Hàm tạm thời để lưu trữ danh sách Legendary và Mythical
const LEGENDARY_SPECIES_IDS = [
    150, 151, // Mewtwo, Mew
    243, 244, 245, 249, 250, 251, // Raikou, Entei, Suicune, Lugia, Ho-Oh, Celebi
    377, 378, 379, 380, 381, 382, 383, 384, 385, 386, // Regirock, Regice, Registeel, Latias, Latios, Kyogre, Groudon, Rayquaza, Jirachi, Deoxys
    480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, // Uxie, Mesprit, Azelf, Dialga, Palkia, Heatran, Regigigas, Giratina, Cresselia, Phione, Manaphy, Darkrai, Shaymin, Arceus
    638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, // Cobalion, Terrakion, Virizion, Tornadus, Thundurus, Reshiram, Zekrom, Landorus, Kyurem, Keldeo, Meloetta, Genesect
    719, 720, 721, // Diancie, Hoopa, Volcanion
    785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, // Tapu Koko, Tapu Lele, Tapu Bulu, Tapu Fini, Cosmog, Cosmoem, Solgaleo, Lunala, Nihilego, Buzzwole, Pheromosa, Xurkitree, Celesteela, Kartana, Guzzlord, Necrozma, Magearna, Marshadow, Poipole, Naganadel, Stakataka, Blacephalon, Zeraora
    888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, // Zacian, Zamazenta, Eternatus, Kubfu, Urshifu, Zarude, Regieleki, Regidrago, Glastrier, Spectrier, Calyrex
    905, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, // Enamorus, Gimmighoul, Gholdengo, Wo-Chien, Chien-Pao, Ting-Lu, Chi-Yu, Koraidon, Miraidon, Walking Wake, Iron Leaves, Fezandipiti, Munkidori, Okidogi, Pecharunt
];

// Bản đồ ánh xạ tên Mega Form trong PokeAPI tới tên của Mega Stone tương ứng.
const MEGA_STONE_MAP = {
    'venusaur-mega': 'Venusaurite',
    'charizard-mega-x': 'Charizardite X',
    'charizard-mega-y': 'Charizardite Y',
    'blastoise-mega': 'Blastoisinite',
    'alakazam-mega': 'Alakazite',
    'gengar-mega': 'Gengarite',
    'kangaskhan-mega': 'Kangaskhanite',
    'pinsir-mega': 'Pinsirite',
    'gyarados-mega': 'Gyaradosite',
    'aerodactyl-mega': 'Aerodactylite',
    'mewtwo-mega-x': 'Mewtwonite X',
    'mewtwo-mega-y': 'Mewtwonite Y',
    'ampharos-mega': 'Ampharosite',
    'scizor-mega': 'Scizorite',
    'heracross-mega': 'Heracronite',
    'houndoom-mega': 'Houndoominite',
    'tyranitar-mega': 'Tyranitarite',
    'blaziken-mega': 'Blazikenite',
    'gardevoir-mega': 'Gardevoirite',
    'mawile-mega': 'Mawilite',
    'aggron-mega': 'Aggronite',
    'medicham-mega': 'Medichamite',
    'manectric-mega': 'Manectite',
    'banette-mega': 'Banettite',
    'absol-mega': 'Absolite',
    'latias-mega': 'Latiasite',
    'latios-mega': 'Latiosite',
    'garchomp-mega': 'Garchompite',
    'lucario-mega': 'Lucarionite',
    'abomasnow-mega': 'Abomasite',
    'gallade-mega': 'Galladite',
    'audino-mega': 'Audinite',
    'diancie-mega': 'Diancite',
    'sceptile-mega': 'Sceptilite',
    'swampert-mega': 'Swampertite',
    'sableye-mega': 'Sableyenite',
    'altaria-mega': 'Altarianite',
    'salamence-mega': 'Salamencite',
    'metagross-mega': 'Metagrossite',
    'sharpedo-mega': 'Sharpedonite',
    'camerupt-mega': 'Cameruptite',
    'pidgeot-mega': 'Pidgeotite',
    'glalie-mega': 'Glalitite',
    'steelix-mega': 'Steelixite',
    'lopunny-mega': 'Lopunnite',
    'beedrill-mega': 'Beedrillite',
    'rayquaza-mega': null, // Rayquaza không dùng Mega Stone, mà học skill "Dragon Ascent"
};

// --- Bổ sung: Định nghĩa các vật phẩm tiến hóa đặc biệt khác ---
// KHÔNG CẦN CHỈ ĐỊNH item_id Ở ĐÂY, DATABASE SẼ TỰ ĐỘNG TẠO DO CÓ SERIAL PRIMARY KEY
const CUSTOM_EVOLUTION_ITEMS = [
    // Regional Stones (Đá tiến hóa dạng khu vực)
    {
        name: 'Alolan Stone',
        description: 'Một viên đá đặc biệt, giúp một số Pokémon từ vùng Kanto tiến hóa thành dạng Alolan.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/b/b5/Sun_Stone_SwSh.png', // Sử dụng tạm sprite của Sun Stone
        value: 10000
    },
    {
        name: 'Galarian Stone',
        description: 'Một viên đá đặc biệt, giúp một số Pokémon từ các vùng khác tiến hóa thành dạng Galarian.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/0/00/Dusk_Stone_SwSh.png', // Sử dụng tạm sprite của Dusk Stone
        value: 10000
    },
    {
        name: 'Hisuian Stone',
        description: 'Một viên đá đặc biệt, giúp một số Pokémon từ các vùng khác tiến hóa thành dạng Hisuian.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/b/b1/Dawn_Stone_SwSh.png', // Sử dụng tạm sprite của Dawn Stone
        value: 10000
    },

    // Các vật phẩm khác bạn cung cấp (đã loại bỏ Friendship Charm và Trade Cable theo yêu cầu)
    {
        name: 'Ice Stone',
        description: 'Một viên đá lạnh giá có thể làm tiến hóa một số Pokémon hệ Băng.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Ice_Stone_SwSh.png/64px-Ice_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Sun Stone',
        description: 'Một viên đá ấm áp như mặt trời, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e5/Sun_Stone_SwSh.png/64px-Sun_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Moon Stone',
        description: 'Một viên đá bí ẩn như mặt trăng, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/7/75/Moon_Stone_SwSh.png/64px-Moon_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Fire Stone',
        description: 'Một viên đá nóng rực có thể làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/9/91/Fire_Stone_SwSh.png/64px-Fire_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Water Stone',
        description: 'Một viên đá xanh biếc như nước, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e0/Water_Stone_SwSh.png/64px-Water_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Thunder Stone',
        description: 'Một viên đá tích điện có thể làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e5/Thunder_Stone_SwSh.png/64px-Thunder_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Leaf Stone',
        description: 'Một viên đá xanh tươi như lá, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e0/Leaf_Stone_SwSh.png/64px-Leaf_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Shiny Stone',
        description: 'Một viên đá lấp lánh có thể làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e5/Shiny_Stone_SwSh.png/64px-Shiny_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Dusk Stone',
        description: 'Một viên đá tối tăm có thể làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Dusk_Stone_SwSh.png/64px-Dusk_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Dawn Stone',
        description: 'Một viên đá rạng đông có thể làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/e/e5/Dawn_Stone_SwSh.png/64px-Dawn_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Oval Stone',
        description: 'Một viên đá hình bầu dục, làm tiến hóa một số Pokémon khi tăng cấp vào ban ngày.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Oval_Stone_SwSh.png/64px-Oval_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'G-Max Soup',
        description: 'Một món súp đặc biệt giúp Pokémon có khả năng Gigantamax.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Max_Soup_SwSh.png/64px-Max_Soup_SwSh.png',
        value: 15000
    },
    {
        name: 'Reaper Cloth',
        description: 'Một tấm vải rách rưới có thể làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Reaper_Cloth_SwSh.png/64px-Reaper_Cloth_SwSh.png',
        value: 7500
    },
    {
        name: 'Protector',
        description: 'Một thiết bị bảo vệ mạnh mẽ, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Protector_SwSh.png/64px-Protector_SwSh.png',
        value: 7500
    },
    {
        name: 'Electirizer',
        description: 'Một thiết bị điện từ, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Electirizer_SwSh.png/64px-Electirizer_SwSh.png',
        value: 7500
    },
    {
        name: 'Magmarizer',
        description: 'Một thiết bị từ tính, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Magmarizer_SwSh.png/64px-Magmarizer_SwSh.png',
        value: 7500
    },
    {
        name: 'Dubious Disc',
        description: 'Một đĩa dữ liệu đáng ngờ, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Dubious_Disc_SwSh.png/64px-Dubious_Disc_SwSh.png',
        value: 7500
    },
    {
        name: 'Up-Grade',
        description: 'Một thiết bị nâng cấp, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Up-Grade_SwSh.png/64px-Up_Grade_SwSh.png',
        value: 7500
    },
    {
        name: 'Dragon Scale',
        description: 'Một vảy rồng bí ẩn, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Dragon_Scale_SwSh.png/64px-Dragon_Scale_SwSh.png',
        value: 7500
    },
    {
        name: 'King\'s Rock',
        description: 'Một viên đá hoàng gia, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Kings_Rock_SwSh.png/64px-Kings_Rock_SwSh.png',
        value: 7500
    },
    {
        name: 'Deep Sea Tooth',
        description: 'Một chiếc răng sắc nhọn từ biển sâu, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Deep_Sea_Tooth_SwSh.png/64px-Deep_Sea_Tooth_SwSh.png',
        value: 7500
    },
    {
        name: 'Deep Sea Scale',
        description: 'Một chiếc vảy lấp lánh từ biển sâu, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Deep_Sea_Scale_SwSh.png/64px-Deep_Sea_Scale_SwSh.png',
        value: 7500
    },
    {
        name: 'Sachet',
        description: 'Một túi thơm bí ẩn, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Sachet_SwSh.png/64px-Sachet_SwSh.png',
        value: 7500
    },
    {
        name: 'Whipped Dream',
        description: 'Một món tráng miệng ngọt ngào, làm tiến hóa một số Pokémon khi trao đổi.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Whipped_Dream_SwSh.png/64px-Whipped_Dream_SwSh.png',
        value: 7500
    },
    {
        name: 'Cracked Pot',
        description: 'Một chiếc bình nứt, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Cracked_Pot_SwSh.png/64px-Cracked_Pot_SwSh.png',
        value: 7500
    },
    {
        name: 'Chipped Pot',
        description: 'Một chiếc bình sứt mẻ, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Chipped_Pot_SwSh.png/64px-Chipped_Pot_SwSh.png',
        value: 7500
    },
    {
        name: 'Sweet Apple',
        description: 'Một quả táo ngọt, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Sweet_Apple_SwSh.png/64px-Sweet_Apple_SwSh.png',
        value: 7500
    },
    {
        name: 'Tart Apple',
        description: 'Một quả táo chua, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Tart_Apple_SwSh.png/64px-Tart_Apple_SwSh.png',
        value: 7500
    },
    {
        name: 'Strawberry Sweet',
        description: 'Một viên kẹo dâu tây ngọt ngào, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Strawberry_Sweet_SwSh.png/64px-Strawberry_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Clover Sweet',
        description: 'Một viên kẹo cỏ ba lá, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Clover_Sweet_SwSh.png/64px-Clover_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Flower Sweet',
        description: 'Một viên kẹo hoa, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Flower_Sweet_SwSh.png/64px-Flower_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Love Sweet',
        description: 'Một viên kẹo tình yêu, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Love_Sweet_SwSh.png/64px-Love_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Berry Sweet',
        description: 'Một viên kẹo quả mọng, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Berry_Berry_Sweet_SwSh.png/64px-Berry_Berry_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Star Sweet',
        description: 'Một viên kẹo sao, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Star_Sweet_SwSh.png/64px-Star_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Ribbon Sweet',
        description: 'Một viên kẹo ruy băng, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Ribbon_Sweet_SwSh.png/64px-Ribbon_Sweet_SwSh.png',
        value: 7500
    },
    {
        name: 'Galarica Cuff',
        description: 'Một chiếc còng Galarica, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Galarica_Cuff_SwSh.png/64px-Galarica_Cuff_SwSh.png',
        value: 7500
    },
    {
        name: 'Galarica Wreath',
        description: 'Một vòng hoa Galarica, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Galarica_Wreath_SwSh.png/64px-Galarica_Wreath_SwSh.png',
        value: 7500
    },
    {
        name: 'Black Augurite',
        description: 'Một vật liệu đen tuyền, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Black_Augurite_LA.png/64px-Black_Augurite_LA.png',
        value: 7500
    },
    {
        name: 'Peat Block',
        description: 'Một khối than bùn, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Peat_Block_LA.png/64px-Peat_Block_LA.png',
        value: 7500
    },
    {
        name: 'Linking Cord',
        description: 'Một sợi dây liên kết, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Linking_Cord_LA.png/64px-Linking_Cord_LA.png',
        value: 7500
    },
    {
        name: 'Razor Claw',
        description: 'Một móng vuốt sắc nhọn, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Razor_Claw_SwSh.png/64px-Razor_Claw_SwSh.png',
        value: 7500
    },
    {
        name: 'Razor Fang',
        description: 'Một chiếc răng nanh sắc bén, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Razor_Fang_SwSh.png/64px-Razor_Fang_SwSh.png',
        value: 7500
    },
    {
        name: 'Sinnoh Stone',
        description: 'Một viên đá bí ẩn từ vùng Sinnoh, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Sinnoh_Stone_SwSh.png/64px-Sinnoh_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Unova Stone',
        description: 'Một viên đá bí ẩn từ vùng Unova, làm tiến hóa một số Pokémon.',
        type: 'evolution_stone',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Unova_Stone_SwSh.png/64px-Unova_Stone_SwSh.png',
        value: 8000
    },
    {
        name: 'Prism Scale',
        description: 'Một chiếc vảy lấp lánh, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Prism_Scale_SwSh.png/64px-Prism_Scale_SwSh.png',
        value: 7500
    },
    {
        name: 'Auspicious Armor',
        description: 'Một bộ giáp may mắn, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Auspicious_Armor_SV.png/64px-Auspicious_Armor_SV.png',
        value: 7500
    },
    {
        name: 'Malicious Armor',
        description: 'Một bộ giáp hiểm ác, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Malicious_Armor_SV.png/64px-Malicious_Armor_SV.png',
        value: 7500
    },
    {
        name: 'Leader\'s Crest',
        description: 'Một chiếc huy hiệu của thủ lĩnh, làm tiến hóa một số Pokémon.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Leaders_Crest_SV.png/64px-Leaders_Crest_SV.png',
        value: 7500
    },
    {
        name: 'Gimmighoul Coin',
        description: 'Một đồng xu vàng lấp lánh, làm tiến hóa Gimmighoul.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Gimmighoul_Coin_SV.png/64px-Gimmighoul_Coin_SV.png',
        value: 10
    },
    {
        name: 'Scroll of Darkness',
        description: 'Một cuộn giấy cổ xưa chứa sức mạnh bóng tối, làm tiến hóa Kubfu.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Scroll_of_Darkness_SwSh.png/64px-Scroll_of_Darkness_SwSh.png',
        value: 12000
    },
    {
        name: 'Scroll of Waters',
        description: 'Một cuộn giấy cổ xưa chứa sức mạnh của nước, làm tiến hóa Kubfu.',
        type: 'evolution_item_special',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Scroll_of_Waters_SwSh.png/64px-Scroll_of_Waters_SwSh.png',
        value: 12000
    },
    {
        name: 'Ability Patch',
        description: 'Một miếng vá đặc biệt có thể thay đổi Ability của Pokémon thành Hidden Ability.',
        type: 'misc',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Ability_Patch_SwSh.png/64px-Ability_Patch_SwSh.png',
        value: 50000
    },
    {
        name: 'Ability Capsule',
        description: 'Một viên nang có thể thay đổi Ability của Pokémon thành một trong những Ability thông thường của nó.',
        type: 'misc',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Ability_Capsule_SwSh.png/64px-Ability_Capsule_SwSh.png',
        value: 25000
    },
    {
        name: 'Bottle Cap',
        description: 'Một nắp chai lấp lánh, dùng để tăng chỉ số IV của Pokémon.',
        type: 'misc',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Bottle_Cap_SwSh.png/64px-Bottle_Cap_SwSh.png',
        value: 10000
    },
    {
        name: 'Gold Bottle Cap',
        description: 'Một nắp chai vàng lấp lánh, dùng để tối đa hóa tất cả chỉ số IV của Pokémon.',
        type: 'misc',
        sprite_url: 'https://archives.bulbagarden.net/media/upload/thumb/f/f6/Gold_Bottle_Cap_SwSh.png/64px-Gold_Bottle_Cap_SwSh.png',
        value: 50000
    },
];


async function importPokemonData() {
    console.log('Bắt đầu nhập dữ liệu từ PokeAPI vào PostgreSQL...');

    try {
        // --- Xóa dữ liệu cũ (Đảm bảo thứ tự để tránh lỗi khóa ngoại) ---
        // Giữ nguyên thứ tự xóa này để tránh lỗi khóa ngoại
        await pgKnex('pokemon_skills').del();
        console.log('Đã xóa dữ liệu cũ trong bảng pokemon_skills.');
        await pgKnex('skills').del();
        console.log('Đã xóa dữ liệu cũ trong bảng skills.');
        await pgKnex('pokemons').del();
        console.log('Đã xóa dữ liệu cũ trong bảng pokemons.');
        await pgKnex('items').del(); // Thêm dòng này để xóa items cũ trước khi nhập lại
        console.log('Đã xóa dữ liệu cũ trong bảng items.');
        console.log('Đã hoàn tất việc dọn dẹp dữ liệu cũ trong các bảng liên quan.');

        // --- NHẬP DỮ LIỆU ITEMS ---
        console.log('\n--- Bắt đầu nhập dữ liệu ITEMS ---');
        const itemDataToInsert = [];
        const existingItemNames = new Set(); // Dùng để theo dõi tên item đã thêm vào mảng

        // Thêm Mega Stones từ MEGA_STONE_MAP
        for (const pokemonName in MEGA_STONE_MAP) {
            const stoneName = MEGA_STONE_MAP[pokemonName];
            if (stoneName && !existingItemNames.has(stoneName)) {
                itemDataToInsert.push({
                    name: stoneName,
                    description: `Một viên đá đặc biệt dùng để tiến hóa Mega cho ${pokemonName.replace('-mega-x', '').replace('-mega-y', '').replace('-mega', '')}.`, // Mô tả tiếng Việt
                    type: 'mega_stone', // Loại mới cho Mega Stone
                    sprite_url: `https://archives.bulbagarden.net/media/upload/thumb/1/1d/${stoneName.replace(/\s/g, '_')}.png/64px-${stoneName.replace(/\s/g, '_')}.png`, // Cần URL sprite chính xác hơn
                    value: 30000 // Giá trị mặc định cho Mega Stone
                });
                existingItemNames.add(stoneName);
            }
        }

        // Thêm các vật phẩm tiến hóa tùy chỉnh khác
        for (const item of CUSTOM_EVOLUTION_ITEMS) {
            if (!existingItemNames.has(item.name)) { // Chỉ thêm nếu chưa tồn tại
                itemDataToInsert.push(item);
                existingItemNames.add(item.name);
            }
        }

        // Chèn tất cả các item đã thu thập
        if (itemDataToInsert.length > 0) {
            await pgKnex.batchInsert('items', itemDataToInsert, 100);
            console.log(`Đã nhập thành công ${itemDataToInsert.length} vật phẩm vào PostgreSQL.`);
        } else {
            console.log('Không có vật phẩm nào để nhập vào bảng items.');
        }

        // --- Lấy lại tất cả items từ DB để tạo itemNameIdMap (bao gồm cả những cái vừa thêm) ---
        const allItemsInDb = await pgKnex('items').select('item_id', 'name');
        const itemNameIdMap = new Map();
        for (const item of allItemsInDb) {
            itemNameIdMap.set(item.name.toLowerCase().replace(/\s/g, '-'), item.item_id); // Chuẩn hóa tên để khớp với PokeAPI và tên bạn dùng
            itemNameIdMap.set(item.name.toLowerCase(), item.item_id); // Dùng cho tên không có dấu gạch ngang
        }
        console.log('Đã tạo map ánh xạ tên vật phẩm sang ID.');


        // --- NHẬP DỮ LIỆU POKEMONS (Bao gồm tất cả forms) ---
        console.log('\n--- Bắt đầu nhập dữ liệu POKEMONS (bao gồm forms) ---');

        // Thay đổi: Lấy danh sách species, sau đó duyệt qua từng variety
        const speciesResponse = await axios.get('https://pokeapi.co/api/v2/pokemon-species?limit=1025'); // Lấy 1025 loài Pokémon
        const pokemonDataToInsert = [];
        const pokemonLevelUpMoves = new Map(); // Để lưu trữ skill và level của từng Pokemon (chỉ level-up moves)
        const processedPokemonPokedexIds = new Set(); // Theo dõi các pokedex_id đã xử lý để tránh trùng lặp

        let processedFormsCount = 0;
        const totalSpecies = speciesResponse.data.results.length;

        for (const speciesEntry of speciesResponse.data.results) {
            try {
                const speciesDetailResponse = await axios.get(speciesEntry.url);
                const speciesData = speciesDetailResponse.data;

                // Lặp qua tất cả các varieties (dạng) của loài Pokémon này
                for (const variety of speciesData.varieties) {
                    const pokemonDetailResponse = await axios.get(variety.pokemon.url);
                    const data = pokemonDetailResponse.data;

                    // Tạo pokedex_id duy nhất cho mỗi form. Sử dụng ID của form đó từ API + 99999
                    const pokedexId = data.id + 99999;

                    // Bỏ qua nếu pokedex_id này đã được xử lý (tránh trường hợp API trả về trùng lặp variety)
                    if (processedPokemonPokedexIds.has(pokedexId)) {
                        continue;
                    }
                    processedPokemonPokedexIds.add(pokedexId);

                    let form = null;
                    let megaStoneName = null;

                    // Logic xác định form và mega stone name dựa trên data.name của từng variety
                    if (data.name.includes('-mega')) {
                        form = 'Mega';
                        if (MEGA_STONE_MAP[data.name]) {
                            megaStoneName = MEGA_STONE_MAP[data.name];
                        }
                    } else if (data.name.includes('-alola')) {
                        form = 'Alolan';
                    } else if (data.name.includes('-galar')) {
                        form = 'Galarian';
                    } else if (data.name.includes('-gmax')) {
                        form = 'Gigantamax';
                    } else if (data.name.includes('-hisui')) {
                        form = 'Hisuian';
                    } else if (data.name.includes('-paldea')) { // Thêm dạng Paldean nếu có
                        form = 'Paldean';
                    }
                    // Thêm các dạng khác nếu cần (ví dụ: '-totem', '-cosplay', v.v. tùy theo nhu cầu)
                    // Đối với các dạng mặc định (không có đuôi đặc biệt), 'form' sẽ là null

                    const hp = data.stats.find(s => s.stat.name === 'hp')?.base_stat || 0;
                    const attack = data.stats.find(s => s.stat.name === 'attack')?.base_stat || 0;
                    const defense = data.stats.find(s => s.stat.name === 'defense')?.base_stat || 0;
                    const special_attack = data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0;
                    const special_defense = data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0;
                    const speed = data.stats.find(s => s.stat.name === 'speed')?.base_stat || 0;

                    const type1 = data.types[0] ? data.types[0].type.name : null;
                    const type2 = data.types[1] ? data.types[1].type.name : null;

                    pokemonDataToInsert.push({
                        pokedex_id: pokedexId,
                        name: data.name, // Lưu tên đầy đủ từ PokeAPI (ví dụ: 'charizard-mega-x', 'vulpix-alola')
                        form: form, // Lưu tên form ngắn gọn của bạn (ví dụ: 'Mega', 'Alolan')
                        species_pokedex_id: speciesData.id, // ID gốc của loài (không phải ID của form)
                        type1: type1,
                        type2: type2,
                        rarity: LEGENDARY_SPECIES_IDS.includes(speciesData.id) ? 'Legendary/Mythical' : 'Common', // Dùng speciesData.id để kiểm tra Legendary/Mythical
                        sprite_front_url: data.sprites.front_default,
                        sprite_back_url: data.sprites.back_default,
                        official_artwork_url: data.sprites.other['official-artwork']?.front_default || null,
                        hp: hp,
                        attack: attack,
                        defense: defense,
                        special_attack: special_attack,
                        special_defense: special_defense,
                        speed: speed,
                        evolution_chain_id: speciesData.evolution_chain ? parseInt(speciesData.evolution_chain.url.split('/').slice(-2, -1)[0]) : null,
                        mega_stone_name: megaStoneName,
                        capture_rate: speciesData.capture_rate,
                    });

                    // --- Thu thập thông tin skill và level cho từng Pokémon (CHỈ LEVEL-UP MOVES) ---
                    const currentPokemonLevelUpMoves = [];
                    for (const moveInfo of data.moves) {
                        const levelUpMethods = moveInfo.version_group_details.filter(
                            (v) => v.move_learn_method.name === 'level-up' // Đã loại bỏ bộ lọc `&& v.version_group.name === 'scarlet-violet'`
                        );

                        if (levelUpMethods.length > 0) {
                            const minLevel = Math.min(...levelUpMethods.map(m => m.level_learned_at));

                            if (!currentPokemonLevelUpMoves.some(m => m.skill_url === moveInfo.move.url && m.learn_level === minLevel)) {
                                currentPokemonLevelUpMoves.push({
                                    skill_url: moveInfo.move.url,
                                    learn_level: minLevel,
                                });
                            }
                        }
                    }
                    pokemonLevelUpMoves.set(pokedexId, currentPokemonLevelUpMoves);

                    processedFormsCount++;
                    if (processedFormsCount % 50 === 0) { // Cập nhật log thường xuyên hơn
                        console.log(`Đã xử lý ${processedFormsCount} dạng Pokémon...`);
                    }
                } // End of variety loop
            } catch (speciesError) {
                console.warn(`Cảnh báo: Không thể lấy dữ liệu cho loài từ URL: ${speciesEntry.url}. Lỗi: ${speciesError.message}`);
            }
        } // End of species entry loop

        console.log(`Hoàn tất thu thập ${pokemonDataToInsert.length} Pokémon và Forms.`);
        await pgKnex.batchInsert('pokemons', pokemonDataToInsert, 100);
        console.log(`Đã nhập thành công ${pokemonDataToInsert.length} Pokémon và Forms vào PostgreSQL.`);

        // --- NHẬP DỮ LIỆU SKILLS (LẤY TẤT CẢ SKILLS TỪ API) ---
        console.log('\n--- Bắt đầu nhập dữ liệu TẤT CẢ SKILLS ---');
        const allUniqueSkillUrls = new Set();
        // Thêm các skill từ pokemonLevelUpMoves
        for (const [pokedexId, moves] of pokemonLevelUpMoves.entries()) {
            for (const move of moves) {
                allUniqueSkillUrls.add(move.skill_url);
            }
        }
        // Thêm tất cả skill từ API để đảm bảo đầy đủ
        // PokeAPI có hơn 900 moves, nên limit cần lớn hơn
        const allMovesApiListResponse = await axios.get('https://pokeapi.co/api/v2/move?limit=10000');
        for (const moveEntry of allMovesApiListResponse.data.results) {
            allUniqueSkillUrls.add(moveEntry.url);
        }
        console.log(`Tổng cộng ${allUniqueSkillUrls.size} skill duy nhất sẽ được xử lý chi tiết.`);

        const skillDataToInsert = [];
        const skillUrlToIdMap = new Map();
        let processedSkillsCount = 0;
        const totalSkillsToProcess = allUniqueSkillUrls.size;

        for (const skillUrl of allUniqueSkillUrls) {
            try {
                const skillDetailResponse = await axios.get(skillUrl);
                const skillData = skillDetailResponse.data;

                const skillId = skillData.id;
                const skillName = skillData.name;
                const skillType = skillData.type ? skillData.type.name : 'Unknown';
                const skillCategory = skillData.damage_class ? skillData.damage_class.name : 'Status';
                const skillPower = skillData.power;
                const skillPP = skillData.pp;
                const skillAccuracy = skillData.accuracy;

                let skillDescription = null;
                let descriptionEntry = skillData.flavor_text_entries.find(entry => entry.language.name === 'vi');
                if (!descriptionEntry) {
                    descriptionEntry = skillData.flavor_text_entries.find(entry => entry.language.name === 'en');
                }
                if (descriptionEntry) {
                    skillDescription = descriptionEntry.flavor_text;
                }

                skillDataToInsert.push({
                    skill_id: skillId,
                    name: skillName,
                    type: skillType,
                    category: skillCategory,
                    power: skillPower,
                    pp: skillPP,
                    accuracy: skillAccuracy,
                    description: skillDescription,
                });
                skillUrlToIdMap.set(skillUrl, skillId);

                processedSkillsCount++;
                if (processedSkillsCount % 100 === 0 || processedSkillsCount === totalSkillsToProcess) {
                    console.log(`    Đã xử lý ${processedSkillsCount}/${totalSkillsToProcess} skill chi tiết...`);
                }
            } catch (skillError) {
                console.warn(`Cảnh báo: Không thể lấy dữ liệu chi tiết cho skill từ URL: ${skillUrl}. Lỗi: ${skillError.message}`);
            }
        }

        await pgKnex.batchInsert('skills', skillDataToInsert, 100);
        console.log(`Đã nhập thành công ${skillDataToInsert.length} Skills vào PostgreSQL.`);

        // --- NHẬP DỮ LIỆU POKEMON_SKILLS (CHỈ CÁC SKILL HỌC QUA LEVEL-UP) ---
        console.log('\n--- Bắt đầu nhập dữ liệu POKEMON_SKILLS ---');
        const pokemonSkillDataToInsert = [];

        for (const [pokedexId, moves] of pokemonLevelUpMoves.entries()) {
            for (const move of moves) {
                const skillId = skillUrlToIdMap.get(move.skill_url);

                if (skillId) {
                    pokemonSkillDataToInsert.push({
                        pokedex_id: pokedexId,
                        skill_id: skillId,
                        learn_level: move.learn_level,
                    });
                }
            }
        }

        await pgKnex.batchInsert('pokemon_skills', pokemonSkillDataToInsert, 100);
        console.log(`Đã nhập thành công ${pokemonSkillDataToInsert.length} Pokemon_Skills vào PostgreSQL.`);
        console.log('\n--- Quá trình nhập dữ liệu hoàn tất! ---');

    } catch (error) {
        console.error('Đã xảy ra lỗi nghiêm trọng trong quá trình nhập dữ liệu tổng thể:', error);
        console.error('Chi tiết lỗi (nếu có):', error.detail || error.message);
    } finally {
        if (pgKnex) {
            await pgKnex.destroy();
        }
    }
}

importPokemonData();