const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('../../utils/logger'); // Giữ lại logger

// Khởi tạo client GCS
const storage = new Storage({
    keyFilename: path.join(__dirname, '..', '..', 'gcloud-key.json')
});

// Tên bucket của bạn
const bucketName = 'discord-bot-photos';

// ✨ Cần cập nhật giá trị này nếu số ảnh thay đổi ✨
const totalFiles = 825; 

module.exports = {
    // Sử dụng SlashCommandBuilder để định nghĩa lệnh
    data: new SlashCommandBuilder()
        .setName('yeuem1doi')
        .setDescription('Lấy một ảnh ngẫu nhiên từ bộ sưu tập của bạn'),
    
    // Logic của lệnh được đặt trong hàm execute
    async execute(interaction) {
        // Sử dụng deferReply để bot có thời gian xử lý

        try {
            // 1. Tạo một chỉ mục ngẫu nhiên dựa trên tổng số tệp
            const randomIndex = Math.floor(Math.random() * totalFiles) + 1;
            
            // 2. Tạo tên tệp tin dựa trên quy tắc đặt tên của bạn
            const fileName = `tiensaker-${String(randomIndex).padStart(3, '0')}.jpg`;

            // 3. Truy vấn trực tiếp tệp tin cụ thể đó
            const file = storage.bucket(bucketName).file(fileName);
            // Không cần lấy metadata trừ khi bạn cần nó cho việc khác
            
            // 4. Tạo URL công khai và gửi lên Discord
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            const embed = new EmbedBuilder()
                .setTitle('Một hình ảnh ngẫu nhiên từ demonking')
                .setImage(publicUrl)
                .setColor('#0099ff')
                .setFooter({ text: `Tên tệp: ${fileName}` });

            // Sử dụng editReply thay vì reply sau khi đã defer
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error("Lỗi khi truy cập bucket:", error);
            // Sử dụng editReply để phản hồi lỗi nếu đã defer
            await interaction.editReply({ content: 'Đã xảy ra lỗi khi cố gắng lấy ảnh.', ephemeral: true });
        }
    },
};