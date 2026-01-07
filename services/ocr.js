const Tesseract = require('tesseract.js');

const extractTextFromImage = async (imageBuffer) => {
  try {
    console.log('Starting OCR extraction...');

    const { data: { text } } = await Tesseract.recognize(
      imageBuffer,
      'eng',
      {
        logger: info => console.log(info)
      }
    );

    const cleanedText = text.trim().replace(/\s+/g, ' ');
    console.log('OCR extraction completed');

    return cleanedText;
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract text from image');
  }
};

module.exports = { extractTextFromImage };
