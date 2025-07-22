// migrations/YYYYMMDDHHMMSS_create_active_spawns_table.js
// (Đảm bảo tên file của bạn khớp với timestamp tự động tạo)

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('active_spawns', function(table) {
    table.increments('id').primary();
    table.string('channel_id').notNullable();
    table.string('message_id').notNullable().unique();
    table.integer('pokedex_id').notNullable();

    // IVs của Pokémon hoang dã
    table.integer('hp_iv').notNullable().defaultTo(0);
    table.integer('attack_iv').notNullable().defaultTo(0);
    table.integer('defense_iv').notNullable().defaultTo(0);
    table.integer('special_attack_iv').notNullable().defaultTo(0);
    table.integer('special_defense_iv').notNullable().defaultTo(0);
    table.integer('speed_iv').notNullable().defaultTo(0);

    table.integer('level').notNullable().defaultTo(1);
    table.string('catcher_id').nullable();
    table.timestamp('spawn_time').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
    table.timestamps(true, true); // created_at và updated_at
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('active_spawns');
};