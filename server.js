require('dotenv').config();
const connectDB = require('./src/config/db');
const app = require('./app');
const { startScheduledJobs } = require('./src/jobs/scheduledJobs');

const PORT = process.env.PORT || 5000;

const start = async () => {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((name) => !process.env[name]);
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  if (missing.length) throw new Error(`Missing required environment variables: ${[...new Set(missing)].join(', ')}`);
  await connectDB();
  startScheduledJobs();
  return app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exit(1);
});
