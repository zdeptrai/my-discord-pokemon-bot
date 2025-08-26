const { Storage } = require('@google-cloud/storage');
const { EmbedBuilder } = require('discord.js');
const path = require('path');
const logger = require('../utils/logger');

// Khởi tạo client GCS
const storage = new Storage({
  keyFilename: path.join(__dirname, 'gcloud-key.json') 
});

// Tên bucket của bạn
const bucketName = 'discord-bot-photos'; 

// ✨ Số tệp tin bạn có trong bucket ✨
// Bạn cần cập nhật giá trị này mỗi khi thêm hoặc xóa ảnh
const totalFiles = 56; // Thay đổi giá trị này thành tổng số ảnh của bạn

module.exports = {
  name: 'rando',
  description: 'Lấy một ảnh ngẫu nhiên từ demonking',
  async execute(message, args) {
    try {
      // 1. Tạo một chỉ mục ngẫu nhiên dựa trên tổng số tệp
      const randomIndex = Math.floor(Math.random() * totalFiles) + 1;
      
      // 2. Tạo tên tệp tin dựa trên quy tắc đặt tên của bạn
      const fileName = `tiensaker-${String(randomIndex).padStart(3, '0')}.jpg`; // ✨ SỬA ĐỊNH DẠNG NẾU CẦN ✨

      // 3. Truy vấn trực tiếp tệp tin cụ thể đó
      const file = storage.bucket(bucketName).file(fileName);
      const [metadata] = await file.getMetadata();

      // 4. Tạo URL công khai và gửi lên Discord
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      const embed = new EmbedBuilder()
        .setTitle('Một hình ảnh ngẫu nhiên từ demonking')
        .setImage(publicUrl)
        .setColor('#0099ff')
        .setFooter({ text: `Tên tệp: ${fileName}` });

      message.channel.send({ embeds: [embed] });

    } catch (error) {
      logger.error("Lỗi khi truy cập bucket:", error);
      message.channel.send('Đã xảy ra lỗi khi cố gắng lấy ảnh.');
    }
  },
};