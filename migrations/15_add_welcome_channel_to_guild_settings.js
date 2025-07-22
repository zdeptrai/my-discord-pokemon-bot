// migrations/YYYYMMDDHHMMSS_add_welcome_channel_to_guild_settings.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('guild_settings', function(table) {
    // Thêm cột welcome_channel_id là VARCHAR (cho ID kênh Discord) và có thể NULL
    table.string('welcome_channel_id', 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('guild_settings', function(table) {
    // Xóa cột welcome_channel_id khi rollback
    table.dropColumn('welcome_channel_id');
  });
};