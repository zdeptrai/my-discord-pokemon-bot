// knexfile.js
require('dotenv').config(); // Đảm bảo dotenv được tải ở đầu knexfile.js

const path = require('path');

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || '127.0.0.1', // Sử dụng biến môi trường, fallback nếu không có
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD, // Mật khẩu không nên có fallback mặc định
      database: process.env.DB_NAME || 'pokebot'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.resolve(__dirname, 'migrations')
    },
    seeds: {
      directory: path.resolve(__dirname, 'seeds')
    }
  },
  // ... cấu hình production nếu có
};