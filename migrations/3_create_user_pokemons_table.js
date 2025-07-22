exports.up = function(knex) {
  return knex.schema.createTable('user_pokemons', function(table) {
    table.increments('id').primary();
    table.string('user_discord_id', 255).notNullable();
    table.integer('pokedex_id').notNullable();
    table.string('nickname', 255).nullable();
    table.integer('level').notNullable().defaultTo(1);
    table.integer('experience').notNullable().defaultTo(0);
    table.integer('current_hp').notNullable();
    table.integer('max_hp').notNullable();
    table.integer('attack').notNullable();
    table.integer('defense').notNullable();
    table.integer('special_attack').notNullable();
    table.integer('special_defense').notNullable();
    table.integer('speed').notNullable();
    table.integer('hp_iv').notNullable().defaultTo(0);
    table.integer('attack_iv').notNullable().defaultTo(0);
    table.integer('defense_iv').notNullable().defaultTo(0);
    table.integer('special_attack_iv').notNullable().defaultTo(0);
    table.integer('special_defense_iv').notNullable().defaultTo(0);
    table.integer('speed_iv').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.foreign('user_discord_id').references('discord_id').inTable('users').onDelete('CASCADE');
    table.foreign('pokedex_id').references('pokedex_id').inTable('pokemons').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_pokemons');
};