const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/erp_db');
  const Supplier = require('d:/Stage/Antigravity/ERP-Platform/backend/src/models/Supplier');
  const Product = require('d:/Stage/Antigravity/ERP-Platform/backend/src/models/Product');
  
  const suppliers = await Supplier.find();
  console.log("Suppliers products:", suppliers.map(s => s.products));
  
  const targetSupplier = suppliers[0];
  if (targetSupplier) {
    try {
      targetSupplier.products = [...(targetSupplier.products || []), new mongoose.Types.ObjectId()];
      await targetSupplier.save();
      console.log("Saved successfully");
    } catch (e) {
      console.error("Save error:", e.message);
    }
  }

  process.exit(0);
}
test();
