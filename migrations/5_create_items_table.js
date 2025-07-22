exports.up = function(knex) {
  return knex.schema.createTable('items', function(table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable().unique();
    table.text('description').nullable();
    table.integer('price').notNullable().defaultTo(0);
    table.boolean('consumable').notNullable().defaultTo(false);
    table.text('effect').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('items');
};