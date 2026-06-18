import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotenv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  return fetch(`${supabaseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
}

async function main() {
  loadDotenv();

  const shouldWrite = process.argv.includes('--write');

  console.log('Checking Supabase connection...');

  const readResponse = await supabaseRequest('/rest/v1/poems?select=id,content&limit=1');
  const readText = await readResponse.text();

  if (!readResponse.ok) {
    console.error(`Read check failed: HTTP ${readResponse.status}`);
    console.error(readText);
    process.exit(1);
  }

  console.log('Read check passed.');

  if (!shouldWrite) {
    console.log('Write check skipped. Run `npm run db:check -- --write` to test insert policy.');
    return;
  }

  const marker = `BlindPoem database check ${new Date().toISOString()}`;
  const insertResponse = await supabaseRequest('/rest/v1/poems', {
    method: 'POST',
    body: JSON.stringify({
      content: marker,
      poem_title: 'Database Check',
      author: 'BlindPoem',
      mood: 'health-check',
    }),
  });
  const insertText = await insertResponse.text();

  if (!insertResponse.ok && insertResponse.status !== 409) {
    console.error(`Write check failed: HTTP ${insertResponse.status}`);
    console.error(insertText);
    process.exit(1);
  }

  console.log(insertResponse.status === 409 ? 'Write check skipped duplicate row.' : 'Write check passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
