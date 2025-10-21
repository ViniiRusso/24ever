// server.js — versão gratuita 24ever com JSONBin (persistente e sem disco)
import express from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import session from "express-session";
import helmet from "helmet";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JSONBIN_KEY = process.env.JSONBIN_KEY;

// JSONBin API setup
const BASE_URL = "https://api.jsonbin.io/v3/b";
const BINS = {
  notes: "NOTES_BIN_ID",
  map: "MAP_BIN_ID",
  events: "EVENTS_BIN_ID",
};

// Helper — cria bin automaticamente se não existir
async function ensureBin(type, initialValue = []) {
  if (BINS[type] && !BINS[type].startsWith("BIN_")) return;
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_KEY,
      "X-Bin-Private": "true",
    },
    body: JSON.stringify(initialValue),
  });
  const data = await res.json();
  BINS[type] = data.metadata.id;
  console.log(`✅ Criado bin para ${type}: ${BINS[type]}`);
}
await ensureBin("notes");
await ensureBin("map");
await ensureBin("events");

async function readBin(type) {
  const id = BINS[type];
  const res = await fetch(`${BASE_URL}/${id}/latest`, {
    headers: { "X-Master-Key": JSONBIN_KEY },
  });
  const data = await res.json();
  return data.record || [];
}

async function writeBin(type, data) {
  const id = BINS[type];
  await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_KEY,
    },
    body: JSON.stringify(data),
  });
}

// segurança e sessão
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  name: "s24",
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

// estáticos
app.use(express.static(path.join(__dirname, "public")));

// autenticação simples
const AUTH_FILE = path.join(__dirname, "auth.json");
let PASSWORD_HASH = null;
try {
  PASSWORD_HASH = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")).password_hash;
} catch {}

const APP_PASSWORD_PLAIN = process.env.APP_PASSWORD || null;
function requireAuth(req, res, next) {
  if (req.path.startsWith("/login") || req.path.startsWith("/auth")) return next();
  if (!req.session.userId) return res.redirect("/login");
  next();
}

app.get("/login", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/auth", async (req, res) => {
  const { password } = req.body || {};
  if (APP_PASSWORD_PLAIN && password === APP_PASSWORD_PLAIN) {
    req.session.userId = "u1";
    return res.redirect("/");
  }
  if (PASSWORD_HASH) {
    const ok = await bcrypt.compare(String(password || ""), PASSWORD_HASH);
    if (ok) { req.session.userId = "u1"; return res.redirect("/"); }
  }
  res.redirect("/login?e=1");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.use(requireAuth);

// páginas
const pages = ["index", "games", "calendar", "map", "notes", "links"];
pages.forEach(p =>
  app.get(p === "index" ? "/" : `/${p}`, (_, res) =>
    res.sendFile(path.join(__dirname, "public", `${p}.html`))
  )
);

// API — Notes
app.get("/api/notes", async (_, res) => res.json(await readBin("notes")));
app.post("/api/notes", async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "missing text" });
  const arr = await readBin("notes");
  const note = { id: crypto.randomUUID(), text, ts: Date.now() };
  arr.unshift(note);
  await writeBin("notes", arr);
  res.json(note);
});
app.patch("/api/notes/:id", async (req, res) => {
  const arr = await readBin("notes");
  const note = arr.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: "not found" });
  note.text = req.body.text || note.text;
  note.ts = Date.now();
  await writeBin("notes", arr);
  res.json(note);
});
app.delete("/api/notes/:id", async (req, res) => {
  let arr = await readBin("notes");
  arr = arr.filter(n => n.id !== req.params.id);
  await writeBin("notes", arr);
  res.json({ ok: true });
});

// API — Mapa
app.get("/api/map/states", async (_, res) => res.json(await readBin("map")));
app.post("/api/map/states", async (req, res) => {
  const { id, visited } = req.body || {};
  if (!id) return res.status(400).json({ error: "missing id" });
  let arr = await readBin("map");
  if (visited && !arr.includes(id)) arr.push(id);
  else arr = arr.filter(x => x !== id);
  await writeBin("map", arr);
  res.json(arr);
});

// API — Calendário
app.get("/api/events", async (_, res) => res.json(await readBin("events")));
app.post("/api/events", async (req, res) => {
  const { title, start, end, allDay } = req.body || {};
  if (!title || !start) return res.status(400).json({ error: "missing fields" });
  const arr = await readBin("events");
  const ev = { id: crypto.randomUUID(), title, start, end: end || null, allDay: !!allDay };
  arr.push(ev);
  await writeBin("events", arr);
  res.json(ev);
});
app.delete("/api/events/:id", async (req, res) => {
  let arr = await readBin("events");
  arr = arr.filter(e => e.id !== req.params.id);
  await writeBin("events", arr);
  res.json({ ok: true });
});

// 404
app.use((_, res) => res.status(404).send("Not found"));

app.listen(PORT, () =>
  console.log(`💖 24ever online — http://localhost:${PORT}`)
);