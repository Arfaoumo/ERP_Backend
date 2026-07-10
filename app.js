const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const i18n = require('i18next');
const i18nMiddleware = require('i18next-http-middleware');
const { ApiError } = require('./src/utils/apiError');
const { errorHandler } = require('./src/utils/errorHandler');

i18n.use(i18nMiddleware.LanguageDetector).init({
  preload: ['en', 'fr'],
  fallbackLng: 'en',
  resources: {
    en: { translation: {} },
    fr: { translation: {} }
  }
});

const parseAllowedOrigins = () => {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return new Set(configured);
};

const app = express();
const allowedOrigins = parseAllowedOrigins();

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(i18nMiddleware.handle(i18n));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new ApiError(403, 'Origin is not allowed by CORS.'));
  },
  optionsSuccessStatus: 204
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.FORM_BODY_LIMIT || '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ERP API is running.' });
});

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
app.use('/api/alerts', require('./src/routes/alertRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { fallthrough: false, maxAge: '1d' }));
app.use((req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
