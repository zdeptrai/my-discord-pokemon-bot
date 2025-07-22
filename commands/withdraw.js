// commands/withdraw.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isChannelAllowed } = require('../utils/core/channelUtils'); // Import hàm kiểm tra kênh

const MARKETPLACE_FEE_PERCENTAGE = 0.10;

module.exports = {
    name: 'withdraw',
    description: 'Rút lại Pokémon hoặc vật phẩm bạn đã đăng bán trên thị trường.',
    aliases: ['wd', 'cancelmk'],
    usage: '<listing_id>',
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
                content: `<@${userId}> Lệnh \`withdraw\` chỉ có thể được sử dụng trong các kênh thị trường đã được thiết lập bởi quản trị viên.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (args.length < 1) {
            await message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của lượt đăng bán bạn muốn rút lại. Cách dùng: \`${prefix}withdraw <listing_id>\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const listingId = parseInt(args[0]);

        if (isNaN(listingId) || listingId <= 0) {
            await message.channel.send({
                content: `<@${userId}> ID lượt đăng bán không hợp lệ. Vui lòng cung cấp một số nguyên dương.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            const listing = await db('marketplace_listings')
                .where({ listing_id: listingId })
                .first();

            if (!listing) {
                await message.channel.send({
                    content: `<@${userId}> Không tìm thấy lượt đăng bán nào với ID \`${listingId}\`.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (listing.seller_discord_id !== userId) {
                await message.channel.send({
                    content: `<@${userId}> Bạn không phải là người bán của lượt đăng bán này.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (listing.status !== 'active') {
                await message.channel.send({
                    content: `<@${userId}> Lượt đăng bán ID \`${listingId}\` hiện không ở trạng thái "active" (có thể đã bán hoặc đã rút).`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const sellerUser = await db('users').where({ discord_id: userId }).first();
            if (!sellerUser) {
                await message.channel.send({
                    content: `<@${userId}> Không tìm thấy thông tin người dùng của bạn. Vui lòng thử lại sau.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const feeAmount = Math.ceil(listing.price * MARKETPLACE_FEE_PERCENTAGE);

            if (sellerUser.pokecoins < feeAmount) {
                await message.channel.send({
                    content: `<@${userId}> Bạn không đủ Pokecoin để rút lại vật phẩm này. Bạn cần ${feeAmount} Pokecoin (phí 10% giá trị listing). Bạn hiện có ${sellerUser.pokecoins} Pokecoin.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await db.transaction(async trx => {
                await trx('users')
                    .where({ discord_id: userId })
                    .decrement('pokecoins', feeAmount);

                let itemDisplayName = '';
                let embedColor = 0xFF0000;

                if (listing.item_type === 'pokemon') {
                    await trx('user_pokemons')
                        .where({ id: listing.item_reference_id })
                        .update({
                            is_on_marketplace: false,
                            marketplace_listing_id: null,
                            user_discord_id: userId,
                            updated_at: new Date()
                        });

                    const userPokemon = await db('user_pokemons').where({ id: listing.item_reference_id }).first();
                    const pokemonData = await db('pokemons').where({ pokedex_id: userPokemon.pokedex_id }).first();
                    itemDisplayName = `${userPokemon.nickname ? userPokemon.nickname + ' (' + pokemonData.name + ')' : pokemonData.name} (Lv.${userPokemon.level})`;
                } else if (listing.item_type === 'item') {
                    const existingItem = await trx('user_inventory_items')
                        .where({ user_discord_id: userId, item_id: listing.item_reference_id })
                        .first();

                    if (existingItem) {
                        await trx('user_inventory_items')
                            .where({ user_discord_id: userId, item_id: listing.item_reference_id })
                            .increment('quantity', listing.quantity);
                    } else {
                        await trx('user_inventory_items').insert({
                            user_discord_id: userId,
                            item_id: listing.item_reference_id,
                            quantity: listing.quantity,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }

                    const itemDetails = await db('items').where({ item_id: listing.item_reference_id }).first();
                    itemDisplayName = `${itemDetails.name} (x${listing.quantity})`;
                }

                await trx('marketplace_listings')
                    .where({ listing_id: listingId })
                    .update({
                        status: 'cancelled',
                        updated_at: new Date()
                    });

                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🗑️ Rút lại vật phẩm thành công!')
                    .setDescription(`Bạn đã rút lại **${itemDisplayName}** (Mã listing: \`${listingId}\`) từ thị trường.`)
                    .addFields(
                        { name: 'Vật phẩm đã rút', value: itemDisplayName, inline: true },
                        { name: 'Phí rút lại', value: `${feeAmount} Pokecoin`, inline: true },
                        { name: 'Số Pokecoin hiện tại', value: `${sellerUser.pokecoins - feeAmount} Pokecoin`, inline: false }
                    )
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
            });

        } catch (error) {
            console.error('[WITHDRAW_COMMAND_ERROR] Lỗi khi rút lại vật phẩm:', error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi rút lại vật phẩm của bạn. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};