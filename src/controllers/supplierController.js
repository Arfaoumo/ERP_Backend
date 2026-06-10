const Supplier = require('../models/Supplier');
const { createLog } = require('./activityController');

const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({});
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const { name, contactName, email, phone, address, vatNumber, products } = req.body;
    const supplierExists = await Supplier.findOne({ email });

    if (supplierExists) {
      res.status(400);
      throw new Error('Supplier with this email already exists');
    }

    const supplier = await Supplier.create({
      name, contactName, email, phone, address, vatNumber, products
    });

    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);

    if (supplier) {
      supplier.name = req.body.name || supplier.name;
      supplier.contactName = req.body.contactName || supplier.contactName;
      supplier.email = req.body.email || supplier.email;
      supplier.phone = req.body.phone || supplier.phone;
      supplier.address = req.body.address || supplier.address;
      supplier.vatNumber = req.body.vatNumber || supplier.vatNumber;
      if (req.body.products) supplier.products = req.body.products;
      if (req.body.isActive !== undefined) supplier.isActive = req.body.isActive;

      const updatedSupplier = await supplier.save();
      await createLog(req.user._id, 'UPDATE', 'Supplier', updatedSupplier.name, 'Supplier details updated');
      res.json(updatedSupplier);
    } else {
      res.status(404);
      throw new Error('Supplier not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getSuppliers, createSupplier, updateSupplier };
