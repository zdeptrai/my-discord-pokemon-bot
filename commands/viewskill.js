// commands/viewskill.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js'); 
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

// Đối tượng ánh xạ loại kỹ năng sang emoji (Bạn có thể tùy chỉnh các emoji này)
const SKILL_TYPE_EMOJIS = {
    'normal': '<:normal:1397489072523575296>',
    'fire': '<:fire:1397490374011785267>',
    'water': '<:water:1397490438067453973>',
    'grass': '<:grass:1397490494170202174>',
    'electric': '<:eletric:1397490466936852641>',
    'ice': '<:ice:1397492582145196052>',
    'fighting': '<:fighting:1397492643377975346>',
    'poison': '<:poison:1397492721446420481>',
    'ground': '<:ground:1397492793919668385>',
    'flying': '<:flying:1397492840266989568>',
    'psychic': '<:psychic:1397492880926314536>',
    'bug': '<:bug:1397492975109672960>',
    'rock': '<:rock:1397493958388744242>',
    'ghost': '<:ghost:1397493993977413685>',
    'dragon': '<:dragon:1397494015544266782>',
    'steel': '<:steel:1397494061341868063>',
    'dark': '<:dar:1397494039422435451>',
    'fairy': '<:fairy:1397494966087057502>',
    'unknown': '❓', 
};

module.exports = {
    name: 'viewskill',
    description: 'Xem các kỹ năng Pokémon của bạn đã học và có thể học (có phân trang).',
    aliases: ['vskill'],
    usage: '<ID Pokémon của bạn>',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX;

        if (args.length !== 1) {
            await message.channel.send({
                content: `<@${userId}> Sử dụng đúng cú pháp: \`${prefix}viewskill <ID Pokémon của bạn>\``,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const userPokemonId = parseInt(args[0]);

        if (isNaN(userPokemonId)) {
            await message.channel.send({
                content: `<@${userId}> ID Pokémon phải là số hợp lệ.`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        try {
            const userPokemon = await db('user_pokemons')
                .where({
                    'user_pokemons.user_discord_id': userId,
                    'user_pokemons.id': userPokemonId
                })
                .select(
                    'user_pokemons.id',
                    'user_pokemons.pokedex_id',
                    'user_pokemons.nickname',
                    'user_pokemons.level',
                    'user_pokemons.learned_skill_ids',
                    'pokemons.name as pokemon_base_name'
                )
                .join('pokemons', 'user_pokemons.pokedex_id', 'pokemons.pokedex_id')
                .first();

            if (!userPokemon) {
                await message.channel.send({
                    content: `<@${userId}> Bạn không sở hữu Pokémon với ID ${userPokemonId}.`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const pokemonDisplayName = userPokemon.nickname || userPokemon.pokemon_base_name;

            let learnedSkillsIds = [];
            try {
                learnedSkillsIds = JSON.parse(userPokemon.learned_skill_ids || '[]');
                if (!Array.isArray(learnedSkillsIds)) {
                    learnedSkillsIds = [];
                }
            } catch (parseError) {
                console.error(`Lỗi phân tích learned_skill_ids cho Pokémon ${userPokemon.id}:`, parseError);
                sendOwnerDM(client, `[Lỗi viewskill] Lỗi phân tích kỹ năng Pokémon ${userPokemon.id} của ${userId}.`, parseError);
                learnedSkillsIds = [];
            }

            let learnedSkillsDetails = [];
            if (learnedSkillsIds.length > 0) {
                learnedSkillsDetails = await db('skills')
                    .whereIn('skill_id', learnedSkillsIds)
                    .select('skill_id', 'name', 'type', 'category', 'power', 'pp', 'accuracy');
            }

            const learnableSkills = await db('pokemon_skills')
                .join('skills', 'pokemon_skills.skill_id', 'skills.skill_id')
                .where('pokemon_skills.pokedex_id', userPokemon.pokedex_id)
                .andWhere('pokemon_skills.learn_level', '<=', userPokemon.level)
                .select('skills.skill_id', 'skills.name', 'skills.type', 'skills.category', 'skills.power', 'skills.pp', 'skills.accuracy', 'pokemon_skills.learn_level');

            const learnableNewSkills = learnableSkills.filter(skill => !learnedSkillsIds.includes(skill.skill_id));

            const SKILLS_PER_PAGE_LEARNABLE = 5; 

            const pages = []; 

            // --- Trang 1: Kỹ năng đã học ---
            const learnedEmbed = new EmbedBuilder()
                .setColor('#00FFFF')
                .setTitle(`📖 Kỹ năng của ${pokemonDisplayName} (ID: ${userPokemon.id})`)
                .setDescription(`Level: ${userPokemon.level}`)
                .setTimestamp();

            if (learnedSkillsDetails.length > 0) {
                let learnedSkillsText = learnedSkillsDetails.map(skill => {
                    const emoji = SKILL_TYPE_EMOJIS[skill.type.toLowerCase()] || SKILL_TYPE_EMOJIS['unknown'];
                    return `${emoji} **${skill.name}** (ID: ${skill.skill_id})\n  > Loại: ${skill.type}, Thể loại: ${skill.category}, Sức mạnh: ${skill.power || 'N/A'}, PP: ${skill.pp || 'N/A'}`;
                }).join('\n');
                learnedEmbed.addFields({ name: 'Đã Học', value: learnedSkillsText, inline: false });
            } else {
                learnedEmbed.addFields({ name: 'Đã Học', value: 'Chưa học kỹ năng nào.', inline: false });
            }
            pages.push(learnedEmbed);


            // --- Các trang tiếp theo: Kỹ năng có thể học ---
            for (let i = 0; i < learnableNewSkills.length; i += SKILLS_PER_PAGE_LEARNABLE) {
                const currentLearnableSkills = learnableNewSkills.slice(i, i + SKILLS_PER_PAGE_LEARNABLE);
                const learnableEmbed = new EmbedBuilder()
                    .setColor('#00FFFF')
                    .setTitle(`📖 Kỹ năng có thể học của ${pokemonDisplayName}`)
                    .setDescription(`Level: ${userPokemon.level}`)
                    .setTimestamp();

                let learnableSkillsText = currentLearnableSkills.map(skill => {
                    const emoji = SKILL_TYPE_EMOJIS[skill.type.toLowerCase()] || SKILL_TYPE_EMOJIS['unknown'];
                    return `${emoji} **${skill.name}** (ID: ${skill.skill_id}) - Học ở Lv ${skill.learn_level}\n  > Loại: ${skill.type}, Thể loại: ${skill.category}, Sức mạnh: ${skill.power || 'N/A'}, PP: ${skill.pp || 'N/A'}`;
                }).join('\n');

                learnableEmbed.addFields({ name: 'Có Thể Học Hiện Tại', value: learnableSkillsText, inline: false });
                pages.push(learnableEmbed);
            }

            const totalPages = pages.length;
            pages.forEach((embed, index) => {
                embed.setFooter({ text: `Trang ${index + 1}/${totalPages} | Sử dụng ${prefix}learnskill <ID Pokémon> <ID Kỹ năng> [Slot 1-4] để học.` });
            });

            let currentPage = 0;

            const getButtons = (pageIndex) => {
                const row = new ActionRowBuilder();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Trước')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Sau')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === pages.length - 1)
                );
                return [row];
            };

            const sentMessage = await message.channel.send({
                embeds: [pages[currentPage]],
                components: getButtons(currentPage)
            });

            // Collector for pagination buttons
            const collector = sentMessage.createMessageComponentCollector({
                filter: i => i.user.id === userId && (i.customId === 'prev_page' || i.customId === 'next_page'), // Chỉ lọc các customId của phân trang
                time: 2 * 60 * 1000 // Collector tự tắt sau 2 phút
            });

            collector.on('collect', async i => {
                // ĐÃ BỎ: await i.deferUpdate(); // Collector sẽ tự động defer/update
                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(pages.length - 1, currentPage + 1);
                }

                try {
                    await i.update({ // Sử dụng i.update() để chỉnh sửa tin nhắn tương tác
                        embeds: [pages[currentPage]],
                        components: getButtons(currentPage)
                    });
                } catch (updateError) {
                    console.error(`Lỗi khi cập nhật tin nhắn viewskill trong collector:`, updateError);
                    // Nếu lỗi là Unknown interaction (10062) hoặc Interaction already acknowledged (40060),
                    // thì không cần làm gì thêm vì tương tác đã hết hạn hoặc đã được xử lý.
                    if (updateError.code === 10062 || updateError.code === 40060) {
                        // Bỏ qua lỗi này vì tin nhắn có thể đã hết hạn hoặc đã được xử lý
                        console.warn(`[VIEWSKILL_COLLECTOR_WARN] Tương tác đã hết hạn hoặc đã được xử lý: ${updateError.code}`);
                    } else {
                        sendOwnerDM(client, `[Lỗi viewskill Collector] Lỗi khi cập nhật tin nhắn phân trang cho người dùng ${userId}.`, updateError);
                    }
                }
            });

            collector.on('end', async () => {
                // Vô hiệu hóa các nút khi collector kết thúc
                try {
                    // Kiểm tra xem tin nhắn có còn tồn tại và có thể chỉnh sửa không
                    const fetchedMessage = await message.channel.messages.fetch(sentMessage.id).catch(() => null);
                    if (fetchedMessage && fetchedMessage.editable) {
                        await fetchedMessage.edit({
                            components: getButtons(currentPage).map(row => {
                                row.components.forEach(button => button.setDisabled(true));
                                return row;
                            })
                        });
                    }
                } catch (e) {
                    // Bắt lỗi Unknown Message (10008) nếu tin nhắn đã bị xóa
                    if (e.code === 10008) {
                        console.warn(`[VIEWSKILL_COLLECTOR_WARN] Tin nhắn viewskill đã bị xóa, không thể vô hiệu hóa nút.`);
                    } else {
                        console.error("Error disabling buttons after viewskill collector end:", e);
                        sendOwnerDM(client, `[Lỗi viewskill Collector End] Lỗi khi vô hiệu hóa nút cho người dùng ${userId}.`, e);
                    }
                }
            });

        } catch (error) {
            console.error(`[VIEWSKILL_COMMAND_ERROR] Lỗi khi xem kỹ năng của Pokémon:`, error);
            sendOwnerDM(client, `[Lỗi viewskill Command] Lỗi khi người dùng ${userId} sử dụng lệnh viewskill.`, error);
            await message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi cố gắng xem kỹ năng. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
