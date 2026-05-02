const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log("=== GEMINI DEBUG ===");
console.log("KEY RAW:", process.env.GEMINI_API_KEY);
console.log("KEY LENGTH:", process.env.GEMINI_API_KEY?.length);
console.log("FIRST 10:", process.env.GEMINI_API_KEY?.slice(0, 10));
console.log("====================");

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
let model = null;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI( apiKey );
  } catch (err) {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
    } catch (innerErr) {
      console.error('Failed to initialize GoogleGenerativeAI client:', innerErr);
      genAI = null;
    }
  }
  model = genAI?.getGenerativeModel?.({ model: 'gemini-2.0-flash' }) ?? null;
}

const callModel = async (prompt) => {
  if (!model) {
    throw new Error('AI model is not initialized');
  }

  if (typeof model.generateContent === 'function') {
    return await model.generateContent(prompt);
  }

  if (typeof model.generate === 'function') {
    return await model.generate({ prompt });
  }

  if (typeof model.predict === 'function') {
    return await model.predict({ prompt });
  }

  throw new Error('Unsupported model API; no generate method found');
};

const extractText = async (result) => {
  if (!result) return '';

  const response = result?.response ?? result;
  if (!response) return '';

  if (typeof response.text === 'function') {
    return (await response.text()).trim();
  }

  if (typeof response.text === 'string') {
    return response.text.trim();
  }

  if (typeof response.outputText === 'string') {
    return response.outputText.trim();
  }

  if (Array.isArray(response.output) && response.output.length > 0) {
    const outputItem = response.output[0];
    if (typeof outputItem.content === 'string') {
      return outputItem.content.trim();
    }
    if (typeof outputItem.text === 'string') {
      return outputItem.text.trim();
    }
  }

  if (typeof result === 'string') {
    return result.trim();
  }

  return '';
};

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

    const result = await callModel(prompt);
    const text = await extractText(result);

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

    const result = await callModel(prompt);
    const text = await extractText(result);

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