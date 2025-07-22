// utils/pvpUtils.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPokemonStats } = require('./core/pokemonUtils');
const { generateHpBar } = require('./core/displayUtils');

/**
 * Lấy danh sách Pokémon trong đội hình của người dùng dựa trên team_slot.
 * @param {string} userId Discord ID của người dùng.
 * @param {number} mode Chế độ PvP (1, 3, hoặc 5).
 * @param {object} db Knex database instance.
 * @returns {Promise<object[]>} Mảng các đối tượng Pokémon đã được tính toán chỉ số.
 */
async function getPokemonTeamForPvp(userId, mode, db) {
    const teamSize = mode;
    
    // Lấy Pokémon của người dùng đã được đặt vào team_slot
    const userPokemonsRaw = await db('user_pokemons')
        .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
        .where('user_discord_id', userId)
        .whereNotNull('team_slot') // Chỉ lấy Pokémon có team_slot
        .orderBy('team_slot', 'asc') // Sắp xếp theo team_slot
        .limit(teamSize) // Giới hạn số lượng Pokémon theo chế độ
        .select(
            'user_pokemons.id',
            'user_pokemons.pokedex_id',
            'user_pokemons.nickname',
            'user_pokemons.level',
            'user_pokemons.current_hp',
            'user_pokemons.max_hp', 
            'user_pokemons.hp_iv',
            'user_pokemons.attack_iv',
            'user_pokemons.defense_iv',
            'user_pokemons.special_attack_iv',
            'user_pokemons.special_defense_iv',
            'user_pokemons.speed_iv',
            'user_pokemons.learned_skill_ids',
            'pokemons.name as pokemon_base_name',
            'pokemons.hp as base_hp',
            'pokemons.attack as base_attack',
            'pokemons.defense as base_defense',
            'pokemons.special_attack as base_special_attack',
            'pokemons.special_defense as base_special_defense',
            'pokemons.speed as base_speed', // Đảm bảo lấy base_speed
            'pokemons.type1 as base_type1',
            'pokemons.type2 as base_type2',
            'pokemons.official_artwork_url as pokemon_image_url',
            'pokemons.sprite_front_url', 
            'pokemons.sprite_back_url'   
        );

    if (userPokemonsRaw.length < teamSize) {
        throw new Error(`Bạn cần có ít nhất ${teamSize} Pokémon trong đội hình (đã đặt slot 1-${teamSize}) để tham gia chế độ ${mode}v${mode}.`);
    }

    const team = [];
    for (const p of userPokemonsRaw) {
        const stats = getPokemonStats(
            {
                hp: p.base_hp,
                attack: p.base_attack,
                defense: p.base_defense,
                special_attack: p.base_special_attack,
                special_defense: p.base_special_defense,
                speed: p.base_speed // ĐÃ SỬA: Sử dụng p.base_speed
            },
            p.level,
            {
                hp_iv: p.hp_iv,
                attack_iv: p.attack_iv,
                defense_iv: p.defense_iv,
                special_attack_iv: p.special_attack_iv,
                special_defense_iv: p.special_defense_iv,
                speed_iv: p.speed_iv
            }
        );

        let learnedSkillsData = [];
        try {
            const skillIds = JSON.parse(p.learned_skill_ids || '[]');
            if (Array.isArray(skillIds) && skillIds.length > 0) {
                const skillsFromDb = await db('skills')
                    .whereIn('skill_id', skillIds)
                    .select('*');
                
                learnedSkillsData = skillIds
                    .map(id => skillsFromDb.find(s => s.skill_id === id))
                    .filter(skill => skill && typeof skill.skill_id === 'number' && skill.skill_id > 0) 
                    .slice(0, 4); 
            }
        } catch (parseError) {
            console.error(`Lỗi phân tích learned_skill_ids cho Pokémon ${p.id}:`, parseError);
        }
        
        if (learnedSkillsData.length === 0) {
            learnedSkillsData.push({
                skill_id: 0, 
                name: 'Tackle',
                type: 'Normal',
                category: 'Physical',
                power: 40,
                accuracy: 100
            });
        }

        team.push({
            id: p.id,
            pokedex_id: p.pokedex_id,
            name: p.nickname || p.pokemon_base_name,
            level: p.level,
            current_hp: p.current_hp,
            max_hp: p.max_hp, 
            ...stats, 
            type1: p.base_type1,
            type2: p.base_type2,
            image_url: p.pokemon_image_url, 
            sprite_front_url: p.sprite_front_url, 
            sprite_back_url: p.sprite_back_url,   
            skills: learnedSkillsData,
            team_slot: p.team_slot
        });
    }

    team.sort((a, b) => a.team_slot - b.team_slot);

    return team;
}

/**
 * Khởi tạo trạng thái trận đấu PvP.
 * @param {string} challengerId Discord ID của người thách đấu.
 * @param {object[]} challengerTeam Mảng Pokémon của người thách đấu.
 * @param {string} opponentId Discord ID của đối thủ.
 * @param {object[]} opponentTeam Mảng Pokémon của đối thủ.
 * @param {number} mode Chế độ PvP (1, 3, hoặc 5).
 * @param {string} channelId ID kênh diễn ra trận đấu.
 * @returns {object} Trạng thái trận đấu PvP.
 */
function initializePvpBattleState(challengerId, challengerTeam, opponentId, opponentTeam, mode, channelId) {
    const battleState = {
        players: {
            [challengerId]: {
                id: challengerId,
                team: challengerTeam,
                activePokemonIndex: 0, 
                currentSkillIndex: 0, 
                ephemeralMessageId: null, 
            },
            [opponentId]: {
                id: opponentId,
                team: opponentTeam,
                activePokemonIndex: 0,
                currentSkillIndex: 0,
                ephemeralMessageId: null, 
            }
        },
        turn: 0,
        activePlayerId: null, 
        battleMessageId: null, 
        channelId: channelId,
        lastBattleAction: '', 
        mode: mode,
        lastInteractionTime: Date.now(), 
    };

    battleState.players[challengerId].team.forEach(p => p.current_hp = p.max_hp);
    battleState.players[opponentId].team.forEach(p => p.current_hp = p.max_hp);

    return battleState;
}

/**
 * Tạo Embed cho trạng thái trận đấu PvP.
 * @param {object} battleState Trạng thái hiện tại của trận đấu.
 * @param {object} client Discord client để lấy username.
 * @returns {EmbedBuilder} Embed hiển thị trạng thái trận đấu.
 */
async function generatePvpBattleEmbed(battleState, client) {
    const player1Id = Object.keys(battleState.players)[0];
    const player2Id = Object.keys(battleState.players)[1];

    const player1 = battleState.players[player1Id];
    const player2 = battleState.players[player2Id];

    const activePokemon1 = player1.team[player1.activePokemonIndex];
    const activePokemon2 = player2.team[player2.activePokemonIndex];

    const player1User = await client.users.fetch(player1Id);
    const player2User = await client.users.fetch(player2Id);

    const embed = new EmbedBuilder()
        .setColor('#FF69B4') // Màu hồng cho PvP
        .setTitle(`⚔️ Trận Chiến PvP: ${player1User.username} vs ${player2User.username} ⚔️`)
        .setDescription(`Chế độ: ${battleState.mode}v${battleState.mode}`);
    
    // Hiển thị sprite của cả hai Pokémon bằng cách sử dụng thumbnail và một trường văn bản
    if (activePokemon1 && activePokemon1.sprite_front_url) {
        embed.setThumbnail(activePokemon1.sprite_front_url);
    } else {
        embed.setThumbnail('https://placehold.co/64x64/000000/FFFFFF?text=P1');
    }

    // Thêm thông tin Pokémon của người chơi 1
    if (activePokemon1) {
        embed.addFields(
            { 
                name: `[${player1User.username}] ${activePokemon1.name} (Lv ${activePokemon1.level})`, 
                value: `${activePokemon1.type1}${activePokemon1.type2 ? `/${activePokemon1.type2}` : ''}\n` +
                       `${generateHpBar(activePokemon1.current_hp, activePokemon1.max_hp)}\n` +
                       `⚔️ ATK: ${activePokemon1.attack} | 🛡️ DEF: ${activePokemon1.defense}\n` + 
                       `✨ SP.ATK: ${activePokemon1.special_attack} | 💎 SP.DEF: ${activePokemon1.special_defense}\n` + 
                       `💨 SPD: ${activePokemon1.speed}`,
                inline: false 
            }
        );
    } else {
        embed.addFields(
            { 
                name: `[${player1User.username}] (Hết Pokémon)`, 
                value: `\u200B`, 
                inline: false 
            }
        );
    }

    // Thêm thông tin Pokémon của người chơi 2
    if (activePokemon2) {
        embed.addFields(
            { 
                name: `[${player2User.username}] ${activePokemon2.name} (Lv ${activePokemon2.level})`, 
                value: `${activePokemon2.type1}${activePokemon2.type2 ? `/${activePokemon2.type2}` : ''}\n` +
                       `${generateHpBar(activePokemon2.current_hp, activePokemon2.max_hp)}\n` +
                       `⚔️ ATK: ${activePokemon2.attack} | 🛡️ DEF: ${activePokemon2.defense}\n` + 
                       `✨ SP.ATK: ${activePokemon2.special_attack} | 💎 SP.DEF: ${activePokemon2.special_defense}\n` + 
                       `💨 Tốc độ: ${activePokemon2.speed}\n` +
                       (activePokemon2.sprite_back_url ? `[Sprite](${activePokemon2.sprite_back_url})` : ''), 
                inline: false 
            }
        );
    } else {
        embed.addFields(
            { 
                name: `[${player2User.username}] (Hết Pokémon)`, 
                value: `\u200B`,
                inline: false 
            }
        );
    }

    embed.addFields({ name: '\u200B', value: '\u200B', inline: false });
    
    // Chỉ hiển thị lastBattleAction
    if (battleState.lastBattleAction) {
        embed.addFields({ name: 'Diễn biến trận đấu', value: `\`\`\`diff\n${battleState.lastBattleAction}\n\`\`\``, inline: false });
    }

    embed.setFooter({ text: `Lượt: ${battleState.turn}` })
         .setTimestamp();
    
    return embed;
}

/**
 * Tạo các nút kỹ năng cho Pokémon đang hoạt động.
 * @param {object} activePokemon Pokémon đang hoạt động.
 * @param {string} playerId ID của người chơi.
 * @returns {ActionRowBuilder[]} Mảng các ActionRow chứa các nút.
 */
function generateSkillButtons(activePokemon, playerId) {
    const rows = [];
    if (activePokemon && activePokemon.skills && activePokemon.skills.length > 0) {
        for (let i = 0; i < activePokemon.skills.length; i += 2) { 
            const row = new ActionRowBuilder();
            const skill = activePokemon.skills[i]; 
            const nextSkill = activePokemon.skills[i+1]; 

            if (skill && typeof skill.skill_id === 'number' && skill.skill_id > 0) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pvp_skill_${playerId}_${skill.skill_id}`)
                        .setLabel(skill.name)
                        .setStyle(ButtonStyle.Primary)
                );
            } else {
                console.warn(`[WARNING] Kỹ năng không hợp lệ hoặc thiếu skill_id cho Pokémon ${activePokemon.name} (slot ${activePokemon.team_slot}):`, skill);
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pvp_skill_invalid_${playerId}_${i}`)
                        .setLabel(`Kỹ năng lỗi (${skill ? skill.name : 'N/A'})`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }

            if (nextSkill && typeof nextSkill.skill_id === 'number' && nextSkill.skill_id > 0) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pvp_skill_${playerId}_${nextSkill.skill_id}`)
                        .setLabel(nextSkill.name)
                        .setStyle(ButtonStyle.Primary)
                );
            } else if (nextSkill) { 
                 console.warn(`[WARNING] Kỹ năng không hợp lệ hoặc thiếu skill_id cho Pokémon ${activePokemon.name} (slot ${activePokemon.team_slot}):`, nextSkill);
                 row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pvp_skill_invalid_${playerId}_${i+1}`)
                        .setLabel(`Kỹ năng lỗi (${nextSkill ? nextSkill.name : 'N/A'})`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }
            rows.push(row);
        }
    } else {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`no_skill_available_${playerId}`)
                .setLabel('Không có kỹ năng')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        ));
    }

    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pvp_forfeit_${playerId}`)
            .setLabel('Đầu hàng')
            .setStyle(ButtonStyle.Danger)
    ));
    return rows;
}


module.exports = {
    getPokemonTeamForPvp,
    initializePvpBattleState,
    generatePvpBattleEmbed,
    generateSkillButtons,
};
