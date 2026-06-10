const DeliveryCompany = require('../models/DeliveryCompany');

const getAvailableCouriers = async (req, res, next) => {
  try {
    const couriers = await DeliveryCompany.find({ isActive: true });
    res.json(couriers);
  } catch (error) {
    next(error);
  }
};

const getAllCouriers = async (req, res, next) => {
  try {
    const couriers = await DeliveryCompany.find({}).sort({ createdAt: -1 });
    res.json(couriers);
  } catch (error) {
    next(error);
  }
};

const createCourier = async (req, res, next) => {
  try {
    const { name, contactEmail } = req.body;
    const exists = await DeliveryCompany.findOne({ name: name ? name.toUpperCase() : '' });
    if (exists) {
      res.status(400);
      throw new Error('Delivery company already exists');
    }
    const courier = await DeliveryCompany.create({ name, contactEmail });
    res.status(201).json(courier);
  } catch (error) {
    next(error);
  }
};

const updateCourier = async (req, res, next) => {
  try {
    const { name, contactEmail, isActive } = req.body;
    const courier = await DeliveryCompany.findById(req.params.id);
    if (!courier) {
      res.status(404);
      throw new Error('Delivery company not found');
    }
    if (name) courier.name = name.toUpperCase();
    if (contactEmail) courier.contactEmail = contactEmail.toLowerCase();
    if (isActive !== undefined) courier.isActive = isActive;

        const updated = await courier.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const toggleCourierStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const courier = await DeliveryCompany.findById(req.params.id);
    if (!courier) {
      res.status(404);
      throw new Error('Delivery company not found');
    }
    if (isActive !== undefined) courier.isActive = isActive;
    const updated = await courier.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getAvailableCouriers, 
  getAllCouriers, 
  createCourier, 
  updateCourier, 
  toggleCourierStatus 
};
