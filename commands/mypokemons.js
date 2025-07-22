// commands/mypokemons.js
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    Message, MessageComponentInteraction, EmbedBuilder
} = require('discord.js');
const { db } = require('../db');
const { getSelectedOrFirstPokemon } = require('../utils/core/userUtils'); 
const { generatePokemonEmbed } = require('../utils/battle/battleUtils'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Giữ lại cho các lỗi nghiêm trọng

const POKEMONS_PER_PAGE = 15; 
const SELECT_MENU_MAX_OPTIONS = 25; 

const userPokemonPages = new Map(); 

/**
 * Hàm helper để tạo options cho select menu từ một danh sách Pokémon cụ thể.
 * @param {Array<Object>} pokemonsToDisplay Danh sách Pokémon để tạo tùy chọn.
 * @param {number|null} currentSelectedId ID của Pokémon đang được chọn làm chính.
 * @returns {Array<StringSelectMenuOptionBuilder>} Mảng các tùy chọn cho select menu.
 */
function createPokemonSelectOptions(pokemonsToDisplay, currentSelectedId) {
    return pokemonsToDisplay.map(pokemon => {
        const isCurrentlySelectedInBot = pokemon.id === currentSelectedId;
        const nicknameOrName = pokemon.nickname ? `${pokemon.nickname} (${pokemon.pokemon_name})` : pokemon.pokemon_name;
        const label = `${pokemon.id}. ${nicknameOrName} (Lv.${pokemon.level})`;

        const option = new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(pokemon.id.toString())
            .setDescription(`HP: ${pokemon.current_hp}/${pokemon.max_hp} | IV: ${((pokemon.hp_iv + pokemon.attack_iv + pokemon.defense_iv + pokemon.special_attack_iv + pokemon.special_defense_iv + pokemon.speed_iv) / (31 * 6) * 100).toFixed(0)}%`);

        if (isCurrentlySelectedInBot) {
            option.setEmoji({ name: '⭐' });
        }
        return option;
    });
}

/**
 * Tạo các hàng ActionRow chứa Select Menu cho Pokémon trên trang hiện tại.
 * Mỗi Select Menu chứa tối đa 25 tùy chọn.
 * @param {Array<Object>} pokemonsOnCurrentPage Danh sách Pokémon để tạo tùy chọn.
 * @param {number|null} currentSelectedId ID của Pokémon đang được chọn làm chính.
 * @param {string} userId ID của người dùng.
 * @param {number} currentPage Trang hiện tại (để tạo customId duy nhất).
 * @returns {Array<ActionRowBuilder>} Mảng các hàng ActionRow chứa Select Menu.
 */
function createSelectMenuRows(pokemonsOnCurrentPage, currentSelectedId, userId, currentPage) {
    const allOptionsForPage = createPokemonSelectOptions(pokemonsOnCurrentPage, currentSelectedId);
    const rows = [];
    for (let i = 0; i < allOptionsForPage.length; i += SELECT_MENU_MAX_OPTIONS) {
        const optionsBatch = allOptionsForPage.slice(i, i + SELECT_MENU_MAX_OPTIONS);
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`mypokemons_select_${userId}_${currentPage}_${Math.floor(i / SELECT_MENU_MAX_OPTIONS)}`) 
            .setPlaceholder(`Chọn Pokémon từ trang ${currentPage} (phần ${Math.floor(i / SELECT_MENU_MAX_OPTIONS) + 1})...`)
            .addOptions(optionsBatch);
        rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }
    return rows;
}

/**
 * Tạo hàng nút "Đặt làm Pokémon chính".
 * @param {object} pokemonToShow Pokémon hiện đang được hiển thị chi tiết.
 * @param {number|null} currentSelectedId ID của Pokémon đang được chọn làm chính.
 * @param {string} userId ID của người dùng.
 * @returns {ActionRowBuilder} Hàng nút.
 */
function createSetMainPokemonButtonRow(pokemonToShow, currentSelectedId, userId) {
    // console.log(`[DEBUG_BUTTON] Tạo nút 'Đặt làm Pokémon chính': Pokémon ID=${pokemonToShow.id}, Current Main ID=${currentSelectedId}. Disabled=${pokemonToShow.id === currentSelectedId}`); // Debug log
    const selectCurrentButton = new ButtonBuilder()
        .setCustomId(`select_pokemon_from_mypkmn_${userId}_${pokemonToShow.id}`)
        .setLabel('Đặt làm Pokémon chính')
        .setStyle(ButtonStyle.Success)
        .setDisabled(pokemonToShow.id === currentSelectedId); 
    return new ActionRowBuilder().addComponents(selectCurrentButton);
}

/**
 * Tạo hàng nút điều hướng phân trang.
 * @param {number} currentPage Trang hiện tại.
 * @param {number} totalPages Tổng số trang.
 * @param {string} userId ID của người dùng.
 * @returns {ActionRowBuilder} Hàng nút.
 */
function createPaginationButtons(currentPage, totalPages, userId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`mypokemons_prev_${userId}_${currentPage}`)
                .setLabel('Trang trước')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId(`mypokemons_next_${userId}_${currentPage}`)
                .setLabel('Trang sau')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
        );
    return row;
}

/**
 * Tải dữ liệu Pokémon và render embed.
 * @param {object} context Tương tác hoặc Message object.
 * @param {object} client Discord client.
 * @param {object} db Knex database instance.
 * @param {number} requestedPage Trang hiện tại cần hiển thị (có thể là trang người dùng yêu cầu hoặc trang từ nút phân trang).
 * @param {string} userId ID của người dùng.
 */
async function loadAndRender(context, client, db, requestedPage, userId) {
    try {
        const allUserPokemonsRaw = await db('user_pokemons')
            .leftJoin('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
            .where('user_pokemons.user_discord_id', userId)
            .select(
                'user_pokemons.*',
                'pokemons.name as pokemon_name',
                'pokemons.sprite_front_url as image_url',
                'pokemons.official_artwork_url as full_image_url',
                'pokemons.rarity',
                'pokemons.type1',
                'pokemons.type2',
                'pokemons.hp as base_hp',
                'pokemons.attack as base_attack',
                'pokemons.defense as base_defense',
                'pokemons.special_attack as base_special_attack',
                'pokemons.special_defense as base_special_defense',
                'pokemons.speed as base_speed',
                'pokemons.sprite_back_url'
            )
            .orderBy('user_pokemons.id', 'asc');

        const allUserPokemons = await Promise.all(allUserPokemonsRaw.map(async (pokemon) => {
            let learnedSkillsIds = [];
            try {
                learnedSkillsIds = JSON.parse(pokemon.learned_skill_ids || '[]');
                if (!Array.isArray(learnedSkillsIds)) {
                    learnedSkillsIds = [];
                }
            } catch (parseError) {
                console.error(`Lỗi phân tích learned_skill_ids cho Pokémon ${pokemon.id}:`, parseError);
                sendOwnerDM(client, `[Lỗi mypokemons] Lỗi phân tích kỹ năng Pokémon ${pokemon.id} của ${userId}.`, parseError);
            }

            let skillDetails = [];
            if (learnedSkillsIds.length > 0) {
                skillDetails = await db('skills')
                    .whereIn('skill_id', learnedSkillsIds)
                    .select('skill_id', 'name', 'type', 'category', 'power', 'pp');
            }
            return { ...pokemon, skill_details: skillDetails };
        }));

        const currentUser = await db('users').where({ discord_id: userId }).select('selected_pokemon_id').first();
        const currentSelectedIdFromDb = currentUser ? currentUser.selected_pokemon_id : null;
        // console.log(`[DEBUG_LOAD_RENDER] currentSelectedIdFromDb: ${currentSelectedIdFromDb}`); // Debug log


        const totalPokemons = allUserPokemons.length;
        const totalPages = Math.ceil(totalPokemons / POKEMONS_PER_PAGE);

        let currentPage = requestedPage; 
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (totalPokemons === 0) currentPage = 1; 

        userPokemonPages.set(userId, currentPage); 

        const startIndex = (currentPage - 1) * POKEMONS_PER_PAGE;
        const endIndex = startIndex + POKEMONS_PER_PAGE;
        const pokemonsOnCurrentPage = allUserPokemons.slice(startIndex, endIndex);

        let pokemonToShow = null;
        if (context instanceof MessageComponentInteraction && context.isStringSelectMenu()) {
            const selectedPokemonId = parseInt(context.values[0]);
            pokemonToShow = allUserPokemons.find(p => p.id === selectedPokemonId);
            // console.log(`[DEBUG_LOAD_RENDER] Selected from menu: Pokémon ID=${selectedPokemonId}`); // Debug log
            // console.log(`[DEBUG_LOAD_RENDER] KHÔNG CẬP NHẬT POKÉMON CHÍNH khi chọn từ Select Menu.`); // Debug log
        } else {
            pokemonToShow = allUserPokemons.find(p => p.id === currentSelectedIdFromDb);
            if (!pokemonToShow && pokemonsOnCurrentPage.length > 0) {
                pokemonToShow = pokemonsOnCurrentPage[0]; 
                // console.log(`[DEBUG_LOAD_RENDER] Defaulting to first Pokémon on current page: ID=${pokemonToShow.id}`); // Debug log
            } else if (!pokemonToShow && allUserPokemons.length > 0) {
                pokemonToShow = allUserPokemons[0];
                // console.log(`[DEBUG_LOAD_RENDER] Defaulting to first Pokémon in all list: ID=${pokemonToShow.id}`); // Debug log
            }
        }

        if (!pokemonToShow && totalPokemons > 0) {
             pokemonToShow = allUserPokemons[0];
             currentPage = 1; 
             userPokemonPages.set(userId, currentPage); 
             // console.log(`[DEBUG_LOAD_RENDER] Fallback: PokémonToShow is null, setting to first Pokémon: ID=${pokemonToShow.id}`); // Debug log
        } else if (!pokemonToShow && totalPokemons === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`🎒 Kho Pokémon của ${context.user ? context.user.username : context.author.username} 🎒`)
                .setDescription(`Tổng số Pokémon: **${totalPokemons}**`)
                .addFields({
                    name: 'Bạn chưa có Pokémon nào!',
                    value: 'Hãy sử dụng lệnh spawn hoặc bắt Pokémon để bắt đầu bộ sưu tập của mình.',
                    inline: false
                })
                .setFooter({ text: `Yêu cầu bởi ${context.user ? context.user.username : context.author.username}` })
                .setTimestamp();

            if (context instanceof Message) {
                await context.channel.send({ embeds: [embed], components: [], fetchReply: true });
            } else if (context instanceof MessageComponentInteraction) {
                await context.editReply({ embeds: [embed], components: [] });
            }
            return null; 
        }

        const detailEmbed = generatePokemonEmbed(pokemonToShow, currentSelectedIdFromDb);
        detailEmbed.setFooter({ text: `Trang ${currentPage}/${totalPages} | Yêu cầu bởi ${context.user ? context.user.username : context.author.username}` })
                   .setTimestamp();

        if (pokemonToShow.id === currentSelectedIdFromDb) {
            detailEmbed.addFields({ name: 'Trạng thái Pokémon', value: '⭐ Đây là Pokémon chính của bạn!', inline: false });
        } else {
            detailEmbed.addFields({ name: 'Trạng thái Pokémon', value: 'Đây không phải là Pokémon chính của bạn.', inline: false });
        }

        const components = [];
        const selectMenuRows = createSelectMenuRows(pokemonsOnCurrentPage, currentSelectedIdFromDb, userId, currentPage);
        components.push(...selectMenuRows);
        components.push(createSetMainPokemonButtonRow(pokemonToShow, currentSelectedIdFromDb, userId));

        if (totalPages > 1) {
            components.push(createPaginationButtons(currentPage, totalPages, userId));
        }

        if (context instanceof Message) {
            await context.channel.send({ embeds: [detailEmbed], components: components, fetchReply: true });
        } else if (context instanceof MessageComponentInteraction) {
            await context.editReply({ embeds: [detailEmbed], components: components });
        } else {
            console.warn('loadAndRender nhận được kiểu context không xác định hoặc không hợp lệ:', context);
            // sendOwnerDM(client, `[Lỗi mypokemons] loadAndRender nhận được kiểu context không xác định hoặc không hợp lệ cho người dùng ${userId}.`, new Error("Invalid context type")); // Debug log
            throw new Error("Invalid context type provided to loadAndRender.");
        }
    } catch (error) {
        console.error(`[MYPOKEMONS_COMMAND_ERROR] Lỗi khi thực hiện lệnh mypokemons:`, error);
        sendOwnerDM(client, `[Lỗi Lệnh mypokemons] Lỗi khi người dùng ${userId} sử dụng lệnh mypokemons.`, error); // Giữ lại cho lỗi nghiêm trọng
        if (context instanceof MessageComponentInteraction && (context.deferred || context.replied)) {
            await context.editReply({ content: 'Đã xảy ra lỗi khi tải danh sách Pokémon của bạn. Vui lòng thử lại sau.', components: [] }).catch(err => console.error("Lỗi khi chỉnh sửa tin nhắn lỗi ephemeral:", err));
        } else if (context instanceof Message) {
            await context.channel.send({ content: 'Đã xảy ra lỗi khi tải danh sách Pokémon của bạn. Vui lòng thử lại sau.', ephemeral: true }).catch(err => console.error("Lỗi khi gửi tin nhắn lỗi ephemeral:", err));
        } else {
            console.warn('loadAndRender nhận được kiểu context không xác định hoặc không hợp lệ khi xử lý lỗi:', context);
        }
    }
}

module.exports = {
    name: 'mypokemons',
    description: 'Hiển thị danh sách Pokémon của bạn.',
    aliases: ['mp', 'mybox', 'box'],
    usage: '[trang_số]',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;
        let page = 1;

        if (args.length > 0) {
            const parsedPage = parseInt(args[0]);
            if (!isNaN(parsedPage) && parsedPage > 0) {
                page = parsedPage;
            } else {
                return message.channel.send({ content: `<@${userId}> Số trang không hợp lệ. Vui lòng nhập một số dương.`, ephemeral: true });
            }
        }

        let userSelectedPokemon = await getSelectedOrFirstPokemon(userId, db); 

        await loadAndRender(message, client, db, page, userId);
    },

    async handleInteraction(interaction, client, db) {
        const userId = interaction.user.id;
        const customId = interaction.customId;

        // console.log(`[DEBUG_MYPOKEMONS] Đang xử lý tương tác trong mypokemons.js: CustomID='${customId}' từ User='${userId}'`); // Debug log

        try {
            if (customId.startsWith('mypokemons_prev_') || customId.startsWith('mypokemons_next_')) {
                const parts = customId.split('_');
                const action = parts[1]; 
                const interactionUserId = parts[2]; 
                let currentPage = parseInt(parts[3]);

                if (interactionUserId !== userId) {
                    return interaction.followUp({ content: 'Bạn không thể điều khiển danh sách Pokémon của người khác!', ephemeral: true });
                }

                if (action === 'prev') {
                    currentPage--;
                } else if (action === 'next') {
                    currentPage++;
                }

                await loadAndRender(interaction, client, db, currentPage, userId);
            }
            else if (customId.startsWith('mypokemons_select_')) {
                const parts = customId.split('_');
                const interactionUserId = parts[2]; 

                if (interactionUserId !== userId) {
                    return interaction.followUp({ content: 'Bạn không thể chọn Pokémon trong danh sách của người khác!', ephemeral: true });
                }

                const currentPageFromCustomId = parseInt(parts[3]);
                if (isNaN(currentPageFromCustomId)) {
                    console.error(`[MYPOKEMONS_INTERACTION_ERROR] Không thể phân tích số trang từ customId Select Menu: ${customId}`);
                    sendOwnerDM(client, `[Lỗi mypokemons] Không thể phân tích số trang từ customId Select Menu: ${customId} cho người dùng ${userId}.`, new Error("Invalid page number in customId")); // Giữ lại cho lỗi nghiêm trọng
                    return interaction.followUp({ content: 'Đã xảy ra lỗi khi chọn Pokémon. Vui lòng thử lại.', ephemeral: true });
                }

                await loadAndRender(interaction, client, db, currentPageFromCustomId, userId);

                // ĐÃ BỎ DÒNG NÀY: await interaction.followUp({ content: `<@${userId}> Bạn đã chọn Pokémon có ID **${interaction.values[0]}** để xem chi tiết!`, ephemeral: true });
            }
            else if (customId.startsWith('select_pokemon_from_mypkmn_')) {
                const parts = customId.split('_');
                const interactionUserId = parts[4];
                const pokemonIdToSetSelected = parseInt(parts[5]);

                if (interactionUserId !== userId) {
                    return interaction.followUp({ content: 'Bạn không thể thay đổi Pokémon của người khác!', ephemeral: true });
                }

                // console.log(`[DEBUG_MAIN_POKEMON] Người dùng ${userId} đang đặt Pokémon ID ${pokemonIdToSetSelected} làm chính.`); // Debug log
                await db('users')
                    .where({ discord_id: userId })
                    .update({ selected_pokemon_id: pokemonIdToSetSelected, updated_at: db.fn.now() });

                await loadAndRender(interaction, client, db, userPokemonPages.get(userId) || 1, userId);

                await interaction.followUp({ content: `<@${userId}> Bạn đã chọn Pokémon có ID **${pokemonIdToSetSelected}** làm Pokémon chính!`, ephemeral: true });
            }
        } catch (error) {
            console.error(`[MYPOKEMONS_INTERACTION_ERROR] Lỗi khi xử lý tương tác cho ${userId} (${customId}):`, error);
            sendOwnerDM(client, `[Lỗi Tương tác mypokemons] Lỗi khi người dùng ${userId} tương tác với mypokemons command (CustomId: ${customId}).`, error); // Giữ lại cho lỗi nghiêm trọng
            await interaction.editReply({ content: 'Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.', components: [] }).catch(err => console.error("Lỗi khi chỉnh sửa phản hồi lỗi ephemeral:", err));
        }
    }
};
