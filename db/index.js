// db.js
const knex = require('knex');
require('dotenv').config(); // Đảm bảo dotenv được tải để truy cập các biến môi trường

// Lấy thông tin kết nối PostgreSQL từ biến môi trường của bạn
const pgConfig = {
  host: process.env.DB_HOST || 'localhost', // Sử dụng DB_HOST
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432, // Sử dụng DB_PORT
  user: process.env.DB_USER, // Sử dụng DB_USER
  password: process.env.DB_PASSWORD, // Sử dụng DB_PASSWORD
  database: process.env.DB_NAME, // Sử dụng DB_NAME
};

// Kiểm tra xem các biến môi trường cần thiết đã được đặt chưa
if (!pgConfig.user || !pgConfig.database) { // Mật khẩu có thể trống, nên không kiểm tra
  console.error("Lỗi: Vui lòng đảm bảo DB_USER và DB_NAME được đặt trong file .env của bạn.");
  process.exit(1);
}

const db = knex({
  client: 'pg', // Client cho PostgreSQL
  connection: pgConfig,
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  },
  useNullAsDefault: true, 
});

// Kiểm tra kết nối database khi khởi động
db.raw('SELECT 1')
  .then(() => {
    console.log(`[DATABASE] Đã kết nối database PostgreSQL thành công tới: ${pgConfig.database} trên ${pgConfig.host}:${pgConfig.port}`);
  })
  .catch((error) => {
    console.error(`[DATABASE_ERROR] Lỗi kết nối database PostgreSQL tới ${pgConfig.database}:`, error);
    process.exit(1); // Thoát ứng dụng nếu không kết nối được DB
  });

module.exports = { db };
