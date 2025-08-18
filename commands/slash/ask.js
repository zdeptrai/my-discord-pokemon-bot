// commands/slash/ask.js
// Import các thư viện cần thiết
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../utils/logger'); 

// --- CẤU HÌNH AI & DATABASE TẠM THỜI ---
const API_KEY = process.env.GEMINI_API_KEY; 

if (!API_KEY) {
    logger.error('Lỗi: Chưa tìm thấy GEMINI_API_KEY. Vui lòng đặt biến môi trường GEMINI_API_KEY.');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", 
    generationConfig: {
        temperature: 0.9,
        topP: 0.1,
        topK: 16,
    },
});

const userHistory = new Map(); 

// --- HÀM HỖ TRỢ ---

/**
 * Hàm xây dựng prompt cho AI, bao gồm lịch sử hội thoại và yêu cầu ngôn ngữ.
 * @param {string} content - Nội dung câu hỏi của người dùng.
 * @param {object} user - Đối tượng người dùng Discord (interaction.user).
 * @param {string} currentLang - Ngôn ngữ AI nên phản hồi (đã được phát hiện).
 * @param {object} langStrings - Đối tượng chứa các chuỗi ngôn ngữ cho 'currentLang'.
 * @returns {Promise<object>} Đối tượng chứa prompt đã xây dựng và các thông tin lịch sử cập nhật.
 */
async function buildPrompt(content, user, currentLang, langStrings) {
    const validContent = content || ''; 
    const userData = userHistory.get(user.id) || { promptHistory: '', CurrentAI: '', CurrentUser: '' };
    let { promptHistory, CurrentAI, CurrentUser } = userData;

    if (!promptHistory) {
        // Sử dụng langStrings để lấy các chuỗi ngôn ngữ phù hợp
        const botIntro = langStrings.bot_intro || "You are a helpful Discord bot named Demonking. Your capabilities include: answering questions, providing information, casual conversation, and server management support.";
        const commandList = langStrings.command_list || "You support slash commands.";
        const sourceCodeLink = langStrings.source_code_link ? langStrings.source_code_link.replace('{link}', 'https://github.com/zijipia/my-bot-discord') : "Your source code is available at: https://github.com/zijipia/my-bot-discord";
        
        promptHistory = `${botIntro} ${commandList} ${sourceCodeLink}`;
    }

    const lowerContent = validContent.toLowerCase().trim(); 
    // Yêu cầu AI phản hồi bằng ngôn ngữ cụ thể
    const languageInstruction = `Please respond in ${currentLang}.`;

    let historyLines = [];
    if (promptHistory) {
        historyLines.push(promptHistory);
    }
    if (CurrentUser && CurrentUser.trim().length > 0) {
        historyLines.push(`${user.username}: ${CurrentUser}`);
    }
    if (CurrentAI && CurrentAI.trim().length > 0) {
        historyLines.push(`Bot: ${CurrentAI}`);
    }

    const historyForAI = historyLines.join('\n').slice(-8000); // Giới hạn kích thước lịch sử
    const userPrompt = `${user.username} says: ${lowerContent}`;
    const fullPrompt = `Context:\n${historyForAI}\nPrompt: ${userPrompt}, ${languageInstruction}`;

    return { 
        fullPrompt, 
        newPromptHistory: historyForAI, 
        newCurrentAI: '', 
        newCurrentUser: lowerContent 
    };
}

/**
 * Hàm chia văn bản dài thành các đoạn nhỏ.
 * @param {string} text - Văn bản cần chia.
 * @param {number} chunkSize - Kích thước tối đa của mỗi đoạn.
 * @returns {string[]} Mảng các đoạn văn bản.
 */
function splitIntoChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

// --- ĐỊNH NGHĨA LỆNH SLASH ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Hỏi AI bất cứ điều gì! (Ngôn ngữ phản hồi tự động phát hiện)')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Câu hỏi của bạn dành cho AI') 
                .setRequired(true)), 

    async execute(interaction, client) { 
        await interaction.deferReply(); 

        const userQuestion = interaction.options.getString('prompt'); 
        const user = interaction.user; 

        const trimmedQuestion = userQuestion ? userQuestion.trim() : '';

        // Lấy các chuỗi ngôn ngữ mặc định (ưu tiên 'vi' rồi đến 'en')
        // Đây là fallback nếu không tìm thấy ngôn ngữ phát hiện được hoặc có lỗi.
        const defaultLangStrings = client.languages.get('vi') || client.languages.get('en') || {}; 
        // Đảm bảo defaultLangStrings không rỗng nếu cả vi/en đều không có, 
        // mặc dù logic loadLanguages đã đảm bảo có en/vi.

        if (trimmedQuestion.length === 0) {
            await interaction.editReply(defaultLangStrings.prompt_required_error || "Please provide a question for the AI to assist you!"); 
            return; 
        }
        
        let detectedLang = 'en'; // Mặc định là tiếng Anh nếu không phát hiện được hoặc lỗi
        let langStrings = defaultLangStrings; // Khởi tạo với ngôn ngữ mặc định

        try {
            const langDetectModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
            // PROMPT MỚI để Gemini trả về mã chính xác
            const langDetectResult = await langDetectModel.generateContent(`Detect the language of the following text and respond only with one of these exact codes: 'en' for English, 'vi' for Vietnamese, 'zh-CN' for Simplified Chinese. If it's another language or you are unsure, default to 'en'.\nText: "${trimmedQuestion}"`);
            
            // Lấy kết quả thô và chuẩn hóa
            const rawDetectedLang = langDetectResult.response.text().trim(); 
            
            // Kiểm tra xem mã ngôn ngữ phát hiện được có tồn tại trong các ngôn ngữ đã tải không
            if (client.languages.has(rawDetectedLang)) {
                detectedLang = rawDetectedLang;
            } else {
                // Nếu Gemini trả về mã không khớp hoặc không được bot hỗ trợ
                logger.warn(`[ASK_CMD]`, `Ngôn ngữ phát hiện từ AI ('${rawDetectedLang}') không khớp với ngôn ngữ đã tải hoặc không được bot hỗ trợ. Mặc định về 'en'.`);
                detectedLang = 'en'; // Fallback về tiếng Anh
            }
            logger.debug(`[ASK_CMD]`, `Ngôn ngữ phát hiện cho câu hỏi '${trimmedQuestion}': ${detectedLang}`);
        
            // Cập nhật langStrings dựa trên ngôn ngữ đã phát hiện
            langStrings = client.languages.get(detectedLang) || defaultLangStrings;

        } catch (langDetectError) {
            logger.error(`[ASK_CMD_ERROR]`, `Lỗi khi phát hiện ngôn ngữ, sử dụng mặc định:`, langDetectError);
        }

        try {
            // Sử dụng detectedLang và langStrings đã được cập nhật
            const { fullPrompt, newPromptHistory } = await buildPrompt(userQuestion, user, detectedLang, langStrings); 
            logger.debug(`[ASK_CMD]`, `Prompt gửi đến AI:`, fullPrompt);

            const result = await model.generateContent(fullPrompt);
            const responseText = result.response.text(); 

            if (!responseText) {
                await interaction.editReply(langStrings.no_ai_response_error || "Sorry, I didn't get a response from the AI. Please try again later."); 
                return;
            }

            userHistory.set(user.id, {
                promptHistory: newPromptHistory, 
                CurrentAI: responseText, 
                CurrentUser: userQuestion 
            });
            logger.debug(`[ASK_CMD]`, `Lịch sử đã cập nhật:`, userHistory.get(user.id));

            const chunks = splitIntoChunks(responseText, 3800); 
            let currentPage = 0; 

            const generateEmbed = (page) => {
                const footerText = langStrings.ask_ai_footer 
                    ? langStrings.ask_ai_footer.replace('{currentPage}', page + 1).replace('{totalPages}', chunks.length).replace('{username}', user.username) 
                    : `Page ${page + 1} / ${chunks.length} | Asked by: ${user.username}`;
                
                return new EmbedBuilder()
                    .setTitle(langStrings.ask_ai_title || "🤖 AI Response") 
                    .setDescription(chunks[page])
                    .setFooter({ text: footerText }) 
                    .setColor('#0099ff'); 
            };

            if (chunks.length === 1) {
                await interaction.editReply({
                    embeds: [generateEmbed(0)],
                    content: `**__${langStrings.ask_ai_user_question || "Your Question:"}__**: ${userQuestion}`, 
                });
                return;
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel(langStrings.prev_page || "◀️ Previous Page") 
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true), 

                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel(langStrings.next_page || "Next Page ▶️") 
                    .setStyle(ButtonStyle.Primary)
            );

            const replyMessage = await interaction.editReply({ 
                embeds: [generateEmbed(currentPage)],
                components: [row],
                content: `**__${langStrings.ask_ai_user_question || "Your Question:"}__**: ${userQuestion}`, 
            });

            const collector = replyMessage.createMessageComponentCollector({
                componentType: ComponentType.Button, 
                filter: i => i.user.id === interaction.user.id, 
                time: 120000, 
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1); 
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(chunks.length - 1, currentPage + 1); 
                }

                row.components[0].setDisabled(currentPage === 0); 
                row.components[1].setDisabled(currentPage === chunks.length - 1); 

                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [row],
                });
            });

            collector.on('end', async () => {
                row.components[0].setDisabled(true);
                row.components[1].setDisabled(true);

                await interaction.editReply({
                    components: [row],
                }).catch(err => logger.error(`[ASK_CMD_ERROR]`, `Lỗi khi vô hiệu hóa nút phân trang:`, err)); 
            });

        } catch (error) {
            logger.error(`[ASK_CMD_ERROR]`, `Lỗi khi gọi AI hoặc xử lý lệnh /ask:`, error);
            // Sử dụng langStrings đã được cập nhật hoặc mặc định cho thông báo lỗi
            await interaction.editReply(langStrings.command_execution_error || "An error occurred while executing this command. Please try again later."); 
        }
    },
};