// migrations/11_add_learned_skill_ids_to_user_pokemons_table.js
exports.up = function(knex) {
  return knex.schema.table('user_pokemons', function(table) {
    // Thêm cột 'learned_skill_ids' kiểu TEXT, không null, mặc định là chuỗi JSON rỗng
    table.text('learned_skill_ids').notNullable().defaultTo('{}'); // Sử dụng '{}' cho JSON object rỗng hoặc '[]' cho JSON array rỗng
  });
};

exports.down = function(knex) {
  return knex.schema.table('user_pokemons', function(table) {
    table.dropColumn('learned_skill_ids');
  });
};