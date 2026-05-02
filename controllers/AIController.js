const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }) : null;

exports.predictiveTyping = async (req, res) => {
    if (!model) {
        return res.json({ suggestions: [] });
    }
    try {
        const { partial } = req.body;
        if (!partial || partial.trim().length === 0) {
            return res.json({ suggestions: [] });
        }

        const prompt = `Given the partial message: "${partial}", suggest 3 concise word or phrase completions that are relevant, natural, appropriate, and polite continuations. Respond with only a JSON array of strings, no other text. Example: ["5 pm", "the office", "tomorrow"]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        let suggestions;
        try {
            suggestions = JSON.parse(text);
        } catch (e) {
            // Fallback: extract from text
            suggestions = text.split(',').map(s => s.trim().replace(/"/g, '')).slice(0, 3);
        }

        res.json({ suggestions: suggestions.slice(0, 3) });
    } catch (error) {
        console.error('Predictive typing error:', error);
        res.status(500).json({ suggestions: [] });
    }
};

exports.smartReplies = async (req, res) => {
    if (!model) {
        return res.json({ replies: [] });
    }
    try {
        const { message } = req.body;
        if (!message || message.trim().length === 0) {
            return res.json({ replies: [] });
        }

        const prompt = `For the incoming message: "${message}", suggest 3 short, appropriate, polite, and context-aware reply options that someone might send. Make them concise. Respond with only a JSON array of strings, no other text. Example: ["Yes, I’ll be there.", "Running late, will join soon.", "Can we reschedule?"]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        let replies;
        try {
            replies = JSON.parse(text);
        } catch (e) {
            replies = text.split(',').map(s => s.trim().replace(/"/g, '')).slice(0, 3);
        }

        res.json({ replies: replies.slice(0, 3) });
    } catch (error) {
        console.error('Smart replies error:', error);
        res.status(500).json({ replies: [] });
    }
};