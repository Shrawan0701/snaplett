const extractKeywords = (text) => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were',
    'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'of', 'to', 'in', 'for',
    'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'and', 'but',
    'or', 'if', 'because', 'until', 'while', 'this', 'that', 'these', 'those'
  ]);

  const words = text.toLowerCase().match(/\b[\w]+\b/g) || [];
  const numbers = text.match(/\d+/g) || [];

  // Extract capitalized terms from original text (potential proper nouns)
  const capitalizedTerms = text.match(/\b[A-Z][a-z]+\b/g) || [];

  // Filter and count word frequency
  const wordFrequency = {};
  words.forEach(word => {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });

  // Sort by frequency
  const sortedWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5);

  // Combine results
  const keywords = [
    ...new Set([
      ...capitalizedTerms.slice(0, 3).map(w => w.toLowerCase()),
      ...sortedWords,
      ...numbers.slice(0, 3)
    ])
  ];

  return keywords.slice(0, 8);
};

module.exports = { extractKeywords };
