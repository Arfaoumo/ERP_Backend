const mongoose = require('mongoose');
const { ApiError } = require('./apiError');

const isTransactionUnsupported = (error) => {
  const message = error?.message || '';
  return error?.code === 20
    || message.includes('Transaction numbers are only allowed on a replica set member or mongos')
    || message.includes('does not support retryable writes');
};

const runInTransaction = async (work) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      throw new ApiError(
        503,
        'This operation requires MongoDB transactions. Configure MongoDB as a replica set or sharded cluster.'
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = { runInTransaction };
