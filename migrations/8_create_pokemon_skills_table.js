// migrations/YYYYMMDDHHMMSS_create_pokemon_skills_table.js
exports.up = function(knex) {
  return knex.schema.createTable('pokemon_skills', function(table) {
    // khóa chính kết hợp để đảm bảo mỗi cặp pokemon_id và skill_id là duy nhất
    table.integer('pokedex_id').notNullable().references('pokedex_id').inTable('pokemons').onDelete('CASCADE');
    table.integer('skill_id').notNullable().references('skill_id').inTable('skills').onDelete('CASCADE');
    table.integer('learn_level').notNullable(); // Cấp độ mà Pokémon học được kỹ năng này
    table.primary(['pokedex_id', 'skill_id', 'learn_level']); // Khóa chính kết hợp

    // Tùy chọn: Thêm timestamps nếu bạn muốn biết khi nào mối quan hệ này được thêm
    // table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('pokemon_skills');
};