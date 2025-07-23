// commands/nickname.js
const { EmbedBuilder } = require('discord.js');

const CURRENCY_NAME = 'PokeCoin'; // Đơn vị tiền tệ của bạn
const NICKNAME_COST = 100000; // Chi phí để đổi nickname (50 PokéCoin)

module.exports = {
    name: 'nickname',
    description: `Đổi nickname cho Pokémon của bạn với ${NICKNAME_COST} ${CURRENCY_NAME}.`,
    aliases: ['nick'],
    usage: '<pokemon_id> <new_nickname>',
    cooldown: 5, // 5 giây cooldown

    async execute(message, args, client, db) {
        const userId = message.author.id;

        if (args.length < 2) {
            return message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của Pokémon và nickname mới. Ví dụ: \`${client.config.PREFIX}nickname 123 Pikachu-kun\``,
                ephemeral: true
            });
        }

        const pokemonId = parseInt(args[0]);
        const newNickname = args.slice(1).join(' ').trim();
        
        if (newNickname.length > 25) {
            return message.channel.send({
                content: `<@${userId}> Nickname quá dài! Vui lòng nhập nickname dưới 25 ký tự.`,
                ephemeral: true
            });
        }
        if (newNickname.length < 1) {
             return message.channel.send({
                content: `<@${userId}> Nickname mới không được để trống!`,
                ephemeral: true
            });
        }

        if (isNaN(pokemonId) || pokemonId <= 0) {
            return message.channel.send({
                content: `<@${userId}> ID Pokémon không hợp lệ. Vui lòng nhập một số ID dương.`,
                ephemeral: true
            });
        }

        // Khai báo biến `oldNickname` ở phạm vi rộng hơn để có thể sử dụng sau transaction
        let oldNickname = null; 

        try {
            await db.transaction(async trx => {
                // 1. Kiểm tra số dư PokéCoin của người dùng
                const user = await trx('users')
                    .where('discord_id', userId)
                    .select('pokecoins')
                    .first();

                if (!user || user.pokecoins < NICKNAME_COST) {
                    throw new Error(`Bạn không đủ ${CURRENCY_NAME} để đổi nickname. Bạn cần ${NICKNAME_COST} ${CURRENCY_NAME}. Bạn hiện có: ${user ? user.pokecoins : 0} ${CURRENCY_NAME}.`);
                }

                // 2. Tìm Pokémon theo ID và đảm bảo nó thuộc về người dùng
                const pokemonFound = await trx('user_pokemons')
                    .where('id', pokemonId)
                    .andWhere('user_discord_id', userId)
                    .select('nickname') // Chỉ cần lấy nickname cũ ở đây
                    .first();

                if (!pokemonFound) {
                    throw new Error(`Không tìm thấy Pokémon với ID **${pokemonId}** trong kho của bạn.`);
                }
                
                // Gán nickname cũ vào biến đã khai báo ngoài transaction
                oldNickname = pokemonFound.nickname;

                // Tránh đổi nickname trùng với nickname hiện tại
                if (oldNickname === newNickname) {
                    throw new Error(`Nickname mới **${newNickname}** giống với nickname hiện tại của Pokémon này.`);
                }

                // 3. Trừ PokéCoin của người dùng
                const updatedRows = await trx('users')
                    .where('discord_id', userId)
                    .decrement('pokecoins', NICKNAME_COST);

                if (updatedRows === 0) {
                    throw new Error('Không thể trừ tiền của bạn. Vui lòng thử lại.');
                }

                // 4. Cập nhật nickname của Pokémon
                const updatedPokemonRows = await trx('user_pokemons')
                    .where('id', pokemonId)
                    .andWhere('user_discord_id', userId)
                    .update({
                        nickname: newNickname,
                        updated_at: db.fn.now()
                    });

                if (updatedPokemonRows === 0) {
                    throw new Error('Không thể cập nhật nickname cho Pokémon. Vui lòng thử lại.');
                }
            });

            // Nếu đến đây nghĩa là transaction thành công.
            // Bây giờ, lấy lại thông tin cần thiết để tạo embed.
            const userAfterUpdate = await db('users').where('discord_id', userId).select('pokecoins').first();
            const newBalance = userAfterUpdate ? userAfterUpdate.pokecoins : 0;

            // Lấy thông tin Pokémon đã được cập nhật
            const updatedPokemonData = await db('user_pokemons')
                .where('id', pokemonId)
                .andWhere('user_discord_id', userId)
                .select('nickname', 'pokedex_id')
                .first();

            if (!updatedPokemonData) { // Kiểm tra lại đề phòng trường hợp lỗi không mong muốn
                throw new Error('Không thể lấy thông tin Pokémon sau khi cập nhật.');
            }

            // Lấy tên gốc của Pokémon để hiển thị trong embed
            const originalPokemonInfoForEmbed = await db('pokemons')
                .where('pokedex_id', updatedPokemonData.pokedex_id)
                .select('name')
                .first();
            const originalPokemonNameForEmbed = originalPokemonInfoForEmbed ? originalPokemonInfoForEmbed.name : 'Unknown Pokémon';

            const embed = new EmbedBuilder()
                .setColor('#00FF7F') // Màu xanh mint cho thành công
                .setTitle('✏️ Đổi Nickname Thành Công!')
                .setDescription(`Pokémon của bạn (ID: **${pokemonId}**, **${originalPokemonNameForEmbed}**) đã được đổi nickname!`)
                .addFields(
                    { name: 'Nickname Cũ', value: oldNickname || '*Chưa có*', inline: true }, // Sử dụng oldNickname đã lưu
                    { name: 'Nickname Mới', value: `**${newNickname}**`, inline: true },
                    { name: 'Chi Phí', value: `${NICKNAME_COST} ${CURRENCY_NAME}`, inline: true },
                    { name: 'Số Dư Mới', value: `${newBalance} ${CURRENCY_NAME}`, inline: false }
                )
                .setFooter({ text: `Yêu cầu bởi ${message.author.displayName}` })
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error(`[NICKNAME_COMMAND_ERROR] Lỗi khi đổi nickname cho người dùng ${userId}:`, error);
            return message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi đổi nickname: **${error.message}**`,
                ephemeral: true
            });
        }
    },
};