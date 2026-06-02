const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/erp_db', { useNewUrlParser: true, useUnifiedTopology: true });
  const User = require('d:/Stage/Antigravity/ERP-Platform/backend/src/models/User');
  const user = await User.findOne({ role: 'Admin' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '30d' });

  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    const suppRes = await fetch('http://localhost:5000/api/suppliers', { headers });
    const suppliers = await suppRes.json();
    const supplier = suppliers[0];
    
    console.log("Updating supplier: ", supplier._id);
    const updateRes = await fetch(`http://localhost:5000/api/suppliers/${supplier._id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        products: [...(supplier.products || []), new mongoose.Types.ObjectId().toString()]
      })
    });
    const result = await updateRes.json();
    if (updateRes.ok) {
      console.log("Update success!");
    } else {
      console.error("Update failed: ", updateRes.status, result);
    }
  } catch (error) {
    console.error("Update error: ", error);
  }
  mongoose.connection.close();
}
test();
