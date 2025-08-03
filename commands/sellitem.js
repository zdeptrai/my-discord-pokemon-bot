// commands/sellitem.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isChannelAllowed } = require('../utils/core/channelUtils'); // Import hàm kiểm tra kênh

const MARKETPLACE_FEE_PERCENTAGE = 0.10;

module.exports = {
    name: 'sellitem',
    description: 'Đăng bán một hoặc nhiều vật phẩm của bạn lên thị trường.',
    aliases: ['si'],
    usage: '<item_id> <quantity> <price> [description]',
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
                content: `<@${userId}> Lệnh \`sellitem\` chỉ có thể được sử dụng trong các kênh thị trường đã được thiết lập bởi quản trị viên.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (args.length < 3) {
            await message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID vật phẩm, số lượng và giá bán. Cách dùng: \`${prefix}sellitem <item_id> <quantity> <price> [description]\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const itemIdToSell = parseInt(args[0]);
        const quantityToSell = parseInt(args[1]);
        const price = parseInt(args[2]);
        const description = args.slice(3).join(' ');

        if (isNaN(itemIdToSell) || itemIdToSell <= 0) {
            await message.channel.send({
                content: `<@${userId}> ID vật phẩm không hợp lệ. Vui lòng cung cấp một số nguyên dương.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (isNaN(quantityToSell) || quantityToSell <= 0) {
            await message.channel.send({
                content: `<@${userId}> Số lượng không hợp lệ. Vui lòng cung cấp một số nguyên dương lớn hơn 0.`,
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
            const userItem = await db('user_inventory_items')
                .where({ user_discord_id: userId, item_id: itemIdToSell })
                .first();

            if (!userItem || userItem.quantity < quantityToSell) {
                await message.channel.send({
                    content: `<@${userId}> Bạn không có đủ số lượng vật phẩm này để bán. Bạn hiện có ${userItem ? userItem.quantity : 0} món.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const itemDetails = await db('items')
                .where({ item_id: itemIdToSell })
                .first();

            if (!itemDetails) {
                await message.channel.send({
                    content: `<@${userId}> Không tìm thấy vật phẩm với ID này.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Ghi nhận bán thành công mà không trừ vật phẩm khỏi kho
            await db.transaction(async trx => {
                const [listing] = await trx('marketplace_listings').insert({
                    seller_discord_id: userId,
                    item_type: 'item',
                    item_reference_id: itemIdToSell, // Vẫn giữ nguyên item_id
                    quantity: quantityToSell,
                    price: price,
                    description: description || null,
                    status: 'active',
                    listed_at: new Date(),
                    listing_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
                }).returning('*');

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎉 Đăng bán Vật phẩm thành công!')
                    .setDescription(`Vật phẩm **${itemDetails.name}** (x${quantityToSell}) đã được đăng bán trên thị trường với giá **${price} Pokecoin**.\n` +
                                     `Mã đăng bán của bạn là: \`${listing.listing_id}\``)
                    .addFields(
                        { name: 'Vật phẩm', value: `${itemDetails.name} (x${quantityToSell})`, inline: true },
                        { name: 'Giá', value: `${price} Pokecoin`, inline: true },
                        { name: 'Mô tả', value: description || 'Không có', inline: false }
                    )
                    .setFooter({ text: `Phí giao dịch khi bán thành công/rút lại là ${MARKETPLACE_FEE_PERCENTAGE * 100}% giá trị.` });

                await message.channel.send({ embeds: [embed] });
            });

        } catch (error) {
            console.error('[SELL_ITEM_COMMAND_ERROR] Lỗi khi đăng bán vật phẩm:', error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi đăng bán vật phẩm của bạn. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
