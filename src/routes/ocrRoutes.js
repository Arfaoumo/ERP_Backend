const express = require('express');
const multer = require('multer');
const router = express.Router();
const { extractInvoice, resolveItems } = require('../controllers/ocrController');
const { protect, authorize } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } 
});

router.post(
  '/invoice/extract',
  protect,
  authorize('Admin', 'Employee_Achats'),
  upload.single('file'),
  extractInvoice
);

router.post(
  '/invoice/resolve',
  protect,
  authorize('Admin', 'Employee_Achats'),
  resolveItems
);

module.exports = router;
