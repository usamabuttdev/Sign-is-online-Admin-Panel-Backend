const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(value, { defaultValue = null } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === 'A' || value === 'Y' || value === 'Yes' || value === 1) return 'A';
  if (value === false || value === 'I' || value === 'N' || value === 'No' || value === 0) return 'I';
  return defaultValue;
}

const PRODUCT_SELECT = `
  p.PRO_ID AS id,
  p.PRO_TITLE AS title,
  p.PRO_SUBSCRIPTION_LENGTH AS subscription_length,
  p.PRO_STATUS AS status,
  CASE WHEN p.PRO_STATUS = 'A' THEN 'Yes' ELSE 'No' END AS status_label,
  p.PRO_DATE_INSERTED AS created_at,
  p.PRO_DATE_UPDATED AS updated_at,
  cur.PP_VALUE AS current_price,
  cur.PP_DATE_ENDS AS current_price_ends,
  nxt.PP_VALUE AS next_price,
  nxt.PP_DATE_STARTS AS next_price_starts,
  ISNULL(loc.location_count, 0) AS locations
`;

const PRODUCT_JOINS = `
  FROM PRODUCT p
  OUTER APPLY (
    SELECT TOP 1 pp.PP_VALUE, pp.PP_DATE_ENDS, pp.PP_DATE_STARTS
    FROM PRODUCT_PRICE pp
    WHERE pp.PP_PRO_ID = p.PRO_ID
      AND pp.PP_STATUS = 'A'
      AND pp.PP_DATE_STARTS <= GETDATE()
      AND (pp.PP_DATE_ENDS IS NULL OR pp.PP_DATE_ENDS >= GETDATE())
    ORDER BY pp.PP_DATE_STARTS DESC, pp.PP_ID DESC
  ) cur
  OUTER APPLY (
    SELECT TOP 1 pp.PP_VALUE, pp.PP_DATE_STARTS
    FROM PRODUCT_PRICE pp
    WHERE pp.PP_PRO_ID = p.PRO_ID
      AND pp.PP_STATUS = 'A'
      AND pp.PP_DATE_STARTS > GETDATE()
    ORDER BY pp.PP_DATE_STARTS ASC, pp.PP_ID DESC
  ) nxt
  LEFT JOIN (
    SELECT LOC_PRO_ID, COUNT(*) AS location_count
    FROM LOCATION
    WHERE LOC_STATUS = 'A'
    GROUP BY LOC_PRO_ID
  ) loc ON loc.LOC_PRO_ID = p.PRO_ID
`;

async function insertProductPrice(productId, { value, starts, ends }) {
  if (value == null) return;
  await devDb.query(
    `INSERT INTO PRODUCT_PRICE (
       PP_PRO_ID, PP_VALUE, PP_DATE_STARTS, PP_DATE_ENDS,
       PP_DATE_INSERTED, PP_DATE_UPDATED, PP_STATUS
     )
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'A')`,
    [productId, value, starts, ends]
  );
}

async function softCloseActivePrices(productId) {
  await devDb.query(
    `UPDATE PRODUCT_PRICE
     SET PP_STATUS = 'I', PP_DATE_UPDATED = CURRENT_TIMESTAMP
     WHERE PP_PRO_ID = $1 AND PP_STATUS = 'A'`,
    [productId]
  );
}

router.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT ${PRODUCT_SELECT}
       ${PRODUCT_JOINS}
       WHERE p.PRO_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      subscription_length,
      current_price,
      current_price_ends,
      next_price,
      next_price_starts,
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title required' });

    const subLength = subscription_length != null ? String(subscription_length).trim() : '';
    if (!subLength) {
      return res.status(400).json({
        success: false,
        message: 'Subscription length required (PRO_SUBSCRIPTION_LENGTH), e.g. Monthly, Yearly, One-time.',
      });
    }

    // PRODUCT NOT NULL: title, subscription_length, date_inserted, date_updated, status
    const inserted = await devDb.query(
      `INSERT INTO PRODUCT (
         PRO_TITLE,
         PRO_SUBSCRIPTION_LENGTH,
         PRO_STATUS,
         PRO_DATE_INSERTED,
         PRO_DATE_UPDATED
       )
       VALUES ($1, $2, 'A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING PRO_ID AS id, PRO_TITLE AS title`,
      [String(title).slice(0, 40), subLength.slice(0, 20)]
    );

    const productId = inserted.rows[0]?.id;
    if (!productId) {
      return res.status(500).json({ success: false, message: 'Product insert did not return id' });
    }

    const currentPriceVal = parseOptionalNumber(current_price);
    const nextPriceVal = parseOptionalNumber(next_price);
    const currentEnds = parseOptionalDate(current_price_ends);
    const nextStarts = parseOptionalDate(next_price_starts);

    if (currentPriceVal != null) {
      await insertProductPrice(productId, {
        value: currentPriceVal,
        starts: new Date(),
        ends: currentEnds,
      });
    }

    if (nextPriceVal != null) {
      if (!nextStarts) {
        return res.status(400).json({
          success: false,
          message: 'next_price_starts is required when next_price is set (PRODUCT_PRICE.PP_DATE_STARTS).',
        });
      }
      await insertProductPrice(productId, {
        value: nextPriceVal,
        starts: nextStarts,
        ends: null,
      });
    }

    const full = await devDb.query(
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_JOINS} WHERE p.PRO_ID = @p1`,
      [productId]
    );
    res.status(201).json({ success: true, data: full.rows[0] || inserted.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      subscription_length,
      status,
      current_price,
      current_price_ends,
      next_price,
      next_price_starts,
    } = req.body;

    const productId = req.params.id;
    const existing = await devDb.query(
      `SELECT PRO_ID FROM PRODUCT WHERE PRO_ID = @p1`,
      [productId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const prodStatus = normalizeStatus(status);
    const titleVal = title !== undefined && title !== null && title !== '' ? String(title).slice(0, 40) : null;
    const subVal =
      subscription_length !== undefined && subscription_length !== null && String(subscription_length).trim() !== ''
        ? String(subscription_length).trim().slice(0, 20)
        : null;

    await devDb.query(
      `UPDATE PRODUCT SET
        PRO_TITLE = COALESCE($1, PRO_TITLE),
        PRO_SUBSCRIPTION_LENGTH = COALESCE($2, PRO_SUBSCRIPTION_LENGTH),
        PRO_STATUS = COALESCE($3, PRO_STATUS),
        PRO_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE PRO_ID = $4`,
      [titleVal, subVal, prodStatus, productId]
    );

    const currentPriceVal = parseOptionalNumber(current_price);
    const nextPriceVal = parseOptionalNumber(next_price);
    const hasPriceUpdate =
      current_price !== undefined ||
      current_price_ends !== undefined ||
      next_price !== undefined ||
      next_price_starts !== undefined;

    if (hasPriceUpdate && (currentPriceVal != null || nextPriceVal != null)) {
      await softCloseActivePrices(productId);

      if (currentPriceVal != null) {
        await insertProductPrice(productId, {
          value: currentPriceVal,
          starts: new Date(),
          ends: parseOptionalDate(current_price_ends),
        });
      }

      if (nextPriceVal != null) {
        const nextStarts = parseOptionalDate(next_price_starts);
        if (!nextStarts) {
          return res.status(400).json({
            success: false,
            message: 'next_price_starts is required when next_price is set (PRODUCT_PRICE.PP_DATE_STARTS).',
          });
        }
        await insertProductPrice(productId, {
          value: nextPriceVal,
          starts: nextStarts,
          ends: null,
        });
      }
    }

    const full = await devDb.query(
      `SELECT ${PRODUCT_SELECT} ${PRODUCT_JOINS} WHERE p.PRO_ID = @p1`,
      [productId]
    );
    res.json({ success: true, data: full.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE PRODUCT SET PRO_STATUS = 'I', PRO_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE PRO_ID = $1 AND PRO_STATUS = 'A'
       RETURNING PRO_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "p.PRO_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND p.PRO_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM PRODUCT p WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT ${PRODUCT_SELECT}
      ${PRODUCT_JOINS}
      WHERE ${where}
      ORDER BY p.PRO_DATE_INSERTED DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, params);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].cnt),
      page: parseInt(pageno),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
