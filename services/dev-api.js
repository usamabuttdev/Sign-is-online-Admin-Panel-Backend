const DEV_API_BASE = process.env.DEV_API_URL || 'http://dev.cqv82ucmgull.us-east-1.rds.amazonaws.com';
const DEV_API_USER = process.env.DEV_API_USER || 'QKERmvHnkjg';
const DEV_API_PASS = process.env.DEV_API_PASS || 'wai8A4ckurhgcyava45ta7wbu&6au24hv3urhu4%gv';

const AUTH = Buffer.from(`${DEV_API_USER}:${DEV_API_PASS}`).toString('base64');

async function request(path, options = {}) {
  const base = DEV_API_BASE.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${base}/${cleanPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Dev API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function getUsers({ page = 1, limit = 10, keyword = '' } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (keyword) params.set('keyword', keyword);
  const data = await request(`USR?${params}`);
  return {
    success: true,
    data: data.data || data.rows || data.results || data,
    total: data.total || data.count || (Array.isArray(data) ? data.length : 0),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

async function getUserById(id) {
  return request(`USR/${id}`);
}

async function updateUserStatus(id, isActive) {
  return request(`USR/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

module.exports = { getUsers, getUserById, updateUserStatus, request };