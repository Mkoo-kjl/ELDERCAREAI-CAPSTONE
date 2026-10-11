import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fileEnv = {};
try {
  const contents = readFileSync(resolve(root, '.env'), 'utf8');
  fileEnv = Object.fromEntries(contents.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    return match ? [match[1], match[2].replace(/^['"]|['"]$/g, '')] : [null, null];
  }).filter(([name]) => name));
} catch { /* CI may provide environment variables instead. */ }

const read = (name) => process.env[name] || fileEnv[name];
const url = read('EXPO_PUBLIC_SUPABASE_URL');
const key = read('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const email = read('ELDERCARE_ADMIN_EMAIL') || 'jaweplanos22+eldercareadmin@gmail.com';
if (!url || !key || !email) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}
if (!/^https:\/\/[^/]+\.supabase\.co$/.test(url) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error('Check the Supabase URL and admin email.');
}
writeFileSync(resolve(root, 'website/edcadmin/config.js'),
  `window.ELDERCARE_ADMIN_CONFIG = ${JSON.stringify({ url, publishableKey: key, adminEmail: email })};\n`, 'utf8');
console.log('Generated website/edcadmin/config.js with public project configuration.');
