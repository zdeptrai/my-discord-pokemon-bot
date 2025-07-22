// migrations/YYYYMMDDHHMMSS_add_last_boss_dungeon_time_to_users.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.timestamp('last_boss_dungeon_time', { useTz: true }).nullable();
    // 'useTz: true' sẽ lưu timestamp kèm múi giờ (timestamp with time zone)
    // '.nullable()' cho phép cột này có giá trị NULL ban đầu
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('users', function(table) {
    table.dropColumn('last_boss_dungeon_time');
  });
};