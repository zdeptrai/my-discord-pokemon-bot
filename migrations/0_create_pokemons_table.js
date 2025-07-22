// Trong migrations/YOUR_TIMESTAMP_create_pokemons_table.js
exports.up = function(knex) {
  return knex.schema.createTable('pokemons', function(table) {
    table.integer('pokedex_id').primary(); // Khóa chính
    table.string('name', 255).notNullable().unique();
    table.string('form', 255).nullable(); // Cột form cho dạng đặc biệt và tiến hóa
    table.integer('species_pokedex_id').notNullable(); // ID loài gốc
    table.string('type1', 50).notNullable();
    table.string('type2', 50).nullable();
    table.string('rarity', 50).nullable(); // Cột độ hiếm (Common, Rare, Legendary, Mythical)
    table.string('sprite_front_url', 255).nullable();
    table.string('sprite_back_url', 255).nullable();
    table.string('official_artwork_url', 255).nullable();
    table.integer('hp').notNullable();
    table.integer('attack').notNullable();
    table.integer('defense').notNullable();
    table.integer('special_attack').notNullable();
    table.integer('special_defense').notNullable();
    table.integer('speed').notNullable();
    // Đã bỏ cột 'generation'
    table.integer('evolution_chain_id').nullable();
    table.string('mega_stone_name', 255).nullable();
    table.integer('capture_rate').nullable(); // Cột tỷ lệ bắt gốc từ API
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('pokemons');
};