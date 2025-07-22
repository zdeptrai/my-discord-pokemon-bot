// utils/dame/battleSimulation.js
const { calculateDamage } = require('./battleCalculations');

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

    battleEvents.push({ type: 'start', userHp: userCurrentHp, bossHp: bossCurrentHp, userPokemonName: userPokemon.nickname || userPokemon.name, bossPokemonName: bossPokemon.name, userLevel: userPokemon.level, bossLevel: bossPokemon.level });

    for (let turn = 1; turn <= maxTurns; turn++) {
        let firstAttacker;
        let secondAttacker;
        let firstSkill;
        let secondSkill;
        let firstAttackerName;
        let secondAttackerName;

        // Lấy kỹ năng cho lượt hiện tại của người chơi (lặp lại qua 4 kỹ năng)
        const currentUserSkill = userSkillsData[userSkillIndex];
        userSkillIndex = (userSkillIndex + 1) % userSkillsData.length; 

        // Lấy kỹ năng có power cao nhất cho Boss (đã được sắp xếp ở bossDungeonLogic)
        // Nếu bossSkillsData rỗng (không có kỹ năng tấn công), lấy kỹ năng mặc định
        const currentBossSkill = bossSkillsData.length > 0 ? bossSkillsData[0] : {
            name: 'Hyper Beam', // Kỹ năng mặc định nếu không có kỹ năng tấn công
            type: 'Normal',
            category: 'Special',
            power: 150,
            accuracy: 90
        };
        
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
        }

        // Lượt tấn công đầu tiên
        const firstAttackResult = calculateDamage(firstAttacker, (firstAttacker === userPokemon ? bossPokemon : userPokemon), firstSkill);
        
        // Cập nhật HP và log sự kiện cho lượt tấn công đầu tiên
        if (firstAttacker === userPokemon) { // Người chơi tấn công boss
            if (firstAttackResult.hit) {
                bossCurrentHp -= firstAttackResult.damage;
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
            battleEvents.push({ type: 'end', winner: 'boss', userHp: 0, bossHp: bossCurrentHp });
            return { userWin: false, events: battleEvents, userRemainingHp: 0, bossRemainingHp: bossCurrentHp };
        }
        if (bossCurrentHp <= 0) {
            battleEvents.push({ type: 'end', winner: 'user', userHp: userCurrentHp, bossHp: 0 });
            return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: 0 };
        }

        // Lượt tấn công thứ hai (nếu trận đấu chưa kết thúc)
        const secondAttackResult = calculateDamage(secondAttacker, (secondAttacker === userPokemon ? bossPokemon : userPokemon), secondSkill);
        
        // Cập nhật HP và log sự kiện cho lượt tấn công thứ hai
        if (secondAttacker === userPokemon) { // Người chơi tấn công boss
            if (secondAttackResult.hit) {
                bossCurrentHp -= secondAttackResult.damage;
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
            battleEvents.push({ type: 'end', winner: 'boss', userHp: 0, bossHp: bossCurrentHp });
            return { userWin: false, events: battleEvents, userRemainingHp: 0, bossRemainingHp: bossCurrentHp };
        }
        if (bossCurrentHp <= 0) {
            battleEvents.push({ type: 'end', winner: 'user', userHp: userCurrentHp, bossHp: 0 });
            return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: 0 };
        }
    }

    // Nếu đạt giới hạn lượt
    battleEvents.push({ type: 'end_max_turns', userHp: userCurrentHp, bossHp: bossCurrentHp });
    if (userCurrentHp > bossCurrentHp) {
        return { userWin: true, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp };
    } else if (bossCurrentHp > userCurrentHp) {
        return { userWin: false, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp };
    } else {
        return { userWin: false, events: battleEvents, userRemainingHp: userCurrentHp, bossRemainingHp: bossCurrentHp }; // Hòa tính là thua
    }
}

module.exports = {
    simulateBossBattle,
};
