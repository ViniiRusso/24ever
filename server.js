// server.js — ESM + session + bcrypt + helmet + APIs (notes & map)
import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- segurança básica
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- sessão
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';
app.use(session({
  name: 's24',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}));

// ---------- estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ---------- auth
const AUTH_FILE = path.join(__dirname, 'auth.json');
let PASSWORD_HASH = null;
try {
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  PASSWORD_HASH = raw.password_hash || null;
} catch {}

const APP_PASSWORD_PLAIN = process.env.APP_PASSWORD || null;

function requireAuth(req, res, next) {
  const p = req.path;
  if (p.startsWith('/login') || p.startsWith('/auth')) return next();
  if (p.startsWith('/api') && !req.session.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!req.session.userId) {
    // se já está na home e sem sessão, manda pro login
    if (p === '/' || p === '/index.html') return res.redirect('/login');
    // para recursos estáticos o express.static já resolve
    // para páginas, redireciona
    if (!p.startsWith('/js') && !p.startsWith('/styles') && !p.startsWith('/media') && !p.startsWith('/images')) {
      return res.redirect('/login');
    }
  }
  next();
}

// ---------- rotas públicas de login
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

async function handleLogin(req, res) {
  const { password } = req.body || {};
  if (APP_PASSWORD_PLAIN && password === APP_PASSWORD_PLAIN) {
    req.session.userId = 'u1';
    return res.redirect('/');
  }
  if (PASSWORD_HASH) {
    const ok = await bcrypt.compare(String(password || ''), PASSWORD_HASH);
    if (ok) { req.session.userId = 'u1'; return res.redirect('/'); }
  }
  return res.redirect('/login?e=1');
}
app.post('/auth', handleLogin);
app.post('/login', handleLogin);

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('s24');
    res.redirect('/login');
  });
});

// ---------- tudo abaixo exige autenticação
app.use(requireAuth);

// ---------- páginas
app.get('/',        (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/games',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));
app.get('/links',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'links.html')));
app.get('/calendar',(_, res) => res.sendFile(path.join(__dirname, 'public', 'calendar.html')));
app.get('/map',     (_, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/notes',   (_, res) => res.sendFile(path.join(__dirname, 'public', 'notes.html')));

// ---------- DATA DIR
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- API calendário (JSON em disco)
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '[]');

function readJSON(file){ try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return []; } }
function writeJSON(file, data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }

app.get('/api/events', (_req, res) => res.json(readJSON(EVENTS_FILE)));
app.post('/api/events', (req, res) => {
  const { id, title, start, end, allDay } = req.body || {};
  if (!title || !start) return res.status(400).json({ error: 'missing fields' });
  const events = readJSON(EVENTS_FILE);
  const ev = {
    id: id || ((Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).slice(0, 24)),
    title, start, end: end || null, allDay: !!allDay
  };
  events.push(ev);
  writeJSON(EVENTS_FILE, events);
  res.json(ev);
});
app.delete('/api/events/:id', (req, res) => {
  const id = req.params.id;
  const events = readJSON(EVENTS_FILE).filter(e => e.id !== id);
  writeJSON(EVENTS_FILE, events);
  res.json({ ok: true });
});

// ---------- API NOTES (bloco de notas compartilhado)
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '[]');

app.get('/api/notes', (_req, res) => res.json(readJSON(NOTES_FILE)));
app.post('/api/notes', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'missing text' });
  const notes = readJSON(NOTES_FILE);
  const note = { id: (Math.random().toString(16).slice(2)).slice(0,12), text, ts: Date.now() };
  notes.unshift(note);
  writeJSON(NOTES_FILE, notes);
  res.json(note);
});
app.patch('/api/notes/:id', (req, res) => {
  const { id } = req.params; const { text } = req.body || {};
  let notes = readJSON(NOTES_FILE);
  const i = notes.findIndex(n => n.id === id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  notes[i].text = text ?? notes[i].text;
  notes[i].ts = Date.now();
  writeJSON(NOTES_FILE, notes);
  res.json(notes[i]);
});
app.delete('/api/notes/:id', (req, res) => {
  const { id } = req.params;
  let notes = readJSON(NOTES_FILE);
  notes = notes.filter(n => n.id !== id);
  writeJSON(NOTES_FILE, notes);
  res.json({ ok: true });
});

// ---------- API MAP (visitados por estado)
const MAP_FILE = path.join(DATA_DIR, 'map.json');
if (!fs.existsSync(MAP_FILE)) fs.writeFileSync(MAP_FILE, '[]'); // array de ids "BR-SP", "US-CA", ...

app.get('/api/map/states', (_req, res) => res.json(readJSON(MAP_FILE)));
app.post('/api/map/states', (req, res) => {
  const { id, visited } = req.body || {}; // id ex.: "BR-SP"
  if (!id) return res.status(400).json({ error: 'missing id' });
  let set = new Set(readJSON(MAP_FILE));
  if (visited) set.add(id); else set.delete(id);
  const arr = Array.from(set);
  writeJSON(MAP_FILE, arr);
  res.json(arr);
});

// ---------- 404
app.use((_, res) => res.status(404).send('Not found'));

app.listen(PORT, () => console.log(`24ever rodando em http://localhost:${PORT}`));