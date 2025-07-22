// migrate_data.js

const path = require('path');
const knex = require('./knexfile'); // Import knexfile của bạn

// Knex instance cho PostgreSQL
const pgKnex = require('knex')(knex.development);

// Knex instance cho SQLite cũ
const sqliteKnex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.resolve(__dirname, 'data', 'pokebot.sqlite') // Đường dẫn đến file SQLite cũ của bạn
  },
  useNullAsDefault: true,
});

async function migrateData() {
  console.log('Bắt đầu di chuyển dữ liệu từ SQLite sang PostgreSQL...');

  try {
    // Thứ tự di chuyển dữ liệu RẤT QUAN TRỌNG để tránh lỗi khóa ngoại.
    // Các bảng được tham chiếu phải được di chuyển trước.
    // Chúng ta sẽ di chuyển các bảng quan trọng của bạn và các phụ thuộc của chúng.
    const tablesToMigrate = [
      'users',          // Cần thiết vì user_pokemons phụ thuộc vào nó
      'pokemons',       // Cần thiết vì user_pokemons và evolutions phụ thuộc vào nó
      'skills',         // Dữ liệu quan trọng của bạn
      'items',          // Dữ liệu quan trọng của bạn
      'user_pokemons',  // Cần thiết vì pokemon_skills phụ thuộc vào nó
      'pokemon_skills', // Dữ liệu quan trọng của bạn
      // 'user_inventory', // Không di chuyển nếu không quan trọng
      // 'user_inventory_items', // Không di chuyển nếu không quan trọng
      // 'evolutions', // Không di chuyển nếu không quan trọng
    ];

    for (const tableName of tablesToMigrate) {
      console.log(`Đang di chuyển dữ liệu cho bảng: ${tableName}...`);

      const oldData = await sqliteKnex(tableName).select('*');

      if (oldData.length === 0) {
        console.log(`Không có dữ liệu trong bảng ${tableName}. Bỏ qua.`);
        continue;
      }

      // Xóa dữ liệu cũ trong bảng PostgreSQL nếu có (để chạy lại script nhiều lần)
      await pgKnex(tableName).del();
      
      // Chèn dữ liệu
      await pgKnex.batchInsert(tableName, oldData, 1000); // Batch insert 1000 hàng mỗi lần

      console.log(`Đã di chuyển ${oldData.length} hàng vào bảng ${tableName}.`);

      // Reset sequence của cột ID tự tăng (SERIAL) trong PostgreSQL
      if (['users', 'pokemons', 'items', 'user_pokemons', 'skills', 'pokemon_skills', 'evolutions'].includes(tableName)) {
        const sequenceNameResult = await pgKnex.raw(
          `SELECT pg_get_serial_sequence(?, 'id') AS sequence_name`,
          [tableName]
        );
        const sequenceName = sequenceNameResult.rows[0]?.sequence_name;

        if (sequenceName) {
          await pgKnex.raw(
            `SELECT setval(?, coalesce(max(id), 0) + 1, false) FROM ??`,
            [sequenceName, tableName]
          );
          console.log(`Đã reset sequence cho bảng ${tableName}.`);
        } else {
            console.warn(`Không tìm thấy sequence cho cột 'id' trong bảng ${tableName}.`);
        }
      }
    }

    console.log('Di chuyển dữ liệu hoàn tất thành công!');
  } catch (error) {
    console.error('Đã xảy ra lỗi trong quá trình di chuyển dữ liệu:', error);
  } finally {
    await sqliteKnex.destroy();
    await pgKnex.destroy();
  }
}

migrateData();