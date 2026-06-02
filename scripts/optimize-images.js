const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const optimize = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- Database Connected ---');

    // 1. Optimize Users
    const users = await User.find({ avatarUrl: { $regex: /\.(jpg|jpeg|png)$/i } });
    console.log(`Found ${users.length} legacy user avatars.`);
    
    for (let user of users) {
      const oldRelativePath = user.avatarUrl.startsWith('/') ? user.avatarUrl.substring(1) : user.avatarUrl;
      const oldPath = path.join(process.cwd(), oldRelativePath);
      
      if (fs.existsSync(oldPath)) {
        const newPath = oldPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        await sharp(oldPath)
          .resize(800, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(newPath);
          
        fs.unlinkSync(oldPath);
        user.avatarUrl = user.avatarUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        await user.save();
        console.log(`✅ Optimized & Updated User: ${user.email}`);
      } else {
        console.log(`⚠️  File not found for user ${user.email}: ${oldPath}`);
      }
    }

    // 2. Optimize Products
    const products = await Product.find({ imageUrl: { $regex: /\.(jpg|jpeg|png)$/i } });
    console.log(`Found ${products.length} legacy product images.`);
    
    for (let product of products) {
      const oldRelativePath = product.imageUrl.startsWith('/') ? product.imageUrl.substring(1) : product.imageUrl;
      const oldPath = path.join(process.cwd(), oldRelativePath);
      
      if (fs.existsSync(oldPath)) {
        const newPath = oldPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        await sharp(oldPath)
          .resize(800, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(newPath);
          
        fs.unlinkSync(oldPath);
        product.imageUrl = product.imageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        await product.save();
        console.log(`✅ Optimized & Updated Product: ${product.name}`);
      } else {
        console.log(`⚠️  File not found for product ${product.name}: ${oldPath}`);
      }
    }

    console.log('--- Optimization Success! ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Optimization Failed ---');
    console.error(error);
    process.exit(1);
  }
};

optimize();
