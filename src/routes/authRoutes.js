const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getUserProfile, getUsers, updateUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/register', protect, authorize('Admin'), registerUser);
router.get('/profile', protect, getUserProfile);
router.get('/users', protect, authorize('Admin'), getUsers);
router.put('/users/:id', protect, authorize('Admin'), updateUser);

module.exports = router;
