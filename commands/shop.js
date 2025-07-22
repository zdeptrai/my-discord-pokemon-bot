// commands/shop.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
// Import db từ ../db.js để dùng chung instance DB
const { db } = require('../db'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

const ITEMS_PER_PAGE = 10; // Số vật phẩm hiển thị trên mỗi trang
const MESSAGE_LIFETIME = 5 * 60 * 1000; // Tin nhắn tồn tại trong 5 phút (tính bằng miliseconds)
const CURRENCY_NAME = 'PokeCoin'; // Đơn vị tiền tệ của bạn

// Hàm tạo Embed cho trang cửa hàng cụ thể
async function createShopEmbed(page, totalPages, items, author) {
    const shopEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🛍️ Cửa Hàng Vật Phẩm')
        .setDescription('Dưới đây là các vật phẩm có sẵn để mua:') // Bỏ thông tin trang ở đây
        .setTimestamp()
        // Di chuyển thông tin trang xuống footer
        .setFooter({ text: `Trang ${page}/${totalPages} | Yêu cầu bởi ${author.username}`, iconURL: author.displayAvatarURL() });

    items.forEach(item => {
        let itemDescription = item.description || 'Không có mô tả.';
        if (item.type) {
            itemDescription = `**Loại:** ${item.type}\n${itemDescription}`;
        }

        // Loại bỏ phần sprite_url ở đây
        shopEmbed.addFields(
            {
                name: `${item.name} (ID: ${item.item_id})`,
                value: `**Giá:** ${item.value} ${CURRENCY_NAME}\n${itemDescription}`, // Sử dụng CURRENCY_NAME
                inline: false,
            }
        );
    });

    return shopEmbed;
}

// Hàm tạo hàng nút điều khiển
function createShopButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('shop_previous_page')
                .setLabel('Trang trước')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('shop_next_page')
                .setLabel('Trang sau')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
        );
    return row;
}

module.exports = {
    name: 'shop',
    description: 'Hiển thị các vật phẩm có sẵn trong cửa hàng.',
    aliases: ['store', 'items'],
    usage: '',
    cooldown: 5,

    async execute(message, args, client) { 
        const userId = message.author.id; // Lấy userId để sử dụng cho tin nhắn ephemeral

        try {
            let currentPage = 1;

            const totalItemsResult = await db('items')
                .where('value', '>', 0)
                .count('item_id as count')
                .first();
            const totalItems = parseInt(totalItemsResult.count);
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

            if (totalPages === 0) {
                return message.channel.send({
                    content: `<@${userId}> Hiện tại không có vật phẩm nào trong cửa hàng.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const initialItems = await db('items')
                .where('value', '>', 0)
                .select('item_id', 'name', 'description', 'type', 'value', 'sprite_url')
                .limit(ITEMS_PER_PAGE)
                .offset(0)
                .orderBy('item_id', 'asc');

            const initialEmbed = await createShopEmbed(currentPage, totalPages, initialItems, message.author);
            const initialButtons = createShopButtons(currentPage, totalPages);

            const shopMessage = await message.channel.send({
                embeds: [initialEmbed],
                components: [initialButtons],
                fetchReply: true
            });

            const collector = shopMessage.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id && (i.customId === 'shop_previous_page' || i.customId === 'shop_next_page'), // Chỉ lọc các customId của phân trang
                time: MESSAGE_LIFETIME,
                idle: MESSAGE_LIFETIME
            });

            collector.on('collect', async i => {
                // ĐÃ BỎ: await i.deferUpdate(); // handlers/interactionCreate.js sẽ bỏ qua defer, i.update() sẽ tự defer/acknowledge

                let newPage = currentPage; // Sử dụng currentPage thay vì page
                if (i.customId === 'shop_previous_page') {
                    newPage--;
                } else if (i.customId === 'shop_next_page') {
                    newPage++;
                }

                if (newPage < 1) newPage = 1;
                if (newPage > totalPages) newPage = totalPages;

                if (newPage === currentPage) { // Nếu trang không đổi, chỉ cần acknowledge tương tác
                    try {
                        await i.update({}); // Gửi một update rỗng để acknowledge tương tác
                    } catch (updateError) {
                        if (updateError.code === 10062 || updateError.code === 40060) {
                            console.warn(`[SHOP_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                        } else {
                            console.error(`[SHOP_COLLECTOR_ERROR] Lỗi khi cập nhật tương tác rỗng cho ${userId}:`, updateError);
                            sendOwnerDM(client, `[Lỗi Shop Collector] Lỗi khi cập nhật tương tác rỗng cho ${userId}.`, updateError);
                        }
                    }
                    return;
                }

                currentPage = newPage; // Cập nhật currentPage

                const newOffset = (currentPage - 1) * ITEMS_PER_PAGE;
                const newItems = await db('items')
                    .where('value', '>', 0)
                    .select('item_id', 'name', 'description', 'type', 'value', 'sprite_url')
                    .limit(ITEMS_PER_PAGE)
                    .offset(newOffset)
                    .orderBy('item_id', 'asc');

                const newEmbed = await createShopEmbed(currentPage, totalPages, newItems, message.author);
                const newButtons = createShopButtons(currentPage, totalPages);

                try {
                    await i.update({ // Sử dụng i.update() để chỉnh sửa tin nhắn tương tác
                        embeds: [newEmbed],
                        components: [newButtons]
                    });
                } catch (updateError) {
                    if (updateError.code === 10062 || updateError.code === 40060) {
                        console.warn(`[SHOP_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                    } else {
                        console.error(`[SHOP_COLLECTOR_ERROR] Lỗi khi cập nhật tin nhắn shop trong collector cho ${userId}:`, updateError);
                        sendOwnerDM(client, `[Lỗi Shop Collector] Lỗi khi cập nhật tin nhắn phân trang cho ${userId}.`, updateError);
                    }
                }
            });

            collector.on('end', async collected => {
                // Khi collector kết thúc (hết thời gian), vô hiệu hóa các nút
                try {
                    // Kiểm tra xem tin nhắn có còn tồn tại và có thể chỉnh sửa không
                    const fetchedMessage = await message.channel.messages.fetch(shopMessage.id).catch(() => null);
                    if (fetchedMessage && fetchedMessage.editable) { 
                        const disabledComponents = fetchedMessage.components.map(row => { // Sử dụng fetchedMessage.components
                            return ActionRowBuilder.from(row).setComponents(
                                row.components.map(component => ButtonBuilder.from(component).setDisabled(true))
                            );
                        });
                        await fetchedMessage.edit({ components: disabledComponents });
                        console.log(`[SHOP] Các nút trên tin nhắn cửa hàng của ${message.author.username} đã được vô hiệu hóa sau ${MESSAGE_LIFETIME / 1000} giây.`);
                    }
                } catch (editError) {
                    // Bắt lỗi Unknown Message (10008) nếu tin nhắn đã bị xóa
                    if (editError.code === 10008) {
                        console.warn(`[SHOP_COLLECTOR_WARN] Tin nhắn cửa hàng đã bị xóa, không thể vô hiệu hóa nút.`);
                    } else {
                        console.error('Không thể vô hiệu hóa nút trên tin nhắn cửa hàng:', editError);
                        sendOwnerDM(client, `[Lỗi Shop Collector End] Lỗi khi vô hiệu hóa nút cho ${userId}.`, editError);
                    }
                }
            });

        } catch (error) {
            console.error('[SHOP_COMMAND_ERROR] Lỗi khi hiển thị cửa hàng:', error);
            sendOwnerDM(client, `[Lỗi Shop Command] Lỗi khi người dùng ${userId} sử dụng lệnh shop.`, error);
            await message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi cố gắng hiển thị cửa hàng. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
