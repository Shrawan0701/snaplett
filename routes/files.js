const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');

const { authenticate, checkUploadLimit } = require('../middleware/auth');
const {
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

router.post('/share/:fileId', authenticate, shareFile);

router.get('/share/:token', getSharedFile);

router.post(
  '/password/:fileId',
  authenticate,
  setFilePassword
);

router.post(
  '/password/verify/:fileId',
  verifyFilePassword
);

router.post('/folders', authenticate, createFolder);




module.exports = router;
