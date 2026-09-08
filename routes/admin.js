const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const dataFile = path.join(__dirname, '..', 'data', 'admin-data.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin || req.session.admin.authenticated !== true) return res.redirect('/admin/login');
  next();
}

router.get('/login', (req, res) => {
  if (req.session && req.session.admin && req.session.admin.authenticated === true) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!adminEmail || !adminPassword) return res.status(500).render('admin-login', { error: 'Admin credentials are not configured.' });
  if (email !== adminEmail || password !== adminPassword) return res.status(401).render('admin-login', { error: 'Invalid credentials' });
  req.session.admin = { authenticated: true, email: adminEmail };
  req.session.save(err => {
    if (err) {
      console.error('[Admin session]', err.message);
      return res.status(500).render('admin-login', { error: 'Unable to create admin session.' });
    }
    res.redirect('/admin');
  });
});

router.get('/', requireAdmin, (req, res) => {
  const data = read(dataFile, { settings: {}, categories: [], products: [], orders: [], invoices: [], services: [] });
  res.render('admin', {
    admin: req.session.admin,
    settings: data.settings || {},
    stats: {
      categories: (data.categories || []).length,
      products: (data.products || []).length,
      orders: (data.orders || []).length,
      invoices: (data.invoices || []).length,
      services: (data.services || []).length
    },
    orders: data.orders || [],
    products: data.products || [],
    categories: data.categories || []
  });
});

router.post('/settings', requireAdmin, (req, res) => {
  const data = read(dataFile, { settings: {} });
  data.settings = data.settings || {};
  const allowed = ['site_name', 'site_logo', 'discord_url', 'panel_url', 'panel_api_key', 'panel_type'];
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) data.settings[key] = String(req.body[key] || '').trim();
  write(dataFile, data);
  res.redirect('/admin?saved=1');
});

router.post('/product', requireAdmin, (req, res) => {
  const data = read(dataFile, { categories: [], products: [] });
  data.products = data.products || [];
  data.products.push({ id: crypto.randomUUID(), name: String(req.body.name || '').trim(), category: String(req.body.category || '').trim(), description: String(req.body.description || '').trim(), price: Number(req.body.price || 0), active: true, created_at: new Date().toISOString() });
  write(dataFile, data);
  res.redirect('/admin?saved=1');
});

router.post('/category', requireAdmin, (req, res) => {
  const data = read(dataFile, { categories: [] });
  data.categories = data.categories || [];
  data.categories.push({ id: crypto.randomUUID(), name: String(req.body.name || '').trim(), description: String(req.body.description || '').trim(), active: true, created_at: new Date().toISOString() });
  write(dataFile, data);
  res.redirect('/admin?saved=1');
});

router.post('/logout', requireAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout failed.');
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

module.exports = router;
