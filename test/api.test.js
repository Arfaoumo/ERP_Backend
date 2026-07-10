const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const app = require('../app');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Customer = require('../src/models/Customer');
const Supplier = require('../src/models/Supplier');
const Sale = require('../src/models/Sale');
const StockMovement = require('../src/models/StockMovement');

let replSet;
let category;
let product;
let customer;
let supplier;
const tokens = {};

const login = async (email, password = 'Password123!') => {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.token;
};

const createQuote = (documentNumber, quantity = 2) => request(app)
  .post('/api/sales')
  .set('Authorization', `Bearer ${tokens.commercial}`)
  .send({
    customer: customer._id.toString(),
    documentNumber,
    documentType: 'Quote',
    courier: 'NONE',
    items: [{
      product: product._id.toString(),
      quantity,
      sellingPrice: 0.01,
      subtotal: 0.01
    }],
    totalAmount: 0.01,
    taxAmount: 0,
    totalWithTax: 0.01
  });

const convert = (id) => request(app)
  .post(`/api/sales/${id}/convert`)
  .set('Authorization', `Bearer ${tokens.commercial}`)
  .send({});

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());

  await Promise.all([
    User.syncIndexes(), Category.syncIndexes(), Product.syncIndexes(), Customer.syncIndexes(),
    Supplier.syncIndexes(), Sale.syncIndexes(), StockMovement.syncIndexes()
  ]);

  await User.create([
    { firstName: 'Ada', lastName: 'Admin', email: 'admin@example.com', password: 'Password123!', role: 'Admin' },
    { firstName: 'Casey', lastName: 'Commercial', email: 'sales@example.com', password: 'Password123!', role: 'Employee_Commercial' },
    { firstName: 'Sam', lastName: 'Stock', email: 'stock@example.com', password: 'Password123!', role: 'Employee_Stocks' },
    { firstName: 'Pat', lastName: 'Purchase', email: 'purchase@example.com', password: 'Password123!', role: 'Employee_Achats' },
    { firstName: 'Riley', lastName: 'HR', email: 'hr@example.com', password: 'Password123!', role: 'Employee_RH' }
  ]);

  tokens.admin = await login('admin@example.com');
  tokens.commercial = await login('sales@example.com');
  tokens.stock = await login('stock@example.com');
  tokens.purchase = await login('purchase@example.com');
  tokens.hr = await login('hr@example.com');

  category = await Category.create({ name: 'Hardware', taxRate: 0.19 });
  product = await Product.create({
    name: 'Managed Switch', sku: 'SW-TEST', category: category._id,
    sellingPrice: 25, buyingPrice: 10, currentStock: 10, minStockThreshold: 1
  });
  customer = await Customer.create({ name: 'Test Customer', email: 'customer@example.com' });
  supplier = await Supplier.create({
    name: 'Test Supplier', email: 'supplier@example.com', products: [product._id]
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (replSet) await replSet.stop();
});

describe('authentication and authorization', () => {
  test('login succeeds with valid credentials and never returns a password', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com', password: 'Password123!'
    });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.password).toBeUndefined();
  });

  test('login fails with invalid credentials using the API error shape', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com', password: 'wrong'
    });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: 'Invalid email or password', errors: [] });
  });

  test('protected routes reject missing tokens and unauthorized roles', async () => {
    const noToken = await request(app).get('/api/sales');
    expect(noToken.status).toBe(401);
    expect(noToken.body.success).toBe(false);

    const wrongRole = await request(app).get('/api/sales')
      .set('Authorization', `Bearer ${tokens.stock}`);
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.body.errors).toEqual([]);
  });

  test('HR cannot grant the Admin role', async () => {
    const response = await request(app).post('/api/auth/register')
      .set('Authorization', `Bearer ${tokens.hr}`)
      .send({
        firstName: 'Eve', lastName: 'Escalation', email: 'eve@example.com',
        password: 'Password123!', role: 'Admin'
      });
    expect(response.status).toBe(403);
    expect(await User.exists({ email: 'eve@example.com' })).toBeNull();
  });

  test('disabled users cannot continue using an existing token', async () => {
    const user = await User.findOne({ email: 'stock@example.com' });
    user.isActive = false;
    await user.save();
    const response = await request(app).get('/api/products')
      .set('Authorization', `Bearer ${tokens.stock}`);
    expect(response.status).toBe(401);
    user.isActive = true;
    await user.save();
  });
});

describe('sales lifecycle and stock integrity', () => {
  let quote;
  let order;
  let delivery;
  let invoice;

  test('sale creation trusts database prices, not client prices', async () => {
    const response = await createQuote('QT-100001');
    expect(response.status).toBe(201);
    expect(response.body.items[0].sellingPrice).toBe(25);
    expect(response.body.totalAmount).toBe(50);
    expect(response.body.taxAmount).toBe(9.5);
    expect(response.body.totalWithTax).toBe(59.5);
    quote = response.body;
  });

  test('Quote -> Order does not change stock', async () => {
    const response = await convert(quote._id);
    expect(response.status).toBe(201);
    expect(response.body.documentType).toBe('Order');
    order = response.body;
    expect((await Product.findById(product._id)).currentStock).toBe(10);
  });

  test('Order -> Delivery Note deducts stock and creates one movement exactly once', async () => {
    const first = await convert(order._id);
    expect(first.status).toBe(201);
    expect(first.body.documentType).toBe('DeliveryNote');
    delivery = first.body;
    expect((await Product.findById(product._id)).currentStock).toBe(8);
    expect(await StockMovement.countDocuments({ sourceType: 'Sale', sourceDocument: order._id })).toBe(1);

    const repeated = await convert(order._id);
    expect(repeated.status).toBe(200);
    expect(repeated.body._id).toBe(delivery._id);
    expect((await Product.findById(product._id)).currentStock).toBe(8);
    expect(await StockMovement.countDocuments({ sourceType: 'Sale', sourceDocument: order._id })).toBe(1);
  });

  test('legacy Shipped requests cannot deduct stock after conversion', async () => {
    const response = await request(app).put(`/api/sales/${order._id}/status`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ status: 'Shipped' });
    expect(response.status).toBe(409);
    expect((await Product.findById(product._id)).currentStock).toBe(8);
  });

  test('Delivery Note -> Invoice preserves coherent statuses', async () => {
    const response = await convert(delivery._id);
    expect(response.status).toBe(201);
    expect(response.body.documentType).toBe('Invoice');
    expect(response.body.status).toBe('Pending');
    invoice = response.body;
    expect((await Sale.findById(delivery._id)).status).toBe('Delivered');
  });

  test('insufficient stock rejects conversion without partial writes', async () => {
    const quoteResponse = await createQuote('QT-100002', 100);
    const orderResponse = await convert(quoteResponse.body._id);
    const before = (await Product.findById(product._id)).currentStock;
    const response = await convert(orderResponse.body._id);
    expect(response.status).toBe(409);
    expect((await Product.findById(product._id)).currentStock).toBe(before);
    expect(await StockMovement.countDocuments({ sourceType: 'Sale', sourceDocument: orderResponse.body._id })).toBe(0);
  });

  test('payment validation rejects non-invoices, invalid methods, and overpayment', async () => {
    const nonInvoice = await request(app).put(`/api/sales/${quote._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 1, paymentMethod: 'Cash' });
    expect(nonInvoice.status).toBe(400);

    const invalidMethod = await request(app).put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 1, paymentMethod: 'Card' });
    expect(invalidMethod.status).toBe(400);

    const overpayment = await request(app).put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 60, paymentMethod: 'Cash' });
    expect(overpayment.status).toBe(409);
  });

  test('concurrent payments cannot overpay an invoice', async () => {
    const first = await request(app).put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 10, paymentMethod: 'Cash' });
    expect(first.status).toBe(200);
    expect(first.body.remainingBalance).toBe(49.5);

    const responses = await Promise.all([30, 30].map((amount) => request(app)
      .put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount, paymentMethod: 'Check' })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const current = await Sale.findById(invoice._id);
    expect(current.amountPaid).toBe(40);
    expect(current.remainingBalance).toBe(19.5);

    const finalPayment = await request(app).put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 19.5, paymentMethod: 'Cash' });
    expect(finalPayment.body).toMatchObject({ amountPaid: 59.5, remainingBalance: 0, paymentStatus: 'Paid', status: 'Finalized' });

    const extra = await request(app).put(`/api/sales/${invoice._id}/payment`)
      .set('Authorization', `Bearer ${tokens.commercial}`)
      .send({ amount: 1, paymentMethod: 'Cash' });
    expect(extra.status).toBe(409);
  });
});

describe('purchase receiving and API errors', () => {
  test('purchase receiving uses database prices and is idempotent', async () => {
    const created = await request(app).post('/api/purchases/orders')
      .set('Authorization', `Bearer ${tokens.purchase}`)
      .send({
        supplier: supplier._id.toString(), documentNumber: 'PO-100001', documentType: 'Order',
        products: [{ product: product._id.toString(), quantity: 3, buyingPrice: 0.01 }], totalAmount: 0.03
      });
    expect(created.status).toBe(201);
    expect(created.body.products[0].buyingPrice).toBe(10);
    expect(created.body.totalAmount).toBe(30);

    const before = (await Product.findById(product._id)).currentStock;
    const first = await request(app).put(`/api/purchases/orders/${created.body._id}/status`)
      .set('Authorization', `Bearer ${tokens.purchase}`).send({ status: 'Received' });
    const repeated = await request(app).put(`/api/purchases/orders/${created.body._id}/status`)
      .set('Authorization', `Bearer ${tokens.purchase}`).send({ status: 'Received' });
    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect((await Product.findById(product._id)).currentStock).toBe(before + 3);
    expect(await StockMovement.countDocuments({ sourceType: 'SupplierOrder', sourceDocument: created.body._id })).toBe(1);
  });

  test('malformed identifiers and unknown routes use the consistent error shape', async () => {
    const invalidId = await request(app).get('/api/sales/not-an-id')
      .set('Authorization', `Bearer ${tokens.commercial}`);
    expect(invalidId.status).toBe(400);
    expect(invalidId.body).toEqual(expect.objectContaining({ success: false, errors: expect.any(Array) }));

    const missing = await request(app).get('/api/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      message: 'Route not found: GET /api/does-not-exist',
      errors: []
    });
  });
});
