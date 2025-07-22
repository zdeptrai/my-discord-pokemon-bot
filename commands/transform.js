// commands/transform.js

// LƯU Ý: Đảm bảo bạn đang sử dụng cùng một instance db từ file db.js
// Thay vì import knexConfig và pgKnex riêng lẻ, hãy import 'db' từ '../db'.
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { db } = require('../db'); // Sử dụng instance db chung

// Hàm phụ trợ: Lấy tên Pokémon từ pokedex_id
async function getPokemonName(dbInstance, pokedexId) {
    try {
        const pokemon = await dbInstance('pokemons') // Sử dụng dbInstance
            .where('pokedex_id', pokedexId)
            .select('name', 'form')
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
async function getPokemonDetails(dbInstance, pokedexId) { // Truyền dbInstance
    try {
        const pokemon = await dbInstance('pokemons') // Sử dụng dbInstance
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
async function getUserPokemon(dbInstance, userId, pokemonInstanceId) { // Truyền dbInstance
    try {
        const userPokemon = await dbInstance('user_pokemons') // Sử dụng dbInstance
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

// Hàm phụ trợ: Lấy thông tin vật phẩm từ database
async function getItemName(dbInstance, itemId) { // Truyền dbInstance
    try {
        const item = await dbInstance('items').where('item_id', itemId).select('name').first(); // Sử dụng dbInstance
        return item ? item.name : 'Vật phẩm không xác định';
    } catch (error) {
        console.error(`Lỗi khi lấy tên vật phẩm ${itemId}:`, error);
        return 'Vật phẩm không xác định';
    }
}

// Hàm phụ trợ: Kiểm tra số lượng vật phẩm của người chơi
async function getUserItemQuantity(dbInstance, userId, itemId) { // Truyền dbInstance
    try {
        const userItem = await dbInstance('user_inventory_items') // Sử dụng dbInstance
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

// Hàm phụ trợ: Tiêu thụ vật phẩm khỏi kho của người chơi
async function consumeUserItem(dbInstance, userId, itemId, quantity = 1) { // Truyền dbInstance
    try {
        const currentQuantity = await getUserItemQuantity(dbInstance, userId, itemId); // Truyền dbInstance
        if (currentQuantity >= quantity) {
            await dbInstance('user_inventory_items') // Sử dụng dbInstance
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
async function performEvolution(dbInstance, userId, pokemonInstanceId, newPokedexId) { // Truyền dbInstance
    try {
        await dbInstance('user_pokemons') // Sử dụng dbInstance
            .where('user_discord_id', userId)
            .andWhere('id', pokemonInstanceId)
            .update({ pokedex_id: newPokedexId, updated_at: dbInstance.fn.now() }); // Cập nhật updated_at
        return true;
    } catch (error) {
        console.error(`Lỗi khi tiến hóa Pokémon (ID: ${pokemonInstanceId}) của người dùng ${userId} sang Pokedex ID ${newPokedexId}:`, error);
        return false;
    }
}


// --- Định nghĩa lệnh ---
module.exports = {
    name: 'transform',
    description: 'Biến đổi Pokémon của bạn thành dạng Mega, Gigantamax, hoặc dạng khu vực.',
    aliases: ['form', 'changeform'],
    usage: '<pokemon_id>',
    cooldown: 5,

    async execute(message, args, client) { // Xóa 'db' khỏi tham số, vì đã import ở trên
        const userId = message.author.id;
        const prefix = client.config.PREFIX;

        if (args.length < 1) {
            // Sử dụng channel.send với ephemeral flag và tag người dùng
            return message.channel.send({
                content: `<@${userId}> Vui lòng cung cấp ID của Pokémon bạn muốn biến đổi. Ví dụ: \`${prefix}transform 123\``,
                flags: MessageFlags.Ephemeral
            });
        }

        const pokemonInstanceId = parseInt(args[0]);

        if (isNaN(pokemonInstanceId)) {
            // Sử dụng channel.send với ephemeral flag và tag người dùng
            return message.channel.send({
                content: `<@${userId}> ID Pokémon không hợp lệ. Vui lòng nhập một số.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const userPokemon = await getUserPokemon(db, userId, pokemonInstanceId); // Truyền db

        if (!userPokemon) {
            // Sử dụng channel.send với ephemeral flag và tag người dùng
            return message.channel.send({
                content: `<@${userId}> Tôi không tìm thấy Pokémon này trong kho của bạn. Hãy đảm bảo bạn nhập đúng ID của Pokémon.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const currentPokemonPokedexId = userPokemon.pokedex_id;
        const currentPokemonName = userPokemon.nickname ?
            `${userPokemon.nickname} (${await getPokemonName(db, userPokemon.pokedex_id, userPokemon.is_mega_evolved)})` :
            await getPokemonName(db, currentPokemonPokedexId); // Truyền db

        console.log(`[TRANSFORM_DEBUG] Người dùng ${userId} cố gắng biến đổi Pokémon ID ${pokemonInstanceId}.`);
        console.log(`[TRANSFORM_DEBUG] Tên: ${currentPokemonName}, Pokedex ID: ${currentPokemonPokedexId}, Cấp độ: ${userPokemon.level}`);

        // Lấy TẤT CẢ các quy tắc tiến hóa cho Pokémon hiện tại
        const evolutionRules = await db('evolutions') // Sử dụng db
            .where('pokedex_id', currentPokemonPokedexId)
            .select('*');

        if (evolutionRules.length === 0) {
            // Sử dụng channel.send với ephemeral flag và tag người dùng
            return message.channel.send({
                content: `<@${userId}> **${currentPokemonName}** của bạn không có quy tắc biến đổi nào.`,
                flags: MessageFlags.Ephemeral
            });
        }

        console.log(`[TRANSFORM_DEBUG] Tìm thấy ${evolutionRules.length} quy tắc tiến hóa/biến đổi cho ${currentPokemonName}.`);

        let transformed = false;
        let transformationMessage = "";
        let allFailureReasons = [];

        // Danh sách các dạng đặc biệt (có thể cần bổ sung nếu có các dạng khác trong DB)
        // Đảm bảo tất cả các giá trị ở đây là chữ thường và không có khoảng trắng thừa.
        const specialForms = ['alola', 'galar', 'hisui', 'mega', 'gigantamax', 'mega-x', 'mega-y', 'primal', 'origin', 'eternamax'];


        for (const rule of evolutionRules) {
            const evolvesToPokedexId = rule.evolves_to_pokedex_id;
            const targetPokemonDetails = await getPokemonDetails(db, evolvesToPokedexId); // Truyền db
            const evolvesToPokemonName = targetPokemonDetails.name;
            let evolvesToPokemonForm = targetPokemonDetails.form; // Lấy giá trị form thô

            // Chuẩn hóa giá trị form: chuyển sang chữ thường và loại bỏ khoảng trắng thừa
            if (evolvesToPokemonForm) {
                evolvesToPokemonForm = evolvesToPokemonForm.toLowerCase().trim();
            }

            console.log(`[TRANSFORM_DEBUG] Đang kiểm tra quy tắc: ${currentPokemonName} -> ${evolvesToPokemonName} (Dạng đã chuẩn hóa: ${evolvesToPokemonForm || 'thường'}, Trigger: ${rule.trigger_method})`);

            // Chỉ xử lý các quy tắc dẫn đến dạng đặc biệt
            if (!evolvesToPokemonForm || !specialForms.includes(evolvesToPokemonForm)) {
                console.log(`[TRANSFORM_DEBUG] Lý do bỏ qua: evolvesToPokemonForm = '${evolvesToPokemonForm}', specialForms.includes(evolvesToPokemonForm) = ${specialForms.includes(evolvesToPokemonForm)}`);
                console.log(`[TRANSFORM_DEBUG] Bỏ qua quy tắc cho ${evolvesToPokemonName} (dạng ${evolvesToPokemonForm || 'thường'}), không phải dạng đặc biệt được xử lý bởi !transform.`);
                continue;
            }

            let canTransform = true;
            let currentRuleFailureReasons = [];

            // Kiểm tra điều kiện cấp độ
            if (rule.required_level !== null && userPokemon.level < rule.required_level) {
                canTransform = false;
                currentRuleFailureReasons.push(`cấp độ ${userPokemon.level}/${rule.required_level}`);
            }

            // Kiểm tra điều kiện vật phẩm
            let requiredItemDbName = null;
            if (canTransform && rule.required_item_id !== null) {
                requiredItemDbName = await getItemName(db, rule.required_item_id); // Truyền db
                const hasItem = await getUserItemQuantity(db, userId, rule.required_item_id); // Truyền db
                if (hasItem === 0) {
                    canTransform = false;
                    currentRuleFailureReasons.push(`thiếu vật phẩm ${requiredItemDbName}`);
                }
            }

            // Kiểm tra điều kiện thời gian trong ngày
            if (canTransform && rule.time_of_day) {
                const currentHour = new Date().getHours();
                const isDay = currentHour >= 6 && currentHour < 18;
                const isNight = !isDay;

                if (rule.time_of_day === 'day' && !isDay) {
                    canTransform = false;
                    currentRuleFailureReasons.push("chỉ có thể biến đổi vào ban ngày");
                } else if (rule.time_of_day === 'night' && !isNight) {
                    canTransform = false;
                    currentRuleFailureReasons.push("chỉ có thể biến đổi vào ban đêm");
                }
            }

            // TODO: Bổ sung các điều kiện khác nếu có (ví dụ: location, gender, etc.) từ bảng evolutions

            if (canTransform) {
                // Tiêu thụ vật phẩm nếu cần
                if (rule.required_item_id !== null) {
                    const consumed = await consumeUserItem(db, userId, rule.required_item_id); // Truyền db
                    if (!consumed) {
                        transformationMessage = `Đã có lỗi xảy ra khi tiêu thụ vật phẩm ${requiredItemDbName} cho ${currentPokemonName}.`;
                        break;
                    }
                }

                // Thực hiện biến đổi (cập nhật pokedex_id)
                const success = await performEvolution(db, userId, pokemonInstanceId, evolvesToPokedexId); // Truyền db
                if (success) {
                    transformed = true;
                    transformationMessage = `🎉 Chúc mừng! **${currentPokemonName}** (ID: ${pokemonInstanceId}) của bạn đã biến đổi thành **${evolvesToPokemonName}**!`;
                    break;
                } else {
                    transformationMessage = `Đã xảy ra lỗi khi biến đổi ${currentPokemonName}. Vui lòng thử lại sau.`;
                    break;
                }
            } else {
                console.log(`[TRANSFORM_DEBUG] Quy tắc không áp dụng cho ${evolvesToPokemonName}: ${currentRuleFailureReasons.join(', ')}`);
                allFailureReasons = allFailureReasons.concat(currentRuleFailureReasons);
            }
        }

        if (!transformed) {
            const uniqueFailureReasons = [...new Set(allFailureReasons)];
            const finalFailureMessage = uniqueFailureReasons.length > 0
                ? `Các điều kiện thiếu: ${uniqueFailureReasons.join(', ')}.`
                : 'Không tìm thấy quy tắc biến đổi phù hợp hoặc đã có lỗi không xác định.';

            // Sử dụng channel.send với ephemeral flag và tag người dùng
            return message.channel.send({
                content: `<@${userId}> Hiện tại **${currentPokemonName}** của bạn chưa đáp ứng đủ điều kiện để biến đổi. ${finalFailureMessage}`,
                flags: MessageFlags.Ephemeral
            });
        }
        // Gửi tin nhắn thành công bằng channel.send
        return message.channel.send(transformationMessage);
    },
};