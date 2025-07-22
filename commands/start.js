// commands/start.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js'); // Thêm MessageFlags
const { isUserRegistered } = require('../utils/core/userUtils');
const { getPokemonInfo } = require('../utils/core/pokemonData'); // Đảm bảo đường dẫn này đúng

module.exports = {
    name: 'start',
    description: 'Bắt đầu hành trình Pokémon của bạn và chọn Pokémon khởi đầu.',
    cooldown: 10,

    async execute(message, args, client, db) {
        const userId = message.author.id;

        try {
            // 1. Kiểm tra xem người dùng đã đăng ký chưa
            const registered = await isUserRegistered(userId);
            if (registered) {
                // SỬA LỖI XÓA TIN NHẮN:
                // Sử dụng message.channel.send với MessageFlags.Ephemeral để gửi tin nhắn riêng tư
                // Tin nhắn này sẽ chỉ hiển thị cho người dùng và tự động biến mất, không cần setTimeout để xóa.
                await message.channel.send({
                    content: `<@${userId}> Bạn đã là một huấn luyện viên rồi! Hãy tiếp tục cuộc phiêu lưu của mình.`,
                    flags: MessageFlags.Ephemeral // Chỉ hiển thị cho người dùng đã gõ lệnh
                }).catch(e => console.error("Không thể gửi tin nhắn ephemeral cho người dùng đã đăng ký:", e));

                // KHÔNG CẦN XÓA TIN NHẮN GỐC CỦA NGƯỜI DÙNG Ở ĐÂY NỮA
                // (Nếu bạn có một hệ thống xóa tin nhắn lệnh tập trung ở index.js thì nó sẽ xử lý.
                // Nếu không, tin nhắn gốc sẽ ở lại, không bị xóa.)
                return;
            }

            // 2. Gửi tin nhắn chọn Pokémon với Embed và các nút
            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // Màu xanh lam chung cho thông báo giới thiệu
                .setTitle('Chào mừng đến với thế giới Pokémon!')
                .setDescription('Để bắt đầu hành trình của mình, bạn hãy chọn một trong ba Pokémon khởi đầu sau:')
                .addFields(
                    { name: '🌱 Bulbasaur', value: 'Pokémon hệ Cỏ/Độc', inline: true },
                    { name: '🔥 Charmander', value: 'Pokémon hệ Lửa', inline: true },
                    { name: '💧 Squirtle', value: 'Pokémon hệ Nước', inline: true }
                )
                // Đảm bảo URL này là một hình ảnh tổng hợp hoặc biểu tượng phù hợp cho các starter
                .setImage('https://images2.alphacoders.com/718/thumb-1920-718222.png') // ĐÃ GIỮ NGUYÊN HÌNH ẢNH
                .setTimestamp()
                .setFooter({ text: 'Chọn Pokémon của bạn!' }); // ĐÃ GIỮ NGUYÊN FOOTER

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('select_starter_bulbasaur') // ID cho Bulbasaur
                        .setLabel('Bulbasaur')
                        .setStyle(ButtonStyle.Success), // Màu xanh lá cây cho hệ Cỏ
                    new ButtonBuilder()
                        .setCustomId('select_starter_charmander') // ID cho Charmander
                        .setLabel('Charmander')
                        .setStyle(ButtonStyle.Danger), // Màu đỏ cho hệ Lửa
                    new ButtonBuilder()
                        .setCustomId('select_starter_squirtle') // ID cho Squirtle
                        .setLabel('Squirtle')
                        .setStyle(ButtonStyle.Primary), // Màu xanh dương cho hệ Nước
                );

            // SỬA LỖI PHẢN HỒI VÀ XÓA TIN NHẮN:
            // Sử dụng message.channel.send thay vì message.reply.
            // Điều này là cần thiết để tránh lỗi "Unknown interaction" khi người dùng nhấn nút,
            // vì `handleStarterSelection.js` sẽ sử dụng interaction.editReply().
            const sentMessage = await message.channel.send({ // SỬA TỪ message.reply SANG message.channel.send
                content: `<@${userId}>`, // Tag người dùng, bạn có thể xóa nếu không muốn
                embeds: [embed],
                components: [row]
            }).catch(e => console.error("Không thể gửi tin nhắn chọn Pokémon:", e));

            // SỬA LỖI XÓA TIN NHẮN:
            // Loại bỏ setTimeout xóa tin nhắn gốc của người dùng.
            // Nếu bạn muốn tin nhắn gốc của người dùng bị xóa, hãy thêm logic xóa vào file index.js của bạn
            // (thường là sau khi lệnh đã được thực thi thành công).
            // setTimeout(() => {
            //     message.delete().catch(e => console.error("Could not delete user message:", e));
            // }, 5000); // Dòng này đã được loại bỏ theo yêu cầu của bạn

        } catch (error) {
            console.error(`[START_COMMAND_ERROR] Lỗi khi xử lý lệnh start cho ${message.author.tag}:`, error);
            // Gửi tin nhắn lỗi riêng tư
            await message.channel.send({
                content: `<@${userId}> Đã có lỗi xảy ra khi bắt đầu hành trình của bạn. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Không thể gửi tin nhắn lỗi ephemeral:", e));
        }
    },
};