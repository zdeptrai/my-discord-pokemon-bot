const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('../../utils/logger');
const Knex = require('knex');
const knexConfig = require('../../knexfile');
const knex = Knex(knexConfig.development);

const bucketName = 'discord-bot-photos';
let fileNames = []; 

async function loadFilesFromDatabase() {
    try {
        const rows = await knex('images').select('name');
        fileNames = rows.map(row => row.name);
        logger.info(`Đã tải thành công ${fileNames.length} tên tệp từ database.`);
    } catch (error) {
        logger.error('Lỗi khi tải danh sách tệp từ database:', error);
    }
}

loadFilesFromDatabase();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yeuem1doi')
        .setDescription('Lấy một ảnh ngẫu nhiên từ bộ sưu tập của bạn'),
    
    // Add the cooldown property here. The value is in seconds.
    cooldown: 60, 
    
    async execute(interaction) {
        // The deferReply is handled in the interactionCreate handler

        try {
            if (fileNames.length === 0) {
                await interaction.editReply({ content: 'Bộ sưu tập ảnh đang trống. Vui lòng thử lại sau.' });
                return;
            }

            const randomIndex = Math.floor(Math.random() * fileNames.length);
            const fileName = fileNames[randomIndex];
            
            const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
            
            const embed = new EmbedBuilder()
                .setTitle('Một hình ảnh ngẫu nhiên từ demonking')
                .setImage(publicUrl)
                .setColor('Random')
                .setFooter({ text: `Tên tệp: ${fileName}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Lỗi khi xử lý lệnh /yeuem1doi:', error);
            await interaction.editReply({ content: 'Đã xảy ra lỗi khi cố gắng lấy ảnh.', ephemeral: true });
        }
    },
};