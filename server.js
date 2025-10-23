// server.js — login primeiro; sessão atrás de proxy (Render); assets públicos
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

app.set('trust proxy', 1); // Render/Cloudflare

// ── Canonical: força HTTPS e WWW no domínio final
const CANON_HOST = 'www.24ever.com.br';
app.use((req, res, next) => {
  const host = req.headers.host || '';
  // força https
  if (!req.secure) {
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  // força www
  if (host !== CANON_HOST) {
    return res.redirect(301, `https://${CANON_HOST}${req.originalUrl}`);
  }
  next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());

// ── Sessão
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';
const isProd = process.env.NODE_ENV === 'production';

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

// ── Assets públicos ANTES do login
const ASSET_EXT = /\.(css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff2?|map)$/i;

// 1) rota dedicada para IMAGENS (garante /images/** sempre público, cache forte)
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), {
  setHeaders(res, filePath) {
    if (/\.(?:jpg|jpeg|png|webp|gif|svg)$/i.test(filePath)) {
      // Cache muito agressivo nas imagens estáticas (com immutable)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
  index: false,
}));

// 2) demais assets públicos por extensão (css/js/woff etc) com cache forte
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

// (opcional) desabilita cache para HTML (evita colar telas antigas)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ── Login (público)
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

// ── Protege o restante
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
app.use(requireAuth);

// ── Estáticos (depois de logado)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Páginas
app.get('/',        (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/games',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));
app.get('/map',     (_, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/calendar',(_, res) => res.sendFile(path.join(__dirname, 'public', 'calendar.html')));
app.get('/notes',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'notes.html')));
app.get('/links',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'links.html')));

// ── DATA
const DATA_DIR = process.env.DATA_DIR || '/opt/render/project/src/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const NOTES_FILE  = path.join(DATA_DIR, 'notes.json');
const MAP_FILE    = path.join(DATA_DIR, 'map.json');
for (const f of [EVENTS_FILE, NOTES_FILE, MAP_FILE]) if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');

const readJSON  = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ── APIs
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
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'missing text' });
  const notes = readJSON(NOTES_FILE);
  const note = { id: crypto.randomUUID(), text, ts: Date.now() };
  notes.unshift(note); writeJSON(NOTES_FILE, notes); res.json(note);
});
app.patch('/api/notes/:id', (req, res) => {
  const notes = readJSON(NOTES_FILE);
  const i = notes.findIndex(n => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  notes[i].text = req.body.text ?? notes[i].text;
  notes[i].ts   = Date.now();
  writeJSON(NOTES_FILE, notes); res.json(notes[i]);
});
app.delete('/api/notes/:id', (req, res) => {
  writeJSON(NOTES_FILE, readJSON(NOTES_FILE).filter(n => n.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/map/states', (_req, res) => res.json(readJSON(MAP_FILE)));
app.post('/api/map/states', (req, res) => {
  const { id, visited } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });
  const set = new Set(readJSON(MAP_FILE));
  visited ? set.add(id) : set.delete(id);
  const arr = [...set]; writeJSON(MAP_FILE, arr); res.json(arr);
});

// 404 → home (protegida)
app.use((_, res) => res.redirect('/'));

// start
app.listen(PORT, () => console.log(`✅ 24ever em https://${CANON_HOST}`));