// commands/setchannel.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db');
const { hasDiscordAdministratorPermission } = require('../utils/core/permissionUtils');

module.exports = {
    name: 'setchannel',
    description: 'Thiết lập hoặc xóa kênh được phép cho một loại lệnh cụ thể (market, battle, spawn, boss, welcome).', // Cập nhật mô tả
    aliases: ['sc', 'channelconfig'],
    usage: '<market|battle|spawn|boss|welcome> <add|remove|list|clear> [channel_id]', // Cập nhật usage
    cooldown: 5,

    async execute(message, args, client) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        const prefix = client.config.PREFIX;

        const hasAdminPerms = await hasDiscordAdministratorPermission(message.member);
        if (!hasAdminPerms) {
            await message.channel.send({
                content: `<@${userId}> Bạn không có quyền để sử dụng lệnh này. Chỉ quản trị viên server mới được phép thiết lập kênh.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (args.length < 1 || (args[0] !== 'list' && args[0] !== 'clear' && args.length < 2)) {
            await message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp loại kênh và hành động (add/remove/list/clear). Ví dụ:\n` +
                                 `\`${prefix}setchannel market add\` (thêm kênh hiện tại)\n` +
                                 `\`${prefix}setchannel boss add\` (chỉ định kênh hiện tại làm kênh boss)\n` +
                                 `\`${prefix}setchannel welcome add\` (chỉ định kênh hiện tại làm kênh chào mừng)\n` + // Ví dụ mới
                                 `\`${prefix}setchannel battle remove #general\` (xóa kênh #general)\n` +
                                 `\`${prefix}setchannel spawn list\` (liệt kê kênh spawn)\n` +
                                 `\`${prefix}setchannel boss clear\` (xóa kênh boss đã thiết lập)`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const channelType = args[0].toLowerCase(); // market, battle, spawn, boss, welcome
        let action;
        let targetChannelId = message.channel.id;

        if (args.length === 1) {
            if (channelType === 'list' || channelType === 'clear') {
                await message.channel.send({
                    content: `<@${userId}> Vui lòng cung cấp loại kênh (market/battle/spawn/boss/welcome) trước khi sử dụng 'list' hoặc 'clear'. Ví dụ: \`${prefix}setchannel market list\`.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            action = 'add';
        } else {
            action = args[1].toLowerCase();
            if (action === 'add' || action === 'remove') {
                if (args[2]) {
                    const mentionedChannel = message.mentions.channels.first();
                    if (mentionedChannel) {
                        targetChannelId = mentionedChannel.id;
                    } else {
                        const parsedId = args[2].replace(/[^0-9]/g, '');
                        if (parsedId && parsedId.length >= 17) {
                            targetChannelId = parsedId;
                        } else {
                            await message.channel.send({
                                content: `<@${userId}> ID kênh không hợp lệ hoặc kênh không được tìm thấy. Vui lòng cung cấp một kênh được nhắc (@kênh) hoặc ID kênh chính xác.`,
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                    }
                } else if (action === 'remove' && !args[2]) {
                    targetChannelId = message.channel.id;
                }
            } else if (action !== 'list' && action !== 'clear') {
                await message.channel.send({
                    content: `<@${userId}> Hành động không hợp lệ. Vui lòng sử dụng \`add\`, \`remove\`, \`list\` hoặc \`clear\`.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        const dbColumnMap = {
            'market': 'market_channel_ids',
            'battle': 'battle_channel_ids',
            'spawn': 'spawn_channel_ids',
            'boss': 'boss_channel_id',
            'welcome': 'welcome_channel_id' // Cột mới cho kênh chào mừng
        };

        const dbColumn = dbColumnMap[channelType];

        if (!dbColumn) {
            await message.channel.send({
                content: `<@${userId}> Loại kênh không hợp lệ. Vui lòng chọn một trong số: \`market\`, \`battle\`, \`spawn\`, \`boss\`, \`welcome\`.`, // Cập nhật thông báo
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            let guildSettings = await db('guild_settings')
                .where({ guild_id: guildId })
                .first();

            let responseMessage = '';
            let embedColor = '#FFC107';
            let updated = false;

            // Xử lý riêng cho các cột đơn (boss_channel_id, welcome_channel_id)
            if (channelType === 'boss' || channelType === 'welcome') { // Thêm 'welcome' vào đây
                let currentChannelId = guildSettings ? guildSettings[dbColumn] : null;

                switch (action) {
                    case 'add':
                        if (currentChannelId === targetChannelId) {
                            responseMessage = `Kênh <#${targetChannelId}> đã là kênh \`${channelType}\` rồi.`;
                        } else {
                            updated = true;
                            responseMessage = `Kênh <#${targetChannelId}> đã được thiết lập làm kênh \`${channelType}\`.`;
                            embedColor = '#28a745';
                            currentChannelId = targetChannelId;
                        }
                        break;
                    case 'remove':
                    case 'clear':
                        if (currentChannelId === targetChannelId || (action === 'clear' && currentChannelId)) {
                            updated = true;
                            responseMessage = `Đã xóa kênh \`${channelType}\` ${currentChannelId ? `<#${currentChannelId}>` : ''}.`;
                            embedColor = '#dc3545';
                            currentChannelId = null;
                        } else {
                            responseMessage = `Không có kênh \`${channelType}\` nào được thiết lập hoặc kênh <#${targetChannelId}> không phải kênh \`${channelType}\` hiện tại.`;
                        }
                        break;
                    case 'list':
                        responseMessage = currentChannelId
                            ? `Kênh \`${channelType}\` hiện tại: <#${currentChannelId}>`
                            : `Hiện tại không có kênh \`${channelType}\` nào được thiết lập.`;
                        embedColor = '#007bff';
                        break;
                }

                if (updated) {
                    const updateData = {
                        [dbColumn]: currentChannelId,
                        updated_at: db.fn.now()
                    };
                    if (guildSettings) {
                        await db('guild_settings').where({ guild_id: guildId }).update(updateData);
                    } else {
                        await db('guild_settings').insert({ guild_id: guildId, ...updateData, created_at: db.fn.now() });
                    }
                }
            } else { // Xử lý các cột JSON array (market, battle, spawn)
                let channelIds = [];
                if (guildSettings && guildSettings[dbColumn]) {
                    try {
                        channelIds = JSON.parse(guildSettings[dbColumn]);
                        if (!Array.isArray(channelIds)) {
                            channelIds = [];
                        }
                    } catch (e) {
                        console.error(`[SETCHANNEL_COMMAND_ERROR] Lỗi phân tích JSON cho ${dbColumn} trong guild ${guildId}:`, e);
                        channelIds = [];
                    }
                }

                switch (action) {
                    case 'add':
                        if (channelIds.includes(targetChannelId)) {
                            responseMessage = `Kênh <#${targetChannelId}> đã có trong danh sách kênh \`${channelType}\` được phép rồi.`;
                        } else {
                            channelIds.push(targetChannelId);
                            updated = true;
                            responseMessage = `Đã thêm kênh <#${targetChannelId}> vào danh sách kênh \`${channelType}\` được phép.`;
                            embedColor = '#28a745';
                        }
                        break;
                    case 'remove':
                        const initialLength = channelIds.length;
                        channelIds = channelIds.filter(id => id !== targetChannelId);
                        if (channelIds.length < initialLength) {
                            updated = true;
                            responseMessage = `Đã xóa kênh <#${targetChannelId}> khỏi danh sách kênh \`${channelType}\` được phép.`;
                            embedColor = '#dc3545';
                        } else {
                            responseMessage = `Kênh <#${targetChannelId}> không có trong danh sách kênh \`${channelType}\` được phép.`;
                        }
                        break;
                    case 'list':
                        responseMessage = channelIds.length > 0
                            ? `Các kênh \`${channelType}\` hiện tại được phép: ${channelIds.map(id => `<#${id}>`).join(', ')}`
                            : `Hiện tại không có kênh \`${channelType}\` nào được thiết lập.`;
                        embedColor = '#007bff';
                        break;
                    case 'clear':
                        if (channelIds.length === 0) {
                            responseMessage = `Danh sách kênh \`${channelType}\` đã trống.`;
                        } else {
                            channelIds = [];
                            updated = true;
                            responseMessage = `Đã xóa tất cả các kênh \`${channelType}\` được phép.`;
                            embedColor = '#dc3545';
                        }
                        break;
                }

                if (updated) {
                    const updateData = {
                        [dbColumn]: JSON.stringify(channelIds),
                        updated_at: db.fn.now()
                    };

                    if (guildSettings) {
                        await db('guild_settings')
                            .where({ guild_id: guildId })
                            .update(updateData);
                    } else {
                        await db('guild_settings').insert({
                            guild_id: guildId,
                            [dbColumn]: JSON.stringify(channelIds),
                            created_at: db.fn.now(),
                            updated_at: db.fn.now()
                        });
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`Cập nhật cài đặt kênh ${channelType}!`)
                .setDescription(responseMessage)
                .setTimestamp();

            if (action !== 'list') {
                let currentValue;
                if (channelType === 'boss' || channelType === 'welcome') { // Thêm 'welcome' vào đây
                    const latestSettings = await db('guild_settings').where({ guild_id: guildId }).select(dbColumn).first();
                    currentValue = latestSettings && latestSettings[dbColumn] ? `<#${latestSettings[dbColumn]}>` : 'Không có kênh nào được thiết lập.';
                } else {
                    currentValue = channelIds.length > 0 ? channelIds.map(id => `<#${id}>`).join(', ') : 'Không có kênh nào được thiết lập.';
                }
                embed.addFields(
                    {
                        name: `Kênh ${channelType} hiện tại`,
                        value: currentValue,
                        inline: false
                    }
                );
            }

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error(`[SETCHANNEL_COMMAND_ERROR] Lỗi khi thiết lập kênh ${channelType}:`, error);
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi thiết lập kênh. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
