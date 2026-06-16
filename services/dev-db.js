const sql = require('mssql');

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const SECRET_NAME = 'storefront/rds-credentials';
const DEFAULTS = {
  server: 'dev.cqv82ucmgull.us-east-1.rds.amazonaws.com',
  port: 1433,
  user: 'IO_JUYI_Avy_zi8w',
  password: 'SimplePass123?',
  database: 'STOREFRONT',
};

let cachedConfig = null;
let pool = null;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;

  // Try AWS Secrets Manager first
  try {
    const client = new SecretsManagerClient({ region: 'us-east-1' });
    const secret = await client.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
    if (secret.SecretString) {
      const parsed = JSON.parse(secret.SecretString);
      cachedConfig = {
        server: parsed.host || parsed.server || DEFAULTS.server,
        port: parseInt(parsed.port || DEFAULTS.port),
        user: parsed.username || parsed.user || DEFAULTS.user,
        password: parsed.password || DEFAULTS.password,
        database: parsed.database || parsed.dbname || DEFAULTS.database,
      };
      return cachedConfig;
    }
  } catch {
    // No AWS creds available — fall through to env/defaults
  }

  cachedConfig = {
    server: process.env.DEV_DB_HOST || DEFAULTS.server,
    port: parseInt(process.env.DEV_DB_PORT || DEFAULTS.port),
    user: process.env.DEV_DB_USER || DEFAULTS.user,
    password: process.env.DEV_DB_PASS || DEFAULTS.password,
    database: process.env.DEV_DB_NAME || DEFAULTS.database,
  };
  return cachedConfig;
}

function buildMssqlConfig(cfg) {
  return {
    server: cfg.server,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };
}

async function getPool() {
  if (!pool) {
    const cfg = await loadConfig();
    pool = await sql.connect(buildMssqlConfig(cfg));
  }
  return pool;
}

function convertMssql(text) {
  let sqlText = text;

  // ILIKE -> LIKE (MSSQL is case-insensitive by default)
  sqlText = sqlText.replace(/\bILIKE\b/gi, 'LIKE');

  // Convert $N -> @pN
  sqlText = sqlText.replace(/\$(\d+)/g, '@p$1');

  // Store LIMIT/OFFSET info before removing
  let limitVal = null;
  let offsetVal = null;

  sqlText = sqlText.replace(
    /\s+LIMIT\s+@p(\d+)(?:\s+OFFSET\s+@p(\d+))?\s*/gi,
    (match, l, o) => {
      limitVal = l;
      offsetVal = o || null;
      return ' ';
    }
  );

  // Handle RETURNING -> OUTPUT
  const returningRE = /\s+RETURNING\s+(.+?)$/i;
  const returningMatch = sqlText.match(returningRE);

  if (returningMatch) {
    const cols = returningMatch[1].trim();
    const isInsert = /^\s*INSERT\b/i.test(sqlText);
    const isDelete = /^\s*DELETE\b/i.test(sqlText);
    const prefix = isDelete ? 'OUTPUT DELETED.' : 'OUTPUT INSERTED.';
    const outputClause = `${prefix}${cols}`;

    // Remove RETURNING clause
    sqlText = sqlText.replace(returningRE, '');

    if (isInsert) {
      sqlText = sqlText.replace(/\bVALUES\s*\(/i, `${outputClause} VALUES (`);
    } else {
      const whereIdx = sqlText.search(/\s+WHERE\s+/i);
      if (whereIdx !== -1) {
        const before = sqlText.slice(0, whereIdx);
        const after = sqlText.slice(whereIdx);
        sqlText = before + ' ' + outputClause + after;
      } else {
        sqlText += ' ' + outputClause;
      }
    }
  }

  // Append OFFSET/FETCH after ORDER BY, or use TOP
  if (limitVal) {
    if (/\s+ORDER\s+BY\s+/i.test(sqlText)) {
      if (offsetVal) {
        sqlText += ` OFFSET @p${offsetVal} ROWS FETCH NEXT @p${limitVal} ROWS ONLY`;
      } else {
        sqlText += ` OFFSET 0 ROWS FETCH NEXT @p${limitVal} ROWS ONLY`;
      }
    } else {
      if (offsetVal) {
        sqlText += ` ORDER BY (SELECT NULL) OFFSET @p${offsetVal} ROWS FETCH NEXT @p${limitVal} ROWS ONLY`;
      } else {
        sqlText = sqlText.replace(/\bSELECT\b/i, `SELECT TOP(@p${limitVal})`);
      }
    }
  }

  // Collapse whitespace
  sqlText = sqlText.replace(/\s+/g, ' ').trim();

  return sqlText;
}

async function query(text, params = []) {
  try {
    const conn = await getPool();
    const converted = convertMssql(text);

    // Get all parameter names from the converted SQL
    const names = [];
    const paramRE = /@p(\d+)/g;
    let m;
    while ((m = paramRE.exec(converted)) !== null) {
      names.push(parseInt(m[1]));
    }

    const request = conn.request();
    for (const idx of [...new Set(names)]) {
      const val = params[idx - 1];
      if (val !== undefined) {
        request.input(`p${idx}`, val);
      }
    }

    const result = await request.query(converted);
    const rows = result.recordset || [];
    return { rows, rowCount: rows.length > 0 ? rows.length : (result.rowsAffected ? result.rowsAffected[0] || 0 : 0) };
  } catch (err) {
    console.error(`MSSQL query error: ${err.message}`);
    console.error(`  SQL: ${text.substring(0, 200)}`);
    throw err;
  }
}

module.exports = { query, pool, getPool, convertMssql };