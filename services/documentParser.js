const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const extractTextFromPDF = async (fileBuffer) => {
  try {
    console.log('Extracting text from PDF...');
    const data = await pdfParse(fileBuffer);
    const cleanedText = data.text.trim().replace(/\s+/g, ' ');
    console.log('PDF extraction completed');
    return cleanedText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

const extractTextFromDOCX = async (fileBuffer) => {
  try {
    console.log('Extracting text from DOCX...');
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const cleanedText = result.value.trim().replace(/\s+/g, ' ');
    console.log('DOCX extraction completed');
    return cleanedText;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
};

// Alternative: Apache Tika (requires separate Tika server running)
const extractTextWithTika = async (fileBuffer, mimeType) => {
  try {
    console.log('Extracting text with Apache Tika...');

    const response = await axios.put(
      `${process.env.TIKA_SERVER_URL}/tika`,
      fileBuffer,
      {
        headers: {
          'Content-Type': mimeType,
          'Accept': 'text/plain'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const cleanedText = response.data.trim().replace(/\s+/g, ' ');
    console.log('Tika extraction completed');
    return cleanedText;
  } catch (error) {
    console.error('Tika extraction error:', error);
    throw new Error('Failed to extract text with Tika');
  }
};

module.exports = {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextWithTika
};
