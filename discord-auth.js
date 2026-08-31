const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const router = express.Router();
const dataFile = path.join(__dirname, 'data', 'admin-data.json');
const usersFile = path.join(__dirname, 'data', 'users.json');

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function write(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function settings() {
  const data = read(dataFile, { settings: {} });
  return data.settings || {};
}
function discordConfig() {
  const s = settings();
  return {
    enabled: String(s.discord_enabled ?? process.env.DISCORD_ENABLED ?? 'true') !== 'false',
    clientId: String(s.discord_client_id || process.env.DISCORD_CLIENT_ID || '').trim(),
    clientSecret: String(s.discord_client_secret || process.env.DISCORD_CLIENT_SECRET || '').trim(),
    redirectUri: String(s.discord_redirect_uri || process.env.DISCORD_REDIRECT_URI || '').trim(),
    botToken: String(s.discord_bot_token || process.env.DISCORD_BOT_TOKEN || '').trim(),
    guildId: String(s.discord_guild_id || process.env.DISCORD_GUILD_ID || '').trim()
  };
}
function requestJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(options.headers || {}) } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(raw); } catch (_) { parsed = { raw }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Discord HTTP ${res.statusCode}: ${parsed.error_description || parsed.message || raw}`));
      });
    });
    req.on('error', reject);
    if (body) req.write(new URLSearchParams(body).toString());
    req.end();
  });
}
async function discordGet(url, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${accessToken}` } }, res => {
      let raw = ''; res.on('data', c => raw += c); res.on('end', () => {
        let parsed; try { parsed = JSON.parse(raw); } catch (_) { parsed = { raw }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Discord HTTP ${res.statusCode}`));
      });
    });
    req.on('error', reject);
  });
}

router.get('/auth/discord', (req, res) => {
  const c = discordConfig();
  if (!c.enabled) return res.status(403).send('Discord login is disabled by the administrator.');
  if (!c.clientId || !c.clientSecret || !c.redirectUri) return res.status(503).send('Discord login is not configured. Ask the administrator to configure Discord Connect.');
  const state = require('crypto').randomBytes(24).toString('hex');
  req.session.discordOAuthState = state;
  req.session.discordNext = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/panel';
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('scope', 'identify email');
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

router.get('/auth/discord/callback', async (req, res) => {
  try {
    const c = discordConfig();
    if (!c.enabled) return res.status(403).send('Discord login is disabled.');
    if (!req.query.code || req.query.state !== req.session.discordOAuthState) return res.status(400).send('Invalid Discord OAuth state.');
    const token = await requestJson('https://discord.com/api/oauth2/token', { method: 'POST' }, {
      client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'authorization_code',
      code: String(req.query.code), redirect_uri: c.redirectUri
    });
    const profile = await discordGet('https://discord.com/api/users/@me', token.access_token);
    const users = read(usersFile, []);
    let user = users.find(u => String(u.discord_id || '') === String(profile.id));
    if (!user) {
      user = { id: require('crypto').randomUUID(), name: profile.global_name || profile.username || 'Discord User', email: profile.email || '', password: '', role: 'client', discord_id: profile.id, created_at: new Date().toISOString() };
      users.push(user);
    } else {
      user.name = profile.global_name || profile.username || user.name;
      if (profile.email) user.email = profile.email;
      user.discord_id = profile.id;
      user.updated_at = new Date().toISOString();
    }
    write(usersFile, users);
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, discord_id: user.discord_id };
    delete req.session.discordOAuthState;
    const next = req.session.discordNext || '/panel'; delete req.session.discordNext;
    res.redirect(next);
  } catch (e) {
    console.error('[Discord OAuth]', e.message);
    res.status(500).send('Discord login failed. Check Discord Connect configuration.');
  }
});

// Admin-only configuration page/API. Secrets are kept in local admin-data.json, never in GitHub.
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin) return res.status(401).send('Admin login required.');
  next();
}
router.get('/admin/discord-connect', requireAdmin, (req, res) => {
  const c = discordConfig();
  res.render('discord-connect', { discord: c, saved: req.query.saved === '1' });
});
router.post('/admin/discord-connect', requireAdmin, express.urlencoded({ extended: true }), (req, res) => {
  const data = read(dataFile, { settings: {} }); data.settings = data.settings || {};
  data.settings.discord_enabled = req.body.discord_enabled === 'on' ? 'true' : 'false';
  data.settings.discord_client_id = String(req.body.discord_client_id || '').trim();
  data.settings.discord_client_secret = String(req.body.discord_client_secret || '').trim();
  data.settings.discord_redirect_uri = String(req.body.discord_redirect_uri || '').trim();
  data.settings.discord_bot_token = String(req.body.discord_bot_token || '').trim();
  data.settings.discord_guild_id = String(req.body.discord_guild_id || '').trim();
  write(dataFile, data);
  res.redirect('/admin/discord-connect?saved=1');
});

module.exports = router;
