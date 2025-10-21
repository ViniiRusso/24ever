// server.js — ESM + session + bcrypt + helmet + APIs (notes & map)
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

// __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- segurança básica
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());

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
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
  }
}));

// ---------- estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ---------- autenticação
const AUTH_FILE = path.join(__dirname, 'auth.json');
let PASSWORD_HASH = null;
try {
  const raw = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  PASSWORD_HASH = raw.password_hash || null;
} catch { }

const APP_PASSWORD_PLAIN = process.env.APP_PASSWORD || null;

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    // se não estiver logado e não for rota pública, redireciona
    if (!req.path.startsWith('/login') && !req.path.startsWith('/auth')) {
      return res.redirect('/login');
    }
  }
  next();
}

// ---------- rotas públicas
app.get('/login', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/auth', async (req, res) => {
  const { password } = req.body || {};
  if (APP_PASSWORD_PLAIN && password === APP_PASSWORD_PLAIN) {
    req.session.userId = 'u1';
    return res.redirect('/');
  }
  if (PASSWORD_HASH && await bcrypt.compare(String(password || ''), PASSWORD_HASH)) {
    req.session.userId = 'u1';
    return res.redirect('/');
  }
  return res.redirect('/login?e=1');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('s24');
    res.redirect('/login');
  });
});

// ---------- autenticação obrigatória
app.use(requireAuth);

// ---------- Páginas protegidas
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/games', (_, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));
app.get('/map', (_, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/calendar', (_, res) => res.sendFile(path.join(__dirname, 'public', 'calendar.html')));
app.get('/notes', (_, res) => res.sendFile(path.join(__dirname, 'public', 'notes.html')));
app.get('/links', (_, res) => res.sendFile(path.join(__dirname, 'public', 'links.html')));

// ---------- DATA persistente (Render Disk)
const DATA_DIR = process.env.DATA_DIR || '/opt/render/project/src/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const MAP_FILE = path.join(DATA_DIR, 'map.json');

for (const f of [EVENTS_FILE, NOTES_FILE, MAP_FILE]) {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
}

// ---------- APIs
// calendário
app.get('/api/events', (_, res) => res.json(readJSON(EVENTS_FILE)));
app.post('/api/events', (req, res) => {
  const { id, title, start, end, allDay } = req.body || {};
  if (!title || !start) return res.status(400).json({ error: 'missing fields' });
  const events = readJSON(EVENTS_FILE);
  const ev = { id: id || crypto.randomUUID(), title, start, end, allDay: !!allDay };
  events.push(ev);
  writeJSON(EVENTS_FILE, events);
  res.json(ev);
});
app.delete('/api/events/:id', (req, res) => {
  const events = readJSON(EVENTS_FILE).filter(e => e.id !== req.params.id);
  writeJSON(EVENTS_FILE, events);
  res.json({ ok: true });
});

// notas
app.get('/api/notes', (_, res) => res.json(readJSON(NOTES_FILE)));
app.post('/api/notes', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'missing text' });
  const notes = readJSON(NOTES_FILE);
  const note = { id: crypto.randomUUID(), text, ts: Date.now() };
  notes.unshift(note);
  writeJSON(NOTES_FILE, notes);
  res.json(note);
});
app.patch('/api/notes/:id', (req, res) => {
  const notes = readJSON(NOTES_FILE);
  const i = notes.findIndex(n => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'not found' });
  notes[i].text = req.body.text || notes[i].text;
  notes[i].ts = Date.now();
  writeJSON(NOTES_FILE, notes);
  res.json(notes[i]);
});
app.delete('/api/notes/:id', (req, res) => {
  const notes = readJSON(NOTES_FILE).filter(n => n.id !== req.params.id);
  writeJSON(NOTES_FILE, notes);
  res.json({ ok: true });
});

// mapa
app.get('/api/map/states', (_, res) => res.json(readJSON(MAP_FILE)));
app.post('/api/map/states', (req, res) => {
  const { id, visited } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });
  const states = new Set(readJSON(MAP_FILE));
  visited ? states.add(id) : states.delete(id);
  writeJSON(MAP_FILE, Array.from(states));
  res.json(Array.from(states));
});

// ---------- 404
app.use((_, res) => res.redirect('/login'));

app.listen(PORT, () => console.log(`✅ 24ever rodando em http://localhost:${PORT}`));