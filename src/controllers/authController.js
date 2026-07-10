const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { createLog } = require('./activityController');
const { ApiError } = require('../utils/apiError');
const { deleteLocalUpload } = require('../utils/files');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (user && (await user.matchPassword(password))) {
      await createLog(user._id, 'LOGIN', 'User', `${user.firstName} ${user.lastName}`, 'User successfully logged into the system');
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

const registerUser = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, avatarUrl, isActive } = req.body;
    if (req.user.role !== 'Admin' && role === 'Admin') {
      throw new ApiError(403, 'Only an Admin can assign the Admin role.');
    }
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({ firstName, lastName, email, password, role, avatarUrl, isActive });

    if (user) {
      await createLog(req.user._id, 'CREATE', 'User', `${user.firstName} ${user.lastName}`, `Registered as ${user.role}`);
      res.status(201).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      let oldAvatarUrl = null;
      if (req.user.role !== 'Admin' && user.role === 'Admin') {
        throw new ApiError(403, 'Only an Admin can modify an Admin account.');
      }
      if (req.user.role !== 'Admin' && req.body.role === 'Admin') {
        throw new ApiError(403, 'Only an Admin can assign the Admin role.');
      }
      user.firstName = req.body.firstName || user.firstName;
      user.lastName = req.body.lastName || user.lastName;
      user.email = req.body.email || user.email;
      user.role = req.body.role || user.role;
      if (req.body.isActive !== undefined) user.isActive = req.body.isActive;

      if (req.body.avatarUrl !== undefined && req.body.avatarUrl !== user.avatarUrl) {
        oldAvatarUrl = user.avatarUrl;
        user.avatarUrl = req.body.avatarUrl;
      }

            if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      await deleteLocalUpload(oldAvatarUrl);

      await createLog(req.user._id, 'UPDATE', 'User', `${updatedUser.firstName} ${updatedUser.lastName}`, 'User profile/permissions updated');

      res.json({
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        isActive: updatedUser.isActive
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { loginUser, registerUser, getUserProfile, getUsers, updateUser };
