**Cấu hình biến môi trường (`.env`):**
    Tạo một file có tên `.env` trong thư mục gốc của dự án. File này chứa các thông tin nhạy cảm của bot và sẽ không được upload lên Git. Bạn có thể tham khảo cấu trúc từ file `.env.example` đã cung cấp.

    **Nội dung mẫu cho file `.env`:**

    ```env
    # Thông tin cơ bản về Discord Bot
    DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
    DISCORD_CLIENT=YOUR_BOT_APPLICATION_ID_HERE
    # DISCORD_GUILDS=YOUR_GUILD_ID_FOR_DEVELOPMENT_ONLY # Bỏ comment và điền ID guild nếu bạn chỉ muốn triển khai lệnh cục bộ (dev)

    # Prefix cho các lệnh cũ (nếu có sử dụng lệnh prefix)
    PREFIX=!

    # Cấu hình Cơ sở dữ liệu
    DB_HOST=YOUR_DB_HOST
    DB_PORT=YOUR_DB_PORT
    DB_USER=YOUR_DB_USERNAME
    DB_PASSWORD=YOUR_DB_PASSWORD
    DB_NAME=YOUR_DB_NAME

    # Khóa API cho các dịch vụ bên ngoài
    OPENWEATHER_API_KEY=YOUR_OPENWEATHERMAP_API_KEY_HERE
    OWNER_DISCORD_ID=YOUR_DISCORD_USER_ID_HERE # ID của bạn để nhận tin nhắn lỗi DM

    # Khóa API cho AI (Gemini)
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

    # Cấu hình LOG HIỂN THỊ TRÊN TERMINAL (CONSOLE OUTPUT)
    CONSOLE_LOG_DEBUG=false
    CONSOLE_LOG_INFO=true
    CONSOLE_LOG_WARN=true
    CONSOLE_LOG_ERROR=true
    CONSOLE_LOG_FATAL=true
    CONSOLE_LOG_MESSAGE=false

    # Cấu hình GHI LOG VÀO FILE
    ENABLE_DEBUG_FILE_LOGGING=true
    ENABLE_INFO_FILE_LOGGING=true
    ENABLE_WARN_FILE_LOGGING=true
    ENABLE_ERROR_FILE_LOGGING=true
    ENABLE_MESSAGE_FILE_LOGGING=true

    # Tên file log cho từng cấp độ (sẽ nằm trong thư mục /logs)
    DEBUG_LOG_FILE=bot_debug.log
    INFO_LOG_FILE=bot_info.log
    WARN_LOG_FILE=bot_warn.log
    ERROR_LOG_FILE=bot_error.log
    MESSAGE_LOG_FILE=messages.log

    # Giới hạn kích thước file log (tính bằng MB) và số lượng file backup
    LOG_FILE_MAX_SIZE_MB=5
    LOG_FILE_MAX_BACKUPS=3
    ```

4.  **Thiết lập Cơ sở dữ liệu:**
    Trước khi chạy bot, bạn cần khởi tạo cấu trúc cơ sở dữ liệu.
    ```bash
    npm run migrate
    # Hoặc nếu bạn không có script trong package.json: npx knex migrate:latest
    ```
    Nếu bạn có các script để điền dữ liệu ban đầu (ví dụ: Pokémon, Skills, Items), hãy chạy chúng:
    ```bash
    node importPokemonData.js
    node populateEvolutionsFromApi.js
    node populateCustomEvolutions.js
    # Thêm bất kỳ script populate dữ liệu nào khác của bạn
    ```

5.  **Đăng ký Lệnh Slash (Deploy Slash Commands):**
    Bạn cần đăng ký các lệnh slash của bot lên Discord API. Điều này chỉ cần thực hiện một lần khi có thay đổi về lệnh.
    ```bash
    node deploy-commands.js
    ```
    *Lưu ý:* Nếu bạn đã đặt `DISCORD_GUILDS` trong `.env`, lệnh sẽ chỉ được đăng ký cho guild đó (thích hợp cho phát triển). Nếu không có `DISCORD_GUILDS`, lệnh sẽ được đăng ký toàn cầu (có thể mất vài phút đến 1 giờ để Discord cập nhật).

6.  **Khởi động Bot:**
    ```bash
    node index.js
    # Hoặc nếu bạn đã cấu hình script 'start' trong package.json: npm start
    ```
