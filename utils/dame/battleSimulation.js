// utils/dame/battleSimulation.js
const { calculateDamage } = require('./battleCalculations');
const logger = require('../logger'); // <-- Thêm dòng này

/**
 * Mô phỏng một trận đấu đơn giản giữa người chơi và boss.
 * Trả về kết quả trận đấu (thắng/thua) và sát thương gây ra/nhận vào, cùng với log sự kiện chi tiết.
 * @param {object} userPokemon Chi tiết user_pokemon của người chơi (bao gồm chỉ số đã tính toán, level, type1, type2, speed)
 * @param {object} bossPokemon Chi tiết boss_pokemon (bao gồm chỉ số đã tính toán, level, type1, type2, speed)
 * @param {object[]} userSkillsData Mảng dữ liệu kỹ năng mà người chơi đã học
 * @param {object[]} bossSkillsData Mảng dữ liệu kỹ năng mà boss có thể sử dụng (đã lọc Status và sắp xếp theo power)
 * @returns {object} { userWin: boolean, events: object[], userRemainingHp: number, bossRemainingHp: number }
 */
async function simulateBossBattle(userPokemon, bossPokemon, userSkillsData, bossSkillsData) {
    let userCurrentHp = userPokemon.hp;
    let bossCurrentHp = bossPokemon.hp;
    const battleEvents = [];
    const maxTurns = 50;
    let userSkillIndex = 0; // Index để theo dõi kỹ năng người chơi đang dùng (lặp lại 4 kỹ năng)

    logger.debug('[BATTLE_SIMULATION_START]', `Bắt đầu mô phỏng: ${userPokemon.nickname || userPokemon.name} (Lv ${userPokemon.level}) vs ${bossPokemon.name} (Lv ${bossPokemon.level})`);
    battleEvents.push({ 
        type: 'start', 
        userHp: userCurrentHp, 
        bossHp: bossCurrentHp, 
        userPokemonName: userPokemon.nickname || userPokemon.name, 
        bossPokemonName: bossPokemon.name, 
        userLevel: userPokemon.level, 
        bossLevel: bossPokemon.level 
    });

    for (let turn = 1; turn <= maxTurns; turn++) {
        logger.debug('[BATTLE_SIMULATION_TURN]', `Lượt ${turn}: User HP: ${Math.max(0, userCurrentHp)}, Boss HP: ${Math.max(0, bossCurrentHp)}`);

        let firstAttacker;
        let secondAttacker;
        let firstSkill;
        let secondSkill;
        let firstAttackerName;
        let secondAttackerName;

        // Lấy kỹ năng cho lượt hiện tại của người chơi (lặp lại qua 4 kỹ năng)
        const currentUserSkill = userSkillsData[userSkillIndex];
        userSkillIndex = (userSkillIndex + 1) % userSkillsData.length; 
        logger.debug('[BATTLE_SIMULATION_SKILL_USER]', `Người chơi sẽ dùng kỹ năng: ${currentUserSkill.name}`);

        // Lấy kỹ năng có power cao nhất cho Boss (đã được sắp xếp ở bossDungeonLogic)
        // Nếu bossSkillsData rỗng (không có kỹ năng tấn công), lấy kỹ năng mặc định
        const currentBossSkill = bossSkillsData.length > 0 ? bossSkillsData[0] : {
            name: 'Hyper Beam', // Kỹ năng mặc định nếu không có kỹ năng tấn công
            type: 'Normal',
            category: 'Special',
            power: 150,
            accuracy: 90
        };
        logger.debug('[BATTLE_SIMULATION_SKILL_BOSS]', `Boss sẽ dùng kỹ năng: ${currentBossSkill.name}`);
        
        // Quyết định lượt đi dựa trên chỉ số Tốc độ
        if (userPokemon.speed > bossPokemon.speed) {
            firstAttacker = userPokemon;
            firstSkill = currentUserSkill;
            firstAttackerName = userPokemon.nickname || userPokemon.name;
            secondAttacker = bossPokemon;
            secondSkill = currentBossSkill;
            secondAttackerName = bossPokemon.name;
            battleEvents.push({ 
                type: 'turn_order', 
                turn: turn, 
                order: 'user_first', 
                first: firstAttackerName, 
                second: secondAttackerName,
                firstAttackerSpeed: firstAttacker.speed, 
                secondAttackerSpeed: secondAttacker.speed 
            });
            logger.debug('[BATTLE_SIMULATION_ORDER]', `${firstAttackerName} (SPD: ${firstAttacker.speed}) tấn công trước ${secondAttackerName} (SPD: ${secondAttacker.speed}).`);
        } else if (bossPokemon.speed > userPokemon.speed) {
            firstAttacker = bossPokemon;
            firstSkill = currentBossSkill;
            firstAttackerName = bossPokemon.name;
            secondAttacker = userPokemon;
            secondSkill = currentUserSkill;
            secondAttackerName = userPokemon.nickname || userPokemon.name;
            battleEvents.push({ 
                type: 'turn_order', 
                turn: turn, 
                order: 'boss_first', 
                first: firstAttackerName, 
                second: secondAttackerName,
                firstAttackerSpeed: firstAttacker.speed, 
                secondAttackerSpeed: secondAttacker.speed 
            });
            logger.debug('[BATTLE_SIMULATION_ORDER]', `${firstAttackerName} (SPD: ${firstAttacker.speed}) tấn công trước ${secondAttackerName} (SPD: ${secondAttacker.speed}).`);
        } else {
            // Nếu tốc độ bằng nhau, người chơi tấn công trước
            firstAttacker = userPokemon;
            firstSkill = currentUserSkill;
            firstAttackerName = userPokemon.nickname || userPokemon.name;
            secondAttacker = bossPokemon;
            secondSkill = currentBossSkill;
            secondAttackerName = bossPokemon.name;
            battleEvents.push({ 
                type: 'turn_order', 
                turn: turn, 
                order: 'equal_speed_user_first', 
                first: firstAttackerName, 
                second: secondAttackerName,
                firstAttackerSpeed: firstAttacker.speed, 
                secondAttackerSpeed: secondAttacker.speed 
            });
            logger.debug('[BATTLE_SIMULATION_ORDER]', `${firstAttackerName} và ${secondAttackerName} có cùng tốc độ (${firstAttacker.speed}). ${firstAttackerName} tấn công trước.`);
        }

        // Lượt tấn công đầu tiên
        const firstAttackTarget = (firstAttacker === userPokemon ? bossPokemon : userPokemon);
        const firstAttackResult = calculateDamage(firstAttacker, firstAttackTarget, firstSkill);
        
        // Cập nhật HP và log sự kiện cho lượt tấn công đầu tiên
        if (firstAttacker === userPokemon) { // Người chơi tấn công boss
            if (firstAttackResult.hit) {
                bossCurrentHp -= firstAttackResult.damage;
                logger.debug('[BATTLE_SIMULATION_ATTACK]', `${firstAttackerName} (User) dùng ${firstSkill.name}, gây ${firstAttackResult.damage} sát thương lên ${secondAttackerName} (Boss). Boss còn ${Math.max(0, bossCurrentHp)} HP.`);
                battleEvents.push({
                    type: 'attack',
                    turn: turn,
                    attacker: 'user',
                    attackerName: firstAttackerName,
                    defenderName: secondAttackerName,
                    skillName: firstSkill.name,
                    damage: firstAttackResult.damage,
                    crit: firstAttackResult.crit,
                    effectiveness: firstAttackResult.effectiveness,
                    remainingHp: Math.max(0, bossCurrentHp)
                });
            } else {
                logger.debug('[BATTLE_SIMULATION_MISS]', `${firstAttackerName} (User) dùng ${firstSkill.name} nhưng trượt.`);
                battleEvents.push({
                    type: 'miss',
                    turn: turn,
                    attacker: 'user',
                    attackerName: firstAttackerName,
                    skillName: firstSkill.name
                });
            }
        } else { // Boss tấn công người chơi
            if (firstAttackResult.hit) {
                userCurrentHp -= firstAttackResult.damage;
                logger.debug('[BATTLE_SIMULATION_ATTACK]', `${firstAttackerName} (Boss) dùng ${firstSkill.name}, gây ${firstAttackResult.damage} sát thương lên ${secondAttackerName} (User). User còn ${Math.max(0, userCurrentHp)} HP.`);
                battleEvents.push({
                    type: 'attack',
                    turn: turn,
                    attacker: 'boss',
                    attackerName: firstAttackerName,
                    defenderName: secondAttackerName,
                    skillName: firstSkill.name,
                    damage: firstAttackResult.damage,
                    crit: firstAttackResult.crit,
                    effectiveness: firstAttackResult.effectiveness,
                    remainingHp: Math.max(0, userCurrentHp)
                });
            } else {
                logger.debug('[BATTLE_SIMULATION_MISS]', `${firstAttackerName} (Boss) dùng ${firstSkill.name} nhưng trượt.`);
                battleEvents.push({
                    type: 'miss',
                    turn: turn,
                    attacker: 'boss',
                    attackerName: firstAttackerName,
                    skillName: firstSkill.name
                });
            }
        }

        // Kiểm tra kết thúc trận đấu sau lượt tấn công đầu tiên
        if (userCurrentHp <= 0) {
            logger.info('[BATTLE_SIMULATION_END]', `Trận đấu kết thúc ở lượt ${turn}: Boss thắng, User HP: 0.`);
            battleEvents.push({ type: 'end', winner: 'boss', userHp: 0, bossHp: bossCurrentHp, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name });
            return { userWin: false, events: battleEvents, userRemainingHp: 0, bossRemainingHp: bossCurrentHp };
        }
        if (bossCurrentHp <= 0) {
            logger.info('[BATTLE_SIMULATION_END]', `Trận đấu kết thúc ở lượt ${turn}: User thắng, Boss HP: 0.`);
            battleEvents.push({ type: 'end', winner: 'user', userHp: userCurrentHp, bossHp: 0, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name });
            return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: 0 };
        }

        // Lượt tấn công thứ hai (nếu trận đấu chưa kết thúc)
        const secondAttackTarget = (secondAttacker === userPokemon ? bossPokemon : userPokemon);
        const secondAttackResult = calculateDamage(secondAttacker, secondAttackTarget, secondSkill);
        
        // Cập nhật HP và log sự kiện cho lượt tấn công thứ hai
        if (secondAttacker === userPokemon) { // Người chơi tấn công boss
            if (secondAttackResult.hit) {
                bossCurrentHp -= secondAttackResult.damage;
                logger.debug('[BATTLE_SIMULATION_ATTACK]', `${secondAttackerName} (User) dùng ${secondSkill.name}, gây ${secondAttackResult.damage} sát thương lên ${firstAttackerName} (Boss). Boss còn ${Math.max(0, bossCurrentHp)} HP.`);
                battleEvents.push({
                    type: 'attack',
                    turn: turn,
                    attacker: 'user',
                    attackerName: secondAttackerName,
                    defenderName: firstAttackerName,
                    skillName: secondSkill.name,
                    damage: secondAttackResult.damage,
                    crit: secondAttackResult.crit,
                    effectiveness: secondAttackResult.effectiveness,
                    remainingHp: Math.max(0, bossCurrentHp)
                });
            } else {
                logger.debug('[BATTLE_SIMULATION_MISS]', `${secondAttackerName} (User) dùng ${secondSkill.name} nhưng trượt.`);
                battleEvents.push({
                    type: 'miss',
                    turn: turn,
                    attacker: 'user',
                    attackerName: secondAttackerName,
                    skillName: secondSkill.name
                });
            }
        } else { // Boss tấn công người chơi
            if (secondAttackResult.hit) {
                userCurrentHp -= secondAttackResult.damage;
                logger.debug('[BATTLE_SIMULATION_ATTACK]', `${secondAttackerName} (Boss) dùng ${secondSkill.name}, gây ${secondAttackResult.damage} sát thương lên ${firstAttackerName} (User). User còn ${Math.max(0, userCurrentHp)} HP.`);
                battleEvents.push({
                    type: 'attack',
                    turn: turn,
                    attacker: 'boss',
                    attackerName: secondAttackerName,
                    defenderName: firstAttackerName,
                    skillName: secondSkill.name,
                    damage: secondAttackResult.damage,
                    crit: secondAttackResult.crit,
                    effectiveness: secondAttackResult.effectiveness,
                    remainingHp: Math.max(0, userCurrentHp)
                });
            } else {
                logger.debug('[BATTLE_SIMULATION_MISS]', `${secondAttackerName} (Boss) dùng ${secondSkill.name} nhưng trượt.`);
                battleEvents.push({
                    type: 'miss',
                    turn: turn,
                    attacker: 'boss',
                    attackerName: secondAttackerName,
                    skillName: secondSkill.name
                });
            }
        }

        // Kiểm tra kết thúc trận đấu sau lượt tấn công thứ hai
        if (userCurrentHp <= 0) {
            logger.info('[BATTLE_SIMULATION_END]', `Trận đấu kết thúc ở lượt ${turn}: Boss thắng, User HP: 0.`);
            battleEvents.push({ type: 'end', winner: 'boss', userHp: 0, bossHp: bossCurrentHp, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name });
            return { userWin: false, events: battleEvents, userRemainingHp: 0, bossRemainingHp: bossCurrentHp };
        }
        if (bossCurrentHp <= 0) {
            logger.info('[BATTLE_SIMULATION_END]', `Trận đấu kết thúc ở lượt ${turn}: User thắng, Boss HP: 0.`);
            battleEvents.push({ type: 'end', winner: 'user', userHp: userCurrentHp, bossHp: 0, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name });
            return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: 0 };
        }
    }

    // Nếu đạt giới hạn lượt
    logger.info('[BATTLE_SIMULATION_END]', `Trận đấu kết thúc sau ${maxTurns} lượt tối đa. User HP: ${Math.max(0, userCurrentHp)}, Boss HP: ${Math.max(0, bossCurrentHp)}.`);
    battleEvents.push({ type: 'end_max_turns', userHp: userCurrentHp, bossHp: bossCurrentHp, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name });
    if (userCurrentHp > bossCurrentHp) {
        logger.info('[BATTLE_SIMULATION_RESULT]', `Người chơi thắng theo HP cao hơn sau ${maxTurns} lượt.`);
        return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp };
    } else if (bossCurrentHp > userCurrentHp) {
        logger.info('[BATTLE_SIMULATION_RESULT]', `Boss thắng theo HP cao hơn sau ${maxTurns} lượt.`);
        return { userWin: false, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp };
    } else {
        logger.info('[BATTLE_SIMULATION_RESULT]', `Trận đấu hòa sau ${maxTurns} lượt. Tính là thua cho người chơi.`);
        return { userWin: false, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp }; // Hòa tính là thua
    }
}

module.exports = {
    simulateBossBattle,
};