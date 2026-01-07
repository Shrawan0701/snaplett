const cloudinary = require('../config/cloudinary');

const getDownloadUrl = (publicId, filename = 'document.pdf') => {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    flags: `attachment:${filename}`, // 👈 IMPORTANT
    secure: true
  });
};

module.exports = { getDownloadUrl };
