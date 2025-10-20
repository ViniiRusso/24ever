// scripts/set-password.mjs
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const pwd = process.argv[2];
  if (!pwd) {
    console.error('Uso: npm run set:password <SENHA>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(pwd, 12);
  const file = path.join(__dirname, '..', 'auth.json');
  fs.writeFileSync(file, JSON.stringify({ password_hash: hash }, null, 2));
  console.log('Senha atualizada em auth.json');
}
run();