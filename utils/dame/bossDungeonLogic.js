// utils/dame/bossDungeonLogic.js
const { EmbedBuilder, MessageFlags } = require('discord.js'); 
const { getPokemonName, getPokemonStats, getRandomMysticalBoss } = require('../core/pokemonUtils'); 
const { generateHpBar } = require('../core/displayUtils'); 

const { getRandomRewardItem, addOrUpdateUserItem } = require('./itemUtils'); 
const { simulateBossBattle } = require('./battleSimulation'); 
const { getTypeEffectiveness } = require('./battleCalculations'); 
const logger = require('../logger'); // <-- Thêm dòng này

const BOSS_DUNGEON_COOLDOWN_HOURS = 8;
const MIN_POKEMON_LEVEL_FOR_BOSS = 20;

/**
 * Định dạng các sự kiện trận đấu thành chuỗi log.
 * @param {object[]} events - Mảng các đối tượng sự kiện trận đấu.
 * @returns {string[]} Mảng các chuỗi log đã định dạng.
 */
function formatBattleEvents(events) {
    const logStrings = [];
    for (const event of events) {
        switch (event.type) {
            case 'start':
                logStrings.push(`--- Bắt đầu trận đấu: ${event.userPokemonName} (Lv ${event.userLevel}) vs ${event.bossPokemonName} (Lv ${event.bossLevel}) ---`);
                logStrings.push(`HP của bạn: ${event.userHp} | HP của Boss: ${event.bossHp}`);
                break;
            case 'turn_order':
                if (event.order === 'user_first') {
                    logStrings.push(`\n💨 ${event.first} (Tốc độ: ${event.firstAttackerSpeed}) nhanh hơn ${event.second} (Tốc độ: ${event.secondAttackerSpeed})! ${event.first} tấn công trước.`);
                } else if (event.order === 'boss_first') {
                    logStrings.push(`\n💨 ${event.first} (Tốc độ: ${event.firstAttackerSpeed}) nhanh hơn ${event.second} (Tốc độ: ${event.secondAttackerSpeed})! ${event.first} tấn công trước.`);
                } else if (event.order === 'equal_speed_user_first') {
                    logStrings.push(`\n💨 ${event.first} và ${event.second} có cùng tốc độ (${event.firstAttackerSpeed}). ${event.first} tấn công trước.`);
                }
                break;
            case 'attack':
                let critMsg = event.crit ? ' (Chí mạng!)' : '';
                let effMsg = '';
                if (event.effectiveness === 2.0) effMsg = ' (Siêu hiệu quả!)';
                else if (event.effectiveness === 0.5) effMsg = ' (Không hiệu quả lắm.)';
                else if (event.effectiveness === 0) effMsg = ' (Không có tác dụng!)';
                logStrings.push(`L${event.turn}: ${event.attackerName} dùng **${event.skillName}** gây **${event.damage} sát thương**!${critMsg}${effMsg}`); // Đã thêm critMsg và effMsg
                logStrings.push(`> ${event.defenderName} còn **${Math.max(0, event.remainingHp)} HP**.`);
                break;
            case 'miss':
                logStrings.push(`L${event.turn}: ${event.attackerName} dùng **${event.skillName}** nhưng trượt!`);
                break;
            case 'end':
                logStrings.push(`--- Kết thúc trận đấu ---`);
                if (event.winner === 'user') {
                    logStrings.push(`Bạn còn ${Math.max(0, event.userHp)} HP | Boss còn 0 HP`);
                    logStrings.push(`Chúc mừng! ${event.userPokemonName || 'Pokémon của bạn'} đã đánh bại ${event.bossPokemonName || 'Boss'}!`);
                } else {
                    logStrings.push(`Bạn còn 0 HP | Boss còn ${Math.max(0, event.bossHp)} HP`);
                    logStrings.push(`Thất bại! ${event.bossPokemonName || 'Boss'} đã đánh bại ${event.userPokemonName || 'Pokémon của bạn'}.`);
                }
                break;
            case 'end_max_turns':
                logStrings.push(`--- Kết thúc trận đấu ---`);
                logStrings.push(`Bạn còn ${Math.max(0, event.userHp)} HP | Boss còn ${Math.max(0, event.bossHp)} HP`);
                logStrings.push('Trận đấu kết thúc sau giới hạn lượt.');
                break;
        }
    }
    return logStrings;
}


/**
 * Xử lý toàn bộ logic cho lệnh phó bản boss.
 * @param {object} message - Đối tượng tin nhắn Discord.
 * @param {object} client - Đối tượng client Discord.
 * @param {object} db - Knex database instance.
 */
async function handleBossDungeon(message, client, db) {
    const userId = message.author.id;
    const userDisplayName = message.member ? message.member.displayName : message.author.displayName;
    logger.pokemon('[BOSS_DUNGEON]', `Người dùng ${userDisplayName} (${userId}) đã sử dụng lệnh boss.`);

    try {
        // --- 1. Kiểm tra cấu hình kênh của guild (guild_settings) ---
        const guildSettings = await db('guild_settings')
            .where('guild_id', message.guild.id)
            .select('boss_channel_id')
            .first();

        if (!guildSettings || guildSettings.boss_channel_id !== message.channel.id) {
            let replyContent = `<@${userId}> Lệnh này chỉ có thể được sử dụng trong kênh phó bản boss đã được chỉ định.`;
            if (guildSettings && !guildSettings.boss_channel_id) {
                replyContent += ` Chủ server cần thiết lập kênh phó bản boss bằng lệnh \`${client.config.PREFIX}setchannel boss add\`.`;
                logger.warn('[BOSS_DUNGEON_WARN]', `Người dùng ${userDisplayName} (${userId}) thử dùng lệnh boss ngoài kênh được thiết lập. Guild: ${message.guild.id}. Kênh chưa thiết lập.`);
            } else {
                logger.warn('[BOSS_DUNGEON_WARN]', `Người dùng ${userDisplayName} (${userId}) thử dùng lệnh boss ngoài kênh được thiết lập. Guild: ${message.guild.id}, Kênh yêu cầu: ${guildSettings.boss_channel_id}, Kênh hiện tại: ${message.channel.id}.`);
            }
            return message.channel.send({
                content: replyContent,
                flags: MessageFlags.Ephemeral 
            });
        }
        logger.debug('[BOSS_DUNGEON_DEBUG]', `Kênh phó bản boss hợp lệ cho guild ${message.guild.id}.`);

        // --- 2. Lấy thông tin người dùng và Pokémon đã chọn ---
        const user = await db('users')
            .where('discord_id', userId)
            .select('selected_pokemon_id', 'last_boss_dungeon_time')
            .first();

        if (!user) {
            logger.warn('[BOSS_DUNGEON_WARN]', `Người dùng ${userDisplayName} (${userId}) chưa đăng ký khi dùng lệnh boss.`);
            return message.channel.send({
                content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký.`,
                flags: MessageFlags.Ephemeral 
            });
        }

        if (!user.selected_pokemon_id) {
            logger.warn('[BOSS_DUNGEON_WARN]', `Người dùng ${userDisplayName} (${userId}) chưa chọn Pokémon khi dùng lệnh boss.`);
            return message.channel.send({
                content: `<@${userId}> Bạn cần chọn một Pokémon để tham gia phó bản boss! Sử dụng lệnh \`${client.config.PREFIX}select <ID_Pokémon>\` để chọn Pokémon.`,
                flags: MessageFlags.Ephemeral 
            });
        }

        const userPokemonRaw = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where('user_pokemons.id', user.selected_pokemon_id)
            .andWhere('user_pokemons.user_discord_id', userId)
            .select(
                'user_pokemons.*',
                'pokemons.name as pokemon_base_name',
                'pokemons.hp as base_hp',
                'pokemons.attack as base_attack',
                'pokemons.defense as base_defense',
                'pokemons.special_attack as base_special_attack',
                'pokemons.special_defense as base_special_defense',
                'pokemons.speed as base_speed',
                'pokemons.type1 as base_type1',
                'pokemons.type2 as base_type2',
                'pokemons.official_artwork_url as pokemon_image_url'
            )
            .first();
        
        if (!userPokemonRaw) {
            logger.warn('[BOSS_DUNGEON_WARN]', `Pokémon đã chọn của người dùng ${userDisplayName} (${userId}) không hợp lệ (ID: ${user.selected_pokemon_id}). Đã đặt lại.`);
            await db('users')
                .where('discord_id', userId)
                .update({ selected_pokemon_id: null });

            return message.channel.send({
                content: `<@${userId}> Pokémon đã chọn của bạn không hợp lệ hoặc không tồn tại. Vui lòng chọn lại Pokémon khác.`,
                flags: MessageFlags.Ephemeral 
            });
        }
        logger.debug('[BOSS_DUNGEON_DEBUG]', `Người dùng ${userDisplayName} (${userId}) đã chọn Pokémon: ${userPokemonRaw.nickname || userPokemonRaw.pokemon_base_name} (ID: ${userPokemonRaw.id}, Lv: ${userPokemonRaw.level}).`);


        if (userPokemonRaw.level < MIN_POKEMON_LEVEL_FOR_BOSS) {
            logger.warn('[BOSS_DUNGEON_WARN]', `Pokémon của người dùng ${userDisplayName} (${userId}) cấp độ quá thấp (${userPokemonRaw.level}) để tham gia phó bản boss.`);
            return message.channel.send({
                content: `<@${userId}> Pokémon của bạn phải đạt cấp độ **${MIN_POKEMON_LEVEL_FOR_BOSS}** trở lên để tham gia phó bản boss. Pokémon hiện tại của bạn là cấp **${userPokemonRaw.level}**.`,
                flags: MessageFlags.Ephemeral 
            });
        }

        // --- 3. Kiểm tra Cooldown Phó bản Boss cho phần thưởng ---
        let canGetReward = true;
        let cooldownTimeLeftMessage = '';
        if (user.last_boss_dungeon_time) {
            const lastDungeonTime = new Date(user.last_boss_dungeon_time);
            const cooldownEndTime = new Date(lastDungeonTime.getTime() + BOSS_DUNGEON_COOLDOWN_HOURS * 60 * 60 * 1000);
            const currentTime = new Date();

            if (currentTime < cooldownEndTime) {
                canGetReward = false;
                const timeLeftMs = cooldownEndTime.getTime() - currentTime.getTime();
                const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
                const minutesLeft = Math.ceil((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                cooldownTimeLeftMessage = ` (còn **${hoursLeft} giờ ${minutesLeft} phút** để nhận thưởng)`;
                logger.pokemon('[BOSS_DUNGEON]', `Người dùng ${userDisplayName} (${userId}) đang trong thời gian cooldown boss dungeon${cooldownTimeLeftMessage}.`);
            }
        }
        if (canGetReward) {
            logger.pokemon('[BOSS_DUNGEON]', `Người dùng ${userDisplayName} (${userId}) đủ điều kiện nhận thưởng boss dungeon.`);
        }


        // --- 4. Chọn Boss ngẫu nhiên (Mythical) ---
        const bossPokedexData = await getRandomMysticalBoss(db);

        if (!bossPokedexData) {
            logger.error('[BOSS_DUNGEON_ERROR]', `Không tìm thấy boss Mythical nào để thách đấu trong database.`);
            return message.channel.send({
                content: `<@${userId}> Hiện tại không có boss Mythical nào để thách đấu. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral 
            });
        }
        logger.pokemon('[BOSS_DUNGEON]', `Đã chọn Boss: ${bossPokedexData.name} (ID: ${bossPokedexData.pokedex_id}, Type: ${bossPokedexData.type1}${bossPokedexData.type2 ? `, ${bossPokedexData.type2}` : ''}).`);


        // --- 5. Tính toán chỉ số cho Pokémon của người dùng và Boss ---
        const userPokemonStats = getPokemonStats(
            {
                hp: userPokemonRaw.base_hp,
                attack: userPokemonRaw.base_attack,
                defense: userPokemonRaw.base_defense,
                special_attack: userPokemonRaw.base_special_attack,
                special_defense: userPokemonRaw.base_special_defense,
                speed: userPokemonRaw.base_speed
            },
            userPokemonRaw.level,
            {
                hp_iv: userPokemonRaw.hp_iv,
                attack_iv: userPokemonRaw.attack_iv,
                defense_iv: userPokemonRaw.defense_iv,
                special_attack_iv: userPokemonRaw.special_attack_iv,
                special_defense_iv: userPokemonRaw.special_defense_iv,
                speed_iv: userPokemonRaw.speed_iv
            }
        );

        const bossLevel = userPokemonRaw.level; // Boss cùng cấp với người chơi
        const bossIVs = { hp_iv: 31, attack_iv: 31, defense_iv: 31, special_attack_iv: 31, special_defense_iv: 31, speed_iv: 31 }; // Boss có IVs tối đa
        const bossStats = getPokemonStats(
            {
                hp: bossPokedexData.hp,
                attack: bossPokedexData.attack,
                defense: bossPokedexData.defense,
                special_attack: bossPokedexData.special_attack,
                special_defense: bossPokedexData.special_defense,
                speed: bossPokedexData.speed
            },
            bossLevel,
            bossIVs
        );
        logger.debug('[BOSS_DUNGEON_DEBUG]', `Chỉ số người dùng (${userPokemonRaw.level}): HP ${userPokemonStats.hp}, ATK ${userPokemonStats.attack}, DEF ${userPokemonStats.defense}, SPD ${userPokemonStats.speed}`);
        logger.debug('[BOSS_DUNGEON_DEBUG]', `Chỉ số Boss (${bossLevel}): HP ${bossStats.hp}, ATK ${bossStats.attack}, DEF ${bossStats.defense}, SPD ${bossStats.speed}`);
        
        // --- Lấy kỹ năng cho người chơi và Boss ---
        let userSkillsData = []; // Mảng để lưu tất cả kỹ năng người chơi
        let bossSkillsData = []; // Mảng để lưu tất cả kỹ năng tấn công của boss

        // Lấy kỹ năng người chơi đã học (tối đa 4 kỹ năng)
        let learnedSkillsIds = [];
        try {
            learnedSkillsIds = JSON.parse(userPokemonRaw.learned_skill_ids || '[]');
            if (!Array.isArray(learnedSkillsIds)) {
                learnedSkillsIds = [];
                logger.warn('[BOSS_DUNGEON_WARN]', `learned_skill_ids cho Pokémon ${userPokemonRaw.id} không phải mảng. Đã đặt lại thành rỗng.`);
            }
        } catch (parseError) {
            logger.error(`[BOSS_DUNGEON_ERROR]`, `Lỗi phân tích learned_skill_ids cho Pokémon ${userPokemonRaw.id}:`, parseError); // Thay thế console.error
            learnedSkillsIds = [];
        }

        if (learnedSkillsIds.length > 0) {
            const skillsFromDb = await db('skills')
                .whereIn('skill_id', learnedSkillsIds)
                .select('*');
            
            // Sắp xếp lại kỹ năng theo thứ tự trong learnedSkillsIds và giới hạn 4 kỹ năng
            userSkillsData = skillsFromDb
                .filter(skill => learnedSkillsIds.includes(skill.skill_id)) // Đảm bảo đúng kỹ năng đã học
                .sort((a, b) => learnedSkillsIds.indexOf(a.skill_id) - learnedSkillsIds.indexOf(b.skill_id)) // Sắp xếp theo thứ tự học
                .slice(0, 4); // Giới hạn tối đa 4 kỹ năng
            logger.debug('[BOSS_DUNGEON_DEBUG]', `Kỹ năng đã học của người dùng: ${userSkillsData.map(s => s.name).join(', ')}`);
        }
        
        // Nếu người chơi chưa học đủ 4 kỹ năng hoặc không có kỹ năng nào, thêm Tackle mặc định
        while (userSkillsData.length < 1) { // Đảm bảo ít nhất có 1 kỹ năng
            userSkillsData.push({
                name: 'Tackle',
                type: 'Normal',
                category: 'Physical',
                power: 40,
                accuracy: 100
            });
            logger.warn('[BOSS_DUNGEON_WARN]', `Pokémon người dùng không có kỹ năng, đã thêm kỹ năng "Tackle" mặc định.`);
        }

        // Lấy kỹ năng tấn công có power cao nhất cho Boss
        // Lọc bỏ các kỹ năng có power = 0 hoặc NULL, và category là 'Status'
        const bossAttackSkills = await db('pokemon_skills')
            .where('pokemon_skills.pokedex_id', bossPokedexData.pokedex_id)
            .join('skills', 'pokemon_skills.skill_id', 'skills.skill_id')
            .whereNotNull('skills.power') // Đảm bảo power không phải NULL
            .where('skills.power', '>', 0) // Đảm bảo power lớn hơn 0
            .whereNot('skills.category', 'Status') // Lọc bỏ các kỹ năng Status (chữ 'S' hoa)
            .whereNot('skills.category', 'status') // Lọc bỏ các kỹ năng Status (chữ 's' thường)
            .orderBy('skills.power', 'desc') // Sắp xếp theo power giảm dần
            .select('skills.*');

        if (bossAttackSkills.length > 0) {
            bossSkillsData = bossAttackSkills; // Giữ tất cả các kỹ năng tấn công đã sắp xếp
            logger.debug('[BOSS_DUNGEON_DEBUG]', `Kỹ năng tấn công của Boss: ${bossSkillsData.map(s => s.name).join(', ')}`);
        } else {
            logger.warn(`[BOSS_DUNGEON_WARN]`, `Boss ${bossPokedexData.name} (ID: ${bossPokedexData.pokedex_id}) không có kỹ năng tấn công nào hợp lệ trong database. Sử dụng kỹ năng "Hyper Beam" mặc định.`); // Thay thế console.warn
            bossSkillsData.push({ // Đảm bảo là mảng
                name: 'Hyper Beam', // Kỹ năng mặc định nếu không tìm thấy kỹ năng tấn công
                type: 'Normal',
                category: 'Special',
                power: 150,
                accuracy: 90
            });
        }

        // Tạo đối tượng Pokémon hoàn chỉnh cho trận đấu
        const userPokemonForBattle = {
            ...userPokemonRaw,
            ...userPokemonStats, 
            name: userPokemonRaw.nickname || userPokemonRaw.pokemon_base_name,
            level: userPokemonRaw.level,
            type1: userPokemonRaw.base_type1,
            type2: userPokemonRaw.base_type2
        };

        const bossPokemonForBattle = {
            ...bossPokedexData,
            ...bossStats, 
            name: bossPokedexData.name,
            level: bossLevel,
            type1: bossPokedexData.type1,
            type2: bossPokedexData.type2
        };

        // --- 6. Mô phỏng trận chiến ---
        logger.pokemon('[BOSS_DUNGEON]', `Bắt đầu mô phỏng trận chiến giữa ${userPokemonForBattle.name} (Lv ${userPokemonForBattle.level}) và ${bossPokemonForBattle.name} (Lv ${bossPokemonForBattle.level}).`);
        const battleResult = await simulateBossBattle(userPokemonForBattle, bossPokemonForBattle, userSkillsData, bossSkillsData);
        logger.pokemon('[BOSS_DUNGEON]', `Kết quả trận chiến: Người dùng ${battleResult.userWin ? 'THẮNG' : 'THUA'}. HP còn lại của người dùng: ${battleResult.userRemainingHp}, HP còn lại của Boss: ${battleResult.bossRemainingHp}.`);


        // --- 7. Trao phần thưởng ngẫu nhiên (Item có value NULL) - ĐIỀU KIỆN THEO COOLDOWN ---
        let rewardMessage = '';
        if (canGetReward) { 
            const randomReward = await getRandomRewardItem(db);
            if (randomReward) {
                const rewardQuantity = 1; 
                await addOrUpdateUserItem(userId, randomReward.item_id, rewardQuantity, db);
                rewardMessage = `Bạn đã nhận được **${rewardQuantity}x ${randomReward.name}**!`;
                logger.pokemon('[BOSS_DUNGEON]', `Người dùng ${userDisplayName} (${userId}) đã nhận phần thưởng: ${rewardQuantity}x ${randomReward.name}.`);

                // Cập nhật cooldown chỉ khi một phần thưởng đã được trao thành công
                await db('users')
                    .where('discord_id', userId)
                    .update({ last_boss_dungeon_time: db.fn.now() });
                logger.pokemon('[BOSS_DUNGEON]', `Đã cập nhật thời gian cooldown phó bản boss cho người dùng ${userId}.`);
            } else {
                rewardMessage = 'Bạn đủ điều kiện nhận thưởng nhưng không tìm thấy vật phẩm nào phù hợp để trao.';
                logger.warn('[BOSS_DUNGEON_WARN]', `Người dùng ${userDisplayName} (${userId}) đủ điều kiện nhận thưởng nhưng không tìm thấy vật phẩm ngẫu nhiên để trao.`);
            }
        } else { // Nếu đang trong thời gian hồi chiêu
            rewardMessage = `Bạn không nhận được phần thưởng vì đang trong thời gian hồi chiêu${cooldownTimeLeftMessage}.`;
        }

        // --- 8. Gửi Embed thông báo kết quả ---
        const resultEmbed = new EmbedBuilder()
            .setColor(battleResult.userWin ? '#00FF00' : '#FF0000')
            .setTitle(`💥 Kết Quả Phó Bản Boss! 💥`)
            .setDescription(`**${userDisplayName}** đã thách đấu với **${bossPokemonForBattle.name} (Cấp ${bossPokemonForBattle.level})**!`)
            .addFields(
                { 
                    name: `[🛡️ Bạn] ${userPokemonForBattle.nickname || userPokemonForBattle.pokemon_base_name} (Lv ${userPokemonForBattle.level})`, 
                    value: `${generateHpBar(Math.max(0, battleResult.userRemainingHp), userPokemonForBattle.hp)}\n` +
                               `⚔️ ATK: ${userPokemonForBattle.attack} | 🛡️ DEF: ${userPokemonForBattle.defense}\n` +
                               `✨ SP.ATK: ${userPokemonForBattle.special_attack} | 💎 SP.DEF: ${userPokemonForBattle.special_defense}\n` +
                               `💨 SPD: ${userPokemonForBattle.speed}`,
                    inline: false 
                },
                { 
                    name: `[👹 Boss] ${bossPokemonForBattle.name} (Lv ${bossPokemonForBattle.level})`, 
                    value: `${generateHpBar(Math.max(0, battleResult.bossRemainingHp), bossPokemonForBattle.hp)}\n` +
                               `⚔️ ATK: ${bossPokemonForBattle.attack} | 🛡️ DEF: ${bossPokemonForBattle.defense}\n` +
                               `✨ SP.ATK: ${bossPokemonForBattle.special_attack} | 💎 SP.DEF: ${bossPokemonForBattle.special_defense}\n` +
                               `💨 SPD: ${bossPokemonForBattle.speed}`,
                    inline: false 
                },
                { name: 'Kết Quả', value: battleResult.userWin ? '✅ **CHIẾN THẮNG!**' : '❌ **THẤT BẠI!**', inline: false },
                { name: 'Phần Thưởng', value: rewardMessage, inline: false }
            )
            .setThumbnail(userPokemonRaw.pokemon_image_url || 'https://placehold.co/100x100/000000/FFFFFF?text=Pokemon')
            .setImage(bossPokedexData.official_artwork_url || 'https://placehold.co/200x200/FF0000/FFFFFF?text=Boss')
            .setFooter({ text: `Thời gian: ${new Date().toLocaleString('vi-VN')}` })
            .setTimestamp();
        
        if (battleResult.events && battleResult.events.length > 0) {
            let battleLogText = formatBattleEvents(battleResult.events).join('\n');
            if (battleLogText.length > 1009) { 
                battleLogText = battleLogText.substring(0, 1009) + '...';
                logger.warn('[BOSS_DUNGEON_WARN]', `Log trận đấu quá dài (${battleLogText.length} ký tự), đã cắt bớt.`);
            }
            resultEmbed.addFields({ name: 'Diễn biến trận đấu', value: `\`\`\`diff\n${battleLogText}\n\`\`\``, inline: false });
        }

        await message.channel.send({ embeds: [resultEmbed] });
        logger.pokemon('[BOSS_DUNGEON]', `Đã gửi embed kết quả phó bản boss cho người dùng ${userDisplayName} (${userId}).`);

    } catch (error) {
        logger.error(`[BOSS_DUNGEON_ERROR]`, `Lỗi khi xử lý lệnh boss cho người dùng ${userId}:`, error); // Thay thế console.error
        return message.channel.send({
            content: `<@${userId}> Đã xảy ra lỗi khi tham gia phó bản boss: **${error.message}**`,
            flags: MessageFlags.Ephemeral 
        });
    }
}

module.exports = {
    handleBossDungeon,
};