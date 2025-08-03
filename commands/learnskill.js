// commands/learnskill.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { sendOwnerDM } = require('../utils/errors/errorReporter'); // Import sendOwnerDM

const MAX_SKILLS = 4; // Giới hạn số kỹ năng Pokémon có thể học
const MESSAGE_LIFETIME = 60000; // Thời gian tồn tại của collector (60 giây)

/**
 * Gửi tin nhắn phản hồi cho một lệnh tiền tố (không thể là ephemeral).
 * @param {Message} message Đối tượng tin nhắn gốc của lệnh.
 * @param {string} content Nội dung tin nhắn.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function sendPrefixedCommandReply(message, content, logContext) {
    try {
        await message.channel.send(content);
    } catch (e) {
        console.error(`[LEARNSKILL_ERROR] Lỗi gửi tin nhắn phản hồi lệnh tiền tố (${logContext}) cho ${message.author.tag}:`, e);
        sendOwnerDM(message.client, `[Lỗi Learnskill] Lỗi gửi tin nhắn phản hồi lệnh tiền tố (${logContext}) cho ${message.author.tag}.`, e);
    }
}

/**
 * Gửi tin nhắn phản hồi cho một Interaction (có thể là ephemeral).
 * Hàm đã được cập nhật để chấp nhận cả chuỗi và đối tượng payload.
 * @param {Interaction} interaction Đối tượng tương tác.
 * @param {string|object} payloadOrContent Nội dung tin nhắn (chuỗi) hoặc đối tượng payload đầy đủ.
 * @param {boolean} [ephemeral=false] Có phải là tin nhắn ephemeral không.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function sendInteractionReply(interaction, payloadOrContent, ephemeral = false, logContext) {
    try {
        let options;
        if (typeof payloadOrContent === 'string') {
            // Nếu là chuỗi, tạo một đối tượng payload đơn giản
            options = { content: payloadOrContent, flags: ephemeral ? MessageFlags.Ephemeral : 0 };
        } else if (typeof payloadOrContent === 'object' && payloadOrContent !== null) {
            // Nếu là đối tượng, giả định đó là một payload hợp lệ và thêm cờ ephemeral
            options = { ...payloadOrContent, flags: ephemeral ? MessageFlags.Ephemeral : 0 };
        } else {
            // Trường hợp không hợp lệ, trả về một tin nhắn lỗi mặc định
            options = { content: 'Đã xảy ra lỗi khi tạo nội dung tin nhắn.', flags: ephemeral ? MessageFlags.Ephemeral : 0 };
        }

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(options);
        } else {
            await interaction.reply(options);
        }
    } catch (e) {
        console.error(`[LEARNSKILL_ERROR] Lỗi gửi tin nhắn tương tác (${logContext}) cho ${interaction.user.tag}:`, e);
        sendOwnerDM(interaction.client, `[Lỗi Learnskill] Lỗi gửi tin nhắn tương tác (${logContext}) cho ${interaction.user.tag}.`, e);
    }
}

/**
 * Chỉnh sửa tin nhắn và báo cáo lỗi nếu không thành công (bao gồm Unknown Message).
 * @param {Message} message Đối tượng tin nhắn cần chỉnh sửa.
 * @param {object} options Tùy chọn chỉnh sửa tin nhắn.
 * @param {string} logContext Ngữ cảnh log lỗi.
 */
async function editMessageSafe(message, options, logContext) {
    try {
        // Fetch lại tin nhắn để đảm bảo nó vẫn tồn tại và có thể chỉnh sửa
        const fetchedMessage = await message.channel.messages.fetch(message.id).catch(() => null);
        if (fetchedMessage && fetchedMessage.editable) {
            await fetchedMessage.edit(options);
        } else {
            console.warn(`[LEARNSKILL_WARN] Tin nhắn không còn tồn tại hoặc không thể chỉnh sửa (${logContext}).`);
        }
    } catch (e) {
        if (e.code === 10008) { // Unknown Message
            console.warn(`[LEARNSKILL_WARN] Tin nhắn đã bị xóa, không thể chỉnh sửa (${logContext}).`);
        } else {
            console.error(`[LEARNSKILL_ERROR] Lỗi chỉnh sửa tin nhắn (${logContext}):`, e);
            sendOwnerDM(message.client, `[Lỗi Learnskill] Lỗi chỉnh sửa tin nhắn (${logContext}) trên kênh ${message.channel.id}.`, e);
        }
    }
}

module.exports = {
    name: 'learnskill',
    description: 'Dạy một kỹ năng cho Pokémon của bạn. Giới hạn 4 kỹ năng.',
    aliases: ['lskill'],
    usage: '<ID Pokémon của bạn> <ID kỹ năng> [Vị trí ô skill muốn thay thế (1-4)]',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX; // Lấy prefix để sử dụng trong cú pháp

        if (args.length < 2 || args.length > 3) {
            return sendPrefixedCommandReply(message, `<@${userId}> Sử dụng đúng cú pháp: \`${prefix}learnskill <ID Pokémon của bạn> <ID kỹ năng> [Vị trí ô skill muốn thay thế (1-4)]\``, 'learnskill_syntax_error');
        }

        const userPokemonId = parseInt(args[0]);
        const skillIdToLearn = parseInt(args[1]);
        const desiredSlot = args[2] ? parseInt(args[2]) : null;

        if (isNaN(userPokemonId) || isNaN(skillIdToLearn)) {
            return sendPrefixedCommandReply(message, `<@${userId}> ID Pokémon và ID kỹ năng phải là số hợp lệ.`, 'learnskill_invalid_ids');
        }
        if (desiredSlot !== null && (isNaN(desiredSlot) || desiredSlot < 1 || desiredSlot > MAX_SKILLS)) {
            return sendPrefixedCommandReply(message, `<@${userId}> Vị trí ô skill phải là một số từ 1 đến ${MAX_SKILLS}.`, 'learnskill_invalid_slot');
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
                return sendPrefixedCommandReply(message, `<@${userId}> Bạn không sở hữu Pokémon với ID ${userPokemonId}.`, 'learnskill_pokemon_not_found');
            }

            const pokemonDisplayName = userPokemon.nickname || userPokemon.pokemon_base_name;

            let learnedSkills = [];
            try {
                learnedSkills = JSON.parse(userPokemon.learned_skill_ids || '[]');
                if (!Array.isArray(learnedSkills)) {
                    learnedSkills = [];
                }
            } catch (parseError) {
                console.error(`[LEARNSKILL_ERROR] Lỗi phân tích learned_skill_ids cho Pokémon ${userPokemon.id}:`, parseError);
                sendOwnerDM(client, `[Lỗi Learnskill] Lỗi phân tích learned_skill_ids cho Pokémon ${userPokemon.id} của ${userId}.`, parseError);
                learnedSkills = [];
            }

            const skillDetails = await db('skills')
                .where('skill_id', skillIdToLearn)
                .first();

            if (!skillDetails) {
                return sendPrefixedCommandReply(message, `<@${userId}> Không tìm thấy kỹ năng với ID ${skillIdToLearn}.`, 'learnskill_skill_not_found');
            }

            const canLearnSkill = await db('pokemon_skills')
                .where({
                    pokedex_id: userPokemon.pokedex_id,
                    skill_id: skillIdToLearn
                })
                .andWhere('learn_level', '<=', userPokemon.level)
                .first();

            if (!canLearnSkill) {
                return sendPrefixedCommandReply(message, `<@${userId}> **${pokemonDisplayName}** (ID: ${userPokemon.id}, Lv ${userPokemon.level}) không thể học kỹ năng **${skillDetails.name}** (ID: ${skillDetails.skill_id}) ở cấp độ hiện tại.`, 'learnskill_cannot_learn');
            }

            if (learnedSkills.includes(skillIdToLearn)) {
                return sendPrefixedCommandReply(message, `<@${userId}> **${pokemonDisplayName}** (ID: ${userPokemon.id}) đã học kỹ năng **${skillDetails.name}** rồi.`, 'learnskill_already_learned');
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

                return message.channel.send({ embeds: [learnEmbed] }).catch(e => {
                    console.error(`[LEARNSKILL_ERROR] Lỗi gửi embed học skill mới cho ${userId}:`, e);
                    sendOwnerDM(client, `[Lỗi Learnskill] Lỗi gửi embed học skill mới cho ${userId}.`, e);
                });

            } else if (learnedSkills.length === MAX_SKILLS || desiredSlot !== null) {
                // Đã đủ 4 skill HOẶC người dùng đã chỉ định slot

                const currentLearnedSkillsDetails = await db('skills')
                    .whereIn('skill_id', learnedSkills)
                    .select('skill_id', 'name');

                let oldSkillIdToReplace = null;
                if (desiredSlot !== null) { // Người dùng đã chỉ định slot
                    const skillIndex = desiredSlot - 1;
                    if (skillIndex < 0 || skillIndex >= learnedSkills.length) {
                        return sendPrefixedCommandReply(message, `<@${userId}> Vị trí ô skill bạn muốn thay thế (**${desiredSlot}**) không hợp lệ. Vui lòng chọn một số từ 1 đến ${learnedSkills.length}.`, 'learnskill_invalid_replace_slot');
                    }
                    oldSkillIdToReplace = learnedSkills[skillIndex];

                    learnedSkills[skillIndex] = skillIdToLearn; // Thay thế kỹ năng cũ bằng kỹ năng mới
                    const updatedLearnedSkills = JSON.stringify(learnedSkills);

                    await db('user_pokemons')
                        .where('id', userPokemonId)
                        .update({ learned_skill_ids: updatedLearnedSkills });

                    const oldSkillDetailsForEmbed = currentLearnedSkillsDetails.find(s => s.skill_id === oldSkillIdToReplace);
                    const learnSuccessEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(`✅ ${pokemonDisplayName} đã học kỹ năng mới!`)
                        .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) đã quên **${oldSkillDetailsForEmbed.name}** và học thành công **${skillDetails.name}**!`)
                        .setTimestamp()
                        .setFooter({ text: `Tổng số kỹ năng: ${learnedSkills.length}/${MAX_SKILLS}` });

                    return message.channel.send({ embeds: [learnSuccessEmbed] }).catch(e => {
                        console.error(`[LEARNSKILL_ERROR] Lỗi gửi embed học skill thay thế cho ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi Learnskill] Lỗi gửi embed học skill thay thế cho ${userId}.`, e);
                    });

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

                    const responseMessage = await message.channel.send({
                        embeds: [choiceEmbed],
                        components: actionRows,
                        fetchReply: true
                    }).catch(e => {
                        console.error(`[LEARNSKILL_ERROR] Lỗi gửi tin nhắn chọn skill thay thế cho ${userId}:`, e);
                        sendOwnerDM(client, `[Lỗi Learnskill] Lỗi gửi tin nhắn chọn skill thay thế cho ${userId}.`, e);
                        return null;
                    });

                    if (!responseMessage) return;

                    const filter = i => i.user.id === userId && (i.customId.startsWith('forget_skill_') || i.customId.startsWith('cancel_learn_'));
                    const collector = responseMessage.createMessageComponentCollector({ filter, time: MESSAGE_LIFETIME });

                    collector.on('collect', async i => {
                        // ĐÃ XÓA: await i.deferUpdate(); // handlers/interactionCreate.js đã xử lý defer

                        if (i.customId.startsWith('cancel_learn_')) {
                            collector.stop('cancel');
                            // Sửa lỗi: Gọi hàm sendInteractionReply với chuỗi
                            await sendInteractionReply(i, `Đã hủy bỏ việc học kỹ năng mới cho **${pokemonDisplayName}**.`, false, 'learnskill_cancel_reply');
                            // Sửa lỗi: Thêm `content` để tránh lỗi tin nhắn trống khi chỉnh sửa tin nhắn gốc
                            await editMessageSafe(responseMessage, { content: 'Phiên học kỹ năng đã kết thúc.', embeds: [], components: [] }, 'learnskill_cancel_edit_original');
                            return;
                        }

                        const parts = i.customId.split('_');
                        const oldPokemonId = parseInt(parts[2]); // Lấy userPokemonId từ customId
                        const oldSkillId = parseInt(parts[3]);
                        const newSkillId = parseInt(parts[4]);

                        // Kiểm tra lại userPokemonId khớp với người dùng hiện tại
                        if (oldPokemonId !== userPokemonId) {
                            return sendInteractionReply(i, 'Tương tác không hợp lệ cho Pokémon này.', true, 'learnskill_invalid_pokemon_id_in_interaction');
                        }

                        // Lấy lại learnedSkills từ DB để đảm bảo dữ liệu mới nhất
                        const updatedUserPokemon = await db('user_pokemons')
                            .where({ 'user_discord_id': userId, 'id': userPokemonId })
                            .select('learned_skill_ids')
                            .first();
                        let currentLearnedSkills = [];
                        try {
                            currentLearnedSkills = JSON.parse(updatedUserPokemon.learned_skill_ids || '[]');
                            if (!Array.isArray(currentLearnedSkills)) {
                                currentLearnedSkills = [];
                            }
                        } catch (parseError) {
                            console.error(`[LEARNSKILL_ERROR] Lỗi phân tích learned_skill_ids trong collector cho Pokémon ${userPokemon.id}:`, parseError);
                            sendOwnerDM(client, `[Lỗi Learnskill] Lỗi phân tích learned_skill_ids trong collector cho Pokémon ${userPokemon.id} của ${userId}.`, parseError);
                            currentLearnedSkills = [];
                        }

                        const oldSkillIndex = currentLearnedSkills.indexOf(oldSkillId);
                        if (oldSkillIndex === -1) {
                            collector.stop('error');
                            return sendInteractionReply(i, `Có vẻ kỹ năng bạn chọn để quên không còn trong danh sách. Vui lòng thử lại.`, true, 'learnskill_skill_not_in_list');
                        }

                        currentLearnedSkills[oldSkillIndex] = newSkillId;
                        const finalUpdatedLearnedSkills = JSON.stringify(currentLearnedSkills);

                        await db('user_pokemons')
                            .where('id', userPokemonId)
                            .update({ learned_skill_ids: finalUpdatedLearnedSkills });

                        const oldSkillDetails = currentLearnedSkillsDetails.find(s => s.skill_id === oldSkillId);
                        const learnSuccessEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle(`✅ ${pokemonDisplayName} đã học kỹ năng mới!`)
                            .setDescription(`**${pokemonDisplayName}** (ID: ${userPokemon.id}) đã quên **${oldSkillDetails ? oldSkillDetails.name : 'kỹ năng cũ'}** và học thành công **${skillDetails.name}**!`)
                            .setTimestamp()
                            .setFooter({ text: `Tổng số kỹ năng: ${currentLearnedSkills.length}/${MAX_SKILLS}` });

                        collector.stop('success');
                        // Sửa lỗi chính: Truyền một đối tượng payload hợp lệ cho hàm sendInteractionReply
                        await sendInteractionReply(i, { embeds: [learnSuccessEmbed], components: [] }, false, 'learnskill_success_edit_reply');
                        // Sửa lỗi: Thêm `content` để tránh lỗi tin nhắn trống khi chỉnh sửa tin nhắn gốc
                        await editMessageSafe(responseMessage, { content: 'Phiên học kỹ năng đã hoàn tất.', embeds: [], components: [] }, 'learnskill_success_edit_original');
                    });

                    collector.on('end', async (collected, reason) => {
                        if (reason === 'time') {
                            await editMessageSafe(responseMessage, {
                                content: `Đã hết thời gian chọn kỹ năng để thay thế cho **${pokemonDisplayName}**.`,
                                embeds: [],
                                components: []
                            }, 'learnskill_timeout_edit_message');
                        }
                    });

                    return;
                }
            }

        } catch (error) {
            console.error(`[LEARNSKILL_ERROR] Lỗi khi dạy kỹ năng cho Pokémon:`, error);
            sendOwnerDM(client, `[Lỗi Learnskill] Lỗi khi dạy kỹ năng cho Pokémon của ${userId}.`, error);
            // Gửi phản hồi lỗi cho người dùng
            await sendPrefixedCommandReply(message, `<@${userId}> Đã xảy ra lỗi khi cố gắng dạy kỹ năng. Vui lòng thử lại sau.`, 'learnskill_general_error');
        }
    },
};
