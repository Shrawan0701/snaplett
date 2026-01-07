const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { searchFiles } = require('../controllers/searchController');
// Search files
router.post('/', authenticate, searchFiles);
module.exports = router;