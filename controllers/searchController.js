const pool = require('../config/database');
const { extractKeywords } = require('../services/keywordExtractor');

const searchFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, limit = 20 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Searching for: "${query}"`);

    // Fetch all user files
    const result = await pool.query(
      `
      SELECT 
        id,
        file_url,
        file_type,
        file_name,
        extracted_text,
        created_at
      FROM files
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const q = query.toLowerCase();

    // Score files locally
    const scored = result.rows.map(file => {
      const text = (file.extracted_text || '').toLowerCase();
      const keywords = extractKeywords(file.extracted_text || '');

      let score = 0;

      if (text.includes(q)) score += 5;

      keywords.forEach(k => {
        if (q.includes(k.toLowerCase())) score += 2;
      });

      return {
        id: file.id,
        file_url: file.file_url,
        file_type: file.file_type,
        file_name: file.file_name,
        created_at: file.created_at,
        keywords,
        preview: file.extracted_text
          ? file.extracted_text.slice(0, 200)
          : '',
        score
      };
    });

    // Sort + filter
    const results = scored
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`Found ${results.length} matching files`);

    res.json({
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
};

module.exports = { searchFiles };
