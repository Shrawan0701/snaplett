const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const { detectFolder } = require('../services/folderDetector');


const cloudinary = require('../config/cloudinary');

const { extractTextFromImage } = require('../services/ocr');
const { extractTextFromPDF, extractTextFromDOCX } = require('../services/documentParser');
const { generateEmbedding } = require('../services/embedding');
const { extractKeywords } = require('../services/keywordExtractor');
const { getDownloadUrl } = require('../utils/cloudinaryDownload');


const { Readable } = require('stream');

/* ============================
   UPLOAD FILE
============================ */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const file = req.file;
    const fileType = file.mimetype;
    const isPDF = fileType === 'application/pdf';
    const isImage = fileType.startsWith('image/');


    console.log(`Processing file: ${file.originalname}, Type: ${fileType}`);

    let fileUrl = null;
    let cloudinaryPublicId = null;

    /* ---------- STORE FILE ---------- */
    if (isImage) {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'memvault/images',
            resource_type: 'image'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        // multer diskStorage → read from path
        fs.createReadStream(file.path).pipe(uploadStream);
      });

      fileUrl = cloudinaryResult.secure_url;
      cloudinaryPublicId = cloudinaryResult.public_id;
    } else {
      // PDFs / DOCX → already saved by multer
      fileUrl =`/uploads/pdfs/${file.filename}`;
      cloudinaryPublicId = null;
    }

    console.log('File stored successfully');

    /* ---------- Extract Text ---------- */
    let extractedText = '';

    if (isImage) {
      extractedText = await extractTextFromImage(
        fs.readFileSync(file.path)
      );
    } else if (fileType === 'application/pdf') {
      extractedText = await extractTextFromPDF(
        fs.readFileSync(file.path)
      );
    } else {
      extractedText = await extractTextFromDOCX(
        fs.readFileSync(file.path)
      );
    }

    if (!extractedText || extractedText.length < 10) {
      if (cloudinaryPublicId) {
        await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: 'image'
        });
      }

      return res.status(400).json({
        error: 'No text could be extracted from the file'
      });
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);

    /* ---------- Embedding ---------- */
    const embedding = await generateEmbedding(extractedText);

    /* ---------- Keywords ---------- */
    const keywords = extractKeywords(extractedText);

    let folder = 'general';

if (req.user.is_paid) {
  folder = detectFolder(extractedText, file.originalname);
}


    /* ---------- Save to Database ---------- */
    const result = await pool.query(
      `
      INSERT INTO files (
        user_id,
        file_url,
        cloudinary_public_id,
        file_type,
        file_name,
        extracted_text,
        embedding,
        folder
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, file_url, file_type, file_name, created_at
      `,
      [
        userId,
        fileUrl,
        cloudinaryPublicId,
        fileType,
        file.originalname,
        extractedText,
        embedding,
        folder
      ]
    );

    /* ---------- Update Free Upload Count ---------- */
    if (!req.user.is_paid) {
      await pool.query(
        'UPDATE users SET free_uploads_used = free_uploads_used + 1 WHERE id = $1',
        [userId]
      );
    }

    console.log('File saved to database successfully');

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        ...result.rows[0],
        keywords
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

/* ============================
   GET USER FILES
============================ */
const getUserFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, folder } = req.query;

    let query = `
      SELECT
        id,
        file_url,
        cloudinary_public_id,
        file_type,
        file_name,
        extracted_text,
        created_at
      FROM files
      WHERE user_id = $1
    `;

    const params = [userId];

    if (folder && folder !== 'all') {
      query += ` AND folder = $2`;
      params.push(folder);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const filesWithKeywords = result.rows.map(file => ({
      id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      created_at: file.created_at,
      file_url: file.file_url,
      keywords: extractKeywords(file.extracted_text || '')
    }));

    res.json({ files: filesWithKeywords });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
};


/* ============================
   DELETE FILE
============================ */
const deleteFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.params.id;

    const fileResult = await pool.query(
      `
      SELECT file_url, cloudinary_public_id, file_type
      FROM files
      WHERE id = $1 AND user_id = $2
      `,
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    if (file.file_type.startsWith('image/') && file.cloudinary_public_id) {
      await cloudinary.uploader.destroy(file.cloudinary_public_id, {
        resource_type: 'image'
      });
    }

    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};
const getUserFolders = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        f.folder_name,
        f.icon,
        COUNT(fi.id) AS file_count
       FROM folders f
       LEFT JOIN files fi 
         ON fi.folder = f.folder_name AND fi.user_id = f.user_id
       WHERE f.user_id = $1
       GROUP BY f.folder_name, f.icon
       ORDER BY f.folder_name`,
      [userId]
    );

    res.json({ folders: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
};

const updateFileFolder = async (req, res) => {
  try {
    if (!req.user.is_paid) {
      return res.status(403).json({ error: 'Premium feature' });
    }

    const userId = req.user.id;
    const fileId = req.params.id;
    const { folder } = req.body;

    const folderCheck = await pool.query(
      'SELECT 1 FROM folders WHERE user_id = $1 AND folder_name = $2',
      [userId, folder]
    );

    if (folderCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid folder' });
    }

    await pool.query(
      'UPDATE files SET folder = $1 WHERE id = $2 AND user_id = $3',
      [folder, fileId, userId]
    );

    res.json({ message: 'File moved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to move file' });
  }
};



module.exports = {
  uploadFile,
  getUserFiles,
  getUserFolders,
  updateFileFolder,
  deleteFile
};
