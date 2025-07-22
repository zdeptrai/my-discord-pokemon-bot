const { db } = require('../db');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const battleUtils = require('./battleUtils'); // Đảm bảo đã import
const battleEmbeds = require('./battleEmbeds');
const { v4: uuidv4 } = require('uuid');

const activeBattles = new Map();
const pendingChallenges = new Map();

const CHALLENGE_TIMEOUT_SECONDS = 60; // Thời gian chờ thách đấu

// Hàm lấy map pendingChallenges để có thể truy cập từ bên ngoài nếu cần
function getPendingChallengesMap() {
    return pendingChallenges;
}

// Hàm thêm lời thách đấu mới
function addPendingChallenge(challenge) {
    challenge.expiresAt = Date.now() + (CHALLENGE_TIMEOUT_SECONDS * 1000);
    pendingChallenges.set(challenge.id, challenge);
    console.log(`[BattleManager] Thêm lời thách đấu: ${challenge.id}, hết hạn lúc: ${new Date(challenge.expiresAt).toLocaleString('vi-VN')}`);
}

// Hàm lấy lời thách đấu
function getPendingChallenge(challengeId) {
    return pendingChallenges.get(challengeId);
}

// Hàm xóa lời thách đấu
function clearPendingChallenge(challengeId) {
    pendingChallenges.delete(challengeId);
    console.log(`[BattleManager] Xóa lời thách đấu: ${challengeId}`);
}

// Hàm dọn dẹp các lời thách đấu đã hết hạn
async function startChallengeCleanup(client) {
    setInterval(async () => {
        const now = Date.now();
        for (const [challengeId, challenge] of pendingChallenges) {
            if (challenge.expiresAt <= now) {
                console.log(`[BattleManager] Lời thách đấu ${challengeId} đã hết hạn.`);
                clearPendingChallenge(challengeId);
                try {
                    const channel = await client.channels.fetch(challenge.channelId);
                    if (channel) {
                        const message = await channel.messages.fetch(challenge.messageId);
                        if (message) {
                            await message.edit({
                                content: `Lời thách đấu của **${challenge.challenger.user.username}** gửi đến **${challenge.target.user.username}** đã hết hạn.`,
                                embeds: [],
                                components: []
                            });
                        }
                    }
                } catch (error) {
                    console.error(`[BattleManager] Không thể cập nhật tin nhắn thách đấu hết hạn ${challenge.messageId}:`, error);
                }
            }
        }
    }, 10 * 1000); // Kiểm tra mỗi 10 giây
}

// --- HÀM MỚI: Lấy team Pokémon của người dùng dựa trên team_slot ---
async function getUserTeamPokemons(userId, requiredCount) {
    try {
        const teamPokemons = await db('user_pokemons')
            .select(
                    'user_pokemons.*',
                    'pokemons.name as pokemon_name',
                    'pokemons.base_hp as base_hp',
                    'pokemons.base_attack as base_attack', // Sửa đây
                    'pokemons.base_defense as base_defense', // Sửa đây
                    'pokemons.base_speed as base_speed', // Sửa đây
                    'pokemons.base_special_attack as base_special_attack', // Sửa đây
                    'pokemons.base_special_defense as base_special_defense', // Sửa đây
                    'pokemons.type1 as type1',
                    'pokemons.type2 as type2'
)
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where({ user_discord_id: userId })
            .where('team_slot', '>', 0)
            .orderBy('team_slot', 'asc')
            .limit(requiredCount);

        const pokemonsWithSkills = await Promise.all(teamPokemons.map(async p => {
            // Đảm bảo rằng các cột IV/EV/level tồn tại, nếu không thì mặc định là 0 hoặc 1
            const ivHp = p.iv_hp || 0;
            const evHp = p.ev_hp || 0;
            const level = p.level || 1; 

            // Tính toán HP tối đa dựa trên base_hp, IV, EV, Level
            const calculatedMaxHp = battleUtils.calculateMaxHp(p.base_hp, ivHp, evHp, level);
            
            p.hp = calculatedMaxHp; // Đặt cột .hp của đối tượng Pokémon là HP tối đa
            // Nếu current_hp từ DB là null/undefined/0, đặt nó bằng HP tối đa
            // Ngược lại, giữ nguyên giá trị từ DB (ví dụ: sau khi lưu trạng thái)
            p.current_hp = calculatedMaxHp; // <-- THAY ĐỔI DÒNG NÀY
            p.max_hp = calculatedMaxHp; // Rất khuyến khích thêm dòng này để dễ truy cập max_hp trong BattleState

            // Logic lấy learned_skills từ pokemon_skills
            const skills = await db('pokemon_skills')
                .select('skill_id')
                .where({ pokedex_id: p.pokedex_id })
                .orderBy('level_learned', 'asc')
                .limit(4); // Giới hạn 4 skill như game gốc
            p.learned_skills = skills.map(s => s.skill_id);

            if (p.learned_skills.length === 0) {
                const basicAttackSkill = await db('skill').where({ name: 'Tấn công cơ bản' }).first();
                if (basicAttackSkill) {
                    p.learned_skills.push(basicAttackSkill.id);
                } else {
                    console.warn("[BattleManager] Skill 'Tấn công cơ bản' không tìm thấy trong DB. Pokémon có thể không có skill nào.");
                }
            }

            // Đảm bảo pokemon_name được gán chính xác (ưu tiên nickname, rồi đến pokemon_name từ join)
            // Nếu nickname là null, sẽ dùng pokemon_name
            // Nếu p.name tồn tại (từ nickname), nó sẽ được giữ nguyên
            if (!p.nickname && p.pokemon_name) {
                p.nickname = p.pokemon_name; // Dùng pokemon_name làm nickname nếu nickname trống
            }

            return p;
        }));
        
        return pokemonsWithSkills;
    } catch (error) {
        console.error(`[BattleManager] Lỗi khi lấy team Pokémon cho người dùng ${userId}:`, error);
        return [];
    }
}

class BattleState {
    constructor(player1, player2, message, format) {
        this.player1 = player1;
        this.player2 = player2;
        this.format = format;
        this.currentTurn = player1.id;
        this.stateMessage = message;
        this.turnCounter = 0;
        this.gameOver = false;
        this.winner = null;
        this.log = [];

        // Mỗi Pokémon khi vào trận sẽ có HP đầy đủ
        // current_hp đã được xử lý trong getUserTeamPokemons
        this.team = {
            [player1.id]: player1.selectedPokemon.map(p => ({
                data: p, // p đã chứa hp và current_hp chính xác
                current_hp: p.current_hp, // Đảm bảo current_hp ở cấp wrapper cũng đầy
                current_skill_index: 0
            })),
            [player2.id]: player2.selectedPokemon.map(p => ({
                data: p, // p đã chứa hp và current_hp chính xác
                current_hp: p.current_hp, // Đảm bảo current_hp ở cấp wrapper cũng đầy
                current_skill_index: 0
            }))
        };

        // Active Pokemon sẽ là Pokémon đầu tiên trong đội hình
        this.activePokemon = {
            [player1.id]: this.team[player1.id][0],
            [player2.id]: this.team[player2.id][0]
        };

        // Bổ sung kiểm tra an toàn sau khi khởi tạo activePokemon
        if (!this.activePokemon[player1.id] || !this.activePokemon[player2.id]) {
            console.error("[BattleManager ERROR] Không tìm thấy active Pokémon khả dụng để bắt đầu trận đấu cho một hoặc cả hai người chơi. Trận đấu bị hủy.");
            this.gameOver = true;
            this.addLog("Lỗi: Không thể tìm thấy Pokémon khả dụng để bắt đầu trận đấu. Trận đấu bị hủy.");
            return;
        }

        console.log(`[BattleManager] Trận đấu ${format} mới giữa ${player1.user.username} và ${player2.user.username} đã bắt đầu.`);
        this.addLog(`**Trận đấu bắt đầu!** ${player1.user.username} đấu với ${player2.user.username} (**${format}**).`);
        this.addLog(`${player1.user.username} đưa ra **${this.activePokemon[player1.id].data.nickname || this.activePokemon[player1.id].data.pokemon_name}**.`);
        this.addLog(`${player2.user.username} đưa ra **${this.activePokemon[player2.id].data.nickname || this.activePokemon[player2.id].data.pokemon_name}**.`);
    }

    addLog(message) {
        this.log.push(message);
        // Giữ log không quá dài, ví dụ 10 dòng cuối
        if (this.log.length > 10) {
            this.log.shift();
        }
    }

    nextTurn() {
        this.turnCounter++;
        this.currentTurn = (this.currentTurn === this.player1.id) ? this.player2.id : this.player1.id;
    }

    updatePokemonHP(userId, newHp) {
        const updatedHp = Math.max(0, newHp);
        this.activePokemon[userId].current_hp = updatedHp;
        // Cập nhật HP trong data của Pokemon và trong team cũng vậy, để đảm bảo tính nhất quán
        this.activePokemon[userId].data.current_hp = updatedHp;

        const pokemonInTeam = this.team[userId].find(p => p.data.id === this.activePokemon[userId].data.id);
        if (pokemonInTeam) {
            pokemonInTeam.current_hp = updatedHp;
            pokemonInTeam.data.current_hp = updatedHp;
        }
    }

    isPokemonFainted(userId) {
        console.log(`[DEBUG_BATTLE_STATE] Kiểm tra ngất xỉu cho ${userId}'s active Pokemon (${this.activePokemon[userId].data.nickname || this.activePokemon[userId].data.pokemon_name}). HP: ${this.activePokemon[userId].current_hp}`);
        return this.activePokemon[userId].current_hp <= 0;
    }

    isTeamFainted(userId) {
        const allFainted = this.team[userId].every(p => p.current_hp <= 0);
        const faintedCount = this.team[userId].filter(p => p.current_hp <= 0).length;
        const totalPokemon = this.team[userId].length;
        console.log(`[DEBUG_BATTLE_STATE] Kiểm tra team ngất xỉu cho ${userId}. Fainted: ${faintedCount}/${totalPokemon}. Tất cả ngất xỉu? ${allFainted}`);
        return allFainted;
    }

    endBattle(winnerId) {
        this.gameOver = true;
        this.winner = winnerId;
        console.log(`[BattleManager] Trận đấu kết thúc. Người thắng: ${this.winner ? (this.winner === this.player1.id ? this.player1.user.username : this.player2.user.username) : 'Không xác định'}.`);
        const battleId = [this.player1.id, this.player2.id].sort().join('-');
        activeBattles.delete(battleId);
    }

    getNextAvailablePokemon(userId) {
        // Tìm Pokémon tiếp theo trong team còn HP > 0 và không phải là Pokémon hiện tại
        const nextPokemon = this.team[userId].find(p => p.current_hp > 0 && p.data.id !== this.activePokemon[userId].data.id);
        console.log(`[DEBUG_BATTLE_STATE] getNextAvailablePokemon cho ${userId}: Đã tìm thấy ${nextPokemon ? (nextPokemon.data.nickname || nextPokemon.data.pokemon_name) : 'Không có'}.`);
        return nextPokemon;
    }

    switchActivePokemon(userId, pokemonIdToSwitchTo) {
        const playerTeam = this.team[userId];
        const newActivePokemonWrapper = playerTeam.find(p => p.data.id === pokemonIdToSwitchTo && p.current_hp > 0);

        if (newActivePokemonWrapper) {
            this.activePokemon[userId] = newActivePokemonWrapper; // Cập nhật activePokemon trỏ đến đối tượng bọc mới

            this.addLog(`**${(userId === this.player1.id ? this.player1.user.username : this.player2.user.username)}** đã đổi sang **${newActivePokemonWrapper.data.nickname || newActivePokemonWrapper.data.pokemon_name}**!`);
            console.log(`[DEBUG_BATTLE_STATE] ${userId} đã đổi sang ${newActivePokemonWrapper.data.nickname || newActivePokemonWrapper.data.pokemon_name}.`);
            return true;
        }
        return false;
    }

    async savePokemonHpToDatabase() {
        console.log('[BattleManager] Bắt đầu lưu trạng thái HP cuối cùng của Pokémon vào database.');
        for (const userId of [this.player1.id, this.player2.id]) {
            for (const pokemonWrapper of this.team[userId]) {
                try {
                    // Chỉ cập nhật nếu current_hp là một số hợp lệ
                    if (typeof pokemonWrapper.current_hp === 'number' && !isNaN(pokemonWrapper.current_hp)) {
                        console.log(`[BattleManager] Cố gắng cập nhật: Pokémon ID=${pokemonWrapper.data.id}, User ID=${userId}, HP mới=${pokemonWrapper.current_hp}`);
                        const updatedRows = await db('user_pokemons')
                            .where({ id: pokemonWrapper.data.id, user_discord_id: userId })
                            .update({ current_hp: pokemonWrapper.current_hp });

                        if (updatedRows === 0) {
                            console.warn(`[BattleManager] Cảnh báo: Không có hàng nào được cập nhật cho Pokémon ID ${pokemonWrapper.data.id} (User: ${userId}). ` +
                                         `Kiểm tra lại 'id' trong bảng user_pokemons và 'user_discord_id'.`);
                        } else {
                            console.log(`[BattleManager] Đã cập nhật thành công ${updatedRows} hàng cho Pokémon ID ${pokemonWrapper.data.id}.`);
                        }
                    } else {
                        console.warn(`[BattleManager] Cảnh báo: Không thể lưu HP cho Pokémon ID ${pokemonWrapper.data.id} (User: ${userId}) vì HP mới không hợp lệ: ${pokemonWrapper.current_hp}.`);
                    }
                } catch (error) {
                    console.error(`[BattleManager] LỖI khi cập nhật HP cho Pokémon ID ${pokemonWrapper.data.id} (User: ${userId}):`, error);
                }
            }
        }
        console.log('[BattleManager] Đã hoàn thành cố gắng lưu trạng thái HP.');
    }
}

async function startBattle(player1Data, player2Data, channel, format) {
    const battleId = [player1Data.id, player2Data.id].sort().join('-');

    if (activeBattles.has(battleId)) {
        throw new Error('Trận đấu giữa hai người chơi này đã diễn ra rồi!');
    }

    const initialBattleState = new BattleState(player1Data, player2Data, null, format);

    if (initialBattleState.gameOver) { // Kiểm tra nếu BattleState báo lỗi ngay từ đầu
        console.error('[BattleManager] Trận đấu không thể bắt đầu do lỗi khởi tạo BattleState.');
        return null;
    }

    const initialEmbed = await battleEmbeds.createBattleOverviewEmbed(initialBattleState);

    const battleMessage = await channel.send({
        embeds: [initialEmbed]
    });

    initialBattleState.stateMessage = battleMessage;
    activeBattles.set(battleId, initialBattleState);

    runBattleLoop(initialBattleState).catch(error => {
        console.error('[BattleManager] Lỗi trong runBattleLoop:', error);
        channel.send(`Đã xảy ra lỗi nghiêm trọng trong trận đấu giữa ${player1Data.user.username} và ${player2Data.user.username}. Trận đấu bị hủy.`);
        initialBattleState.endBattle(null);
        initialBattleState.savePokemonHpToDatabase();
    });

    return initialBattleState;
}

async function runBattleLoop(battleState) {
    console.log("[DEBUG_RUN_LOOP] Bắt đầu vòng lặp trận đấu.");
    const channel = battleState.stateMessage.channel;

    while (!battleState.gameOver) {
        battleState.nextTurn();
        console.log(`[DEBUG_RUN_LOOP] Bắt đầu Lượt ${battleState.turnCounter}. Người chơi hiện tại: ${battleState.currentTurn}`);

        const currentPlayerId = battleState.currentTurn;
        const opponentPlayerId = (currentPlayerId === battleState.player1.id) ? battleState.player2.id : battleState.player1.id;

        const currentPlayer = (currentPlayerId === battleState.player1.id) ? battleState.player1 : battleState.player2;
        // Sửa lỗi ReferenceError tại đây
        const opponentPlayer = (currentPlayer === battleState.player1) ? battleState.player2 : battleState.player1; 

        // --- Xử lý Pokémon ngất xỉu của người chơi hiện tại (từ lượt trước hoặc khởi đầu lượt) ---
        if (battleState.isPokemonFainted(currentPlayerId)) {
            console.log(`[DEBUG_RUN_LOOP] Pokémon của ${currentPlayer.user.username} (${battleState.activePokemon[currentPlayerId].data.nickname || battleState.activePokemon[currentPlayerId].data.pokemon_name}) đã ngất xỉu.`);
            battleState.addLog(`**${battleState.activePokemon[currentPlayerId].data.nickname || battleState.activePokemon[currentPlayerId].data.pokemon_name}** của ${currentPlayer.user.username} đã ngất xỉu!`);

            const nextPokemon = battleState.getNextAvailablePokemon(currentPlayerId);
            if (nextPokemon) {
                battleState.switchActivePokemon(currentPlayerId, nextPokemon.data.id); // Truyền data.id
                const updatedEmbedAfterSwitch = await battleEmbeds.createBattleOverviewEmbed(battleState);
                await battleState.stateMessage.edit({ embeds: [updatedEmbedAfterSwitch] });
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log(`[DEBUG_RUN_LOOP] ${currentPlayer.user.username} không còn Pokémon nào sau khi Pokémon hiện tại ngất xỉu. Kết thúc trận đấu.`);
                battleState.addLog(`**${currentPlayer.user.username}** đã hết Pokémon và không thể chiến đấu nữa!`);
                battleState.endBattle(opponentPlayerId);
                break;
            }
        }

        if (battleState.gameOver) {
            console.log("[DEBUG_RUN_LOOP] Trận đấu kết thúc sau khi xử lý Pokémon ngất xỉu của người chơi hiện tại.");
            break;
        }

        let currentPokemon = battleState.activePokemon[currentPlayerId].data;
        let opponentPokemon = battleState.activePokemon[opponentPlayerId].data;
        let currentSkillIndex = battleState.activePokemon[currentPlayerId].current_skill_index;

        // --- Logic chọn skill theo thứ tự và lặp lại ---
        const availableSkillIds = currentPokemon.learned_skills;
        let selectedSkillId;
        let selectedSkill = null;

        if (!availableSkillIds || availableSkillIds.length === 0) {
            console.warn(`[DEBUG_RUN_LOOP] Pokemon ${currentPokemon.nickname || currentPokemon.pokemon_name} không có skill nào. Tìm skill mặc định.`);
            selectedSkill = await db('skill').where({ name: 'Tấn công cơ bản' }).first();
            if (!selectedSkill) {
                battleState.addLog(`**${currentPokemon.nickname || currentPokemon.pokemon_name}** không có skill và không tìm thấy skill mặc định!`);
                battleState.endBattle(opponentPlayerId);
                console.log(`[DEBUG_RUN_LOOP] ${currentPlayer.user.username}'s Pokémon không có skill và không có skill mặc định. Kết thúc trận đấu.`);
                break;
            }
        } else {
            let attempts = 0;
            const maxAttempts = availableSkillIds.length * 2; // Giới hạn số lần thử để tránh vòng lặp vô hạn
            while (true && attempts < maxAttempts) {
                if (currentSkillIndex >= availableSkillIds.length) {
                    currentSkillIndex = 0;
                }
                selectedSkillId = availableSkillIds[currentSkillIndex];

                if (selectedSkillId) {
                    selectedSkill = await db('skill').where({ id: selectedSkillId }).first();
                    if (selectedSkill) {
                        break; // Đã tìm thấy skill hợp lệ
                    } else {
                        console.warn(`[DEBUG_RUN_LOOP] Skill ID ${selectedSkillId} (index ${currentSkillIndex}) không tìm thấy trong DB. Bỏ qua.`);
                        battleState.addLog(`**${currentPokemon.nickname || currentPokemon.pokemon_name}** cố gắng dùng skill không hợp lệ (ID: ${selectedSkillId}).`);
                        currentSkillIndex++;
                    }
                } else {
                    console.warn(`[DEBUG_RUN_LOOP] Skill ở index ${currentSkillIndex} là null/undefined. Bỏ qua.`);
                    currentSkillIndex++;
                }
                attempts++;

                if (attempts >= maxAttempts) {
                    console.warn(`[DEBUG_RUN_LOOP] Đã đạt giới hạn số lần thử skill cho Pokemon ${currentPokemon.id}. Tìm skill mặc định.`);
                    selectedSkill = await db('skill').where({ name: 'Tấn công cơ bản' }).first();
                    if (!selectedSkill) {
                        battleState.addLog(`**${currentPokemon.nickname || currentPokemon.pokemon_name}** không có skill hợp lệ và không tìm thấy skill mặc định!`);
                        battleState.endBattle(opponentPlayerId);
                        console.log(`[DEBUG_RUN_LOOP] ${currentPlayer.user.username}'s Pokémon không có skill hợp lệ và không có skill mặc định. Kết thúc trận đấu.`);
                    }
                    break;
                }
            }
        }

        // Cập nhật index skill cho lượt tiếp theo
        battleState.activePokemon[currentPlayerId].current_skill_index = (currentSkillIndex + 1) % (availableSkillIds && availableSkillIds.length > 0 ? availableSkillIds.length : 1);
        if (!availableSkillIds || availableSkillIds.length === 0) {
            battleState.activePokemon[currentPlayerId].current_skill_index = 0;
        }

        if (!selectedSkill) {
            battleState.addLog(`**${currentPokemon.nickname || currentPokemon.pokemon_name}** không thể thực hiện đòn tấn công!`);
            battleState.endBattle(opponentPlayerId);
            console.log(`[DEBUG_RUN_LOOP] Lỗi nghiêm trọng: Selected Skill vẫn null. Kết thúc trận đấu.`);
            break;
        }

        // --- Người chơi hiện tại tấn công ---
        const damageResult = await battleUtils.calculateDamage(currentPokemon, opponentPokemon, selectedSkill);
        battleState.updatePokemonHP(opponentPlayerId, battleState.activePokemon[opponentPlayerId].current_hp - damageResult.damage);

        const skillDisplayName = selectedSkill.emoji ? `${selectedSkill.emoji} ${selectedSkill.name}` : selectedSkill.name;
        battleState.addLog(`**${currentPokemon.nickname || currentPokemon.pokemon_name || 'Pokémon'}** đã dùng **${skillDisplayName}** và gây **${damageResult.damage}** sát thương lên **${opponentPokemon.nickname || opponentPokemon.pokemon_name || 'Pokémon'}**!${damageResult.message.includes('(Rất hiệu quả!)') ? ' (Rất hiệu quả!)' : ''}${damageResult.message.includes('(Không hiệu quả lắm...)') ? ' (Không hiệu quả lắm...)' : ''}${damageResult.message.includes('(Không có tác dụng!)') ? ' (Không có tác dụng!)' : ''}${damageResult.message.includes('(Chí mạng!)') ? ' (Chí mạng!)' : ''}`);

        console.log(`[DEBUG_RUN_LOOP] ${currentPlayer.user.username}'s ${currentPokemon.nickname || currentPokemon.pokemon_name} tấn công ${opponentPlayer.user.username}'s ${opponentPokemon.nickname || opponentPokemon.pokemon_name}. HP còn lại của đối thủ: ${battleState.activePokemon[opponentPlayerId].current_hp}/${opponentPokemon.hp}.`);


        // --- Kiểm tra Pokémon đối thủ ngất xỉu sau khi bị tấn công ---
        if (battleState.isPokemonFainted(opponentPlayerId)) {
            battleState.addLog(`**${opponentPokemon.nickname || opponentPokemon.pokemon_name || 'Pokémon'}** đã ngất xỉu!`);
            console.log(`[DEBUG_RUN_LOOP] Pokémon của ${opponentPlayer.user.username} (${opponentPokemon.nickname || opponentPokemon.pokemon_name}) đã ngất xỉu sau khi bị tấn công.`);

            // Cập nhật HP của Pokemon đã ngất xỉu trong team thành 0
            const faintedPokemonInTeam = battleState.team[opponentPlayerId].find(p => p.data.id === opponentPokemon.id);
            if (faintedPokemonInTeam) {
                faintedPokemonInTeam.current_hp = 0;
                faintedPokemonInTeam.data.current_hp = 0; // Đảm bảo data.current_hp cũng là 0
            }

            if (battleState.isTeamFainted(opponentPlayerId)) {
                battleState.addLog(`**${opponentPlayer.user.username}** đã hết Pokémon. **${currentPlayer.user.username}** đã thắng!`);
                battleState.endBattle(currentPlayerId);
                console.log(`[DEBUG_RUN_LOOP] ${opponentPlayer.user.username} hết Pokémon. ${currentPlayer.user.username} thắng.`);
            } else {
                battleState.addLog(`**${opponentPlayer.user.username}** cần đưa Pokémon khác ra trận.`);
                const nextOpponentPokemon = battleState.getNextAvailablePokemon(opponentPlayerId);
                if (nextOpponentPokemon) {
                    console.log(`[DEBUG_RUN_LOOP] Đối thủ ${opponentPlayer.user.username} tự động đổi sang: ${nextOpponentPokemon.data.nickname || nextOpponentPokemon.data.pokemon_name}`);
                    battleState.switchActivePokemon(opponentPlayerId, nextOpponentPokemon.data.id);
                    const updatedEmbedAfterOpponentSwitch = await battleEmbeds.createBattleOverviewEmbed(battleState);
                    await battleState.stateMessage.edit({ embeds: [updatedEmbedAfterOpponentSwitch] });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.warn(`[DEBUG_RUN_LOOP] Cảnh báo: ${opponentPlayer.user.username} không tìm thấy Pokémon thay thế dù isTeamFainted trả về false. Buộc kết thúc trận đấu.`);
                    battleState.addLog(`**${opponentPlayer.user.username}** không thể tìm thấy Pokémon thay thế và bị xử thua!`);
                    battleState.endBattle(currentPlayerId);
                }
            }
        }

        // --- Cập nhật Embed sau khi tấn công và kiểm tra ngất xỉu (nếu trận đấu chưa kết thúc) ---
        if (!battleState.gameOver) {
            const updatedEmbed = await battleEmbeds.createBattleOverviewEmbed(battleState);
            await battleState.stateMessage.edit({
                embeds: [updatedEmbed],
                components: []
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (battleState.gameOver) {
            console.log("[DEBUG_RUN_LOOP] Trận đấu đã kết thúc. Thoát vòng lặp runBattleLoop.");
            break;
        }
    }

    // --- Xử lý cuối trận đấu ---
    console.log('[BattleManager] Vòng lặp trận đấu kết thúc. Bắt đầu lưu trạng thái HP cuối cùng.');
    await battleState.savePokemonHpToDatabase();

    const finalEmbed = await battleEmbeds.createBattleOverviewEmbed(battleState);
    await battleState.stateMessage.edit({ embeds: [finalEmbed], components: [] });
    console.log("[DEBUG_RUN_LOOP] Xử lý trận đấu hoàn tất.");
}

async function handleChallengeInteraction(interaction) {
    const [_, actionType, challengerId, targetId] = interaction.customId.split('_');
    const challengerUser = await interaction.client.users.fetch(challengerId);
    const targetUser = await interaction.client.users.fetch(targetId);

    const challengeId = `${challengerId}-${targetId}`;
    const pendingChallenge = pendingChallenges.get(challengeId);

    if (!pendingChallenge || pendingChallenge.target.id !== interaction.user.id) {
        return interaction.reply({ content: 'Lời thách đấu này không dành cho bạn hoặc đã hết hạn.', ephemeral: true });
    }

    clearPendingChallenge(challengeId); // Xóa lời thách đấu ngay khi có tương tác (chấp nhận/từ chối)

    let challengeMessage;
    try {
        const channel = await interaction.client.channels.fetch(pendingChallenge.channelId);
        challengeMessage = await channel.messages.fetch(pendingChallenge.messageId);
    } catch (error) {
        console.error('[BattleManager] Không thể tìm thấy tin nhắn thách đấu gốc:', error);
        return interaction.reply({ content: 'Có lỗi xảy ra khi xử lý lời thách đấu (tin nhắn gốc không tìm thấy).', ephemeral: true });
    }

    if (actionType === 'accept') {
        await interaction.deferReply();

        try {
            const battleFormat = pendingChallenge.format;

            let requiredPokemonCount;
            switch (battleFormat) {
                case '1v1': requiredPokemonCount = 1; break;
                case '3v3': requiredPokemonCount = 3; break;
                case '5v5': requiredPokemonCount = 5; break;
                default: requiredPokemonCount = 3; // Mặc định 3v3 nếu không rõ
            }

            // --- LẤY TEAM TỪ DATABASE DỰA TRÊN TEAM_SLOT ---
            const challengerSelectedPokemons = await getUserTeamPokemons(challengerId, requiredPokemonCount);
            const targetSelectedPokemons = await getUserTeamPokemons(targetId, requiredPokemonCount);
            // --------------------------------------------------

            console.log("[DEBUG] Challenger's Retrieved Pokemons for Battle:", challengerSelectedPokemons.map(p => ({ id: p.id, name: p.pokemon_name, nickname: p.nickname, hp: p.hp, current_hp: p.current_hp, learned_skills: p.learned_skills })));
            console.log("[DEBUG] Target's Retrieved Pokemons for Battle:", targetSelectedPokemons.map(p => ({ id: p.id, name: p.pokemon_name, nickname: p.nickname, hp: p.hp, current_hp: p.current_hp, learned_skills: p.learned_skills })));


            if (challengerSelectedPokemons.length < requiredPokemonCount || targetSelectedPokemons.length < requiredPokemonCount) {
                let errorMessage = `Lời thách đấu giữa **${challengerUser.username}** và **${targetUser.username}** không thể bắt đầu vì `;
                if (challengerSelectedPokemons.length < requiredPokemonCount) {
                    errorMessage += `**${challengerUser.username}** không có đủ **${requiredPokemonCount} Pokémon trong đội hình** cho thể thức **${battleFormat}**.`;
                }
                if (targetSelectedPokemons.length < requiredPokemonCount && challengerSelectedPokemons.length < requiredPokemonCount) {
                    errorMessage += ` và **${targetUser.username}** cũng không có đủ **${requiredPokemonCount} Pokémon trong đội hình**.`;
                } else if (targetSelectedPokemons.length < requiredPokemonCount) {
                    errorMessage += `**${targetUser.username}** không có đủ **${requiredPokemonCount} Pokémon trong đội hình** cho thể thức **${battleFormat}**.`;
                }
                errorMessage += `\nVui lòng thiết lập đủ Pokémon vào đội hình bằng lệnh \`!setteam\`.`;

                await challengeMessage.edit({
                    content: errorMessage,
                    embeds: [],
                    components: []
                });
                return interaction.editReply({ content: errorMessage, ephemeral: true });
            }

            // Truyền các Pokémon đã được lấy từ team_slot vào startBattle
            await startBattle({
                id: challengerId,
                user: challengerUser,
                selectedPokemon: challengerSelectedPokemons
            }, {
                id: targetId,
                user: targetUser,
                selectedPokemon: targetSelectedPokemons
            }, interaction.channel, battleFormat);

            await challengeMessage.edit({
                content: `Lời thách đấu của **${challengerUser.username}** đã được **${targetUser.username}** chấp nhận! Trận đấu **${battleFormat}** đã bắt đầu!`,
                embeds: [],
                components: []
            });
            await interaction.editReply({ content: 'Trận đấu đã bắt đầu tự động!' });

        } catch (error) {
            console.error('[BattleManager] Lỗi khi chấp nhận thách đấu và bắt đầu trận đấu:', error);
            await challengeMessage.edit({
                content: `Có lỗi xảy ra khi bắt đầu trận đấu giữa ${challengerUser.username} và ${targetUser.username}: ${error.message}`,
                embeds: [],
                components: []
            });
            return interaction.editReply(`Có lỗi xảy ra khi bắt đầu trận đấu: ${error.message}`);
        }
    } else if (actionType === 'deny') {
        await challengeMessage.edit({
            content: `Lời thách đấu của **${challengerUser.username}** đã bị **${targetUser.username}** từ chối.`,
            embeds: [],
            components: []
        });
        return interaction.reply({ content: 'Bạn đã từ chối lời thách đấu.', ephemeral: true });
    }
}

function getBattleState(userId1, userId2) {
    const battleId = [userId1, userId2].sort().join('-');
    return activeBattles.get(battleId);
}

module.exports = {
    startBattle,
    getBattleState,
    handleChallengeInteraction,
    addPendingChallenge,
    getPendingChallenge,
    clearPendingChallenge,
    getPendingChallengesMap,
    startChallengeCleanup,
    getUserTeamPokemons // Export hàm này nếu bạn muốn sử dụng nó ở nơi khác
};