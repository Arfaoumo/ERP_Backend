const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  type: { type: String, enum: ['IN', 'OUT'], required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceType: { type: String, enum: ['Sale', 'SupplierOrder'], default: null },
  sourceDocument: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

stockMovementSchema.index(
  { sourceType: 1, sourceDocument: 1, product: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceDocument: { $type: 'objectId' } }
  }
);

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
module.exports = StockMovement;
