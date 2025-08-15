// commands/profile.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
// Import db từ ../db.js để dùng chung instance DB
const { db } = require('../db'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

const CURRENCY_NAME = 'PokeCoin'; // Đơn vị tiền tệ của bạn
const ITEMS_PER_PAGE = 10; // Số vật phẩm hiển thị trên mỗi trang hồ sơ
const MESSAGE_LIFETIME = 2 * 60 * 1000; // Tin nhắn tồn tại trong 2 phút (tính bằng miliseconds)

// Hàm tạo Embed cho trang hồ sơ cụ thể
async function createProfileEmbed(page, totalPages, items, pokecoins, authorId, authorUsername, authorAvatarURL, clientAvatarURL) {
    const profileEmbed = new EmbedBuilder()
        .setColor('#FFD700') // Màu vàng gold cho hồ sơ
        .setTitle(`👤 Hồ Sơ của ${authorUsername}`)
        .setThumbnail(authorAvatarURL)
        .addFields(
            { name: `💰 ${CURRENCY_NAME}`, value: `${pokecoins}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Trang ${page}/${totalPages} | ID: ${authorId}`, iconURL: clientAvatarURL }); // Thêm số trang vào footer

    // Thêm danh sách vật phẩm
    if (items.length > 0) {
        let itemsList = items.map(item => {
            return `**${item.name}** x${item.quantity} (ID: ${item.item_id})`;
        }).join('\n');

        if (itemsList.length > 1000) {
            itemsList = itemsList.substring(0, 997) + '...';
        }

        profileEmbed.addFields(
            { name: '🎒 Vật Phẩm Sở Hữu', value: itemsList, inline: false }
        );
    } else {
        profileEmbed.addFields(
            { name: '🎒 Vật Phẩm Sở Hữu', value: 'Bạn chưa sở hữu vật phẩm nào.', inline: false }
        );
    }

    return profileEmbed;
}

// Hàm tạo hàng nút điều khiển
function createProfileButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('profile_previous_page')
                .setLabel('Trang trước')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1), // Vô hiệu hóa nếu là trang đầu tiên
            new ButtonBuilder()
                .setCustomId('profile_next_page')
                .setLabel('Trang sau')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages) // Vô hiệu hóa nếu là trang cuối cùng
        );
    return row;
}

module.exports = {
    name: 'profile',
    description: 'Hiển thị hồ sơ của bạn, bao gồm số PokéCoin và các vật phẩm sở hữu.',
    aliases: ['me', 'inventory', 'inv'],
    usage: '',
    cooldown: 5,

    async execute(message, args, client, db) { 
        const userId = message.author.id;

        try {
            // 1. Lấy thông tin người dùng và số PokéCoin
            const userProfile = await db('users') 
                .where('discord_id', userId)
                .select('pokecoins')
                .first();

            if (!userProfile) {
                try {
                    return await message.channel.send({
                        content: `<@${userId}> Bạn chưa có hồ sơ. Vui lòng sử dụng lệnh \`!start\` (hoặc lệnh khởi tạo tương tự) để tạo hồ sơ và bắt đầu.`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (e) {
                    console.error(`[PROFILE_COMMAND_ERROR] Lỗi gửi tin nhắn chưa đăng ký cho ${userId}:`, e);
                    sendOwnerDM(client, `[Lỗi Profile] Lỗi gửi tin nhắn chưa đăng ký cho ${userId}.`, e);
                }
                return;
            }

            const pokecoins = userProfile.pokecoins || 0;

            // 2. Lấy tổng số vật phẩm người dùng sở hữu để tính toán số trang
            const totalItemsResult = await db('user_inventory_items') 
                .where('user_discord_id', userId)
                .andWhere('quantity', '>', 0)
                .count('id as count')
                .first();
            const totalItems = parseInt(totalItemsResult.count);
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1; 

            let currentPage = 1;

            // 3. Lấy vật phẩm cho trang đầu tiên
            const initialItems = await db('user_inventory_items') 
                .join('items', 'user_inventory_items.item_id', '=', 'items.item_id')
                .where('user_discord_id', userId)
                .andWhere('user_inventory_items.quantity', '>', 0)
                .select(
                    'items.item_id', 
                    'items.name',
                    'user_inventory_items.quantity'
                )
                .limit(ITEMS_PER_PAGE)
                .offset(0)
                .orderBy('items.name', 'asc');

            const initialEmbed = await createProfileEmbed(
                currentPage,
                totalPages,
                initialItems,
                pokecoins,
                message.author.id,
                message.author.username,
                message.author.displayAvatarURL({ dynamic: true }),
                client.user.displayAvatarURL()
            );
            const initialButtons = createProfileButtons(currentPage, totalPages);

            let profileMessage;
            try {
                // Gửi tin nhắn ban đầu bằng channel.send và fetchReply
                profileMessage = await message.channel.send({
                    embeds: [initialEmbed],
                    components: [initialButtons],
                    fetchReply: true
                });
            } catch (e) {
                console.error("[PROFILE_COMMAND_ERROR] Lỗi khi gửi tin nhắn hồ sơ:", e);
                sendOwnerDM(client, `[Lỗi Profile] Lỗi khi gửi tin nhắn hồ sơ cho ${userId}.`, e);
                return; // Thoát nếu không gửi được tin nhắn
            }

            // Tạo bộ thu thập tương tác cho các nút
            const collector = profileMessage.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id && (i.customId === 'profile_previous_page' || i.customId === 'profile_next_page'), // Chỉ lọc các customId của phân trang
                time: MESSAGE_LIFETIME, 
                idle: MESSAGE_LIFETIME 
            });

            collector.on('collect', async i => {
                // ĐÃ BỎ: await i.deferUpdate(); // handlers/interactionCreate.js sẽ bỏ qua defer, i.update() sẽ tự defer/acknowledge

                let newPage = currentPage; 
                if (i.customId === 'profile_previous_page') {
                    newPage--;
                } else if (i.customId === 'profile_next_page') {
                    newPage++;
                }

                if (newPage < 1) newPage = 1;
                if (newPage > totalPages) newPage = totalPages;

                if (newPage === currentPage) { // Nếu trang không đổi, chỉ cần acknowledge tương tác
                    try {
                        await i.update({}); // Gửi một update rỗng để acknowledge tương tác
                    } catch (updateError) {
                        if (updateError.code === 10062 || updateError.code === 40060) {
                            console.warn(`[PROFILE_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                        } else {
                            console.error(`[PROFILE_COLLECTOR_ERROR] Lỗi khi cập nhật tương tác rỗng cho ${userId}:`, updateError);
                            sendOwnerDM(client, `[Lỗi Profile Collector] Lỗi khi cập nhật tương tác rỗng cho ${userId}.`, updateError);
                        }
                    }
                    return;
                }

                currentPage = newPage; 

                const newOffset = (currentPage - 1) * ITEMS_PER_PAGE;
                const newItems = await db('user_inventory_items') 
                    .join('items', 'user_inventory_items.item_id', '=', 'items.item_id')
                    .where('user_discord_id', userId)
                    .andWhere('user_inventory_items.quantity', '>', 0)
                    .select(
                        'items.item_id',
                        'items.name',
                        'user_inventory_items.quantity'
                    )
                    .limit(ITEMS_PER_PAGE)
                    .offset(newOffset)
                    .orderBy('items.name', 'asc');

                const newEmbed = await createProfileEmbed(
                    currentPage,
                    totalPages,
                    newItems,
                    pokecoins,
                    message.author.id,
                    message.author.username,
                    message.author.displayAvatarURL({ dynamic: true }),
                    client.user.displayAvatarURL()
                );
                const newButtons = createProfileButtons(currentPage, totalPages);

                try {
                    // Cập nhật tin nhắn với Embed và nút mới
                    await i.update({
                        embeds: [newEmbed],
                        components: [newButtons]
                    });
                } catch (updateError) {
                    if (updateError.code === 10062 || updateError.code === 40060) {
                        console.warn(`[PROFILE_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                    } else {
                        console.error(`[PROFILE_COLLECTOR_ERROR] Lỗi khi cập nhật tin nhắn profile trong collector cho ${userId}:`, updateError);
                        sendOwnerDM(client, `[Lỗi Profile Collector] Lỗi khi cập nhật tin nhắn phân trang cho ${userId}.`, updateError);
                    }
                }
            });

            collector.on('end', async collected => {
                // Khi collector kết thúc (hết thời gian), vô hiệu hóa các nút
                try {
                    // Kiểm tra xem tin nhắn có còn tồn tại và có thể chỉnh sửa không
                    const fetchedMessage = await message.channel.messages.fetch(profileMessage.id).catch(() => null);
                    if (fetchedMessage && fetchedMessage.editable) {
                        const disabledComponents = fetchedMessage.components.map(row => { 
                            return ActionRowBuilder.from(row).setComponents(
                                row.components.map(component => ButtonBuilder.from(component).setDisabled(true))
                            );
                        });
                        await fetchedMessage.edit({ components: disabledComponents });
                        console.log(`[PROFILE] Các nút trên tin nhắn hồ sơ của ${message.author.username} đã được vô hiệu hóa sau ${MESSAGE_LIFETIME / 1000} giây.`);
                    }
                } catch (editError) {
                    // Bắt lỗi Unknown Message (10008) nếu tin nhắn đã bị xóa
                    if (editError.code === 10008) {
                        console.warn(`[PROFILE_COLLECTOR_WARN] Tin nhắn hồ sơ đã bị xóa, không thể vô hiệu hóa nút.`);
                    } else {
                        console.error('Không thể vô hiệu hóa nút trên tin nhắn hồ sơ:', editError);
                        sendOwnerDM(client, `[Lỗi Profile Collector End] Lỗi khi vô hiệu hóa nút cho ${userId}.`, editError);
                    }
                }
            });

        } catch (error) {
            console.error('[PROFILE_COMMAND_ERROR] Lỗi khi hiển thị hồ sơ người dùng:', error);
            sendOwnerDM(client, `[Lỗi Profile Command] Lỗi khi người dùng ${userId} sử dụng lệnh profile.`, error);
            await message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi cố gắng hiển thị hồ sơ của bạn. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            }).catch(err => console.error("Lỗi khi gửi tin nhắn lỗi ephemeral:", err));
        }
    },
};
