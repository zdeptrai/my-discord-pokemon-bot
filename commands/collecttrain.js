// commands/collecttrain.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isUserRegistered } = require('../utils/core/userUtils');
const { getPokemonName } = require('../utils/core/pokemonUtils');
const {
    MAX_TRAINING_HOURS_PER_COLLECT,
    calculateExpToNextLevel,
    calculateTrainingExpGained,
    checkAndLevelUpPokemon
} = require('../utils/core/pokemonLevelingUtils');

const POKECOINS_PER_MINUTE_TRAINING = 50;

module.exports = {
    name: 'collecttrain',
    description: 'Nhận lại Pokémon đang huấn luyện và thu thập kinh nghiệm.',
    aliases: ['ctrain', 'ct', 'gettrain'],
    usage: '',
    cooldown: 10,

    async execute(message, args, client) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX;

        try {
            const registered = await isUserRegistered(userId);
            if (!registered) {
                await message.channel.send({
                    content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${prefix}start\` để đăng ký và bắt đầu.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const trainingPokemon = await db('user_pokemons')
                .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
                .where({ 'user_pokemons.user_discord_id': userId })
                .whereNotNull('user_pokemons.training_start_time')
                .select(
                    'user_pokemons.*',
                    'pokemons.name as pokemon_name',
                    'pokemons.hp as base_hp',
                    'pokemons.attack as base_attack',
                    'pokemons.defense as base_defense',
                    'pokemons.special_attack as base_special_attack',
                    'pokemons.special_defense as base_special_defense',
                    'pokemons.speed as base_speed'
                )
                .first();

            if (!trainingPokemon) {
                await message.channel.send({
                    content: `<@${userId}> Không có Pokémon nào của bạn đang được huấn luyện. Sử dụng \`${prefix}train\` để gửi Pokémon đi huấn luyện.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Đảm bảo tất cả các chỉ số base và IVs là số hợp lệ
            // Nếu bất kỳ giá trị nào là null/undefined từ DB, đặt chúng về 0 để tránh NaN
            trainingPokemon.base_hp = Number(trainingPokemon.base_hp) || 0;
            trainingPokemon.base_attack = Number(trainingPokemon.base_attack) || 0;
            trainingPokemon.base_defense = Number(trainingPokemon.base_defense) || 0;
            trainingPokemon.base_special_attack = Number(trainingPokemon.base_special_attack) || 0;
            trainingPokemon.base_special_defense = Number(trainingPokemon.base_special_defense) || 0;
            trainingPokemon.base_speed = Number(trainingPokemon.base_speed) || 0;

            trainingPokemon.hp_iv = Number(trainingPokemon.hp_iv) || 0;
            trainingPokemon.attack_iv = Number(trainingPokemon.attack_iv) || 0;
            trainingPokemon.defense_iv = Number(trainingPokemon.defense_iv) || 0;
            trainingPokemon.special_attack_iv = Number(trainingPokemon.special_attack_iv) || 0;
            trainingPokemon.special_defense_iv = Number(trainingPokemon.special_defense_iv) || 0;
            trainingPokemon.speed_iv = Number(trainingPokemon.speed_iv) || 0;

            trainingPokemon.level = Number(trainingPokemon.level) || 1;
            trainingPokemon.experience = Number(trainingPokemon.experience) || 0;

            const pokemonDisplayName = trainingPokemon.nickname ?
                `${trainingPokemon.nickname} (${await getPokemonName(db, trainingPokemon.pokedex_id, trainingPokemon.is_mega_evolved)})` :
                await getPokemonName(db, trainingPokemon.pokedex_id, trainingPokemon.is_mega_evolved);

            const startTime = new Date(trainingPokemon.training_start_time);
            const now = new Date();
            const durationMs = now.getTime() - startTime.getTime();
            let durationMinutes = Math.floor(durationMs / (1000 * 60));

            const maxDurationMinutes = MAX_TRAINING_HOURS_PER_COLLECT * 60;
            if (durationMinutes > maxDurationMinutes) {
                durationMinutes = maxDurationMinutes;
            }

            const expGained = calculateTrainingExpGained(trainingPokemon.level, durationMinutes);

            let totalExperience = trainingPokemon.experience + expGained;
            let currentLevel = trainingPokemon.level;

            const { leveledUp, newLevel, newExperience, newStats, initialStats } =
                await checkAndLevelUpPokemon({ ...trainingPokemon, experience: totalExperience, level: currentLevel }, trainingPokemon);

            const pokecoinsGained = durationMinutes * POKECOINS_PER_MINUTE_TRAINING;

            await db.transaction(async trx => {
                await trx('user_pokemons')
                    .where({ id: trainingPokemon.id })
                    .update({
                        experience: newExperience,
                        level: newLevel,
                        max_hp: newStats.hp,
                        current_hp: newStats.current_hp,
                        attack: newStats.attack,
                        defense: newStats.defense,
                        special_attack: newStats.special_attack,
                        special_defense: newStats.special_defense,
                        speed: newStats.speed,
                        training_start_time: null,
                        updated_at: db.fn.now()
                    });

                const user = await trx('users').where({ discord_id: userId }).select('pokecoins').first();
                const currentPokecoins = user ? Number(user.pokecoins) : 0;
                const newPokecoins = currentPokecoins + pokecoinsGained;

                await trx('users')
                    .where({ discord_id: userId })
                    .update({
                        pokecoins: newPokecoins,
                        updated_at: db.fn.now()
                    });

                console.log(`[COLLECT_TRAIN] Người dùng ${userId} đã nhận ${pokecoinsGained} Pokecoin từ huấn luyện. Số dư mới: ${newPokecoins}`);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🎉 ${pokemonDisplayName} đã hoàn thành huấn luyện!`)
                    .setDescription(`**${pokemonDisplayName}** của bạn đã trở lại và đã thu thập được kinh nghiệm!`)
                    .addFields(
                        { name: 'Thời gian huấn luyện', value: `${durationMinutes} phút`, inline: true },
                        { name: 'EXP nhận được', value: `${expGained} EXP`, inline: true },
                        { name: 'Tổng EXP hiện tại', value: `${newExperience} EXP`, inline: true },
                        { name: 'Cấp độ hiện tại', value: `Lv. ${newLevel}`, inline: true },
                        { name: '🎉 Pokecoin nhận được', value: `${pokecoinsGained} Pokecoin`, inline: true },
                        { name: 'Số Pokecoin hiện tại', value: `${newPokecoins} Pokecoin`, inline: true }
                    )
                    .setThumbnail(trainingPokemon.image_url);

                if (leveledUp) {
                    embed.addFields(
                        { name: 'Lên cấp!', value: `**${pokemonDisplayName}** đã lên cấp từ Lv.${trainingPokemon.level} lên Lv.${newLevel}!`, inline: false },
                        { name: 'Chỉ số tăng', value: `HP: ${initialStats.hp} -> ${newStats.hp}\nAttack: ${initialStats.attack} -> ${newStats.attack}\nDefense: ${initialStats.defense} -> ${newStats.defense}\nSp. Atk: ${initialStats.special_attack} -> ${newStats.special_attack}\nSp. Def: ${initialStats.special_defense} -> ${newStats.special_defense}\nSpeed: ${initialStats.speed} -> ${newStats.speed}`, inline: false }
                    );
                }

                await message.channel.send({ embeds: [embed] });

            });

        } catch (error) {
            console.error('[COLLECT_TRAIN_COMMAND_ERROR] Lỗi không mong muốn khi thực hiện lệnh collecttrain:', error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi nhận lại Pokémon. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};