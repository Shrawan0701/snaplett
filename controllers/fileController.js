const pool = require('../config/database');
const fs = require('fs');
const path = require('path');
const { detectFolder } = require('../services/folderDetector');
const crypto = require('crypto');
const bcrypt = require('bcrypt');



const cloudinary = require('../config/cloudinary');

const { extractTextFromImage } = require('../services/ocr');
const { extractTextFromPDF, extractTextFromDOCX } = require('../services/documentParser');
const { generateEmbedding } = require('../services/embedding');
const { extractKeywords } = require('../services/keywordExtractor');
const { getDownloadUrl } = require('../utils/cloudinaryDownload');


const { Readable } = require('stream');
const { create } = require('domain');

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

    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';
    const isDocx =
      fileType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    let fileUrl = null;
    let cloudinaryPublicId = null;

    // 🔹 UPLOAD TO CLOUDINARY (CORRECT WAY)
    // ... inside uploadFile function

// 1. Define the resource type logic
// PDFs must be 'auto' or 'image' to be viewable. Only use 'raw' for DOCX/other non-viewables.
const resourceType = isImage || isPDF ? 'auto' : 'raw'; 

const uploadResult = await new Promise((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: isImage ? 'snaplet/images' : 'snaplet/docs',
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true
      // 🟢 flags line removed completely
    },
    (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }
  );
  fs.createReadStream(file.path).pipe(uploadStream);
});

fileUrl = uploadResult.secure_url;

    cloudinaryPublicId = uploadResult.public_id;

    // 🧹 delete temp file AFTER upload
    fs.unlinkSync(file.path);

    /* ---------- TEXT EXTRACTION ---------- */
    let extractedText = '';

    if (isImage) {
      extractedText = await extractTextFromImage(
        fs.readFileSync(file.path)
      );
    } else if (isPDF) {
      extractedText = await extractTextFromPDF(
        await fetch(fileUrl).then(r => r.arrayBuffer())
      );
    } else if (isDocx) {
      extractedText = await extractTextFromDOCX(
        await fetch(fileUrl).then(r => r.arrayBuffer())
      );
    }

    if (!extractedText || extractedText.length < 10) {
      return res.status(400).json({ error: 'No text extracted' });
    }

    const embedding = await generateEmbedding(extractedText);
    const keywords = extractKeywords(extractedText);

    let folder = 'general';
    if (req.user.is_paid) {
      folder = detectFolder(extractedText, file.originalname);
    }

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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
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
        folder,
      ]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      file: { ...result.rows[0], keywords },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
  const userId = req.user.id;
  const fileId = req.params.id;

  const result = await pool.query(
    'SELECT cloudinary_public_id, file_type FROM files WHERE id=$1 AND user_id=$2',
    [fileId, userId]
  );

  if (!result.rowCount) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = result.rows[0];

 await cloudinary.uploader.destroy(file.cloudinary_public_id, {
  resource_type: file.file_type.startsWith('image/')
    ? 'image'
    : 'raw',
});


  await pool.query('DELETE FROM files WHERE id=$1', [fileId]);

  res.json({ message: 'File deleted successfully' });
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

const shareFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const token = crypto.randomBytes(16).toString('hex');

    const result = await pool.query(
      `
      UPDATE files
      SET is_shared = true,
          share_token = $1
      WHERE id = $2 AND user_id = $3
      RETURNING share_token
      `,
      [token, fileId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      shareUrl: `${process.env.FRONTEND_URL}/share/${token}`
    });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
};


const getSharedFile = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `
      SELECT file_url, file_type, file_name
      FROM files
      WHERE share_token = $1 AND is_shared = true
      `,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shared file' });
  }
};

const setFilePassword = async (req, res) => {
  try {
    if (!req.user.is_paid) {
      return res.status(403).json({ error: 'Premium feature' });
    }

    const { fileId } = req.params;
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      // remove password
      await pool.query(
        `UPDATE files
         SET file_password_hash = NULL, is_locked = false
         WHERE id = $1 AND user_id = $2`,
        [fileId, userId]
      );

      return res.json({ message: 'Password removed' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE files
       SET file_password_hash = $1, is_locked = true
       WHERE id = $2 AND user_id = $3`,
      [hash, fileId, userId]
    );

    res.json({ message: 'Password set successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set password' });
  }
};

const verifyFilePassword = async (req, res) => {
  const { fileId } = req.params;
  const { password } = req.body;

  const result = await pool.query(
    `SELECT file_password_hash, file_url
     FROM files WHERE id = $1`,
    [fileId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = result.rows[0];

  const isValid = await bcrypt.compare(
    password,
    file.file_password_hash
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ fileUrl: file.file_url });
};

const createFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { folder_name } = req.body;

    if (!folder_name || folder_name.trim() === '') {
      return res.status(400).json({
        error: 'Folder name is required'
      });
    }

    const normalizedName = folder_name.trim().toLowerCase();

    // check duplicate folder for this user
    const existing = await pool.query(
      `SELECT id FROM folders
       WHERE user_id = $1 AND folder_name = $2`,
      [userId, normalizedName]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: 'Folder already exists'
      });
    }

    const result = await pool.query(
      `INSERT INTO folders (user_id, folder_name)
       VALUES ($1, $2)
       RETURNING id, folder_name`,
      [userId, normalizedName]
    );

    res.status(201).json({
      folder: result.rows[0]
    });
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({
      error: 'Failed to create folder'
    });
  }
};




module.exports = {
  uploadFile,
  getUserFiles,
  getUserFolders,
  updateFileFolder,
  deleteFile,
  shareFile,
  getSharedFile,
  setFilePassword,
  verifyFilePassword,
  createFolder,
  
};
