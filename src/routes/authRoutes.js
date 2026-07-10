const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getUserProfile, getUsers, updateUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { rateLimit } = require('express-rate-limit');
const { validate, validateObjectId } = require('../middleware/validationMiddleware');
const schemas = require('../validation/schemas');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    message: 'Too many login attempts. Please try again later.',
    errors: []
  })
});

router.post('/login', loginLimiter, validate(schemas.login), loginUser);
router.post('/register', protect, authorize('Admin', 'Employee_RH'), validate(schemas.userCreate), registerUser);
router.get('/profile', protect, getUserProfile);
router.get('/users', protect, authorize('Admin', 'Employee_RH'), getUsers);
router.put('/users/:id', protect, authorize('Admin', 'Employee_RH'), validateObjectId(), validate(schemas.userUpdate), updateUser);

module.exports = router;
