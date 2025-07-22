const knexConfig = require('./knexfile');
const axios = require('axios');
const pgKnex = require('knex')(knexConfig.development);

let itemNameIdMap = new Map();

function mapPokeApiIdToCustomPokedexId(pokeApiId) {
    return pokeApiId + 99999;
}

async function getPokemonIdFromDB(name, speciesId, formName = null) {
    let query = pgKnex('pokemons')
        .select('pokedex_id')
        .where('name', name)
        .andWhere('species_pokedex_id', speciesId);

    if (formName) {
        query = query.andWhere('form', formName);
    } else {
        query = query.andWhere(function() {
            this.whereNull('form').orWhere('form', '');
        });
    }

    const result = await query.first();
    if (!result) {
        const genericQuery = pgKnex('pokemons')
            .select('pokedex_id')
            .where('species_pokedex_id', speciesId)
            .first();

        const genericResult = await genericQuery;
        if (genericResult) {
            console.warn(`Cảnh báo: Không tìm thấy Pokémon khớp chính xác tên '${name}' (species ${speciesId}, form '${formName || 'null'}'). Sử dụng một form bất kỳ của species_id ${speciesId}: ${genericResult.pokedex_id}`);
            return genericResult.pokedex_id;
        }

        console.error(`Lỗi: Không tìm thấy Pokémon nào với name '${name}' (species ${speciesId}, form '${formName || 'null'})' trong DB.`);
        return null;
    }
    return result.pokedex_id;
}


async function populateEvolutionsFromApi() {
    console.log('Bắt đầu điền dữ liệu tiến hóa từ PokeAPI vào PostgreSQL...');

    try {
        await pgKnex('evolutions').del();
        console.log('Đã xóa dữ liệu cũ trong bảng evolutions.');

        const allItemsInDb = await pgKnex('items').select('item_id', 'name');
        itemNameIdMap = new Map();
        for (const item of allItemsInDb) {
            itemNameIdMap.set(item.name.toLowerCase().replace(/\s/g, '-'), item.item_id);
            itemNameIdMap.set(item.name.toLowerCase(), item.item_id);
        }
        console.log('Đã tạo map ánh xạ tên vật phẩm sang ID từ DB.');

        const evolutionChainListResponse = await axios.get('https://pokeapi.co/api/v2/evolution-chain?limit=1000');
        const evolutionChainList = evolutionChainListResponse.data.results;

        const evolutionDataToInsert = [];
        const addedEvolutionPairs = new Set(); // Thêm Set này để theo dõi các cặp đã được thêm
        let processedChains = 0;

        const traverseEvolutionChain = async (node) => {
            const fromSpeciesUrl = node.species.url;
            const fromSpeciesId = parseInt(fromSpeciesUrl.split('/').slice(-2, -1)[0]);
            const fromPokedexId = await getPokemonIdFromDB(node.species.name, fromSpeciesId);

            if (!fromPokedexId) {
                console.warn(`Bỏ qua chuỗi tiến hóa từ species ID: ${fromSpeciesId} do không tìm thấy Pokémon gốc trong DB.`);
                return;
            }

            for (const evolutionDetail of node.evolves_to) {
                const toSpeciesUrl = evolutionDetail.species.url;
                const toSpeciesId = parseInt(toSpeciesUrl.split('/').slice(-2, -1)[0]);
                const toPokedexId = await getPokemonIdFromDB(evolutionDetail.species.name, toSpeciesId);

                if (!toPokedexId) {
                    console.warn(`Bỏ qua tiến hóa từ ${fromPokedexId} sang species ID: ${toSpeciesId} do không tìm thấy Pokémon tiến hóa trong DB.`);
                    continue;
                }

                // Tạo khóa duy nhất cho cặp tiến hóa này
                const evolutionPairKey = `${fromPokedexId}-${toPokedexId}`;

                // Chỉ thêm nếu cặp này chưa được thêm vào
                if (!addedEvolutionPairs.has(evolutionPairKey)) {
                    addedEvolutionPairs.add(evolutionPairKey); // Đánh dấu là đã thêm

                    // Lấy chi tiết tiến hóa đầu tiên (hoặc xử lý logic phức tạp hơn nếu cần)
                    // Hiện tại, chúng ta chỉ lấy chi tiết đầu tiên nếu có nhiều
                    const detail = evolutionDetail.evolution_details[0];

                    let triggerName = detail ? detail.trigger.name : 'unknown'; // Đảm bảo có detail
                    let requiredLevel = detail ? detail.min_level : null;
                    let requiredItemId = null;

                    if (detail && detail.held_item) {
                        const heldItemName = detail.held_item.name.toLowerCase();
                        requiredItemId = itemNameIdMap.get(heldItemName);
                    } else if (detail && detail.item) {
                        const itemName = detail.item.name.toLowerCase();
                        requiredItemId = itemNameIdMap.get(itemName);
                    }

                    if (triggerName === 'trade' || triggerName === 'friendship') {
                        triggerName = 'level-up';
                        requiredLevel = requiredLevel || 25; // Giữ nguyên cấp độ nếu có, hoặc đặt là 25
                        requiredItemId = null;
                    }

                    evolutionDataToInsert.push({
                        pokedex_id: fromPokedexId,
                        evolves_to_pokedex_id: toPokedexId,
                        required_level: requiredLevel,
                        required_item_id: requiredItemId,
                        evolution_type: triggerName,
                        trigger_method: triggerName,
                        time_of_day: null,
                    });
                } else {
                    // console.log(`Cảnh báo: Bỏ qua cặp tiến hóa trùng lặp: ${evolutionPairKey}`);
                }

                await traverseEvolutionChain(evolutionDetail);
            }
        };

        for (const chainEntry of evolutionChainList) {
            try {
                const chainResponse = await axios.get(chainEntry.url);
                const chainData = chainResponse.data;
                await traverseEvolutionChain(chainData.chain);
            } catch (chainError) {
                console.warn(`Cảnh báo: Không thể lấy dữ liệu cho chuỗi tiến hóa từ URL: ${chainEntry.url}. Lỗi: ${chainError.message}`);
            }
            processedChains++;
            if (processedChains % 10 === 0 || processedChains === evolutionChainList.length) {
                console.log(`Đã xử lý ${processedChains}/${evolutionChainList.length} chuỗi tiến hóa.`);
            }
        }

        if (evolutionDataToInsert.length > 0) {
            await pgKnex.batchInsert('evolutions', evolutionDataToInsert, 100);
            console.log(`Đã nhập thành công ${evolutionDataToInsert.length} quy tắc tiến hóa vào PostgreSQL.`);
        } else {
            console.log('Không có quy tắc tiến hóa nào để nhập.');
        }

        console.log('\n--- Quá trình điền dữ liệu tiến hóa hoàn tất! ---');

    } catch (error) {
        console.error('Đã xảy ra lỗi nghiêm trọng trong quá trình điền dữ liệu tiến hóa:', error);
        console.error('Chi tiết lỗi (nếu có):', error.detail || error.message);
    } finally {
        if (pgKnex) {
            await pgKnex.destroy();
        }
    }
}

populateEvolutionsFromApi();