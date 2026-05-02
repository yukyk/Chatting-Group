const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-pro' }) : null;

exports.predictiveTyping = async (req, res) => {
    if (!model) {
        return res.json({ completion: '' });
    }
    try {
        const { partial } = req.body;
        if (!partial || partial.trim().length === 0) {
            return res.json({ completion: '' });
        }

        const prompt = `Given the partial message: "${partial}", suggest a concise word or phrase completion that is the most likely natural continuation. Respond with only the completion text, no quotes or extra text. Example: "5 pm"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        res.json({ completion: text });
    } catch (error) {
        console.error('Predictive typing error:', error);
        res.status(500).json({ completion: '' });
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