// commands/market.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { isChannelAllowed } = require('../utils/core/channelUtils'); // Import hàm kiểm tra kênh
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

const ITEMS_PER_PAGE = 5;

module.exports = {
    name: 'market',
    description: 'Xem các Pokémon và vật phẩm đang được rao bán trên thị trường.',
    aliases: ['mk', 'listings'],
    usage: '[page_number]',
    cooldown: 5,

    async execute(message, args, client) {
        const prefix = client.config.PREFIX;
        const userId = message.author.id;
        const guildId = message.guild.id;
        const channelId = message.channel.id;

        // KIỂM TRA KÊNH ĐƯỢC PHÉP
        const allowed = await isChannelAllowed(guildId, channelId, 'market');
        if (!allowed) {
            await message.channel.send({
                content: `<@${userId}> Lệnh \`market\` chỉ có thể được sử dụng trong các kênh thị trường đã được thiết lập bởi quản trị viên.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        let page = parseInt(args[0]) || 1;
        if (page < 1) page = 1;

        try {
            // Lấy tổng số listings, chỉ tính những listing đang active VÀ chưa hết hạn
            const totalListingsResult = await db('marketplace_listings')
                .where({ status: 'active' })
                .where('listing_expires_at', '>', new Date()) // THÊM ĐIỀU KIỆN MỚI
                .count('listing_id as count')
                .first();
            const totalListings = parseInt(totalListingsResult.count);
            const totalPages = Math.ceil(totalListings / ITEMS_PER_PAGE);

            if (totalListings === 0) {
                await message.channel.send({
                    content: `<@${userId}> Thị trường hiện đang trống rỗng. Hãy là người đầu tiên đăng bán!`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (page > totalPages) {
                await message.channel.send({
                    content: `<@${userId}> Trang ${page} không tồn tại. Thị trường chỉ có ${totalPages} trang.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const offset = (page - 1) * ITEMS_PER_PAGE;

            // Lấy danh sách listings, chỉ lấy những listing đang active VÀ chưa hết hạn
            const listings = await db('marketplace_listings')
                .where({ status: 'active' })
                .where('listing_expires_at', '>', new Date()) // THÊM ĐIỀU KIỆN MỚI
                .orderBy('listed_at', 'desc')
                .limit(ITEMS_PER_PAGE)
                .offset(offset);

            let description = '';
            for (const listing of listings) {
                let itemName = 'Không rõ';
                if (listing.item_type === 'pokemon') {
                    const userPokemon = await db('user_pokemons')
                        .where({ id: listing.item_reference_id })
                        .first();
                    if (userPokemon) {
                        const pokemonData = await db('pokemons')
                            .where({ pokedex_id: userPokemon.pokedex_id })
                            .first();
                        if (pokemonData) {
                            itemName = `${userPokemon.nickname || pokemonData.name} (Lv.${userPokemon.level})`;
                        }
                    }
                } else if (listing.item_type === 'item') {
                    const itemData = await db('items')
                        .where({ item_id: listing.item_reference_id })
                        .first();
                    if (itemData) {
                        itemName = `${itemData.name} (x${listing.quantity})`;
                    }
                }

                description += `**ID: ${listing.listing_id}** | **${itemName}**\n` +
                    `Người bán: <@${listing.seller_discord_id}>\n` +
                    `Giá: ${listing.price} Pokecoin\n` +
                    `${listing.description ? `Mô tả: ${listing.description}\n` : ''}` +
                    `Đăng lúc: ${new Date(listing.listed_at).toLocaleString('vi-VN')}\n\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🛒 Thị trường Pokémon & Vật phẩm')
                .setDescription(description || 'Không có listing nào trên trang này.')
                .setFooter({ text: `Trang ${page}/${totalPages} | Sử dụng ${prefix}market <số_trang> để xem thêm.` });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`market_prev_${page}`)
                        .setLabel('Trang trước')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId(`market_next_${page}`)
                        .setLabel('Trang sau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages),
                );

            const replyMessage = await message.channel.send({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = replyMessage.createMessageComponentCollector({
                filter: i => i.user.id === message.author.id && i.customId.startsWith('market_'),
                time: 120000 // 2 phút
            });

            collector.on('collect', async i => {
                let newPage = page;
                if (i.customId.includes('prev')) {
                    newPage--;
                } else if (i.customId.includes('next')) {
                    newPage++;
                }

                if (newPage < 1) newPage = 1;
                if (newPage > totalPages) newPage = totalPages;

                if (newPage === page) {
                    try {
                        await i.update({});
                    } catch (updateError) {
                        if (updateError.code === 10062 || updateError.code === 40060) {
                            console.warn(`[MARKET_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                        } else {
                            console.error(`[MARKET_COLLECTOR_ERROR] Lỗi khi cập nhật tương tác rỗng cho ${userId}:`, updateError);
                            sendOwnerDM(client, `[Lỗi Market Collector] Lỗi khi cập nhật tương tác rỗng cho ${userId}.`, updateError);
                        }
                    }
                    return;
                }

                page = newPage;

                const newOffset = (page - 1) * ITEMS_PER_PAGE;
                const newlistings = await db('marketplace_listings')
                    .where({ status: 'active' })
                    .where('listing_expires_at', '>', new Date()) // SỬA TRUY VẤN Ở ĐÂY
                    .orderBy('listed_at', 'desc')
                    .limit(ITEMS_PER_PAGE)
                    .offset(newOffset);

                let newDescription = '';
                for (const listing of newlistings) {
                    let itemName = 'Không rõ';
                    if (listing.item_type === 'pokemon') {
                        const userPokemon = await db('user_pokemons')
                            .where({ id: listing.item_reference_id })
                            .first();
                        if (userPokemon) {
                            const pokemonData = await db('pokemons')
                                .where({ pokedex_id: userPokemon.pokedex_id })
                                .first();
                            if (pokemonData) {
                                itemName = `${userPokemon.nickname || pokemonData.name} (Lv.${userPokemon.level})`;
                            }
                        }
                    } else if (listing.item_type === 'item') {
                        const itemData = await db('items')
                            .where({ item_id: listing.item_reference_id })
                            .first();
                        if (itemData) {
                            itemName = `${itemData.name} (x${listing.quantity})`;
                        }
                    }
                    newDescription += `**ID: ${listing.listing_id}** | **${itemName}**\n` +
                        `Người bán: <@${listing.seller_discord_id}>\n` +
                        `Giá: ${listing.price} Pokecoin\n` +
                        `${listing.description ? `Mô tả: ${listing.description}\n` : ''}` +
                        `Đăng lúc: ${new Date(listing.listed_at).toLocaleString('vi-VN')}\n\n`;
                }

                const newEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🛒 Thị trường Pokémon & Vật phẩm')
                    .setDescription(newDescription || 'Không có listing nào trên trang này.')
                    .setFooter({ text: `Trang ${page}/${totalPages} | Sử dụng ${prefix}market <số_trang> để xem thêm.` });

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`market_prev_${page}`)
                            .setLabel('Trang trước')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId(`market_next_${page}`)
                            .setLabel('Trang sau')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page === totalPages),
                    );

                try {
                    await i.update({
                        embeds: [newEmbed],
                        components: [newRow]
                    });
                } catch (updateError) {
                    if (updateError.code === 10062 || updateError.code === 40060) {
                        console.warn(`[MARKET_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                    } else {
                        console.error(`[MARKET_COLLECTOR_ERROR] Lỗi khi cập nhật tin nhắn market trong collector cho ${userId}:`, updateError);
                        sendOwnerDM(client, `[Lỗi Market Collector End] Lỗi khi cập nhật tin nhắn phân trang cho ${userId}.`, updateError);
                    }
                }
            });

            collector.on('end', async (collected, reason) => {
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`market_prev_${page}`)
                            .setLabel('Trang trước')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`market_next_${page}`)
                            .setLabel('Trang sau')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true),
                    );
                try {
                    const fetchedMessage = await message.channel.messages.fetch(replyMessage.id).catch(() => null);
                    if (fetchedMessage && fetchedMessage.editable) {
                        await fetchedMessage.edit({ components: [disabledRow] });
                    }
                } catch (e) {
                    if (e.code === 10008) {
                        console.warn(`[MARKET_COLLECTOR_WARN] Tin nhắn market đã bị xóa, không thể vô hiệu hóa nút.`);
                    } else {
                        console.error("Could not disable market buttons:", e);
                        sendOwnerDM(client, `[Lỗi Market Collector End] Lỗi khi vô hiệu hóa nút cho ${userId}.`, e);
                    }
                }
            });

        } catch (error) {
            console.error('[MARKET_COMMAND_ERROR] Lỗi khi hiển thị thị trường:', error);
            sendOwnerDM(client, `[Lỗi Market Command] Lỗi khi người dùng ${userId} sử dụng lệnh market.`, error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi tải thị trường. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
