exports.up = function(knex) {
  return knex.schema.createTable('evolutions', function(table) {
    table.increments('id').primary();
    table.integer('pokedex_id').notNullable();
    table.integer('evolves_to_pokedex_id').notNullable();
    table.integer('evolution_level').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('pokedex_id').references('pokedex_id').inTable('pokemons').onDelete('CASCADE');
    table.foreign('evolves_to_pokedex_id').references('pokedex_id').inTable('pokemons').onDelete('CASCADE');
    table.unique(['pokedex_id', 'evolves_to_pokedex_id']); // A Pokémon only evolves into a specific form once
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('evolutions');
};