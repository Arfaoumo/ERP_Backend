const cron = require('node-cron');
const { generateMonthlySummary } = require('../controllers/reportController');
const { processOverdueInvoices } = require('../services/overdueService');

const startScheduledJobs = () => {
  cron.schedule('5 0 * * *', async () => {
    try {
      const result = await processOverdueInvoices();
      console.log(`Overdue invoice job completed: ${result.modifiedCount} invoice(s) updated.`);
    } catch (error) {
      console.error('Overdue invoice job failed:', error.message);
    }
  });

  cron.schedule('0 0 1 * *', async () => {
    try {
      const date = new Date();
      const targetMonth = date.getMonth() === 0 ? 11 : date.getMonth() - 1;
      const targetYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear();
      await generateMonthlySummary({ body: { month: targetMonth, year: targetYear } });
      console.log('Automated monthly financial summary completed.');
    } catch (error) {
      console.error('Monthly financial summary job failed:', error.message);
    }
  });
};

module.exports = { startScheduledJobs };
