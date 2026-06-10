const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const uploadDir = path.join(process.cwd(), 'uploads');
const usersDir = path.join(uploadDir, 'users');
const productsDir = path.join(uploadDir, 'products');

if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true });
if (!fs.existsSync(productsDir)) fs.mkdirSync(productsDir, { recursive: true });

const storage = multer.memoryStorage();

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb('Images only!');
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

router.post('/:type', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const type = req.params.type;
    const allowedTypes = ['users', 'products'];
    const targetType = allowedTypes.includes(type) ? type : 'others';

    const othersDir = path.join(uploadDir, 'others');
    if (!fs.existsSync(othersDir)) fs.mkdirSync(othersDir, { recursive: true });

    const filename = `${req.file.fieldname}-${Date.now()}.webp`;
    const filepath = path.join('uploads', targetType, filename);
    const fullPath = path.join(process.cwd(), filepath);

    await sharp(req.file.buffer)
      .resize(800) 
      .webp({ quality: 80 }) 
      .toFile(fullPath);

    res.send(`/${filepath.replace(/\\/g, '/')}`);
  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).send('Error processing image');
  }
});

module.exports = router;
