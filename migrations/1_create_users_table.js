// Trong migrations/YOUR_TIMESTAMP_create_users_table.js
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary(); // SERIAL PRIMARY KEY for PostgreSQL
    table.string('discord_id', 255).notNullable().unique();
    table.integer('pokecoins').notNullable().defaultTo(0);
    table.integer('selected_pokemon_id').nullable();
    table.integer('starter_pokemon_id').nullable(); // <--- THÊM DÒNG NÀY
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};