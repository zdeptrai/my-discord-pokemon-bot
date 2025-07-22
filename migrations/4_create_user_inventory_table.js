exports.up = function(knex) {
  return knex.schema.createTable('user_inventory', function(table) {
    table.string('user_discord_id', 255).primary(); // Discord ID as primary key
    table.integer('pokecoins').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('user_discord_id').references('discord_id').inTable('users').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_inventory');
};