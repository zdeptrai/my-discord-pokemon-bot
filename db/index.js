// db/index.js
// Đây là nơi bạn khởi tạo Knex instance và kết nối nó với cấu hình database

const knexConfig = require('../knexfile'); // Import cấu hình Knex
const knex = require('knex');

// Chọn cấu hình database dựa trên môi trường hiện tại (development, production, v.v.)
// Nếu không có NODE_ENV, mặc định là 'development'
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// Khởi tạo Knex instance
const db = knex(config);

// Export Knex instance để các module khác có thể sử dụng
module.exports = { db };