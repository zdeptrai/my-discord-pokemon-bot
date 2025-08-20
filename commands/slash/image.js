// commands/slash/image.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch'); // Import node-fetch
const logger = require('../../utils/logger'); // Import logger

module.exports = {
    // Định nghĩa Slash Command
    data: new SlashCommandBuilder()
        .setName('image')
        .setDescription('Lấy một hình ảnh ngẫu nhiên theo chủ đề.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('anime')
                .setDescription('Lấy một hình ảnh anime ngẫu nhiên (chỉ SFW).')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Loại hình ảnh anime bạn muốn.')
                        .setRequired(false) // Không bắt buộc, sẽ mặc định là 'waifu'
                        .addChoices(
                            // Lựa chọn từ Waifu.pics
                            { name: 'Waifu', value: 'waifu' },
                            { name: 'Neko', value: 'neko' },
                            { name: 'Shinobu', value: 'shinobu' },
                            { name: 'Megumin', value: 'megumin' },
                            { name: 'Ôm (Hug)', value: 'hug' },
                            { name: 'Hôn (Kiss)', value: 'kiss' },
                            { name: 'Vỗ đầu (Pat)', value: 'pat' },
                            { name: 'Mỉm cười (Smile)', value: 'smile' },
                            { name: 'Buồn (Cry)', value: 'cry' },
                            { name: 'Hắt hơi (Awoo)', value: 'awoo' }, // Thường là anime wolf girl
                            { name: 'Bonk', value: 'bonk' }, // Meme "Go to horny jail"
                            { name: 'Yeet', value: 'yeet' }, // Meme
                            { name: 'Cringe', value: 'cringe' },
                            { name: 'Cắn (Bite)', value: 'bite' },
                            { name: 'Ôm chặt (Glomp)', value: 'glomp' },
                            { name: 'Tát (Slap)', value: 'slap' },
                            { name: 'Đá (Kick)', value: 'kick' },
                            { name: 'Vui vẻ (Happy)', value: 'happy' },
                            { name: 'Nháy mắt (Wink)', value: 'wink' },
                            
                            // Lựa chọn từ Nekos.life
                            { name: 'Hình nền Anime (Wallpaper)', value: 'nekos_wallpaper' }, // Rất tốt để đa dạng hóa!
                            { name: 'Ảnh mèo (Meow)', value: 'nekos_meow' }, // Đôi khi là anime cat
                            { name: 'Nữ cáo (Fox Girl)', value: 'nekos_fox_girl' },
                            { name: 'Baka', value: 'nekos_baka' }, // GIF
                            { name: 'Avatar Anime', value: 'nekos_avatar' },
                            { name: 'GIF ngẫu nhiên (Gecg)', value: 'nekos_gecg' }, // GIF ngẫu nhiên
                        )
                )
        ),
    
    // Xử lý khi lệnh Slash được gọi
    async execute(interaction, client, db) {
        await interaction.deferReply(); // Gửi phản hồi "đang suy nghĩ..." để tránh timeout

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'anime') {
            const imageType = interaction.options.getString('type') || 'waifu'; // Mặc định là 'waifu'

            let apiUrl;
            let titlePrefix;

            // Logic chọn API URL dựa trên imageType
            if (imageType.startsWith('nekos_')) {
                const nekosLifeType = imageType.replace('nekos_', ''); // Bỏ prefix 'nekos_'
                apiUrl = `https://nekos.life/api/v2/img/${nekosLifeType}`;
                titlePrefix = `Ảnh/GIF Anime (Nekos.life - ${nekosLifeType.charAt(0).toUpperCase() + nekosLifeType.slice(1)})`;
            } else {
                apiUrl = `https://api.waifu.pics/sfw/${imageType}`;
                titlePrefix = `Ảnh Anime (Waifu.pics - ${imageType.charAt(0).toUpperCase() + imageType.slice(1)})`;
            }

            try {
                const response = await fetch(apiUrl);
                const data = await response.json();

                let imageUrl;
                // Waifu.pics và Nekos.life đều trả về URL trong trường 'url'
                if (data.url) {
                    imageUrl = data.url;
                } else if (data.image) { // RandomFox dùng 'image', nhưng chúng ta đang tập trung anime
                    imageUrl = data.image;
                } else {
                    throw new Error('Không tìm thấy URL ảnh trong phản hồi API.');
                }

                if (!response.ok || !imageUrl) {
                    logger.error(`[IMAGE_API_ERROR]`, `Lỗi khi lấy ảnh anime từ ${apiUrl} (${imageType}):`, data);
                    await interaction.editReply({ content: '🚫 Rất tiếc, không thể lấy ảnh anime vào lúc này. Vui lòng thử lại sau.' });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(titlePrefix)
                    .setImage(imageUrl) // Đặt URL ảnh vào Embed
                    .setColor('Random') // Màu ngẫu nhiên cho Embed
                    .setFooter({ text: `Yêu cầu bởi ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                // logger.info(`[IMAGE_COMMAND]`, `Người dùng ${interaction.user.tag} đã lấy ảnh anime loại: ${imageType} từ API: ${apiUrl}`);
            } catch (error) {
                logger.error(`[IMAGE_COMMAND_ERROR]`, `Lỗi khi thực hiện lệnh /image anime với type ${imageType}:`, error);
                await interaction.editReply({ content: '🚫 Đã xảy ra lỗi khi cố gắng lấy ảnh anime. Vui lòng thử lại sau.' });
            }
        } else {
            await interaction.editReply({ content: 'Lệnh ảnh này chưa được triển khai hoàn chỉnh.' });
        }
    },
};