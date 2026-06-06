require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/utils/errorHandler');

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(morgan('dev'));

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'ERP API is running smoothly.' });
});

// API Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));
app.use('/api/suppliers', require('./src/routes/supplierRoutes'));
app.use('/api/purchases/orders', require('./src/routes/supplierOrderRoutes'));
app.use('/api/customers', require('./src/routes/customerRoutes'));
app.use('/api/sales', require('./src/routes/saleRoutes'));
app.use('/api/logs', require('./src/routes/activityRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/delivery-companies', require('./src/routes/deliveryCompanyRoutes'));
app.use('/api/categories', require('./src/routes/categoryRoutes'));
app.use('/api/ocr', require('./src/routes/ocrRoutes'));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
