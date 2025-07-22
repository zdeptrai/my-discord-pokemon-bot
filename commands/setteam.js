// commands/setteam.js
const { MessageFlags } = require('discord.js');

module.exports = {
    name: 'setteam',
    description: 'Quản lý đội Pokémon của bạn cho các trận đấu PvP. Sử dụng !setteam <ID_Pokémon> <vị_trí_1-5_hoặc_0_để_gỡ>.',
    aliases: ['st'],
    usage: '<ID_Pokémon> <slot_1-5_hoặc_0_để_gỡ>',
    cooldown: 3, // Cooldown 3 giây

    async execute(message, args, client, db) {
        const userId = message.author.id;

        if (args.length !== 2) {
            return message.channel.send({
                content: `<@${userId}> Vui lòng sử dụng đúng cú pháp: \`${client.config.PREFIX}setteam <ID_Pokémon> <vị_trí_1-5_hoặc_0_để_gỡ}>\`.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const pokemonId = parseInt(args[0]);
        const targetSlot = parseInt(args[1]);

        if (isNaN(pokemonId) || isNaN(targetSlot)) {
            return message.channel.send({
                content: `<@${userId}> ID Pokémon và vị trí phải là số hợp lệ.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (targetSlot < 0 || targetSlot > 5) {
            return message.channel.send({
                content: `<@${userId}> Vị trí trong đội phải từ 1 đến 5, hoặc 0 để gỡ Pokémon khỏi đội hình.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Lấy tất cả Pokémon của người dùng và đội hình hiện tại
        // ĐÃ SỬA: Thêm JOIN với bảng 'pokemons' để lấy tên cơ bản của Pokémon
        const userPokemons = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where('user_discord_id', userId)
            .select('user_pokemons.id', 'user_pokemons.nickname', 'pokemons.name as pokemon_base_name', 'user_pokemons.team_slot');

        const targetPokemon = userPokemons.find(p => p.id === pokemonId);

        if (!targetPokemon) {
            return message.channel.send({ content: `<@${userId}> Không tìm thấy Pokémon này trong bộ sưu tập của bạn.`, flags: MessageFlags.Ephemeral });
        }

        // Sử dụng pokemon_base_name thay cho pokemon_name
        const pokemonDisplayName = targetPokemon.nickname || targetPokemon.pokemon_base_name;

        if (targetSlot === 0) { // Gỡ Pokémon khỏi đội hình
            if (targetPokemon.team_slot === null) {
                return message.channel.send({ content: `<@${userId}> ${pokemonDisplayName} không có trong đội hình của bạn.`, flags: MessageFlags.Ephemeral });
            }

            await db('user_pokemons')
                .where('id', pokemonId)
                .andWhere('user_discord_id', userId)
                .update({ team_slot: null });

            return message.channel.send({ content: `✅ Đã gỡ **${pokemonDisplayName}** khỏi đội hình của bạn.` });

        } else { // Thêm hoặc di chuyển Pokémon vào một vị trí cụ thể (1-5)
            // 1. Kiểm tra nếu Pokémon đã ở vị trí đích
            if (targetPokemon.team_slot === targetSlot) {
                return message.channel.send({ content: `<@${userId}> ${pokemonDisplayName} đã ở trong đội hình tại vị trí ${targetSlot} rồi.`, flags: MessageFlags.Ephemeral });
            }

            let replyContent = '';
            let isMovingExistingPokemon = false;

            // 2. Nếu Pokémon mục tiêu đang ở một slot khác, gỡ nó khỏi slot cũ
            if (targetPokemon.team_slot !== null) {
                isMovingExistingPokemon = true;
                replyContent += `**${pokemonDisplayName}** đã được di chuyển từ vị trí **${targetPokemon.team_slot}**`;
                // Việc update xuống slot mới sẽ tự động ghi đè, không cần update riêng thành null
            }

            // 3. Kiểm tra xem có Pokémon nào khác đang ở vị trí đích không
            const pokemonCurrentlyInTargetSlot = userPokemons.find(p => p.team_slot === targetSlot && p.id !== pokemonId);
            if (pokemonCurrentlyInTargetSlot) {
                // Gỡ Pokémon cũ ra khỏi vị trí đích
                await db('user_pokemons')
                    .where('id', pokemonCurrentlyInTargetSlot.id)
                    .andWhere('user_discord_id', userId)
                    .update({ team_slot: null });
                
                // Sử dụng pokemon_base_name cho pokemonCurrentlyInTargetSlot
                const oldPokemonDisplayName = pokemonCurrentlyInTargetSlot.nickname || pokemonCurrentlyInTargetSlot.pokemon_base_name;

                if (isMovingExistingPokemon) {
                    replyContent += ` và thay thế **${oldPokemonDisplayName}** tại vị trí **${targetSlot}**.`;
                } else {
                    replyContent += `✅ **${oldPokemonDisplayName}** đã được gỡ khỏi vị trí **${targetSlot}** để nhường chỗ.`;
                }
            } else {
                if (isMovingExistingPokemon) {
                    replyContent += ` sang vị trí **${targetSlot}**.`;
                }
            }

            // 4. Cập nhật Pokémon mục tiêu vào vị trí mới
            await db('user_pokemons')
                .where('id', pokemonId)
                .andWhere('user_discord_id', userId)
                .update({ team_slot: targetSlot });
            
            // Xây dựng thông báo cuối cùng nếu chưa được xây dựng đầy đủ
            if (!isMovingExistingPokemon && !pokemonCurrentlyInTargetSlot) {
                replyContent = `✅ Đã thêm **${pokemonDisplayName}** vào đội hình tại vị trí **${targetSlot}**!`;
            } else if (!isMovingExistingPokemon && pokemonCurrentlyInTargetSlot) {
                // Đã xử lý ở trên: `✅ **${oldPokemonDisplayName}** đã được gỡ khỏi vị trí **${targetSlot}** để nhường chỗ.`
                // Bổ sung thêm thông báo về pokemon mới được thêm vào
                replyContent = `✅ Đã thêm **${pokemonDisplayName}** vào đội hình tại vị trí **${targetSlot}**! (Thay thế **${pokemonCurrentlyInTargetSlot.nickname || pokemonCurrentlyInTargetSlot.pokemon_base_name}**)`;
            }
            // Các trường hợp isMovingExistingPokemon đã được xây dựng replyContent ở trên

            return message.channel.send({ content: replyContent });
        }
    },
};
