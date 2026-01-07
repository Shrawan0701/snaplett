const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const isDev = process.env.NODE_ENV !== 'production';

// Generate fake 1536-dim embedding for dev
function generateFakeEmbedding() {
  return Array.from({ length: 1536 }, () => Math.random());
}

const generateEmbedding = async (text) => {
  if (!text || text.trim().length === 0) {
    throw new Error('Text is empty');
  }

  // ✅ DEV MODE: skip OpenAI
  if (isDev) {
    console.log('⚠️ Using fake embedding (development mode)');
    return generateFakeEmbedding();
  }

  // ✅ PROD MODE: real embeddings
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000)
  });

  return response.data[0].embedding;
};

module.exports = { generateEmbedding };
