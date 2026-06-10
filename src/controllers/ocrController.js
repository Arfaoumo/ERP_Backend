const OpenAI = require('openai');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { createLog } = require('./activityController');

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('OPENAI_API_KEY is not configured on the server');
    err.statusCode = 500;
    throw err;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EXTRACTION_PROMPT = `You are an OCR assistant specialized in supplier invoices and purchase orders.
Extract the line items from the document.
Respond ONLY with strict JSON of the form:
{
  "documentNumber": string | null,
  "supplierName": string | null,
  "totalAmount": number | null,
  "items": [
    {
      "name": string,
      "sku": string | null,
      "description": string | null,
      "quantity": number,
      "unitPrice": number
    }
  ]
}

Rules:
- "unitPrice" is the unit BUYING price excluding tax in the invoice currency.
- "quantity" must be a positive number, integer when possible.
- If a line shows a discounted price, return the final discounted unit price.
- "sku" is the supplier reference / barcode / product code. Return null if not present — do NOT invent one.
- Skip non-product rows such as subtotals, tax lines, shipping, rounding, or commentary lines.
- Trim whitespace and remove currency symbols from numeric fields.`;

const extractInvoice = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(req.file.mimetype)) {
      res.status(400);
      throw new Error('Only JPG, PNG, WEBP images or PDF files are allowed');
    }

    const client = getClient();
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const contentPart = req.file.mimetype === 'application/pdf'
      ? { type: 'file', file: { filename: req.file.originalname || 'invoice.pdf', file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl } };

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_OCR_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an invoice OCR assistant. Always reply with strict JSON only — no markdown fencing, no commentary.' },
        { role: 'user', content: [{ type: 'text', text: EXTRACTION_PROMPT }, contentPart] }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      res.status(502);
      throw new Error('OCR provider returned non-JSON output');
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    const skus = [...new Set(rawItems.map(i => (i.sku || '').trim()).filter(Boolean))];
    const names = [...new Set(rawItems.map(i => (i.name || '').trim()).filter(Boolean))];

    const orClauses = [];
    if (skus.length > 0) {
      orClauses.push({ sku: { $in: skus.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i')) } });
    }
    if (names.length > 0) {
      orClauses.push({ name: { $in: names.map(n => new RegExp(`^${escapeRegex(n)}$`, 'i')) } });
    }

    const candidates = orClauses.length > 0
      ? await Product.find({ $or: orClauses }).populate('category', 'name')
      : [];

    const itemsWithMatches = rawItems.map((it) => {
      const sku = (it.sku || '').trim();
      const name = (it.name || '').trim();

      let match = null;
      if (sku) {
        match = candidates.find(p => p.sku && p.sku.toLowerCase() === sku.toLowerCase());
      }
      if (!match && name) {
        match = candidates.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
      }

      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);

      return {
        name,
        sku: sku || null,
        description: it.description || null,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        buyingPrice: Number.isFinite(price) && price >= 0 ? price : 0,
        matchedProductId: match ? match._id : null,
        matchedProductName: match ? match.name : null,
        matchedProductSku: match ? match.sku : null,
        matchedCategoryId: match?.category?._id || null,
        matchedCategoryName: match?.category?.name || null,
        matchedCurrentStock: match?.currentStock ?? null
      };
    });

    await createLog(
      req.user._id,
      'OCR',
      'SupplierOrder',
      req.file.originalname || 'invoice',
      `Invoice OCR extracted ${itemsWithMatches.length} line item(s)`
    );

    res.json({
      documentNumber: parsed.documentNumber || null,
      supplierName: parsed.supplierName || null,
      totalAmount: parsed.totalAmount || null,
      items: itemsWithMatches
    });
  } catch (error) {
    next(error);
  }
};

const resolveItems = async (req, res, next) => {
  try {
    const { supplierId, items } = req.body;

    if (!supplierId) {
      res.status(400);
      throw new Error('supplierId is required');
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('At least one item is required');
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      res.status(404);
      throw new Error('Supplier not found');
    }

    const resolved = [];
    const newProducts = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.buyingPrice);

      if (!Number.isFinite(qty) || qty <= 0) {
        res.status(400);
        throw new Error(`Invalid quantity for item "${item.name || ''}"`);
      }
      if (!Number.isFinite(price) || price < 0) {
        res.status(400);
        throw new Error(`Invalid buying price for item "${item.name || ''}"`);
      }

      let productId = item.matchedProductId || null;

      if (!productId) {
        const trimmedName = (item.name || '').trim();
        const trimmedSku = (item.sku || '').trim();

        if (!trimmedName || !trimmedSku || !item.categoryId) {
          res.status(400);
          throw new Error('New product items require name, sku and categoryId');
        }

        let existing = await Product.findOne({
          sku: new RegExp(`^${escapeRegex(trimmedSku)}$`, 'i')
        });
        if (!existing) {
          existing = await Product.findOne({
            name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i')
          });
        }

        if (existing) {
          productId = existing._id;
        } else {
          const sellingPrice = Number.isFinite(Number(item.sellingPrice)) && Number(item.sellingPrice) >= 0
            ? Number(item.sellingPrice)
            : Number((price * 1.3).toFixed(2));

          const created = await Product.create({
            name: trimmedName,
            sku: trimmedSku,
            category: item.categoryId,
            description: item.description || '',
            buyingPrice: price,
            sellingPrice,
            minStockThreshold: Number.isFinite(Number(item.minStockThreshold)) && Number(item.minStockThreshold) > 0
              ? Number(item.minStockThreshold)
              : 10,
            isActive: true
          });
          productId = created._id;
          newProducts.push(created);
          await createLog(
            req.user._id,
            'CREATE',
            'Product',
            created.name,
            `Created via Invoice OCR (SKU: ${created.sku})`
          );
        }
      }

      resolved.push({
        product: productId,
        quantity: qty,
        buyingPrice: price
      });
    }

    if (newProducts.length > 0) {
      const existingIds = new Set((supplier.products || []).map(id => String(id)));
      for (const p of newProducts) {
        if (!existingIds.has(String(p._id))) {
          supplier.products.push(p._id);
          existingIds.add(String(p._id));
        }
      }
      await supplier.save();
    }

    const allProductIds = resolved.map(r => r.product);
    const products = await Product.find({ _id: { $in: allProductIds } });

    res.json({
      items: resolved,
      newProducts,
      products,
      supplier
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { extractInvoice, resolveItems };
