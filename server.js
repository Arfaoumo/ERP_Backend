require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/utils/errorHandler');

const i18n = require('i18next');
const middleware = require('i18next-http-middleware');

i18n.use(middleware.LanguageDetector).init({
  preload: ['en', 'fr'],
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'error.duplicateField': 'Duplicate field value entered. Please use a unique value.',
        'error.tokenFailed': 'Not authorized, token failed',
        'error.noToken': 'Not authorized, no token',
        'error.userNotFound': 'Not authorized, user not found',
        'error.unauthorized': 'User role is not authorized to access this route'
      }
    },
    fr: {
      translation: {
        'error.duplicateField': 'Valeur de champ en double saisie. Veuillez utiliser une valeur unique.',
        'error.tokenFailed': 'Non autorisé, échec du token',
        'error.noToken': 'Non autorisé, aucun token fourni',
        'error.userNotFound': 'Non autorisé, utilisateur non trouvé',
        'error.unauthorized': 'Le rôle de l\'utilisateur n\'est pas autorisé à accéder à cette route'
      }
    }
  }
});

const app = express();

connectDB();

app.use(middleware.handle(i18n));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'ERP API is running smoothly.' });
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

const cron = require('node-cron');
const { generateMonthlySummary } = require('./src/controllers/reportController');
const { processOverdueInvoices } = require('./src/services/overdueService');

cron.schedule('5 0 * * *', async () => {
  try {
    const result = await processOverdueInvoices();
    console.log(`Overdue invoice job completed: ${result.modifiedCount} invoice(s) updated.`);
  } catch (error) {
    console.error('Overdue invoice job failed:', error.message);
  }
});

cron.schedule('0 0 1 * *', async () => {
  console.log('Running automated monthly financial summary job...');
  const date = new Date();
  const targetMonth = date.getMonth() === 0 ? 11 : date.getMonth() - 1;
  const targetYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();

    await generateMonthlySummary({ body: { month: targetMonth, year: targetYear } });
  console.log('Automated monthly financial summary completed.');
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
