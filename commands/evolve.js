// commands/evolve.js
const { MessageFlags } = require('discord.js'); // Import MessageFlags
const knexConfig = require('../knexfile');
const pgKnex = require('knex')(knexConfig.development);

// Hàm phụ trợ: Lấy tên Pokémon từ pokedex_id
async function getPokemonName(pokedexId) {
    try {
        const pokemon = await pgKnex('pokemons')
            .where('pokedex_id', pokedexId)
            .select('name', 'form') // Lấy cả tên và form
            .first();
        if (!pokemon) return 'Unknown Pokémon';
        return pokemon.form && pokemon.form !== 'normal'
            ? `${pokemon.name} (${pokemon.form})`
            : pokemon.name;
    } catch (error) {
        console.error(`Lỗi khi lấy tên Pokémon cho Pokedex ID ${pokedexId}:`, error);
        return 'Unknown Pokémon';
    }
}

// HÀM MỚI: Lấy chi tiết Pokémon bao gồm cả form
async function getPokemonDetails(pokedexId) {
    try {
        const pokemon = await pgKnex('pokemons')
            .where('pokedex_id', pokedexId)
            .select('name', 'form')
            .first();
        if (!pokemon) return { name: 'Unknown Pokémon', form: null };
        return { name: pokemon.name, form: pokemon.form };
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết Pokémon cho Pokedex ID ${pokedexId}:`, error);
        return { name: 'Unknown Pokémon', form: null };
    }
}

// Hàm phụ trợ: Lấy thông tin Pokémon của người chơi
async function getUserPokemon(userId, pokemonInstanceId) {
    try {
        const userPokemon = await pgKnex('user_pokemons')
            .where('user_discord_id', userId)
            .andWhere('id', pokemonInstanceId)
            .select('*')
            .first();
        return userPokemon;
    } catch (error) {
        console.error(`Lỗi khi lấy Pokémon của người dùng ${userId} (ID: ${pokemonInstanceId}):`, error);
        return null;
    }
}

// Hàm phụ trợ: Lấy các quy tắc tiến hóa
async function getEvolutionRules(currentPokemonPokedexId) {
    try {
        const evolutionRules = await pgKnex('evolutions')
            .where('pokedex_id', currentPokemonPokedexId)
            .select('*');
        return evolutionRules;
    } catch (error) {
        console.error(`Lỗi khi lấy quy tắc tiến hóa cho Pokedex ID ${currentPokemonPokedexId}:`, error);
        return [];
    }
}

// Hàm phụ trợ: Lấy thông tin vật phẩm từ database
async function getItemName(itemId) {
    try {
        const item = await pgKnex('items').where('item_id', itemId).select('name').first();
        return item ? item.name : 'Vật phẩm không xác định';
    } catch (error) {
        console.error(`Lỗi khi lấy tên vật phẩm ${itemId}:`, error);
        return 'Vật phẩm không xác định';
    }
}

// Hàm phụ trợ: Kiểm tra số lượng vật phẩm của người chơi
async function getUserItemQuantity(userId, itemId) {
    try {
        const userItem = await pgKnex('user_inventory_items') // Sử dụng user_inventory_items
            .where('user_discord_id', userId)
            .andWhere('item_id', itemId)
            .select('quantity')
            .first();
        return userItem ? userItem.quantity : 0;
    } catch (error) {
        console.error(`Lỗi khi lấy số lượng vật phẩm ${itemId} của người dùng ${userId}:`, error);
        return 0;
    }
}

// Hàm phụ trợ: Trừ vật phẩm khỏi kho của người chơi
async function consumeUserItem(userId, itemId, quantity = 1) {
    try {
        const currentQuantity = await getUserItemQuantity(userId, itemId);
        if (currentQuantity >= quantity) {
            await pgKnex('user_inventory_items') // Sử dụng user_inventory_items
                .where('user_discord_id', userId)
                .andWhere('item_id', itemId)
                .update({ quantity: currentQuantity - quantity });
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Lỗi khi trừ vật phẩm ${itemId} của người dùng ${userId}:`, error);
        return false;
    }
}

// Hàm phụ trợ: Thực hiện tiến hóa (cập nhật pokedex_id)
async function performEvolution(userId, pokemonInstanceId, newPokedexId) {
    try {
        await pgKnex('user_pokemons')
            .where('user_discord_id', userId)
            .andWhere('id', pokemonInstanceId)
            .update({ pokedex_id: newPokedexId });
        return true;
    } catch (error) {
        console.error(`Lỗi khi tiến hóa Pokémon (ID: ${pokemonInstanceId}) của người dùng ${userId} sang Pokedex ID ${newPokedexId}:`, error);
        return false;
    }
}

// --- Định nghĩa lệnh ---
module.exports = {
    name: 'evolve',
    description: 'Tiến hóa Pokémon của bạn.',
    aliases: ['evo'],
    usage: '<pokemon_id>',
    cooldown: 5,

    async execute(message, args, client, db) {
        const userId = message.author.id;
        const prefix = client.config.PREFIX; // Lấy prefix để dùng trong tin nhắn hướng dẫn

        if (args.length < 1) {
            // Thay message.reply bằng message.channel.send và thêm MessageFlags.Ephemeral
            await message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của Pokémon bạn muốn tiến hóa. Ví dụ: \`${prefix}evolve 123\``,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send evolve usage message:", e));
            return;
        }

        const pokemonInstanceId = parseInt(args[0]);

        if (isNaN(pokemonInstanceId)) {
            // Thay message.reply bằng message.channel.send và thêm MessageFlags.Ephemeral
            await message.channel.send({
                content: `<@${userId}> ID Pokémon không hợp lệ. Vui lòng nhập một số.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send invalid pokemon ID message:", e));
            return;
        }

        const userPokemon = await getUserPokemon(userId, pokemonInstanceId);

        if (!userPokemon) {
            // Thay message.reply bằng message.channel.send và thêm MessageFlags.Ephemeral
            await message.channel.send({
                content: `<@${userId}> Tôi không tìm thấy Pokémon này trong kho của bạn. Hãy đảm bảo bạn nhập đúng ID của Pokémon.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send pokemon not found message:", e));
            return;
        }

        const currentPokemonPokedexId = userPokemon.pokedex_id;
        const currentPokemonName = await getPokemonName(currentPokemonPokedexId);

        console.log(`[EVOLVE_DEBUG] Người dùng ${userId} cố gắng tiến hóa Pokémon ID ${pokemonInstanceId}.`);
        console.log(`[EVOLVE_DEBUG] Tên: ${currentPokemonName}, Pokedex ID: ${currentPokemonPokedexId}, Cấp độ: ${userPokemon.level}`);

        const evolutionRules = await getEvolutionRules(currentPokemonPokedexId);

        if (evolutionRules.length === 0) {
            // Thay message.reply bằng message.channel.send và thêm MessageFlags.Ephemeral
            await message.channel.send({
                content: `<@${userId}> **${currentPokemonName}** của bạn không thể tiến hóa thêm được nữa.`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send no more evolution message:", e));
            return;
        }

        console.log(`[EVOLVE_DEBUG] Tìm thấy ${evolutionRules.length} quy tắc tiến hóa cho ${currentPokemonName}.`);

        let evolved = false;
        let evolutionMessage = "";
        let foundApplicableRule = false;
        let allFailureReasons = [];

        // Danh sách các dạng đặc biệt (có thể cần bổ sung nếu có các dạng khác trong DB)
        const specialForms = ['alola', 'galar', 'hisui', 'mega', 'gigantamax', 'mega-x', 'mega-y', 'primal', 'origin', 'eternamax'];


        for (const rule of evolutionRules) {
            const evolvesToPokedexId = rule.evolves_to_pokedex_id;
            const targetPokemonDetails = await getPokemonDetails(evolvesToPokedexId); // Lấy chi tiết Pokémon đích
            const evolvesToPokemonName = targetPokemonDetails.name;
            const evolvesToPokemonForm = targetPokemonDetails.form; // Đây là chìa khóa để phân biệt

            console.log(`[EVOLVE_DEBUG] Đang kiểm tra quy tắc: ${currentPokemonName} -> ${evolvesToPokemonName} (Dạng: ${evolvesToPokemonForm || 'thường'}, Trigger: ${rule.trigger_method})`);

            // Bỏ qua các quy tắc dẫn đến dạng đặc biệt, yêu cầu dùng lệnh transform
            if (evolvesToPokemonForm && specialForms.includes(evolvesToPokemonForm.toLowerCase())) {
                allFailureReasons.push(`**${currentPokemonName}** có thể biến đổi thành **${evolvesToPokemonName}** (dạng ${evolvesToPokemonForm}). Vui lòng sử dụng lệnh \`${prefix}transform\` để thực hiện.`); // Sử dụng prefix
                continue; // Bỏ qua quy tắc này trong !evolve
            }

            let canEvolve = true;
            let currentRuleFailureReasons = [];

            // Kiểm tra điều kiện cấp độ
            if (rule.required_level !== null && userPokemon.level < rule.required_level) {
                canEvolve = false;
                currentRuleFailureReasons.push(`cấp độ ${userPokemon.level}/${rule.required_level}`);
            }

            // Kiểm tra điều kiện vật phẩm
            let requiredItemDbName = null;
            if (canEvolve && rule.required_item_id !== null) {
                requiredItemDbName = await getItemName(rule.required_item_id);
                const hasItem = await getUserItemQuantity(userId, rule.required_item_id);
                if (hasItem === 0) {
                    canEvolve = false;
                    currentRuleFailureReasons.push(`thiếu vật phẩm ${requiredItemDbName}`);
                }
            }

            // Kiểm tra điều kiện thời gian trong ngày
            if (canEvolve && rule.time_of_day) {
                const currentHour = new Date().getHours();
                const isDay = currentHour >= 6 && currentHour < 18;
                const isNight = !isDay;

                if (rule.time_of_day === 'day' && !isDay) {
                    canEvolve = false;
                    currentRuleFailureReasons.push("chỉ có thể tiến hóa vào ban ngày");
                } else if (rule.time_of_day === 'night' && !isNight) {
                    canEvolve = false;
                    currentRuleFailureReasons.push("chỉ có thể tiến hóa vào ban đêm");
                }
            }

            // TODO: Bổ sung các điều kiện khác (ví dụ: location, gender, etc.) nếu có trong DB

            if (canEvolve) {
                foundApplicableRule = true; // Tìm thấy một quy tắc có thể áp dụng

                // Nếu có vật phẩm yêu cầu, tiêu thụ nó
                if (rule.required_item_id !== null) {
                    const consumed = await consumeUserItem(userId, rule.required_item_id);
                    if (!consumed) {
                        evolutionMessage = `Đã có lỗi xảy ra khi tiêu thụ vật phẩm ${requiredItemDbName} cho ${currentPokemonName}.`;
                        break;
                    }
                }

                // Thực hiện tiến hóa
                const success = await performEvolution(userId, pokemonInstanceId, evolvesToPokedexId);
                if (success) {
                    evolved = true;
                    evolutionMessage = `🎉 Chúc mừng! **${currentPokemonName}** (ID: ${pokemonInstanceId}) của bạn đã tiến hóa thành **${evolvesToPokemonName}**!`;
                    break;
                } else {
                    evolutionMessage = `Đã xảy ra lỗi khi tiến hóa **${currentPokemonName}**. Vui lòng thử lại sau.`;
                    break;
                }
            } else {
                console.log(`[EVOLVE_DEBUG] Quy tắc không áp dụng cho ${evolvesToPokemonName}: ${currentRuleFailureReasons.join(', ')}`);
                // Chỉ thêm lý do thất bại nếu nó không phải là một dạng đặc biệt
                if (!(evolvesToPokemonForm && specialForms.includes(evolvesToPokemonForm.toLowerCase()))) {
                    allFailureReasons = allFailureReasons.concat(currentRuleFailureReasons);
                }
            }
        }

        if (!evolved) {
            const uniqueFailureReasons = [...new Set(allFailureReasons)]; // Lọc các lý do trùng lặp
            const finalFailureMessage = uniqueFailureReasons.length > 0
                ? `Các điều kiện thiếu: ${uniqueFailureReasons.join(', ')}.`
                : 'Không tìm thấy quy tắc tiến hóa phù hợp hoặc đã có lỗi không xác định. (Lưu ý: Một số Pokémon yêu cầu lệnh khác để biến đổi dạng đặc biệt.)'; // Thêm ghi chú để rõ ràng hơn

            // Thay message.reply bằng message.channel.send và thêm MessageFlags.Ephemeral
            await message.channel.send({
                content: `<@${userId}> Hiện tại **${currentPokemonName}** của bạn chưa đáp ứng đủ điều kiện để tiến hóa. ${finalFailureMessage}`,
                flags: MessageFlags.Ephemeral
            }).catch(e => console.error("Could not send evolve failure message:", e));
        } else {
            // Thay message.reply bằng message.channel.send (tin nhắn thành công không cần ephemeral)
            // Evolution message đã được xây dựng sẵn ở trên
            await message.channel.send({
                content: `<@${userId}> ${evolutionMessage}`
            }).catch(e => console.error("Could not send evolve success message:", e));
        }
    },
};