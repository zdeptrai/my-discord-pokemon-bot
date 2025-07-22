// migrations/YYYYMMDDHHMMSS_create_skills_table.js
exports.up = function(knex) {
  return knex.schema.createTable('skills', function(table) {
    table.integer('skill_id').primary(); // ID của kỹ năng từ API
    table.string('name', 255).notNullable().unique(); // <--- Cột này phải có!
    table.string('type', 50).notNullable(); // Loại kỹ năng (ví dụ: Fire, Water)
    table.string('category', 50).notNullable(); // Vật lý, Đặc biệt, Thay đổi
    table.integer('power').nullable(); // Sức mạnh (có thể null nếu là kỹ năng thay đổi)
    table.integer('pp').nullable(); // Power Points (số lần sử dụng)
    table.integer('accuracy').nullable(); // Độ chính xác (có thể null)
    table.text('description').nullable(); // Mô tả kỹ năng
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('skills');
};