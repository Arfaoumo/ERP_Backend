const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId.');
const nonEmpty = z.string().trim().min(1);
const email = z.string().trim().email().transform((value) => value.toLowerCase());
const money = z.coerce.number().finite().min(0);
const positiveNumber = z.coerce.number().finite().positive();
const roles = ['Admin', 'Employee_Commercial', 'Employee_Stocks', 'Employee_Achats', 'Employee_Finance', 'Employee_RH'];

const login = z.object({ email, password: z.string().min(1) }).strict();
const userCreate = z.object({
  firstName: nonEmpty.max(100),
  lastName: nonEmpty.max(100),
  email,
  password: z.string().min(8).max(128),
  role: z.enum(roles),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().optional()
}).strict();
const userUpdate = userCreate.omit({ password: true }).partial().extend({
  password: z.string().min(8).max(128).optional()
}).strict();

const productCreate = z.object({
  name: nonEmpty.max(200),
  sku: nonEmpty.max(100),
  category: objectId,
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  sellingPrice: money,
  buyingPrice: money,
  minStockThreshold: z.coerce.number().finite().min(0).optional(),
  imageUrl: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().optional()
}).strict();
const productUpdate = productCreate.partial().strict();
const stockAdjustment = z.object({
  type: z.enum(['IN', 'OUT']),
  quantity: positiveNumber,
  reason: nonEmpty.max(500)
}).strict();

const categoryCreate = z.object({
  name: nonEmpty.max(100),
  taxRate: z.coerce.number().finite().min(0).max(1),
  description: z.string().trim().max(1000).optional().or(z.literal(''))
}).strict();
const categoryUpdate = categoryCreate.partial().strict();

const customerCreate = z.object({
  name: nonEmpty.max(200), contactName: z.string().trim().max(200).optional().or(z.literal('')),
  email, phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal('')),
  cin: z.string().trim().max(100).optional().or(z.literal('')),
  shippingAddress: z.string().trim().max(1000).optional().or(z.literal('')),
  isActive: z.boolean().optional()
}).strict();
const customerUpdate = customerCreate.partial().strict();

const supplierCreate = z.object({
  name: nonEmpty.max(200), contactName: z.string().trim().max(200).optional().or(z.literal('')),
  email, phone: z.string().trim().max(50).optional().or(z.literal('')),
  address: z.string().trim().max(1000).optional().or(z.literal('')),
  vatNumber: z.string().trim().max(100).optional().or(z.literal('')),
  products: z.array(objectId).default([]),
  isActive: z.boolean().optional()
}).strict();
const supplierUpdate = supplierCreate.partial().strict();

const purchaseCreate = z.object({
  supplier: objectId,
  documentNumber: nonEmpty.max(100),
  documentType: z.enum(['Request', 'Order']).default('Order'),
  parentDocument: objectId.nullish(),
  products: z.array(z.object({
    product: objectId,
    quantity: positiveNumber,
    buyingPrice: money.optional()
  }).strict()).min(1),
  totalAmount: money.optional()
}).strict();
const purchaseStatus = z.object({ status: z.enum(['Received', 'Cancelled']) }).strict();

const saleCreate = z.object({
  customer: objectId,
  documentNumber: nonEmpty.max(100),
  documentType: z.literal('Quote').default('Quote'),
  parentDocument: z.null().optional(),
  courier: z.string().trim().max(200).default('NONE'),
  items: z.array(z.object({
    product: objectId,
    quantity: positiveNumber,
    sellingPrice: money.optional(),
    subtotal: money.optional()
  }).strict()).min(1),
  totalAmount: money.optional(),
  taxAmount: money.optional(),
  totalWithTax: money.optional()
}).strict();
const payment = z.object({
  amount: positiveNumber,
  paymentMethod: z.enum(['Cash', 'Check'])
}).strict();
const saleStatus = z.object({ status: nonEmpty.max(50) }).strict();

const courierCreate = z.object({
  name: nonEmpty.max(200),
  contactEmail: email.optional().or(z.literal('')),
  isActive: z.boolean().optional()
}).strict();
const courierUpdate = courierCreate.partial().extend({ isActive: z.boolean().optional() }).strict();
const courierToggle = z.object({ isActive: z.boolean() }).strict();

module.exports = {
  login, userCreate, userUpdate,
  productCreate, productUpdate, stockAdjustment,
  categoryCreate, categoryUpdate,
  customerCreate, customerUpdate,
  supplierCreate, supplierUpdate,
  purchaseCreate, purchaseStatus,
  saleCreate, payment, saleStatus,
  courierCreate, courierUpdate, courierToggle
};
