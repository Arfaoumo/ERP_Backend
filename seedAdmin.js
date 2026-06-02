require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@erp.com' });
    if (adminExists) {
      console.log('Admin user already exists.');
      process.exit();
    }

    // Create the first admin user
    await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@erp.com',
      password: 'password123', // Will be hashed by the Mongoose pre-save hook
      role: 'Admin'
    });

    console.log('Admin user seeded successfully. You can now login with: admin@erp.com / password123');
    process.exit();
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
