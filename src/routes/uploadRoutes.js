const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { protect } = require('../middleware/authMiddleware');
const { ApiError } = require('../utils/apiError');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');
const allowedRoles = {
  users: ['Admin', 'Employee_RH'],
  products: ['Admin', 'Employee_Stocks', 'Employee_Achats']
};
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const authorizeUpload = (req, res, next) => {
  const roles = allowedRoles[req.params.type];
  if (!roles) return next(new ApiError(400, 'Unsupported upload type.'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'User role is not authorized for this upload type.'));
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      return callback(new ApiError(400, 'Only JPG, PNG, and WEBP images are allowed.'));
    }
    callback(null, true);
  }
});

router.post('/:type', protect, authorizeUpload, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, 'No image was uploaded.');

    const targetDir = path.join(uploadDir, req.params.type);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const filename = `${crypto.randomUUID()}.webp`;
    const fullPath = path.join(targetDir, filename);

    await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(fullPath);

    res.status(201).send(`/uploads/${req.params.type}/${filename}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
