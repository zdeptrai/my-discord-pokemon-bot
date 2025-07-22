// migrations/YYYYMMDDHHMMSS_add_boss_channel_to_guild_settings.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('guild_settings', function(table) {
    // Thêm cột boss_channel_id là VARCHAR (cho ID Discord) và có thể NULL
    table.string('boss_channel_id', 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('guild_settings', function(table) {
    // Xóa cột boss_channel_id khi rollback
    table.dropColumn('boss_channel_id');
  });
};