import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const REQUIRED_COLUMNS = ['content'];
const OPTIONAL_COLUMNS = ['poem_title', 'author', 'mood'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

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

function normalizeSupabaseUrl(value) {
  return value.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }

      row.push(field);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV has an unclosed quoted field');
  }

  return rows;
}

function poemsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) {
      throw new Error(`CSV is missing required column: ${column}`);
    }
  }

  return rows.slice(1).map((row) => {
    const poem = {};
    headers.forEach((header, index) => {
      if (ALL_COLUMNS.includes(header)) {
        const value = row[index]?.trim();
        poem[header] = value || null;
      }
    });
    return poem;
  });
}

function poemsFromJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error('JSON file must contain an array of poem objects');
  }

  return data.map((item) => {
    const poem = {};
    for (const column of ALL_COLUMNS) {
      poem[column] = typeof item[column] === 'string' && item[column].trim()
        ? item[column].trim()
        : null;
    }
    return poem;
  });
}

function uniquePoems(poems) {
  const seen = new Set();
  const result = [];

  for (const poem of poems) {
    if (!poem.content || !poem.content.trim()) {
      continue;
    }

    const normalizedContent = poem.content.replace(/\s+/g, '').trim();
    if (seen.has(normalizedContent)) {
      continue;
    }

    seen.add(normalizedContent);
    result.push({
      content: poem.content.trim(),
      poem_title: poem.poem_title || null,
      author: poem.author || null,
      mood: poem.mood || null,
    });
  }

  return result;
}

function readPoems(filePath) {
  const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const extension = extname(filePath).toLowerCase();

  if (extension === '.csv') {
    return uniquePoems(poemsFromCsv(text));
  }

  if (extension === '.json') {
    return uniquePoems(poemsFromJson(text));
  }

  throw new Error('Only .csv and .json files are supported');
}

async function importPoems(poems) {
  const rawSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!rawSupabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }

  const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
  const endpoint = `${supabaseUrl}/rest/v1/poems?on_conflict=content`;
  const batchSize = 50;

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

    console.log(`Imported batch ${Math.min(i + batchSize, poems.length)}/${poems.length}`);
  }
}

async function main() {
  loadDotenv();

  const filePath = process.argv.find((arg, index) => (
    index > 1 && !arg.startsWith('--')
  ));
  const isDryRun = process.argv.includes('--dry-run');

  if (!filePath) {
    throw new Error('Usage: npm run db:import -- path/to/poems.csv -- --dry-run');
  }

  const poems = readPoems(resolve(process.cwd(), filePath));
  console.log(`Prepared ${poems.length} unique poems from ${filePath}.`);

  if (poems.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  if (isDryRun) {
    console.log('Dry run only. First poems:');
    console.log(JSON.stringify(poems.slice(0, 5), null, 2));
    return;
  }

  await importPoems(poems);
  console.log('Import finished.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
