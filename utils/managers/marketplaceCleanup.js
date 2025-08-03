// utils/managers/marketplaceCleanup.js
const { db } = require('../../db');
const { EmbedBuilder } = require('discord.js');

const MARKETPLACE_FEE_PERCENTAGE = 0.10; // Phí 10%
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Chạy mỗi 10 phút

let cleanupIntervalId = null;

async function cleanupExpiredListings(client) {
    console.log('[MARKETPLACE_CLEANUP] Bắt đầu kiểm tra các listing hết hạn...');
    const now = new Date();

    try {
        const expiredListings = await db('marketplace_listings')
            .where('status', 'active')
            .andWhere('listing_expires_at', '<=', now)
            .select('*');

        if (expiredListings.length === 0) {
            console.log('[MARKETPLACE_CLEANUP] Không có listing nào hết hạn.');
            return;
        }

        console.log(`[MARKETPLACE_CLEANUP] Tìm thấy ${expiredListings.length} listing hết hạn.`);

        for (const listing of expiredListings) {
            await db.transaction(async trx => {
                try {
                    const sellerId = listing.seller_discord_id;
                    const feeAmount = Math.ceil(listing.price * MARKETPLACE_FEE_PERCENTAGE);

                    // 1. Trừ phí từ người bán
                    await trx('users')
                        .where({ discord_id: sellerId })
                        .decrement('pokecoins', feeAmount);

                    const updatedSellerUser = await trx('users').where({ discord_id: sellerId }).first();
                    const updatedSellerCoins = updatedSellerUser ? updatedSellerUser.pokecoins : 0;

                    let itemDisplayName = '';
                    let returnSuccess = false;

                    // 2. Trả lại vật phẩm/Pokémon cho người bán bằng cách cập nhật trạng thái
                    if (listing.item_type === 'pokemon') {
                        const updatedCount = await trx('user_pokemons')
                            .where({ id: listing.item_reference_id })
                            .update({
                                is_on_marketplace: false,
                                marketplace_listing_id: null,
                                updated_at: new Date()
                            });
                        
                        if (updatedCount > 0) {
                            const userPokemon = await db('user_pokemons').where({ id: listing.item_reference_id }).first();
                            if (userPokemon) {
                                const pokemonData = await db('pokemons').where({ pokedex_id: userPokemon.pokedex_id }).first();
                                itemDisplayName = `${userPokemon.nickname || pokemonData.name} (Lv.${userPokemon.level})`;
                                returnSuccess = true;
                            }
                        }
                    } else if (listing.item_type === 'item') {
                        // Trả lại vật phẩm cho kho bằng cách tăng số lượng
                        const updatedCount = await trx('user_inventory_items')
                            .where({ user_discord_id: sellerId, item_id: listing.item_reference_id })
                            .increment('quantity', listing.quantity);
                        
                        if (updatedCount === 0) {
                            // Nếu không có item nào trong kho (vì đã bán hết), thì thêm mới
                            await trx('user_inventory_items').insert({
                                user_discord_id: sellerId,
                                item_id: listing.item_reference_id,
                                quantity: listing.quantity,
                                created_at: new Date(),
                                updated_at: new Date()
                            });
                        }
                        const itemDetails = await db('items').where({ item_id: listing.item_reference_id }).first();
                        if (itemDetails) {
                            itemDisplayName = `${itemDetails.name} (x${listing.quantity})`;
                            returnSuccess = true;
                        }
                    }

                    // 3. Xóa listing đã hết hạn
                    await trx('marketplace_listings')
                        .where({ listing_id: listing.listing_id })
                        .del();

                    // 4. Gửi DM thông báo cho người bán
                    if (returnSuccess) {
                        try {
                            const sellerDMChannel = await client.users.fetch(sellerId);
                            const embed = new EmbedBuilder()
                                .setColor(0xFFA500)
                                .setTitle('⏰ Listing của bạn đã hết hạn!')
                                .setDescription(`Vật phẩm **${itemDisplayName}** (Mã listing: \`${listing.listing_id}\`) của bạn đã hết hạn trên thị trường sau 24 giờ.`)
                                .addFields(
                                    { name: 'Vật phẩm đã trả lại', value: itemDisplayName, inline: true },
                                    { name: 'Phí hết hạn (10% giá trị)', value: `${feeAmount} Pokecoin`, inline: true },
                                    { name: 'Số Pokecoin hiện tại', value: `${updatedSellerCoins} Pokecoin`, inline: false }
                                )
                                .setFooter({ text: 'Vật phẩm đã được trả lại vào kho của bạn.' });
                            await sellerDMChannel.send({ embeds: [embed] });
                            console.log(`[MARKETPLACE_CLEANUP] Đã xử lý và gửi DM cho người bán ${sellerId} về listing ${listing.listing_id}.`);
                        } catch (dmError) {
                            console.error(`[MARKETPLACE_CLEANUP_DM_ERROR] Không thể gửi DM cho người bán ${sellerId} về listing ${listing.listing_id}:`, dmError);
                        }
                    } else {
                        console.warn(`[MARKETPLACE_CLEANUP] Không thể trả lại vật phẩm/Pokémon cho listing ${listing.listing_id}.`);
                    }

                } catch (innerError) {
                    console.error(`[MARKETPLACE_CLEANUP_TRANSACTION_ERROR] Lỗi khi xử lý listing ${listing.listing_id}:`, innerError);
                }
            });
        }
    } catch (error) {
        console.error('[MARKETPLACE_CLEANUP_ERROR] Lỗi tổng quát trong quá trình dọn dẹp listing:', error);
    }
    console.log('[MARKETPLACE_CLEANUP] Kết thúc kiểm tra các listing hết hạn.');
}

function scheduleCleanup(client) {
    console.log('[MARKETPLACE_CLEANUP] Hàm scheduleCleanup đang được gọi.');
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
    }
    cleanupIntervalId = setInterval(() => cleanupExpiredListings(client), CLEANUP_INTERVAL_MS);
    console.log(`[MARKETPLACE_CLEANUP] Tác vụ dọn dẹp marketplace đã được lên lịch chạy mỗi ${CLEANUP_INTERVAL_MS / (1000 * 60)} phút.`);
}

function stopCleanup() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        console.log('[MARKETPLACE_CLEANUP] Tác vụ dọn dẹp marketplace đã dừng.');
    }
}

function getMarketplaceCleanupStatus() {
    return {
        isActive: !!cleanupIntervalId,
        cleanupIntervalMinutes: CLEANUP_INTERVAL_MS / (1000 * 60)
    };
}


module.exports = {
    cleanupExpiredListings,
    CLEANUP_INTERVAL_MS,
    scheduleCleanup,
    stopCleanup,
    getMarketplaceCleanupStatus
};
