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

function parseCopyValue(value) {
  if (value === '\\N') {
    return null;
  }

  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

function parsePoemsFromBackup(backupPath) {
  const text = readFileSync(backupPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const copyHeader = /^COPY public\.poems \(([^)]+)\) FROM stdin;$/;
  const poems = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(copyHeader);
    if (!match) {
      continue;
    }

    const columns = match[1].split(',').map((column) => column.trim());
    for (let rowIndex = i + 1; rowIndex < lines.length; rowIndex++) {
      const line = lines[rowIndex];
      if (line === '\\.') {
        return poems;
      }

      if (!line) {
        continue;
      }

      const values = line.split('\t').map(parseCopyValue);
      const row = Object.fromEntries(
        columns.map((column, columnIndex) => [column, values[columnIndex] ?? null])
      );

      if (row.content) {
        poems.push({
          id: row.id,
          content: row.content,
          poem_title: row.poem_title,
          author: row.author,
          mood: row.mood,
          created_at: row.created_at,
        });
      }
    }
  }

  throw new Error('Could not find COPY public.poems data in backup');
}

async function supabaseInsert(poems) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/poems?on_conflict=content`;
  const batchSize = 50;
  let imported = 0;

  for (let i = 0; i < poems.length; i += batchSize) {
    const batch = poems.slice(i, i + batchSize);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Import failed at row ${i + 1}: HTTP ${response.status}\n${text}`);
    }

    imported += batch.length;
    console.log(`Imported batch ${Math.min(i + batchSize, poems.length)}/${poems.length}`);
  }

  return imported;
}

async function main() {
  loadDotenv();

  const backupPath = process.argv[2];
  if (!backupPath) {
    throw new Error('Usage: npm run db:import-poems -- /path/to/db.backup');
  }

  const poems = parsePoemsFromBackup(backupPath);
  console.log(`Found ${poems.length} poems in backup.`);

  if (process.argv.includes('--dry-run')) {
    console.log('Dry run only. No data was imported.');
    return;
  }

  const imported = await supabaseInsert(poems);
  console.log(`Import finished. Submitted ${imported} poems.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
