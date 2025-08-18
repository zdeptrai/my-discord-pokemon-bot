// utils/display/commandTablePrinter.js

/**
 * In một bảng các lệnh đã tải ra console.
 * @param {Array<Object>} commandStatuses - Mảng các đối tượng chứa tên, kiểu và trạng thái tải của lệnh.
 */
function printCommandTable(commandStatuses) {
    // Sắp xếp lệnh theo tên cho dễ nhìn
    commandStatuses.sort((a, b) => a.name.localeCompare(b.name));

    const header = ['Command Name', 'Type', 'Status'];
    
    // Tìm độ dài tối đa cho mỗi cột để căn chỉnh
    const maxNameLength = Math.max(...commandStatuses.map(cmd => cmd.name.length), header[0].length);
    const maxTypeLength = Math.max(...commandStatuses.map(cmd => cmd.type.length), header[1].length);
    const maxStatusLength = Math.max(...commandStatuses.map(cmd => cmd.status.length), header[2].length);

    // Ký tự bảng đẹp mắt
    const TL = '┌'; // Top-Left
    const TR = '┐'; // Top-Right
    const BL = '└'; // Bottom-Left
    const BR = '┘'; // Bottom-Right
    const H = '─'; // Horizontal
    const V = '│'; // Vertical
    const JM = '┼'; // Join-Middle
    const JT = '┬'; // Join-Top
    const JB = '┴'; // Join-Bottom
    const JL = '├'; // Join-Left
    const JR = '┤'; // Join-Right

    // Hàm tạo dòng ngang
    const createHorizontalLine = (left, mid1, mid2, right) => {
        return left + H.repeat(maxNameLength + 2) + mid1 + H.repeat(maxTypeLength + 2) + mid2 + H.repeat(maxStatusLength + 2) + right;
    };

    console.log('\n'); 
    // --- Bắt đầu logo ASCII Art (đã được bạn cung cấp) ---
    console.log('       ██████  ███████ ███    ███  ██████  ███    ██ ██   ██ ██ ███    ██  ██████  ');
    console.log('       ██   ██ ██      ████  ████ ██    ██ ████   ██ ██  ██  ██ ████   ██ ██       ');
    console.log('       ██   ██ █████   ██ ████ ██ ██    ██ ██ ██  ██ █████   ██ ██ ██  ██ ██   ███ ');
    console.log('       ██   ██ ██      ██  ██  ██ ██    ██ ██  ██ ██ ██  ██  ██ ██  ██ ██ ██    ██ ');
    console.log('       ██████  ███████ ██      ██  ██████  ██   ████ ██   ██ ██ ██   ████  ██████  ');
    // --- Kết thúc logo ASCII Art ---
    console.log('\n');
    console.log('                           ╔═══════════════════════╗');
    console.log('                           ║   Bot Command Status  ║');
    console.log('                           ╚═══════════════════════╝');
    console.log('\n');

    // Dòng trên cùng của bảng
    console.log(createHorizontalLine(TL, JT, JT, TR));

    // Dòng tiêu đề
    console.log(`${V} ${header[0].padEnd(maxNameLength)} ${V} ${header[1].padEnd(maxTypeLength)} ${V} ${header[2].padEnd(maxStatusLength)} ${V}`);

    // Dòng phân cách tiêu đề và nội dung
    console.log(createHorizontalLine(JL, JM, JM, JR));

    // Nội dung bảng
    for (const cmd of commandStatuses) {
        console.log(`${V} ${cmd.name.padEnd(maxNameLength)} ${V} ${cmd.type.padEnd(maxTypeLength)} ${V} ${cmd.status.padEnd(maxStatusLength)} ${V}`);
    }

    // Dòng dưới cùng của bảng
    console.log(createHorizontalLine(BL, JB, JB, BR));
    console.log('\n');
}

module.exports = { printCommandTable };