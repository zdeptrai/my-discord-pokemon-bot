// commands/useitem.js
const { MessageFlags } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils');
const { recalculatePokemonStats } = require('../utils/core/pokemonStats');

module.exports = {
    name: 'useitem',
    description: 'Sử dụng một vật phẩm để tăng IV cho Pokémon của bạn.',
    usage: '<pokemon_id> <tên_vật_phẩm>',
    cooldown: 5,
    
    async execute(message, args, client, db) {
        const userId = message.author.id;
        const registered = await isUserRegistered(userId, db);
        if (!registered) {
            return message.reply({
                content: `<@${userId}> Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${client.config.PREFIX}start\` để đăng ký và bắt đầu.`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        if (args.length < 2) {
            return message.reply(`Cú pháp không hợp lệ. Vui lòng sử dụng: \`${client.config.PREFIX}useitem <pokemon_id> <tên_vật_phẩm>\`.`);
        }

        const pokemonId = parseInt(args[0], 10);
        const itemName = args.slice(1).join(' ').toUpperCase();
        
        const reply = await message.reply('Đang sử dụng vật phẩm...');

        try {
            const ivMapping = {
                'IV HP': 'hp_iv',
                'IV ATK': 'attack_iv',
                'IV DEF': 'defense_iv',
                'IV SP.ATK': 'special_attack_iv',
                'IV SP.DEF': 'special_defense_iv',
                'IV SPD': 'speed_iv',
            };

            const ivColumnToUpdate = ivMapping[itemName];
            if (!ivColumnToUpdate) {
                return reply.edit('Vật phẩm này không tồn tại hoặc không phải vật phẩm tăng IV.');
            }

            // --- Cập nhật truy vấn Knex.js ---
            const pokemon = await db('user_pokemons')
                .where({ id: pokemonId, user_discord_id: userId })
                .first();

            if (!pokemon) {
                return reply.edit('Không tìm thấy Pokémon có ID này của bạn.');
            }

            // --- Cập nhật truy vấn Knex.js ---
            const item = await db('items')
                .where({ name: itemName })
                .first();

            if (!item) {
                return reply.edit('Vật phẩm này không tồn tại.');
            }

            // --- Cập nhật truy vấn Knex.js ---
            const userItem = await db('user_inventory_items')
                .where({ user_discord_id: userId, item_id: item.item_id })
                .first();

            if (!userItem || userItem.quantity < 1) {
                return reply.edit(`Bạn không có đủ **${itemName}** trong kho.`);
            }

            if (pokemon[ivColumnToUpdate] >= 31) {
                return reply.edit(`Chỉ số **${itemName}** của Pokémon này đã đạt tối đa (31).`);
            }

            const newIvValue = pokemon[ivColumnToUpdate] + 1;
            
            // --- Cập nhật truy vấn Knex.js ---
            await db('user_pokemons')
                .where({ id: pokemonId })
                .update({ [ivColumnToUpdate]: newIvValue, updated_at: db.fn.now() });
            
            // --- Cập nhật truy vấn Knex.js ---
            await db('user_inventory_items')
                .where({ user_discord_id: userId, item_id: item.item_id })
                .decrement('quantity', 1);

            // Tái tính toán lại các chỉ số sau khi IV đã được cập nhật
            await recalculatePokemonStats(pokemonId, db);
            
            return reply.edit(`Bạn đã sử dụng **${itemName}** để tăng chỉ số IV của Pokémon **${pokemon.nickname || 'Pokémon#' + pokemon.id}** lên **${newIvValue}**.`);

        } catch (error) {
            console.error(`[COMMAND_EXECUTION_ERROR] Lỗi khi thực thi lệnh 'useitem':`, error);
            sendOwnerDM(client, `[Lỗi Thực Thi Lệnh] Lệnh: \`useitem\` bởi <@${userId}>`, error);
            return reply.edit('Đã có lỗi xảy ra khi sử dụng vật phẩm!');
        }
    },
};
