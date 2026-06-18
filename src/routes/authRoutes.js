const express = require('express');
const router = express.Router();
const { loginUser, registerUser, getUserProfile, getUsers, updateUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/register', protect, authorize('Admin', 'Employee_RH'), registerUser);
router.get('/profile', protect, getUserProfile);
router.get('/users', protect, authorize('Admin', 'Employee_RH'), getUsers);
router.put('/users/:id', protect, authorize('Admin', 'Employee_RH'), updateUser);

module.exports = router;
