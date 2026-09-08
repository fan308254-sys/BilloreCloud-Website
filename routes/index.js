const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
const dataFile = path.join(__dirname, '..', 'data', 'admin-data.json');
const usersFile = path.join(__dirname, '..', 'data', 'users.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (err, key) => err ? reject(err) : resolve(key.toString('hex')));
  });
}
async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
function makePassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return hashPassword(password, salt).then(hash => `scrypt$${salt}$${hash}`);
}
function safeNext(value) { return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/panel'; }

router.get('/', (req, res) => {
  const data = read(dataFile, { settings: {}, categories: [], products: [] });
  res.render('index', { categories: data.categories || [], products: data.products || [] });
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(safeNext(req.query.next));
  res.render('login', { error: null, next: safeNext(req.query.next) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const next = safeNext(req.body.next);
  const users = read(usersFile, []);
  const user = users.find(u => String(u.email || '').trim().toLowerCase() === email);
  try {
    const valid = user && (await verifyPassword(password, user.password));
    if (!valid) return res.status(401).render('login', { error: 'Invalid email or password.', next });
    req.session.regenerate(err => {
      if (err) return res.status(500).render('login', { error: 'Unable to create session.', next });
      req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role || 'client', discord_id: user.discord_id || '' };
      req.session.save(saveErr => {
        if (saveErr) return res.status(500).render('login', { error: 'Unable to save session.', next });
        res.redirect(next);
      });
    });
  } catch (e) {
    console.error('[Login]', e.message);
    res.status(500).render('login', { error: 'Login failed.', next });
  }
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/panel');
  res.render('register', { error: null, form: {} });
});

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const discordId = String(req.body.discord_id || '').trim();
  const form = { name, email, discord_id: discordId };
  if (!name || !email || password.length < 6 || !/^\d{17,20}$/.test(discordId)) {
    return res.status(400).render('register', { error: 'Please enter valid account details and a 17–20 digit Discord User ID.', form });
  }
  const users = read(usersFile, []);
  if (users.some(u => String(u.email || '').toLowerCase() === email)) return res.status(409).render('register', { error: 'An account with this email already exists.', form });
  try {
    const user = { id: crypto.randomUUID(), name, email, password: await makePassword(password), role: 'client', discord_id: discordId, created_at: new Date().toISOString() };
    users.push(user);
    write(usersFile, users);
    req.session.user = { id: user.id, name, email, role: 'client', discord_id: discordId };
    req.session.save(err => err ? res.status(500).render('register', { error: 'Account created, but session could not be saved. Please login.', form }) : res.redirect('/panel'));
  } catch (e) {
    console.error('[Register]', e.message);
    res.status(500).render('register', { error: 'Unable to create account.', form });
  }
});

router.get('/panel', (req, res) => {
  if (!req.session.user) return res.redirect('/login?next=/panel');
  const data = read(dataFile, { orders: [], services: [], invoices: [] });
  const orders = (data.orders || []).filter(o => String(o.user_id || o.client_id || '') === String(req.session.user.id) || String(o.email || '').toLowerCase() === String(req.session.user.email).toLowerCase());
  const services = (data.services || []).filter(s => String(s.user_id || s.client_id || '') === String(req.session.user.id));
  res.render('panel', { user: req.session.user, orders, services });
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout failed.');
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
