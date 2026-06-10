const Customer = require('../models/Customer');
const { createLog } = require('./activityController');

const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({});
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const { name, contactName, email, phone, address, cin, shippingAddress } = req.body;
    const customerExists = await Customer.findOne({ email });

    if (customerExists) {
      res.status(400);
      throw new Error('Customer with this email already exists');
    }

    const customer = await Customer.create({
      name, contactName, email, phone, address, cin, shippingAddress
    });

    await createLog(req.user._id, 'CREATE', 'Customer', customer.name, 'New customer onboarded');
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (customer) {
      customer.name = req.body.name || customer.name;
      customer.contactName = req.body.contactName || customer.contactName;
      customer.email = req.body.email || customer.email;
      customer.phone = req.body.phone || customer.phone;
      customer.address = req.body.address || customer.address;
      customer.cin = req.body.cin || customer.cin;
      customer.shippingAddress = req.body.shippingAddress || customer.shippingAddress;
      if (req.body.isActive !== undefined) customer.isActive = req.body.isActive;

      const updatedCustomer = await customer.save();
      await createLog(req.user._id, 'UPDATE', 'Customer', updatedCustomer.name, 'Customer profile updated');
      res.json(updatedCustomer);
    } else {
      res.status(404);
      throw new Error('Customer not found');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { getCustomers, createCustomer, updateCustomer };
