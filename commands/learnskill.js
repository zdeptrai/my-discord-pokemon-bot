// commands/learnskill.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js'); // Thêm MessageFlags

module.exports = {
    name: 'learnskill',
    description: 'Dạy một kỹ năng cho Pokémon của bạn. Giới hạn 4 kỹ năng.',
    aliases: ['lskill'],
    usage: '<ID Pokémon của bạn> <ID kỹ năng> [Vị trí ô skill muốn thay thế (1-4)]',
    cooldown: 5,

    async execute(message, args, client, db) {
        // KHÔNG XÓA TIN NHẮN Ở ĐÂY NỮA, HÃY ĐỂ index.js XÓA
        // if (message.deletable) {
        //     message.delete().catch(e => console.error("Could not delete user command message:", e));
        // }

        const userId = message.author.id;
        const MAX_SKILLS = 4; // Giới hạn số kỹ năng Pokémon có thể học
        const prefix = client.config.PREFIX; // Lấy prefix để sử dụng trong cú pháp

        if (args.length < 2 || args.length > 3) {
            // Sử dụng message.channel.send thay vì message.reply, và dùng ephemeral
            return message.channel.send({
                content: `<@${userId}> Sử dụng đúng cú pháp: \`${prefix}learnskill <ID Pokémon của bạn> <ID kỹ năng> [Vị trí ô skill muốn thay thế (1-4)]\``,
                flags: MessageFlags.Ephemeral
            });
        }

        const userPokemonId = parseInt(args[0]);
        const skillIdToLearn = parseInt(args[1]);
        const desiredSlot = args[2] ? parseInt(args[2]) : null;

        if (isNaN(userPokemonId) || isNaN(skillIdToLearn)) {
            // Sử dụng message.channel.send và ephemeral
            return message.channel.send({
                content: `<@${userId}> ID Pokémon và ID kỹ năng phải là số hợp lệ.`,
                flags: MessageFlags.Ephemeral
            });
        }
        if (desiredSlot !== null && (isNaN(desiredSlot) || desiredSlot < 1 || desiredSlot > MAX_SKILLS)) {
            // Sử dụng message.channel.send và ephemeral
            return message.channel.send({
                content: `<@${userId}> Vị trí ô skill phải là một số từ 1 đến ${MAX_SKILLS}.`,
                flags: MessageFlags.Ephemeral
            });
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
                // Sử dụng message.channel.send và ephemeral
                return message.channel.send({
                    content: `<@${userId}> Bạn không sở hữu Pokémon với ID ${userPokemonId}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const pokemonDisplayName = userPokemon.nickname || userPokemon.pokemon_base_name;

            let learnedSkills = [];
            try {
                learnedSkills = JSON.parse(userPokemon.learned_skill_ids || '[]');
                if (!Array.isArray(learnedSkills)) {
                    learnedSkills = [];
                }
            } catch (parseError) {
                console.error(`Lỗi phân tích learned_skill_ids cho Pokémon ${userPokemon.id}:`, parseError);
                learnedSkills = [];
            }

            const skillDetails = await db('skills')
                .where('skill_id', skillIdToLearn)
                .first();

            if (!skillDetails) {
                // Sử dụng message.channel.send và ephemeral
                return message.channel.send({
                    content: `<@${userId}> Không tìm thấy kỹ năng với ID ${skillIdToLearn}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const canLearnSkill = await db('pokemon_skills')
                .where({
                    pokedex_id: userPokemon.pokedex_id,
                    skill_id: skillIdToLearn
                })
                .andWhere('learn_level', '<=', userPokemon.level)
                .first();

            if (!canLearnSkill) {
                // Sử dụng message.channel.send và ephemeral
                return message.channel.send({
                    content: `<@${userId}> **${pokemonDisplayName}** (ID: ${userPokemon.id}, Lv ${userPokemon.level}) không thể học kỹ năng **${skillDetails.name}** (ID: ${skillDetails.skill_id}) ở cấp độ hiện tại.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (learnedSkills.includes(skillIdToLearn)) {
                // Sử dụng message.channel.send và ephemeral
                return message.channel.send({
                    content: `<@${userId}> **${pokemonDisplayName}** (ID: ${userPokemon.id}) đã học kỹ năng **${skillDetails.name}** rồi.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // --- Logic chính để học kỹ năng ---

            if (learnedSkills.length < MAX_SKILLS && desiredSlot === null) {
                // Thêm kỹ năng mới nếu chưa đủ slot và không chỉ định slot
                learnedSkills.push(skillIdToLearn);
                const updatedLearnedSkills = JSON.stringify(learnedSkills);

                await db('user_pokemons')
                    .where('id', userPokemonId)
                    .update({ learned_skill_ids: updatedLearnedSkills });

                const learnEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`✨ ${pokemonDisplayName} đã học một kỹ năng mới!`)
                    .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) đã học thành công kỹ năng **${skillDetails.name}**!`)
                    .setTimestamp()
                    .setFooter({ text: `Tổng số kỹ năng: ${learnedSkills.length}/${MAX_SKILLS}` });

                // Gửi tin nhắn thành công, không ephemeral
                return message.channel.send({ embeds: [learnEmbed] });

            } else if (learnedSkills.length === MAX_SKILLS || desiredSlot !== null) {
                // Đã đủ 4 skill HOẶC người dùng đã chỉ định slot

                const currentLearnedSkillsDetails = await db('skills')
                    .whereIn('skill_id', learnedSkills)
                    .select('skill_id', 'name');

                let oldSkillIdToReplace = null;
                if (desiredSlot !== null) { // Người dùng đã chỉ định slot
                    const skillIndex = desiredSlot - 1;
                    if (skillIndex < 0 || skillIndex >= learnedSkills.length) {
                        // Sử dụng message.channel.send và ephemeral
                        return message.channel.send({
                            content: `<@${userId}> Vị trí ô skill bạn muốn thay thế (**${desiredSlot}**) không hợp lệ. Vui lòng chọn một số từ 1 đến ${learnedSkills.length}.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    oldSkillIdToReplace = learnedSkills[skillIndex];

                    learnedSkills[skillIndex] = skillIdToLearn; // Thay thế kỹ năng cũ bằng kỹ năng mới
                    const updatedLearnedSkills = JSON.stringify(learnedSkills);

                    await db('user_pokemons')
                        .where('id', userPokemonId)
                        .update({ learned_skill_ids: updatedLearnedSkills });

                    const learnSuccessEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(`✅ ${pokemonDisplayName} đã học kỹ năng mới!`)
                        .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) đã quên **${currentLearnedSkillsDetails.find(s => s.skill_id === oldSkillIdToReplace).name}** và học thành công **${skillDetails.name}**!`)
                        .setTimestamp()
                        .setFooter({ text: `Tổng số kỹ năng: ${learnedSkills.length}/${MAX_SKILLS}` });

                    // Gửi tin nhắn thành công, không ephemeral
                    return message.channel.send({ embeds: [learnSuccessEmbed] });

                } else { // Đã đủ 4 skill và người dùng CHƯA chỉ định slot, hiển thị nút để chọn
                    const choiceEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle(`⚠️ ${pokemonDisplayName} đã học đầy ${MAX_SKILLS} kỹ năng!`)
                        .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) muốn học kỹ năng mới **${skillDetails.name}**.\n\nVui lòng chọn một kỹ năng bạn muốn **thay thế** bằng **${skillDetails.name}** hoặc dùng lệnh với vị trí ô skill: \`${prefix}learnskill ${userPokemonId} ${skillIdToLearn} [1-4]\`:\n`);

                    const buttons = [];
                    currentLearnedSkillsDetails.forEach((skill, index) => {
                        choiceEmbed.addFields({ name: `[${index + 1}] ${skill.name}`, value: `ID: ${skill.skill_id}`, inline: true });
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`forget_skill_${userPokemonId}_${skill.skill_id}_${skillIdToLearn}`)
                                .setLabel(`${index + 1}. Thay thế ${skill.name}`)
                                .setStyle(ButtonStyle.Primary)
                        );
                    });

                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`cancel_learn_${userPokemonId}`)
                            .setLabel('Hủy bỏ')
                            .setStyle(ButtonStyle.Danger)
                    );

                    const actionRows = [];
                    for (let i = 0; i < buttons.length; i += 5) {
                        actionRows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
                    }

                    // Gửi tin nhắn với embed và nút, không ephemeral
                    const responseMessage = await message.channel.send({
                        embeds: [choiceEmbed],
                        components: actionRows,
                        fetchReply: true // Quan trọng để lấy được đối tượng tin nhắn để tạo collector
                    });

                    const filter = i => i.user.id === userId && (i.customId.startsWith('forget_skill_') || i.customId.startsWith('cancel_learn_'));
                    const collector = responseMessage.createMessageComponentCollector({ filter, time: 60000 });

                    collector.on('collect', async i => {
                        await i.deferUpdate();

                        if (i.customId.startsWith('cancel_learn_')) {
                            collector.stop('cancel');
                            // Sử dụng i.editReply
                            return i.editReply({
                                content: `Đã hủy bỏ việc học kỹ năng mới cho **${pokemonDisplayName}**.`,
                                embeds: [],
                                components: []
                            });
                        }

                        const parts = i.customId.split('_');
                        const oldSkillId = parseInt(parts[3]);
                        const newSkillId = parseInt(parts[4]);

                        const oldSkillIndex = learnedSkills.indexOf(oldSkillId);
                        if (oldSkillIndex === -1) {
                            collector.stop('error');
                            // Sử dụng i.editReply
                            return i.editReply({
                                content: `Có vẻ kỹ năng bạn chọn để quên không còn trong danh sách. Vui lòng thử lại.`,
                                embeds: [],
                                components: []
                            });
                        }

                        learnedSkills[oldSkillIndex] = newSkillId;
                        const updatedLearnedSkills = JSON.stringify(learnedSkills);

                        await db('user_pokemons')
                            .where('id', userPokemonId)
                            .update({ learned_skill_ids: updatedLearnedSkills });

                        const learnSuccessEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle(`✅ ${pokemonDisplayName} đã học kỹ năng mới!`)
                            .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) đã quên **${currentLearnedSkillsDetails.find(s => s.skill_id === oldSkillId).name}** và học thành công **${skillDetails.name}**!`)
                            .setTimestamp()
                            .setFooter({ text: `Tổng số kỹ năng: ${learnedSkills.length}/${MAX_SKILLS}` });

                        collector.stop('success');
                        // Sử dụng i.editReply
                        return i.editReply({ embeds: [learnSuccessEmbed], components: [] });

                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            // Sử dụng responseMessage.edit
                            responseMessage.edit({
                                content: `Đã hết thời gian chọn kỹ năng để thay thế cho **${pokemonDisplayName}**.`,
                                embeds: [],
                                components: []
                            }).catch(e => console.error("Error editing message after timeout:", e));
                        }
                    });

                    return;
                }
            }

        } catch (error) {
            console.error(`Lỗi khi dạy kỹ năng cho Pokémon:`, error);
            // Sử dụng message.channel.send và ephemeral
            message.channel.send({
                content: `<@${userId}> Đã xảy ra lỗi khi cố gắng dạy kỹ năng. Vui lòng thử lại sau.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};