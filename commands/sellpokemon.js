// commands/sellpokemon.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isChannelAllowed } = require('../utils/core/channelUtils'); // Import hàm kiểm tra kênh

const MARKETPLACE_FEE_PERCENTAGE = 0.10;

module.exports = {
    name: 'sellpokemon',
    description: 'Đăng bán một Pokémon của bạn lên thị trường.',
    aliases: ['sp'],
    usage: '<pokemon_id> <price> [description]',
    cooldown: 10,

    async execute(message, args, client) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX;
        const guildId = message.guild.id;
        const channelId = message.channel.id;

        // KIỂM TRA KÊNH ĐƯỢC PHÉP
        const allowed = await isChannelAllowed(guildId, channelId, 'market');
        if (!allowed) {
            await message.channel.send({
                content: `<@${userId}> Lệnh \`sellpokemon\` chỉ có thể được sử dụng trong các kênh thị trường đã được thiết lập bởi quản trị viên.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (args.length < 2) {
            await message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID Pokémon và giá bán. Cách dùng: \`${prefix}sellpokemon <pokemon_id> <price> [description]\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const pokemonIdToSell = parseInt(args[0]);
        const price = parseInt(args[1]);
        const description = args.slice(2).join(' ');

        if (isNaN(pokemonIdToSell) || pokemonIdToSell <= 0) {
            await message.channel.send({
                content: `<@${userId}> ID Pokémon không hợp lệ. Vui lòng cung cấp một số nguyên dương.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (isNaN(price) || price <= 0) {
            await message.channel.send({
                content: `<@${userId}> Giá bán không hợp lệ. Vui lòng cung cấp một số nguyên dương lớn hơn 0.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            const userPokemon = await db('user_pokemons')
                .where({ id: pokemonIdToSell, user_discord_id: userId })
                .first();

            if (!userPokemon) {
                await message.channel.send({
                    content: `<@${userId}> Bạn không sở hữu Pokémon với ID này, hoặc ID không tồn tại.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (userPokemon.is_on_marketplace) {
                await message.channel.send({
                    content: `<@${userId}> Pokémon **${userPokemon.nickname || userPokemon.pokemon_name} (ID: ${userPokemon.id})** đã được đăng bán trên thị trường rồi!`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (userPokemon.training_start_time) {
                await message.channel.send({
                    content: `<@${userId}> Pokémon **${userPokemon.nickname || userPokemon.pokemon_name} (ID: ${userPokemon.id})** hiện đang được huấn luyện và không thể bán. Vui lòng nhận lại bằng \`${prefix}collecttrain\` trước.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const [listing] = await db('marketplace_listings').insert({
                seller_discord_id: userId,
                item_type: 'pokemon',
                item_reference_id: pokemonIdToSell,
                quantity: 1,
                price: price,
                description: description || null,
                status: 'active',
                listed_at: new Date(),
                listing_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }).returning('*');

            await db('user_pokemons')
                .where({ id: pokemonIdToSell })
                .update({
                    is_on_marketplace: true,
                    marketplace_listing_id: listing.listing_id,
                    updated_at: new Date()
                });

            const pokemonData = await db('pokemons').where({ pokedex_id: userPokemon.pokedex_id }).first();

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎉 Đăng bán Pokémon thành công!')
                .setDescription(`Pokémon **${userPokemon.nickname || pokemonData.name} (ID: ${userPokemon.id})** đã được đăng bán trên thị trường với giá **${price} Pokecoin**.\n` +
                                `Mã đăng bán của bạn là: \`${listing.listing_id}\``)
                .addFields(
                    { name: 'Pokémon', value: `${userPokemon.nickname || pokemonData.name} (Lv.${userPokemon.level})`, inline: true },
                    { name: 'Giá', value: `${price} Pokecoin`, inline: true },
                    { name: 'Mô tả', value: description || 'Không có', inline: false }
                )
                .setThumbnail(pokemonData.official_artwork_url)
                .setFooter({ text: `Phí giao dịch khi bán thành công/rút lại là ${MARKETPLACE_FEE_PERCENTAGE * 100}% giá trị.` });

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[SELL_POKEMON_COMMAND_ERROR] Lỗi khi đăng bán Pokémon:', error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi đăng bán Pokémon của bạn. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};