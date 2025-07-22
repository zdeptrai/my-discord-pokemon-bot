// commands/train.js
const { EmbedBuilder, MessageFlags } = require('discord.js'); // Thêm MessageFlags
const { db } = require('../db');
const { isUserRegistered, getSelectedOrFirstPokemon, getUserPokemonByIdOrName } = require('../utils/core/userUtils');
// const { deleteMessageWithTimeout } = require('../utils/commonUtils'); // KHÔNG CẦN NỮA
const { getPokemonName } = require('../utils/core/pokemonUtils');

module.exports = {
    name: 'train',
    description: 'Gửi Pokémon của bạn đi huấn luyện để nhận kinh nghiệm theo thời gian.',
    aliases: ['t', 'sendtrain'],
    usage: '[tên_pokemon_hoặc_ID_của_bạn]',
    cooldown: 30,

    async execute(message, args, client) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX;

        try {
            // 1. Kiểm tra người dùng đã đăng ký chưa
            const registered = await isUserRegistered(userId);
            if (!registered) {
                // Sử dụng channel.send với ephemeral flag và tag người dùng
                await message.channel.send({
                    content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${prefix}start\` để đăng ký và bắt đầu.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // 2. Lấy Pokémon của người dùng (Pokémon muốn gửi đi huấn luyện)
            let userPokemon;
            const arg = args.join(' ').toLowerCase();

            if (arg) {
                userPokemon = await getUserPokemonByIdOrName(userId, arg);
            } else {
                userPokemon = await getSelectedOrFirstPokemon(userId);
            }

            if (!userPokemon) {
                // Sử dụng channel.send với ephemeral flag và tag người dùng
                await message.channel.send({
                    content: `<@${userId}> Không tìm thấy Pokémon nào với \`${arg}\` hoặc bạn chưa có Pokémon nào được chọn. Vui lòng sử dụng \`${prefix}mypokemons\` để xem kho Pokémon của bạn.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Lấy tên hiển thị của Pokémon
            const pokemonDisplayName = userPokemon.nickname ?
                `${userPokemon.nickname} (${await getPokemonName(db, userPokemon.pokedex_id, userPokemon.is_mega_evolved)})` :
                await getPokemonName(db, userPokemon.pokedex_id, userPokemon.is_mega_evolved);

            // --- KIỂM TRA MỚI: CHỈ MỘT POKÉMON ĐƯỢC HUẤN LUYỆN MỘT LÚC ---
            const currentlyTrainingPokemon = await db('user_pokemons')
                .where({ user_discord_id: userId })
                .whereNotNull('training_start_time')
                .first();

            if (currentlyTrainingPokemon) {
                if (currentlyTrainingPokemon.id === userPokemon.id) {
                    // Sử dụng channel.send với ephemeral flag và tag người dùng
                    await message.channel.send({
                        content: `<@${userId}> **${pokemonDisplayName}** của bạn hiện đang được huấn luyện! Sử dụng \`${prefix}collecttrain\` để nhận lại.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                } else {
                    const currentlyTrainingDisplayName = currentlyTrainingPokemon.nickname ?
                        `${currentlyTrainingPokemon.nickname} (${await getPokemonName(db, currentlyTrainingPokemon.pokedex_id, currentlyTrainingPokemon.is_mega_evolved)})` :
                        await getPokemonName(db, currentlyTrainingPokemon.pokedex_id, currentlyTrainingPokemon.is_mega_evolved);

                    // Sử dụng channel.send với ephemeral flag và tag người dùng
                    await message.channel.send({
                        content: `<@${userId}> Bạn chỉ có thể huấn luyện một Pokémon tại một thời điểm! **${currentlyTrainingDisplayName}** của bạn hiện đang được huấn luyện. Vui lòng dùng \`${prefix}collecttrain\` để nhận lại trước khi gửi Pokémon khác.`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }
            // --- KẾT THÚC KIỂM TRA ---

            // 4. Cập nhật trạng thái huấn luyện trong database
            await db('user_pokemons')
                .where({ id: userPokemon.id, user_discord_id: userId })
                .update({
                    training_start_time: db.fn.now(),
                    updated_at: db.fn.now()
                });

            // 5. Gửi thông báo thành công
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`✅ Huấn luyện bắt đầu!`)
                .setDescription(`**${pokemonDisplayName}** đã được gửi đi huấn luyện!`)
                .addFields(
                    { name: 'Thời gian bắt đầu', value: new Date().toLocaleString('vi-VN'), inline: true },
                    { name: 'Nhận EXP', value: 'Pokémon của bạn sẽ nhận EXP theo thời gian.', inline: false },
                    { name: 'Nhận Pokecoin', value: 'Pokémon của bạn sẽ nhận Pokecoin theo thời gian.', inline: false }
                )
                .setFooter({ text: `Sử dụng lệnh '${prefix}ctrain' để nhận lại Pokémon và thu thập EXP & Pokecoin.` })
                .setTimestamp();

            // Sử dụng channel.send (tin nhắn thành công không cần ephemeral)
            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[TRAIN_COMMAND_ERROR] Lỗi không mong muốn khi thực hiện lệnh train:', error);
            // Sử dụng channel.send với ephemeral flag và tag người dùng
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi gửi Pokémon đi huấn luyện. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};