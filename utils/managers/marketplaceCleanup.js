// utils/managers/marketplaceCleanup.js
const { db } = require('../../db'); // Cập nhật đường dẫn: từ utils/managers/ lên 2 cấp để đến db.js
const { EmbedBuilder } = require('discord.js');

const MARKETPLACE_FEE_PERCENTAGE = 0.10; // Phí 10%
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Chạy mỗi 10 phút

// Biến để theo dõi trạng thái của interval
let cleanupIntervalId = null; 

/**
 * Hàm kiểm tra và xử lý các listing đã hết hạn.
 * @param {Client} client - Đối tượng Discord Client để gửi DM.
 */
async function cleanupExpiredListings(client) {
    console.log('[MARKETPLACE_CLEANUP] Bắt đầu kiểm tra các listing hết hạn...');
    const now = new Date();

    try {
        // Tìm tất cả các listing đang active và đã hết hạn
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

                    // Lấy lại thông tin người bán sau khi trừ phí để hiển thị số dư chính xác
                    const updatedSellerUser = await trx('users').where({ discord_id: sellerId }).first();
                    const updatedSellerCoins = updatedSellerUser ? updatedSellerUser.pokecoins : 0;

                    let itemDisplayName = '';
                    let returnSuccess = false;

                    // 2. Trả lại vật phẩm/Pokémon cho người bán
                    if (listing.item_type === 'pokemon') {
                        await trx('user_pokemons')
                            .where({ id: listing.item_reference_id })
                            .update({
                                user_discord_id: sellerId, // Chuyển quyền sở hữu về người bán
                                is_on_marketplace: false,
                                marketplace_listing_id: null,
                                updated_at: new Date()
                            });
                        const userPokemon = await db('user_pokemons').where({ id: listing.item_reference_id }).first();
                        if (userPokemon) {
                            const pokemonData = await db('pokemons').where({ pokedex_id: userPokemon.pokedex_id }).first();
                            itemDisplayName = `${userPokemon.nickname || pokemonData.name} (Lv.${userPokemon.level})`;
                            returnSuccess = true;
                        }
                    } else if (listing.item_type === 'item') {
                        const existingItem = await trx('user_inventory_items')
                            .where({ user_discord_id: sellerId, item_id: listing.item_reference_id })
                            .first();

                        if (existingItem) {
                            await trx('user_inventory_items')
                                .where({ user_discord_id: sellerId, item_id: listing.item_reference_id })
                                .increment('quantity', listing.quantity);
                        } else {
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

                    // 3. Cập nhật trạng thái listing thành 'expired'
                    await trx('marketplace_listings')
                        .where({ listing_id: listing.listing_id })
                        .update({
                            status: 'expired',
                            updated_at: new Date()
                        });

                    // 4. Gửi DM thông báo cho người bán
                    if (returnSuccess) {
                        try {
                            const sellerDMChannel = await client.users.fetch(sellerId);
                            const embed = new EmbedBuilder()
                                .setColor(0xFFA500) // Màu cam cho thông báo hết hạn
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
        // Có thể gửi DM lỗi cho chủ bot ở đây nếu muốn
        // const { sendOwnerDM } = require('../errors/errorReporter');
        // sendOwnerDM(client, `[Lỗi Dọn Dẹp Marketplace] Đã xảy ra lỗi khi dọn dẹp các listing hết hạn.`, error);
    }
    console.log('[MARKETPLACE_CLEANUP] Kết thúc kiểm tra các listing hết hạn.');
}

/**
 * Lên lịch chạy tác vụ dọn dẹp marketplace.
 * @param {Client} client Discord client.
 */
function scheduleCleanup(client) {
    console.log('[MARKETPLACE_CLEANUP] Hàm scheduleCleanup đang được gọi.'); // Dòng log mới
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
    }
    cleanupIntervalId = setInterval(() => cleanupExpiredListings(client), CLEANUP_INTERVAL_MS);
    console.log(`[MARKETPLACE_CLEANUP] Tác vụ dọn dẹp marketplace đã được lên lịch chạy mỗi ${CLEANUP_INTERVAL_MS / (1000 * 60)} phút.`);
}

/**
 * Dừng tác vụ dọn dẹp marketplace.
 */
function stopCleanup() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        console.log('[MARKETPLACE_CLEANUP] Tác vụ dọn dẹp marketplace đã dừng.');
    }
}

/**
 * Lấy trạng thái của Marketplace Cleanup.
 * @returns {object} Trạng thái hiện tại của Marketplace Cleanup.
 */
function getMarketplaceCleanupStatus() {
    return {
        isActive: !!cleanupIntervalId, // True nếu interval đang chạy
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
