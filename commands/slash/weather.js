// commands/slash/weather.js

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js'); // Import MessageFlags
const fetch = require('node-fetch');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Hiển thị thông tin thời tiết hiện tại cho một thành phố.')
        .addStringOption(option =>
            option.setName('city')
                .setDescription('Tên thành phố bạn muốn xem thời tiết.')
                .setRequired(true)),
    
    async execute(interaction, client) {
        const userId = interaction.user.id;
        const city = interaction.options.getString('city');

        // THAY ĐỔI: Không sử dụng flags: MessageFlags.Ephemeral ở đây nữa
        // Điều này làm cho phản hồi ban đầu và phản hồi cuối cùng là công khai

        if (!OPENWEATHER_API_KEY) {
            console.error('[WEATHER_COMMAND_ERROR] OPENWEATHER_API_KEY không được thiết lập trong .env!');
            return interaction.editReply({
                content: `Lỗi: Khóa API OpenWeatherMap chưa được thiết lập. Vui lòng liên hệ quản trị viên bot.`,
                flags: MessageFlags.Ephemeral // Thông báo lỗi vẫn là ephemeral
            });
        }

        // encodeURIComponent là cần thiết để xử lý các ký tự đặc biệt và khoảng trắng trong tên thành phố
        // Ví dụ: "Hà Nội" sẽ thành "H%C3%A0%20N%E1%BB%99i"
        // OpenWeatherMap API thường hỗ trợ tên thành phố không dấu tốt hơn hoặc tên tiếng Anh
        // Nếu gặp lỗi "city not found" với tên có dấu, hãy thử tên không dấu (vd: "Ha Noi")
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.cod !== 200) {
                let errorMessage = `Không thể lấy thông tin thời tiết cho **${city}**.`;
                if (data.message) {
                    errorMessage += ` Lỗi: ${data.message}`;
                } else if (data.cod === '404') {
                    errorMessage += ` Không tìm thấy thành phố này. Vui lòng kiểm tra lại tên hoặc thử tên không dấu (ví dụ: "Ha Noi").`;
                }
                console.error(`[WEATHER_API_ERROR] Phản hồi lỗi từ OpenWeatherMap cho "${city}":`, data);
                return interaction.editReply({ 
                    content: errorMessage,
                    flags: MessageFlags.Ephemeral // Thông báo lỗi vẫn là ephemeral
                });
            }

            const { main, weather, wind, sys, name, dt, timezone } = data;
            const weatherDescription = weather[0].description;
            const temperature = main.temp.toFixed(1);
            const feelsLike = main.feels_like.toFixed(1);
            const humidity = main.humidity;
            const windSpeed = (wind.speed * 3.6).toFixed(1);
            const pressure = main.pressure;
            const iconCode = weather[0].icon;
            const iconUrl = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;

            const cityOffset = timezone; 

            const sunriseUtcSeconds = sys.sunrise;
            const sunsetUtcSeconds = sys.sunset;
            const currentUtcSeconds = dt;

            const formatTime = (utcSeconds, offsetSeconds) => {
                const date = new Date((utcSeconds + offsetSeconds) * 1000);
                const hours = date.getUTCHours().toString().padStart(2, '0');
                const minutes = date.getUTCMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            };

            const sunriseTime = formatTime(sunriseUtcSeconds, cityOffset);
            const sunsetTime = formatTime(sunsetUtcSeconds, cityOffset);
            const currentTime = formatTime(currentUtcSeconds, cityOffset);


            const weatherEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Thời tiết tại ${name} 🌤️`)
                .setDescription(`**${weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1)}**`)
                .setThumbnail(iconUrl)
                .addFields(
                    { name: '🌡️ Nhiệt độ', value: `${temperature}°C (Cảm nhận: ${feelsLike}°C)`, inline: true },
                    { name: '💧 Độ ẩm', value: `${humidity}%`, inline: true },
                    { name: '💨 Gió', value: `${windSpeed} km/h`, inline: true },
                    { name: '📊 Áp suất', value: `${pressure} hPa`, inline: true },
                    { name: '☀️ Mặt trời mọc', value: sunriseTime, inline: true },
                    { name: '🌙 Mặt trời lặn', value: sunsetTime, inline: true }
                )
                .setFooter({ text: `Cập nhật lúc: ${currentTime} | Dữ liệu từ OpenWeatherMap` })
                .setTimestamp();

            // THAY ĐỔI: Không sử dụng flags: MessageFlags.Ephemeral ở đây nữa
            await interaction.editReply({ embeds: [weatherEmbed] });

        } catch (error) {
            console.error(`[WEATHER_COMMAND_ERROR] Lỗi khi lấy thời tiết cho ${city}:`, error);
            return interaction.editReply({ 
                content: `Đã xảy ra lỗi khi lấy thông tin thời tiết. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral // Thông báo lỗi vẫn là ephemeral
            });
        }
    },
};
