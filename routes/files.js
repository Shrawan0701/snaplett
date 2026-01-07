const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');

const { authenticate, checkUploadLimit } = require('../middleware/auth');
const {
  uploadFile,
  getUserFiles,
  getUserFolders,
  updateFileFolder,
  deleteFile
} = require('../controllers/fileController');

// Serve PDFs statically



// Upload file
router.post(
  '/upload',
  authenticate,
  checkUploadLimit,
  upload.single('file'),
  uploadFile
);


// Get user files
router.get('/', authenticate, getUserFiles);

router.get('/folders', authenticate, getUserFolders);

// Update file folder
router.put('/:id/folder', authenticate, updateFileFolder);

// Delete file
router.delete('/:id', authenticate, deleteFile);

module.exports = router;
