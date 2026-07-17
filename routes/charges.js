const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');
const { syncSequence } = require('../services/sequences-schema');

const router = express.Router();

function parseRequiredInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is required and must be a number`);
    err.status = 400;
    throw err;
  }
  return Math.trunc(n);
}

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function ensureInvoice({ invoiceId, locationId, productId, amount }) {
  if (invoiceId != null) {
    const existing = await devDb.query(
      `SELECT INV_ID AS id FROM INVOICE WHERE INV_ID = @p1`,
      [invoiceId]
    );
    if (!existing.rows.length) {
      const err = new Error(`Invoice ${invoiceId} not found (CHA_INV_ID)`);
      err.status = 400;
      throw err;
    }
    return invoiceId;
  }

  try {
    await syncSequence({ sequence: 'INV_SEQ', table: 'INVOICE', column: 'INV_ID' });
  } catch (syncErr) {
    console.warn('INV_SEQ sync before invoice insert failed:', syncErr.message);
  }

  // INV_NUMBER is varchar(40) after schema ensure (was wrongly varchar(1))
  const invNumber = `C${locationId}${String(Date.now()).slice(-8)}`.slice(0, 40);
  const created = await devDb.query(
    `INSERT INTO INVOICE (
       INV_LOC_ID,
       INV_PRO_ID,
       INV_NUMBER,
       INV_AMOUNT,
       INV_DATE_DUE,
       INV_DATE_INSERTED,
       INV_DATE_UPDATED,
       INV_STATUS
     )
     VALUES ($1, $2, $3, $4, DATEADD(day, 30, GETDATE()), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A')
     RETURNING INV_ID AS id`,
    [locationId, productId, invNumber, amount]
  );
  const id = created.rows[0]?.id;
  if (!id) {
    const err = new Error('Failed to create invoice for charge');
    err.status = 500;
    throw err;
  }
  return id;
}

router.get('/charges', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno, 10) - 1) * limit;

    let where = "ISNULL(c.CHA_STATUS, 'A') = 'A'";
    const params = [];
    if (search) {
      where += ' AND (acc.ACC_TITLE LIKE @p1 OR c.CHA_METHOD LIKE @p1 OR loc.LOC_TITLE LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt
       FROM CHARGE c
       LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
       LEFT JOIN LOCATION loc ON loc.LOC_ID = c.CHA_LOC_ID
       WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        c.CHA_ID AS id,
        c.CHA_ACC_ID AS account_id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_LOC_ID AS location_id,
        ISNULL(loc.LOC_TITLE, '') AS location,
        c.CHA_INV_ID AS invoice_id,
        c.CHA_PRO_ID AS product_id,
        c.CHA_PP_ID AS product_price_id,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        ISNULL(c.CHA_STATUS, 'A') AS status_code,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      LEFT JOIN LOCATION loc ON loc.LOC_ID = c.CHA_LOC_ID
      WHERE ${where}
      ORDER BY c.CHA_DATE_INSERTED DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, params);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].cnt, 10),
      page: parseInt(pageno, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        c.CHA_ID AS id,
        c.CHA_ACC_ID AS account_id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_LOC_ID AS location_id,
        ISNULL(loc.LOC_TITLE, '') AS location,
        c.CHA_INV_ID AS invoice_id,
        c.CHA_PRO_ID AS product_id,
        c.CHA_PP_ID AS product_price_id,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        ISNULL(c.CHA_STATUS, 'A') AS status_code,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      LEFT JOIN LOCATION loc ON loc.LOC_ID = c.CHA_LOC_ID
      WHERE c.CHA_ID = @p1 AND ISNULL(c.CHA_STATUS, 'A') = 'A'`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/charges', authenticateToken, async (req, res) => {
  try {
    const {
      account_id,
      location_id,
      invoice_id,
      product_id,
      product_price_id,
      pp_id,
      amount,
      method,
    } = req.body;

    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, message: 'Amount required' });
    }
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum)) {
      return res.status(400).json({ success: false, message: 'Amount must be a number' });
    }

    const locationId = parseRequiredInt(location_id, 'location_id (CHA_LOC_ID)');

    const locResult = await devDb.query(
      `SELECT LOC_ID AS id, LOC_ACC_ID AS account_id, LOC_PRO_ID AS product_id, LOC_PP_ID AS product_price_id
       FROM LOCATION
       WHERE LOC_ID = @p1 AND LOC_STATUS = 'A'`,
      [locationId]
    );
    if (!locResult.rows.length) {
      return res.status(400).json({ success: false, message: `Active location ${locationId} not found` });
    }
    const loc = locResult.rows[0];

    let accountId = parseOptionalInt(account_id);
    if (accountId == null) {
      accountId = Number(loc.account_id);
    } else if (Number(loc.account_id) !== accountId) {
      return res.status(400).json({
        success: false,
        message: `location_id ${locationId} belongs to account ${loc.account_id}, not ${accountId}`,
      });
    }

    let productId = parseOptionalInt(product_id) ?? parseOptionalInt(loc.product_id);
    let productPriceId =
      parseOptionalInt(product_price_id) ?? parseOptionalInt(pp_id) ?? parseOptionalInt(loc.product_price_id);

    if (productId == null) {
      return res.status(400).json({
        success: false,
        message: 'product_id required (CHA_PRO_ID). Location has no product assigned.',
      });
    }
    if (productPriceId == null) {
      return res.status(400).json({
        success: false,
        message: 'product_price_id required (CHA_PP_ID). Location has no product price assigned.',
      });
    }

    const ppCheck = await devDb.query(
      `SELECT PP_ID AS id, PP_PRO_ID AS product_id FROM PRODUCT_PRICE WHERE PP_ID = @p1 AND PP_STATUS = 'A'`,
      [productPriceId]
    );
    if (!ppCheck.rows.length) {
      return res.status(400).json({
        success: false,
        message: `Active product_price_id ${productPriceId} not found in PRODUCT_PRICE`,
      });
    }

    const invoiceId = await ensureInvoice({
      invoiceId: parseOptionalInt(invoice_id),
      locationId,
      productId,
      amount: amountNum,
    });

    try {
      await syncSequence({ sequence: 'CHA_SEQ', table: 'CHARGE', column: 'CHA_ID' });
    } catch (syncErr) {
      console.warn('CHA_SEQ sync before insert failed:', syncErr.message);
    }

    // CHARGE NOT NULL: ACC, LOC, INV, PRO, PP, AMOUNT, DATE_INSERTED, STATUS
    const result = await devDb.query(
      `INSERT INTO CHARGE (
         CHA_ACC_ID,
         CHA_LOC_ID,
         CHA_INV_ID,
         CHA_PRO_ID,
         CHA_PP_ID,
         CHA_AMOUNT,
         CHA_METHOD,
         CHA_STATUS,
         CHA_DATE_INSERTED
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'A', CURRENT_TIMESTAMP)
       RETURNING CHA_ID AS id, CHA_AMOUNT AS amount`,
      [
        accountId,
        locationId,
        invoiceId,
        productId,
        productPriceId,
        amountNum,
        method ? String(method).slice(0, 20) : null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.put('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const {
      amount,
      method,
      status,
      account_id,
      location_id,
      product_id,
      product_price_id,
      pp_id,
    } = req.body;

    const existing = await devDb.query(
      `SELECT CHA_ID FROM CHARGE WHERE CHA_ID = @p1 AND ISNULL(CHA_STATUS, 'A') = 'A'`,
      [req.params.id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }

    const fields = [];
    const params = [];
    let idx = 1;

    if (amount !== undefined && amount !== null && amount !== '') {
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum)) {
        return res.status(400).json({ success: false, message: 'Amount must be a number' });
      }
      fields.push(`CHA_AMOUNT = $${idx++}`);
      params.push(amountNum);
    }

    if (method !== undefined) {
      fields.push(`CHA_METHOD = $${idx++}`);
      params.push(method ? String(method).slice(0, 20) : null);
    }

    const accountId = parseOptionalInt(account_id);
    if (accountId != null) {
      fields.push(`CHA_ACC_ID = $${idx++}`);
      params.push(accountId);
    }

    const locationId = parseOptionalInt(location_id);
    if (locationId != null) {
      fields.push(`CHA_LOC_ID = $${idx++}`);
      params.push(locationId);
    }

    const productId = parseOptionalInt(product_id);
    if (productId != null) {
      fields.push(`CHA_PRO_ID = $${idx++}`);
      params.push(productId);
    }

    const productPriceId = parseOptionalInt(product_price_id) ?? parseOptionalInt(pp_id);
    if (productPriceId != null) {
      const ppCheck = await devDb.query(
        `SELECT PP_ID FROM PRODUCT_PRICE WHERE PP_ID = @p1 AND PP_STATUS = 'A'`,
        [productPriceId]
      );
      if (!ppCheck.rows.length) {
        return res.status(400).json({
          success: false,
          message: `Active product_price_id ${productPriceId} not found in PRODUCT_PRICE`,
        });
      }
      fields.push(`CHA_PP_ID = $${idx++}`);
      params.push(productPriceId);
    }

    if (status !== undefined && status !== null && status !== '') {
      const statusCode =
        status === 'A' || status === 'I'
          ? status
          : status === 'Successful' || status === 'Attempted'
            ? 'A'
            : status === 'Refunded' || status === 'banned' || status === 'inactive'
              ? 'I'
              : null;
      if (!statusCode) {
        return res.status(400).json({ success: false, message: 'status must be A or I' });
      }
      fields.push(`CHA_STATUS = $${idx++}`);
      params.push(statusCode);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);
    await devDb.query(
      `UPDATE CHARGE SET ${fields.join(', ')} WHERE CHA_ID = $${idx} AND ISNULL(CHA_STATUS, 'A') = 'A'`,
      params
    );

    const full = await devDb.query(
      `SELECT
        c.CHA_ID AS id,
        c.CHA_ACC_ID AS account_id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_LOC_ID AS location_id,
        ISNULL(loc.LOC_TITLE, '') AS location,
        c.CHA_INV_ID AS invoice_id,
        c.CHA_PRO_ID AS product_id,
        c.CHA_PP_ID AS product_price_id,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        ISNULL(c.CHA_STATUS, 'A') AS status_code,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      LEFT JOIN LOCATION loc ON loc.LOC_ID = c.CHA_LOC_ID
      WHERE c.CHA_ID = @p1`,
      [req.params.id]
    );

    res.json({ success: true, data: full.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE CHARGE SET CHA_STATUS = 'I'
       WHERE CHA_ID = $1 AND ISNULL(CHA_STATUS, 'A') = 'A'
       RETURNING CHA_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.json({ success: true, message: 'Charge soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
