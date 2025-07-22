// migrations/YYYYMMDDHHMMSS_add_training_time_to_user_pokemons.js
exports.up = function(knex) {
  return knex.schema.alterTable('user_pokemons', function(table) {
    table.timestamp('training_start_time').nullable(); // Thêm cột mới
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('user_pokemons', function(table) {
    table.dropColumn('training_start_time'); // Xóa cột nếu rollback
  });
};