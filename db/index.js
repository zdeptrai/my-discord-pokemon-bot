// db/index.js

const knex = require('knex');
// Không cần require('dotenv').config(); trên Replit. Replit tự quản lý biến môi trường.

// Replit Database cung cấp một chuỗi kết nối duy nhất qua DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;

// Kiểm tra xem biến môi trường DATABASE_URL đã được đặt chưa
if (!DATABASE_URL) {
    console.error("Lỗi: Biến môi trường DATABASE_URL không được tìm thấy. Vui lòng đảm bảo Replit Database đã được bật hoặc DATABASE_URL đã được thiết lập trong Secrets.");
    process.exit(1);
}

const db = knex({
    client: 'pg', // Client cho PostgreSQL
    connection: {
        connectionString: DATABASE_URL, // Sử dụng chuỗi kết nối duy nhất
        ssl: {
            rejectUnauthorized: false // RẤT QUAN TRỌNG: Cho phép kết nối SSL mà không kiểm tra chứng chỉ
        }
    },
    pool: {
        min: 2,
        max: 10
    },
    migrations: {
        tableName: 'knex_migrations'
    },
    // useNullAsDefault: true; // Tùy chọn này thường dùng cho SQLite. Có thể bỏ đi nếu chỉ dùng PostgreSQL.
});

// Hàm kiểm tra kết nối database và khởi tạo schema
async function initializeDatabase() {
    try {
        await db.raw('SELECT 1'); // Kiểm tra kết nối đơn giản
        console.log(`[DATABASE] Đã kết nối database PostgreSQL thành công.`);

        // --- Ví dụ tạo bảng Pokemon nếu chưa tồn tại ---
        // Bạn có thể di chuyển logic tạo bảng này vào một migration script nếu dùng Knex migrations
        const hasPokemonDataTable = await db.schema.hasTable('pokemon_data');
        if (!hasPokemonDataTable) {
            await db.schema.createTable('pokemon_data', (table) => {
                table.increments('id').primary();
                table.string('name').unique().notNullable();
                table.string('type1').notNullable();
                table.string('type2'); // Có thể null
                table.integer('hp').notNullable();
                table.integer('attack').notNullable();
                table.integer('defense').notNullable();
                table.integer('sp_attack').notNullable();
                table.integer('sp_defense').notNullable();
                table.integer('speed').notNullable();
                // Thêm các cột khác theo nhu cầu của bạn
            });
            console.log('Bảng pokemon_data đã được tạo.');
        } else {
            console.log('Bảng pokemon_data đã tồn tại.');
        }

        // TODO: Bạn có thể thêm logic kiểm tra dữ liệu và populate dữ liệu Pokémon vào đây
        // nếu database rỗng hoặc cần cập nhật.
        // Ví dụ:
        // const existingPokemonCount = await db('pokemon_data').count('id as count');
        // if (existingPokemonCount[0].count === '0') {
        //   console.log('Database Pokémon trống, đang tải dữ liệu...');
        //   // Gọi hàm tải dữ liệu Pokémon của bạn ở đây
        //   // Ví dụ: await loadInitialPokemonData(db);
        // }

    } catch (error) {
        console.error(`[DATABASE_ERROR] Lỗi kết nối hoặc khởi tạo database PostgreSQL:`, error);
        process.exit(1); // Thoát ứng dụng nếu không kết nối được DB
    }
}

// Gọi hàm khởi tạo database khi module được import
initializeDatabase();

module.exports = { db };