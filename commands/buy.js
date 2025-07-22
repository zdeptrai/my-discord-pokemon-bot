// commands/buy.js

const { EmbedBuilder, MessageFlags } = require('discord.js'); // Thêm MessageFlags
const knexConfig = require('../knexfile');
const pgKnex = require('knex')(knexConfig.development);

const CURRENCY_NAME = 'PokéCoin'; // Đơn vị tiền tệ của bạn

// Hàm phụ trợ: Lấy số dư PokéCoin của người dùng
async function getUserPokecoins(userId) {
    try {
        const user = await pgKnex('users')
            .where('discord_id', userId)
            .select('pokecoins')
            .first();
        return user ? user.pokecoins : 0;
    } catch (error) {
        console.error(`Lỗi khi lấy PokéCoins của người dùng ${userId}:`, error);
        return 0;
    }
}

// Hàm phụ trợ: Cập nhật số dư PokéCoin của người dùng
async function updateUserPokecoins(userId, amount) {
    try {
        await pgKnex('users')
            .where('discord_id', userId)
            .increment('pokecoins', amount); // Dùng increment để cộng/trừ
        return true;
    } catch (error) {
        console.error(`Lỗi khi cập nhật PokéCoins của người dùng ${userId}:`, error);
        return false;
    }
}

// Hàm phụ trợ: Lấy thông tin vật phẩm từ database
async function getItemDetails(itemId) {
    try {
        const item = await pgKnex('items')
            .where('item_id', itemId)
            .select('name', 'value')
            .first();
        return item;
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết vật phẩm ${itemId}:`, error);
        return null;
    }
}

// Hàm phụ trợ: Thêm/Cập nhật vật phẩm trong kho của người dùng
async function addUserItem(userId, itemId, quantity) {
    try {
        const existingItem = await pgKnex('user_inventory_items')
            .where('user_discord_id', userId)
            .andWhere('item_id', itemId)
            .first();

        if (existingItem) {
            // Nếu vật phẩm đã tồn tại, cập nhật số lượng
            await pgKnex('user_inventory_items')
                .where('id', existingItem.id)
                .increment('quantity', quantity);
        } else {
            // Nếu vật phẩm chưa tồn tại, thêm mới
            await pgKnex('user_inventory_items').insert({
                user_discord_id: userId,
                item_id: itemId,
                quantity: quantity,
            });
        }
        return true;
    } catch (error) {
        console.error(`Lỗi khi thêm/cập nhật vật phẩm ${itemId} cho người dùng ${userId}:`, error);
        return false;
    }
}

module.exports = {
    name: 'buy',
    description: 'Mua vật phẩm từ cửa hàng.',
    aliases: ['purchase'],
    usage: '<item_id> [quantity]', // Hướng dẫn sử dụng
    cooldown: 5,

    async execute(message, args, client, db) { // Giữ lại db nếu có nơi khác dùng
        const userId = message.author.id;
        const prefix = client.config.PREFIX; // Lấy prefix từ client.config

        if (args.length < 1) {
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của vật phẩm bạn muốn mua. Ví dụ: \`${prefix}buy 1 5\` (mua 5 vật phẩm ID 1)`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }

        const itemId = parseInt(args[0]);
        const quantity = args[1] ? parseInt(args[1]) : 1; // Mặc định mua 1 nếu không chỉ định

        if (isNaN(itemId) || itemId <= 0) {
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> ID vật phẩm không hợp lệ. Vui lòng nhập một số ID dương.`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }
        if (isNaN(quantity) || quantity <= 0) {
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> Số lượng mua không hợp lệ. Vui lòng nhập một số lượng dương.`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }

        // 1. Lấy thông tin vật phẩm
        const item = await getItemDetails(itemId);
        if (!item || item.value <= 0) { // Đảm bảo vật phẩm tồn tại và có giá trị mua được
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> Vật phẩm với ID **${itemId}** không tồn tại hoặc không thể mua được.`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }

        const totalPrice = item.value * quantity;

        // 2. Lấy số dư PokéCoin của người dùng
        const userPokecoins = await getUserPokecoins(userId);

        // 3. Kiểm tra đủ tiền
        if (userPokecoins < totalPrice) {
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> Bạn không đủ ${CURRENCY_NAME} để mua **${quantity}x ${item.name}** (Tổng: ${totalPrice} ${CURRENCY_NAME}). Bạn hiện có: ${userPokecoins} ${CURRENCY_NAME}.`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }

        // 4. Thực hiện giao dịch trong một transaction để đảm bảo tính toàn vẹn dữ liệu
        try {
            await pgKnex.transaction(async trx => {
                // Trừ tiền của người dùng
                // Sử dụng Knex instance đã được truyền vào transaction (trx)
                const moneyDeducted = await trx('users')
                    .where('discord_id', userId)
                    .decrement('pokecoins', totalPrice);
                
                if (moneyDeducted === 0) { // Kiểm tra xem có hàng nào bị ảnh hưởng không
                    throw new Error('Không tìm thấy người dùng hoặc không thể trừ tiền.');
                }

                // Thêm vật phẩm vào kho
                const existingItem = await trx('user_inventory_items')
                    .where('user_discord_id', userId)
                    .andWhere('item_id', itemId)
                    .first();

                if (existingItem) {
                    await trx('user_inventory_items')
                        .where('id', existingItem.id)
                        .increment('quantity', quantity);
                } else {
                    await trx('user_inventory_items').insert({
                        user_discord_id: userId,
                        item_id: itemId,
                        quantity: quantity,
                        created_at: pgKnex.fn.now(), // Thêm created_at
                        updated_at: pgKnex.fn.now()  // Thêm updated_at
                    });
                }
            });

            // Giao dịch thành công
            const newBalance = await getUserPokecoins(userId); // Lấy số dư mới để thông báo
            const embed = new EmbedBuilder()
                .setColor('#00ff00') // Màu xanh lá cây cho giao dịch thành công
                .setTitle('✅ Giao Dịch Thành Công!')
                .setDescription(`Bạn đã mua **${quantity}x ${item.name}** với giá **${totalPrice} ${CURRENCY_NAME}**.\nSố dư ${CURRENCY_NAME} của bạn hiện tại: **${newBalance}**.`);
            
            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Lỗi trong quá trình giao dịch mua vật phẩm:', error);
            // Đã sửa: dùng message.channel.send với ephemeral: true
            return message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi trong quá trình mua vật phẩm. Vui lòng thử lại sau.`,
                ephemeral: true // Sử dụng ephemeral flag
            });
        }
    },
};