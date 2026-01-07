const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pdfDir = path.join(__dirname, '..', 'uploads', 'pdfs');

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

const storage = multer.diskStorage({
 destination: (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, pdfDir); // ✅ correct
  } else {
    cb(null, path.join(__dirname, '..', 'uploads'));
  }
},

  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});


const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  cb(null, allowed.includes(file.mimetype));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
