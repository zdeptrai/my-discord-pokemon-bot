// commands/buymarket.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
// const { deleteMessageWithTimeout } = require('../utils/commonUtils'); // KHÔNG CẦN NỮA VÌ DÙNG EPHEMERAL

const MARKETPLACE_FEE_PERCENTAGE = 0.10; // Phí 10%

module.exports = {
    name: 'buymarket',
    description: 'Mua một Pokémon hoặc vật phẩm từ thị trường.',
    aliases: ['bm', 'buymk'],
    usage: '<listing_id>',
    cooldown: 5,

    async execute(message, args, client) {
        const buyerId = message.author.id;
        const prefix = client.config.PREFIX;

        if (args.length < 1) {
            await message.channel.send({
                content: `<@${buyerId}> Vui lòng cung cấp ID của lượt đăng bán bạn muốn mua. Cách dùng: \`${prefix}buymarket <listing_id>\``,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send buymarket usage message:", e));
            return;
        }

        const listingId = parseInt(args[0]);

        if (isNaN(listingId) || listingId <= 0) {
            await message.channel.send({
                content: `<@${buyerId}> ID lượt đăng bán không hợp lệ. Vui lòng cung cấp một số nguyên dương.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send invalid listing ID message:", e));
            return;
        }

        try {
            // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
            await db.transaction(async trx => {
                const listing = await trx('marketplace_listings')
                    .where({ listing_id: listingId, status: 'active' })
                    .first();

                if (!listing) {
                    await message.channel.send({
                        content: `<@${buyerId}> Không tìm thấy lượt đăng bán với ID \`${listingId}\` hoặc nó đã bị bán/hủy.`,
                        flags: MessageFlags.Ephemeral
                    }).catch(e => console.error("Could not send listing not found message:", e));
                    return;
                }

                if (listing.seller_discord_id === buyerId) {
                    await message.channel.send({
                        content: `<@${buyerId}> Bạn không thể mua listing của chính mình!`,
                        flags: MessageFlags.Ephemeral
                    }).catch(e => console.error("Could not send self-purchase message:", e));
                    return;
                }

                const buyerUser = await trx('users').where({ discord_id: buyerId }).first();
                if (!buyerUser || buyerUser.pokecoins < listing.price) {
                    await message.channel.send({
                        content: `<@${buyerId}> Bạn không đủ Pokecoin để mua vật phẩm này. Bạn cần ${listing.price} Pokecoin.`,
                        flags: MessageFlags.Ephemeral
                    }).catch(e => console.error("Could not send insufficient coins message:", e));
                    return;
                }

                // Xử lý dựa trên loại listing
                let itemDisplayName;
                let embedColor;

                if (listing.item_type === 'pokemon') {
                    // ĐÃ SỬA: JOIN với bảng 'pokemons' để lấy tên cơ bản của Pokémon
                    const pokemon = await trx('user_pokemons')
                        .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
                        .where('user_pokemons.id', listing.item_reference_id)
                        .andWhere('user_pokemons.user_discord_id', listing.seller_discord_id)
                        .select('user_pokemons.*', 'pokemons.name as pokemon_base_name') // Lấy tên cơ bản
                        .first();

                    if (!pokemon) {
                        await message.channel.send({
                            content: `<@${buyerId}> Pokémon này không còn thuộc sở hữu của người bán. Listing đã bị lỗi.`,
                            flags: MessageFlags.Ephemeral
                        }).catch(e => console.error("Could not send pokemon not owned message:", e));
                        // Đánh dấu listing là đã hủy nếu Pokémon không còn thuộc về người bán
                        await trx('marketplace_listings')
                            .where({ listing_id: listingId })
                            .update({ status: 'cancelled', updated_at: new Date() });
                        return;
                    }

                    // Chuyển quyền sở hữu Pokémon
                    await trx('user_pokemons')
                        .where({ id: listing.item_reference_id })
                        .update({ user_discord_id: buyerId, updated_at: new Date() });

                    // ĐẢM BẢO itemDisplayName LUÔN LÀ CHUỖI
                    itemDisplayName = (pokemon.nickname || pokemon.pokemon_base_name || 'Pokémon không xác định').toString();
                    embedColor = 0xFFD700; // Màu vàng cho Pokémon
                } else if (listing.item_type === 'item') {
                    const item = await trx('user_inventory_items')
                        .where({ user_discord_id: listing.seller_discord_id, item_id: listing.item_reference_id })
                        .first();

                    if (!item || item.quantity < listing.quantity) {
                        await message.channel.send({
                            content: `<@${buyerId}> Vật phẩm này không còn đủ số lượng của người bán. Listing đã bị lỗi.`,
                            flags: MessageFlags.Ephemeral
                        }).catch(e => console.error("Could not send item not enough message:", e));
                        // Đánh dấu listing là đã hủy nếu vật phẩm không còn đủ
                        await trx('marketplace_listings')
                            .where({ listing_id: listingId })
                            .update({ status: 'cancelled', updated_at: new Date() });
                        return;
                    }

                    // Trừ số lượng vật phẩm của người bán
                    await trx('user_inventory_items')
                        .where({ user_discord_id: listing.seller_discord_id, item_id: listing.item_reference_id })
                        .decrement('quantity', listing.quantity);

                    // Cộng vật phẩm cho người mua
                    const buyerItem = await trx('user_inventory_items')
                        .where({ user_discord_id: buyerId, item_id: listing.item_reference_id })
                        .first();

                    if (buyerItem) {
                        await trx('user_inventory_items')
                            .where({ user_discord_id: buyerId, item_id: listing.item_reference_id })
                            .increment('quantity', listing.quantity);
                    } else {
                        await trx('user_inventory_items').insert({
                            user_discord_id: buyerId,
                            item_id: listing.item_reference_id,
                            quantity: listing.quantity,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }

                    const itemData = await trx('items').where({ item_id: listing.item_reference_id }).first();
                    // ĐẢM BẢO itemDisplayName LUÔN LÀ CHUỖI
                    itemDisplayName = (itemData ? itemData.name : 'Vật phẩm không xác định').toString();
                    embedColor = 0x8A2BE2; // Màu tím cho vật phẩm
                } else {
                    console.error(`[BUYMARKET_ERROR] Listing ID ${listingId} có loại không hợp lệ: ${listing.item_type}`);
                    await message.channel.send({
                        content: `<@${buyerId}> Loại listing không hợp lệ. Vui lòng kiểm tra ID listing.`,
                        flags: MessageFlags.Ephemeral
                    }).catch(e => console.error("Could not send invalid listing type message:", e));
                    return;
                }

                // Cập nhật trạng thái listing
                await trx('marketplace_listings')
                    .where({ listing_id: listingId })
                    .update({
                        status: 'sold',
                        buyer_discord_id: buyerId,
                        sold_at: new Date(),
                        updated_at: new Date()
                    });

                // Trừ Pokecoin của người mua
                await trx('users')
                    .where({ discord_id: buyerId })
                    .decrement('pokecoins', listing.price);

                // Cộng Pokecoin cho người bán (sau khi trừ phí)
                const sellerPayout = Math.floor(listing.price * (1 - MARKETPLACE_FEE_PERCENTAGE));
                await trx('users')
                    .where({ discord_id: listing.seller_discord_id })
                    .increment('pokecoins', sellerPayout);

                // Gửi tin nhắn xác nhận cho người mua (không cần ephemeral, muốn hiện công khai)
                const buyerEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🎉 Mua hàng thành công!')
                    .setDescription(`Bạn đã mua thành công **${itemDisplayName}** với giá **${listing.price} Pokecoin**!`)
                    .addFields(
                        { name: 'Vật phẩm', value: itemDisplayName, inline: true },
                        { name: 'Giá đã trả', value: `${listing.price} Pokecoin`, inline: true },
                        { name: 'Mã Listing', value: `\`${listingId}\``, inline: false }
                    )
                    .setTimestamp();
                await message.channel.send({ embeds: [buyerEmbed] });

                // Gửi DM cho người bán
                try {
                    const sellerUser = await trx('users').where({ discord_id: listing.seller_discord_id }).first();
                    // Tính toán lại số dư của người bán sau khi nhận tiền (để hiển thị trong DM)
                    // LƯU Ý: sellerUser.pokecoins ở đây là số dư TRƯỚC khi increment.
                    // Để có số dư MỚI NHẤT, bạn cần fetch lại hoặc tính toán dựa trên số dư cũ + payout.
                    // Cách tốt nhất là fetch lại sau khi transaction đã commit hoặc dùng một giá trị ước tính.
                    // Vì đây là trong transaction, chúng ta có thể dùng giá trị đã được increment.
                    // Tuy nhiên, để đảm bảo an toàn, tôi sẽ tính toán lại dựa trên giá trị cũ + payout.
                    const currentSellerCoins = sellerUser.pokecoins + sellerPayout; 
                    
                    const sellerDMChannel = await client.users.fetch(listing.seller_discord_id);
                    const sellerEmbed = new EmbedBuilder()
                        .setColor(0x00FF00) // Màu xanh lá cây cho DM thành công
                        .setTitle('💰 Listing của bạn đã được bán!')
                        .setDescription(`Listing **${itemDisplayName}** (Mã: \`${listingId}\`) của bạn đã được bán cho <@${buyerId}> với giá **${listing.price} Pokecoin**.\nBạn nhận được **${sellerPayout} Pokecoin**.`);
                    sellerEmbed.addFields(
                        { name: 'Vật phẩm', value: itemDisplayName, inline: true },
                        { name: 'Giá bán', value: `${listing.price} Pokecoin`, inline: true },
                        { name: 'Phí Marketplace (10%)', value: `${listing.price - sellerPayout} Pokecoin`, inline: true },
                        { name: 'Bạn đã nhận', value: `${sellerPayout} Pokecoin`, inline: true },
                        { name: 'Số Pokecoin hiện tại', value: `${currentSellerCoins} Pokecoin`, inline: false } // SỬ DỤNG currentSellerCoins
                    );
                    await sellerDMChannel.send({ embeds: [sellerEmbed] });
                } catch (dmError) {
                    console.error(`[BUYMARKET_DM_ERROR] Không thể gửi DM cho người bán ${listing.seller_discord_id}:`, dmError);
                    await message.channel.send({
                        content: `<@${buyerId}> (Không thể gửi thông báo DM cho người bán <@${listing.seller_discord_id}>.)`,
                        flags: MessageFlags.Ephemeral
                    }).catch(e => console.error("Could not send DM error message:", e));
                }
            }); // Kết thúc transaction

        } catch (error) {
            console.error('[BUYMARKET_COMMAND_ERROR] Lỗi khi mua vật phẩm từ thị trường:', error);
            await message.channel.send({
                content: `<@${buyerId}> Đã có lỗi xảy ra khi mua vật phẩm này. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send generic buymarket error message:", e));
        }
    },
};
