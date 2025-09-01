const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('../../utils/logger');
// ✨ Thêm Knex và sửa lại cách khởi tạo
const Knex = require('knex');
const knexConfig = require('../../knexfile');
const knex = Knex(knexConfig.development);

const bucketName = 'discord-bot-photos';
let fileNames = []; 

/**
 * Tải danh sách tên tệp từ database.
 * Hàm này chỉ chạy một lần khi bot khởi động.
 */
async function loadFilesFromDatabase() {
    try {
        const rows = await knex('images').select('name');
        fileNames = rows.map(row => row.name);
        logger.info(`Đã tải thành công ${fileNames.length} tên tệp từ database.`);
    } catch (error) {
        logger.error('Lỗi khi tải danh sách tệp từ database:', error);
    }
}

// Gọi hàm này khi module được tải
loadFilesFromDatabase();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yeuem1doi')
        .setDescription('Lấy một ảnh ngẫu nhiên từ bộ sưu tập của bạn'),
    
    async execute(interaction) {
        // Vì bạn đã xử lý deferReply() ở file interactionCreate.js nên không cần ở đây

        try {
            if (fileNames.length === 0) {
                await interaction.editReply({ content: 'Bộ sưu tập ảnh đang trống. Vui lòng thử lại sau.' });
                return;
            }

            // 1. Chọn một tên tệp ngẫu nhiên từ mảng đã được tải
            const randomIndex = Math.floor(Math.random() * fileNames.length);
            const fileName = fileNames[randomIndex];
            
            // 2. Tạo URL công khai trực tiếp từ tên tệp đã chọn
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            
            // 3. Tạo và gửi embed
            const embed = new EmbedBuilder()
                .setTitle('Một hình ảnh ngẫu nhiên từ demonking')
                .setImage(publicUrl)
                .setColor('#0099ff')
                .setFooter({ text: `Tên tệp: ${fileName}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Lỗi khi xử lý lệnh /yeuem1doi:', error);
            await interaction.editReply({ content: 'Đã xảy ra lỗi khi cố gắng lấy ảnh.', ephemeral: true });
        }
    },
};