exports.up = function(knex) {
  return knex.schema.createTable('user_inventory_items', function(table) {
    table.increments('id').primary();
    table.string('user_discord_id', 255).notNullable();
    table.integer('item_id').notNullable();
    table.integer('quantity').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('user_discord_id').references('discord_id').inTable('users').onDelete('CASCADE');
    table.foreign('item_id').references('id').inTable('items').onDelete('CASCADE');
    table.unique(['user_discord_id', 'item_id']); // Ensure unique item per user
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_inventory_items');
};