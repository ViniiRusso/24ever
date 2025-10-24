import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import helmet from 'helmet';
import dotenv from 'dotenv';
import compression from 'compression';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// Canonical só em produção
const CANON_HOST = process.env.CANON_HOST || 'www.24ever.com.br';
if (isProd) {
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!req.secure) return res.redirect(301, `https://${host}${req.originalUrl}`);
    if (host !== CANON_HOST) return res.redirect(301, `https://${CANON_HOST}${req.originalUrl}`);
    next();
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());

// Sessão
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';
app.use(session({
  name: 's24',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    domain: isProd ? '.24ever.com.br' : undefined,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}));

// Assets públicos
const ASSET_EXT = /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff2?|map)$/i;

app.use('/images', express.static(path.join(__dirname, 'public', 'images'), {
  setHeaders(res, filePath) {
    if (/\.(?:jpg|jpeg|png|webp|gif|svg)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
  index: false,
}));

app.use((req, res, next) => {
  if (ASSET_EXT.test(req.path)) {
    return express.static(path.join(__dirname, 'public'), {
      setHeaders(res, filePath) {
        if (/\.(?:js|css|jpg|jpeg|png|webp|gif|svg|woff2?)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
      index: false,
    })(req, res, next);
  }
  next();
});

// evita cache de HTML
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Login público
app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

async function doAuth(req, res) {
  const { password } = req.body || {};
  const AUTH_FILE = path.join(__dirname, 'auth.json');
  let PASSWORD_HASH = null;
  try { PASSWORD_HASH = (JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))).password_hash || null; } catch {}
  const APP_PASSWORD_PLAIN = process.env.APP_PASSWORD || null;

  const okEnv  = APP_PASSWORD_PLAIN && password === APP_PASSWORD_PLAIN;
  const okFile = PASSWORD_HASH && await bcrypt.compare(String(password || ''), PASSWORD_HASH);
  if (!(okEnv || okFile)) return res.redirect('/login?e=1');

  req.session.regenerate(err => {
    if (err) return res.redirect('/login?e=1');
    req.session.userId = 'u1';
    req.session.save(() => res.redirect('/'));
  });
}
app.post('/auth', doAuth);
app.post('/login', doAuth);

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('s24', { domain: isProd ? '.24ever.com.br' : undefined });
    res.redirect('/login');
  });
});

// Proteção
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
app.use(requireAuth);

// Estáticos pós-login
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Páginas
app.get('/',        (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/games',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));
app.get('/map',     (_, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/calendar',(_, res) => res.sendFile(path.join(__dirname, 'public', 'calendar.html')));
app.get('/notes',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'notes.html')));
app.get('/links',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'links.html')));

// DATA (JSON em disco)
const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const EVENTS_FILE= path.join(DATA_DIR, 'events.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const MAP_FILE   = path.join(DATA_DIR, 'map.json');
const GJ_BR_FILE = path.join(DATA_DIR, 'brazil-states.geojson');
const GJ_US_FILE = path.join(DATA_DIR, 'united-states.geojson');

for (const f of [EVENTS_FILE, NOTES_FILE, MAP_FILE]) if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');

const readJSON  = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// --- APIs base ---
app.get('/api/events', (_req, res) => res.json(readJSON(EVENTS_FILE)));
app.post('/api/events', (req, res) => {
  const { id, title, start, end, allDay } = req.body || {};
  if (!title || !start) return res.status(400).json({ error: 'missing fields' });
  const events = readJSON(EVENTS_FILE);
  const ev = { id: id || crypto.randomUUID(), title, start, end: end || null, allDay: !!allDay };
  events.push(ev); writeJSON(EVENTS_FILE, events); res.json(ev);
});
app.delete('/api/events/:id', (req, res) => {
  writeJSON(EVENTS_FILE, readJSON(EVENTS_FILE).filter(e => e.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/notes', (_req, res) => res.json(readJSON(NOTES_FILE)));
app.post('/api/notes', (req, res) => {
  const { text } = req.body ?? {};
  if (text === undefined) return res.status(400).json({ error: 'missing text' });
  const notes = readJSON(NOTES_FILE);
  const note = { id: crypto.randomUUID(), text: String(text), ts: Date.now() };
  notes.unshift(note); writeJSON(NOTES_FILE, notes); res.json(note);
});
app.patch('/api/notes/:id', (req, res) => {
  const notes = readJSON(NOTES_FILE);
  const i = notes.findIndex(n => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  if (req.body.text !== undefined) notes[i].text = String(req.body.text);
  notes[i].ts = Date.now();
  writeJSON(NOTES_FILE, notes); res.json(notes[i]);
});
app.delete('/api/notes/:id', (req, res) => {
  writeJSON(NOTES_FILE, readJSON(NOTES_FILE).filter(n => n.id !== req.params.id));
  res.json({ ok: true });
});

// --- APIs do Map (persistência) ---
app.get('/api/map/states', (_req, res) => res.json(readJSON(MAP_FILE)));
app.post('/api/map/states', (req, res) => {
  const { id, visited } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });
  const set = new Set(readJSON(MAP_FILE));
  visited ? set.add(id) : set.delete(id);
  const arr = [...set]; writeJSON(MAP_FILE, arr); res.json(arr);
});
app.post('/api/map/clear', (_req, res) => { writeJSON(MAP_FILE, []); res.json({ ok: true }); });

// --- GeoJSON proxy com cache em disco (evita CORS/instabilidade) ---
async function cachedFetchGeo(url, filePath){
  // se já existe em disco, serve do cache
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch {}
  }
  // baixa (Node 18+ tem fetch nativo)
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Falha ao baixar ${url}`);
  const gj = await r.json();
  fs.writeFileSync(filePath, JSON.stringify(gj));
  return gj;
}

app.get('/api/geo/brazil', async (_req, res) => {
  try {
    const url = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
    const gj  = await cachedFetchGeo(url, GJ_BR_FILE);
    res.json(gj);
  } catch (e) {
    res.status(500).json({ error: 'brazil geojson fetch failed' });
  }
});

app.get('/api/geo/us', async (_req, res) => {
  try {
    const url = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/united-states.geojson';
    const gj  = await cachedFetchGeo(url, GJ_US_FILE);
    res.json(gj);
  } catch (e) {
    res.status(500).json({ error: 'us geojson fetch failed' });
  }
});

// 404 → home
app.use((_, res) => res.redirect('/'));

// start
app.listen(PORT, () => console.log(`✅ 24ever rodando em ${isProd ? `https://${CANON_HOST}` : `http://localhost:${PORT}`}`));