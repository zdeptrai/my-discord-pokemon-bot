// utils/battle/battleUtils.js
const { EmbedBuilder } = require('discord.js');

// Đối tượng ánh xạ loại kỹ năng sang emoji (Lấy từ viewskill để đồng bộ)
const SKILL_TYPE_EMOJIS = {
    'normal': '<:normal:1397489072523575296>',
    'fire': '<:fire:1397490374011785267>',
    'water': '<:water:1397490438067453973>',
    'grass': '<:grass:1397490494170202174>',
    'electric': '<:eletric:1397490466936852641>',
    'ice': '<:ice:1397492582145196052>',
    'fighting': '<:fighting:1397492643377975346>',
    'poison': '<:poison:1397492721446420481>',
    'ground': '<:ground:1397492793919668385>',
    'flying': '<:flying:1397492840266989568>',
    'psychic': '<:psychic:1397492880926314536>',
    'bug': '<:bug:1397492975109672960>',
    'rock': '<:rock:1397493958388744242>',
    'ghost': '<:ghost:1397493993977413685>',
    'dragon': '<:dragon:1397494015544266782>',
    'steel': '<:steel:1397494061341868063>',
    'dark': '<:dar:1397494039422435451>',
    'fairy': '<:fairy:1397494966087057502>',
    'unknown': '❓', 
};

/**
 * Tạo một thanh HP dạng biểu đồ.
 * @param {number} currentHp HP hiện tại.
 * @param {number} maxHp HP tối đa.
 * @param {number} length Độ dài của thanh (số ký tự).
 * @returns {string} Chuỗi biểu thị thanh HP.
 */
function generateHpBar(currentHp, maxHp, length = 10) {
    const percentage = currentHp / maxHp;
    const filledLength = Math.round(length * percentage);
    const emptyLength = length - filledLength;
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    return `[${filledBar}${emptyBar}] \`${currentHp}/${maxHp}\``;
}

/**
 * Hàm tính EXP cần thiết cho cấp độ tiếp theo.
 * @param {number} currentLevel Cấp độ hiện tại của Pokémon.
 * @returns {number} Lượng EXP cần để lên cấp độ tiếp theo.
 */
const calculateExpToNextLevel = (currentLevel) => {
    return currentLevel * 100;
};

/**
 * Tạo một Embed hiển thị chi tiết Pokémon của người dùng.
 * @param {Object} pokemon Dữ liệu Pokémon của người dùng (từ user_pokemons join với pokemons).
 * Bây giờ bao gồm cả 'skill_details' (mảng các đối tượng skill)
 * @param {number|null} currentSelectedId ID của Pokémon hiện đang được chọn bởi người dùng.
 * @returns {EmbedBuilder}
 */
function generatePokemonEmbed(pokemon, currentSelectedId) {
    const totalIV = pokemon.hp_iv + pokemon.attack_iv + pokemon.defense_iv +
                    pokemon.special_attack_iv + pokemon.special_defense_iv + pokemon.speed_iv;
    const maxTotalIV = 31 * 6;
    const ivPercentage = ((totalIV / maxTotalIV) * 100).toFixed(2);

    let types = pokemon.type1;
    if (pokemon.type2) {
        types += `/${pokemon.type2}`;
    }

    let embedTitle = `${pokemon.nickname || pokemon.pokemon_name} (Lv.${pokemon.level})`;
    if (pokemon.id === currentSelectedId) {
        embedTitle = `⭐ ${embedTitle} (Đang chọn)`;
    }

    const expNeededForNextLevel = calculateExpToNextLevel(pokemon.level);

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(embedTitle)
        .setDescription(
            `**Loài:** ${pokemon.pokemon_name}\n` +
            `**Kinh nghiệm:** ${pokemon.experience}/${expNeededForNextLevel} (để lên Lv.${pokemon.level + 1})\n` +
            `**HP:** ${pokemon.current_hp}/${pokemon.max_hp}\n` +
            `**Loại:** ${types} | **Độ hiếm:** ${pokemon.rarity || 'Chưa xác định'}\n`
        )
        .addFields(
            {
                name: 'Chỉ số (Stats)',
                value: `❤️ HP: **${pokemon.max_hp}**\n` +
                       `⚔️ ATK: **${pokemon.attack}**\n` +
                       `🛡️ DEF: **${pokemon.defense}**\n` +
                       `✨ SP.ATK: **${pokemon.special_attack}**\n` +
                       `💎 SP.DEF: **${pokemon.special_defense}**\n` +
                       `⚡ SPD: **${pokemon.speed}**`,
                inline: true
            },
            {
                name: 'IVs (Individual Values)',
                value: `❤️ HP: **${pokemon.hp_iv}/31**\n` +
                       `⚔️ ATK: **${pokemon.attack_iv}/31**\n` +
                       `🛡️ DEF: **${pokemon.defense_iv}/31**\n` +
                       `✨ SP.ATK: **${pokemon.special_attack_iv}/31**\n` +
                       `💎 SP.DEF: **${pokemon.special_defense_iv}/31**\n` +
                       `⚡ SPD: **${pokemon.speed_iv}/31**`,
                inline: true
            },
            {
                name: '\u200b', // Ký tự trống để thêm khoảng cách
                value: `\n**Tổng IV:** ${totalIV}/${maxTotalIV} (${ivPercentage}%)`,
                inline: false
            }
        )
        .setFooter({ text: `ID của Pokémon: ${pokemon.id}` })
        .setTimestamp()
        .setImage(pokemon.image_url || pokemon.full_image_url);

    // --- Thêm phần hiển thị kỹ năng đã học ---
    // Kiểm tra nếu pokemon.skill_details tồn tại và là một mảng
    if (pokemon.skill_details && Array.isArray(pokemon.skill_details) && pokemon.skill_details.length > 0) {
        const skillText = pokemon.skill_details.map(skill => {
            const emoji = SKILL_TYPE_EMOJIS[skill.type.toLowerCase()] || SKILL_TYPE_EMOJIS['unknown'];
            return `${emoji} **${skill.name}** (ID: ${skill.skill_id}) - Sức mạnh: ${skill.power || 'N/A'} | PP: ${skill.pp || 'N/A'}`;
        }).join('\n');
        embed.addFields({ name: 'Kỹ năng đã học', value: skillText, inline: false });
    } else {
        embed.addFields({ name: 'Kỹ năng đã học', value: 'Chưa học kỹ năng nào.', inline: false });
    }
    // --- Kết thúc phần hiển thị kỹ năng đã học ---

    return embed;
}

/**
 * Tạo một Embed hiển thị trạng thái trận chiến với hai Pokémon.
 * @param {Object} userPokemon - Dữ liệu Pokémon của người dùng (từ user_pokemons).
 * @param {Object} wildPokemon - Dữ liệu Pokémon hoang dã đã được xử lý (từ simulateBattle).
 * @param {string[]} battleLogLines - Mảng các dòng nhật ký trận đấu.
 * @param {boolean} isInitial - true nếu là Embed khởi tạo trận đấu, false nếu là cập nhật giữa chừng.
 * @returns {EmbedBuilder}
 */
function generateBattleEmbed(userPokemon, wildPokemon, battleLogLines, isInitial = false) {
    let description = '';

    const playerImageUrl = userPokemon.sprite_back_url || userPokemon.image_url;
    const wildThumbnailUrl = wildPokemon.official_artwork_url || wildPokemon.sprite_front_url;

    const wildPokemonDisplayName = wildPokemon.pokemon_name || wildPokemon.name;

    if (isInitial) {
        description =
            `**${userPokemon.nickname || userPokemon.pokemon_name}** (Lv.${userPokemon.level}) của bạn đã sẵn sàng chiến đấu!\n` +
            `Một **${wildPokemonDisplayName}** hoang dã (Lv.${wildPokemon.level}) xuất hiện!`;
    } else {
        const recentLogs = battleLogLines.slice(-3).join('\n'); // Lấy 3 dòng log gần nhất
        description = recentLogs;
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle(`⚔️ ${userPokemon.nickname || userPokemon.pokemon_name} vs. ${wildPokemonDisplayName}`)
        .addFields(
            {
                name: `Của bạn: ${userPokemon.nickname || userPokemon.pokemon_name} (Lv.${userPokemon.level})`,
                value: `❤️ HP: ${userPokemon.current_hp}/${userPokemon.max_hp}\n` +
                       `${generateHpBar(userPokemon.current_hp, userPokemon.max_hp, 15)}\n` + // Thanh HP của người chơi
                       `⚔️ ATK: ${userPokemon.attack} | 🛡️ DEF: ${userPokemon.defense}\n` +
                       `✨ SP.ATK: ${userPokemon.special_attack} | 💎 SP.DEF: ${userPokemon.special_defense}\n` +
                       `⚡ SPD: ${userPokemon.speed}`,
                inline: true
            },
            {
                name: `Đối thủ: ${wildPokemonDisplayName} (Lv.${wildPokemon.level})`,
                value: `❤️ HP: ${wildPokemon.current_hp}/${wildPokemon.max_hp}\n` +
                       `${generateHpBar(wildPokemon.current_hp, wildPokemon.max_hp, 15)}\n` + // Thanh HP của Pokémon hoang dã
                       `⚔️ ATK: ${wildPokemon.attack} | 🛡️ DEF: ${wildPokemon.defense}\n` +
                       `✨ SP.ATK: ${wildPokemon.special_attack} | 💎 SP.DEF: ${wildPokemon.special_defense}\n` +
                       `⚡ SPD: ${wildPokemon.speed}`,
                inline: true
            }
        )
        .setDescription(description) // Log trận đấu ở dưới cùng
        .setFooter({ text: 'Trận chiến đang diễn ra...' })
        .setTimestamp();

    if (wildThumbnailUrl) {
        embed.setThumbnail(wildThumbnailUrl);
    }
    if (playerImageUrl) {
        embed.setImage(playerImageUrl);
    }

    return embed;
}

module.exports = {
    generatePokemonEmbed,
    generateBattleEmbed
};