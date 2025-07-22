// commands/sell.js
const { EmbedBuilder } = require('discord.js');

const CURRENCY_NAME = 'PokeCoin'; // Đơn vị tiền tệ của bạn
const BASE_SELL_PRICE = 500; // Giá cơ bản khi bán một Pokémon cho bot

module.exports = {
    name: 'sell',
    description: `Bán một Pokémon từ kho của bạn cho bot để nhận ${BASE_SELL_PRICE} ${CURRENCY_NAME}.`,
    aliases: ['bán'],
    usage: '<pokemon_id>',
    cooldown: 10, // Cooldown 10 giây để tránh spam hoặc bán nhầm liên tục

    async execute(message, args, client, db) {
        const userId = message.author.id;

        if (args.length === 0) {
            return message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của Pokémon bạn muốn bán. Ví dụ: \`${client.config.PREFIX}sell 123\``,
                ephemeral: true
            });
        }

        const pokemonId = parseInt(args[0]);

        if (isNaN(pokemonId) || pokemonId <= 0) {
            return message.channel.send({
                content: `<@${userId}> ID Pokémon không hợp lệ. Vui lòng nhập một số ID dương.`,
                ephemeral: true
            });
        }

        try {
            // Khởi tạo transaction để đảm bảo tính toàn vẹn dữ liệu
            // (Nếu xóa Pokémon thành công mà cộng tiền thất bại, hoặc ngược lại)
            await db.transaction(async trx => {
                // 1. Tìm Pokémon theo ID và đảm bảo nó thuộc về người dùng
                const pokemonToSell = await trx('user_pokemons')
                    .where('id', pokemonId)
                    .andWhere('user_discord_id', userId)
                    .select('nickname', 'pokedex_id', 'is_on_marketplace')
                    .first();

                if (!pokemonToSell) {
                    throw new Error(`Không tìm thấy Pokémon với ID **${pokemonId}** trong kho của bạn.`);
                }
                
                // Kiểm tra nếu Pokémon đang trên marketplace
                if (pokemonToSell.is_on_marketplace) {
                    throw new Error(`Pokémon **${pokemonToSell.nickname || 'ID: ' + pokemonId}** hiện đang được rao bán trên Marketplace. Vui lòng gỡ nó xuống trước khi bán!`);
                }

                // Lấy tên gốc của Pokémon để hiển thị trong thông báo
                const originalPokemonInfo = await trx('pokemons')
                    .where('pokedex_id', pokemonToSell.pokedex_id)
                    .select('name')
                    .first();
                const originalPokemonName = originalPokemonInfo ? originalPokemonInfo.name : 'Unknown Pokémon';

                // 2. Xóa Pokémon khỏi bảng user_pokemons
                const deletedRows = await trx('user_pokemons')
                    .where('id', pokemonId)
                    .andWhere('user_discord_id', userId)
                    .del(); // `del()` là hàm xóa trong Knex

                if (deletedRows === 0) {
                    // Mặc dù đã kiểm tra ở trên, nhưng đây là một lớp bảo vệ nữa
                    throw new Error('Không thể xóa Pokémon. Vui lòng thử lại.');
                }

                // 3. Cộng tiền cho người dùng
                const updatedUserRows = await trx('users')
                    .where('discord_id', userId)
                    .increment('pokecoins', BASE_SELL_PRICE);

                if (updatedUserRows === 0) {
                    // Lỗi nếu không tìm thấy người dùng (mặc dù đã kiểm tra registered trước đó)
                    throw new Error('Không thể cập nhật số dư của bạn. Vui lòng thử lại.');
                }

                // Lưu lại số dư mới để hiển thị trong embed
                const userAfterSell = await trx('users')
                    .where('discord_id', userId)
                    .select('pokecoins')
                    .first();
                const newBalance = userAfterSell ? userAfterSell.pokecoins : 0;

                // Chuẩn bị thông tin Pokémon đã bán cho embed
                const pokemonNameForEmbed = pokemonToSell.nickname ? 
                    `${pokemonToSell.nickname} (**${originalPokemonName}**)` : 
                    `**${originalPokemonName}** (ID: ${pokemonId})`;

                // Giao dịch thành công, gửi embed thông báo
                const embed = new EmbedBuilder()
                    .setColor('#00FFFF') // Màu xanh cyan
                    .setTitle('💸 Pokémon Đã Bán!')
                    .setDescription(`Bạn đã bán thành công Pokémon: ${pokemonNameForEmbed}.`)
                    .addFields(
                        { name: 'Giá Bán', value: `${BASE_SELL_PRICE} ${CURRENCY_NAME}`, inline: true },
                        { name: 'Số Dư Mới', value: `${newBalance} ${CURRENCY_NAME}`, inline: true }
                    )
                    .setFooter({ text: `Yêu cầu bởi ${message.author.displayName}` })
                    .setTimestamp();
                
                message.channel.send({ embeds: [embed] });
            });

        } catch (error) {
            console.error(`[SELL_COMMAND_ERROR] Lỗi khi bán Pokémon cho người dùng ${userId}:`, error);
            // Gửi tin nhắn lỗi riêng tư
            return message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi bán Pokémon: **${error.message}**`,
                ephemeral: true
            });
        }
    },
};