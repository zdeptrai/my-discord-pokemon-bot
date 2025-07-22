// commands/spawn.js
const { db } = require('../db');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { isUserRegistered } = require('../utils/core/userUtils');

module.exports = {
    name: 'spawn', // Đổi tên lệnh thành spawn
    description: 'Tạo ra một Pokémon hoang dã để bắt.', // Cập nhật mô tả
    aliases: ['s', 'wild'], // Cập nhật aliases nếu muốn
    cooldown: 10, // Giữ nguyên cooldown hoặc điều chỉnh

    async execute(message, args, client) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX;

        const registered = await isUserRegistered(userId);
        if (!registered) {
            return message.reply({
                content: `Bạn chưa bắt đầu cuộc phiêu lưu của mình! Vui lòng sử dụng lệnh \`${prefix}start\` để đăng ký và bắt đầu.`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Logic để spawn Pokémon (hiện tại có thể giống catch)
            // Ví dụ: Lấy ngẫu nhiên một Pokémon từ database
            const totalPokemonsResult = await db('pokemons').count('pokedex_id as count').first();
            const totalPokemonsCount = totalPokemonsResult ? parseInt(totalPokemonsResult.count) : 0;

            if (totalPokemonsCount === 0) {
                return message.reply('Không có Pokémon nào trong database để spawn.');
            }

            const randomPokedexId = Math.floor(Math.random() * totalPokemonsCount) + 1;

            const wildPokemonData = await db('pokemons')
                .where('pokedex_id', randomPokedexId)
                .first();

            if (!wildPokemonData) {
                return message.reply('Không thể spawn Pokémon hoang dã. Vui lòng kiểm tra dữ liệu.');
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`Một ${wildPokemonData.name} hoang dã xuất hiện!`)
                .setDescription(`Nhập \`${prefix}catch <nickname tùy chọn>\` để cố gắng bắt nó!`) // Hướng dẫn vẫn là catch để người dùng bắt
                .setImage(wildPokemonData.image_url) // Hoặc sprite_front_url
                .setFooter({ text: `Pokedex ID: ${wildPokemonData.pokedex_id}` })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('[SPAWN_COMMAND_ERROR] Lỗi khi thực hiện lệnh spawn:', error);
            await message.reply('Đã có lỗi xảy ra khi tạo Pokémon hoang dã. Vui lòng thử lại sau.');
        }
    },
};