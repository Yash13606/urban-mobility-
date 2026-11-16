#!/usr/bin/env node

/**
 * scripts/setup.mjs
 * Cross-platform interactive configuration script (macOS, Linux, Windows).
 * Creates or updates the local .env configuration file safely.
 */

import { createInterface } from 'node:readline';
import { promises as fs } from 'node:fs';
import { resolve, join } from 'node:path';

const repoRoot = resolve(process.cwd());
const envPath = join(repoRoot, '.env');
const defaultDatasetPath = 'data/raw/bangalore_traffic_timely_data.csv';

function askPassword(prompt, iterator) {
  if (!process.stdin.isTTY) {
    process.stdout.write(prompt);
    return iterator.next().then((n) => (n.done ? '' : n.value.trim()));
  }

  return new Promise((resolvePrompt) => {
    process.stdout.write(prompt);
    let pass = '';
    const onData = (chunk) => {
      const s = chunk.toString('utf-8');
      for (const char of s) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolvePrompt(pass);
          return;
        } else if (char === '\u0003') {
          process.exit(1);
        } else if (char === '\u0008' || char === '\x7f') {
          if (pass.length > 0) {
            pass = pass.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          pass += char;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n=== Urban Mobility Local Configuration ===');
  console.log('Cross-platform setup for macOS, Linux, and Windows.');
  console.log('Your credentials will be saved ONLY in the local .env file (ignored by Git).\n');

  try {
    await fs.access(envPath);
    console.log('Notice: A .env file already exists. Running this will update it.\n');
  } catch {
    // Fresh setup
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const iterator = rl[Symbol.asyncIterator]();

  async function ask(query, defaultValue) {
    process.stdout.write(`${query} [${defaultValue}]: `);
    const next = await iterator.next();
    if (next.done) return defaultValue;
    const val = next.value.trim();
    return val || defaultValue;
  }

  try {
    const host = await ask('MySQL Host', '127.0.0.1');
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/.test(host)) {
      throw new Error(`Invalid host: ${host}`);
    }

    const portStr = await ask('MySQL Port', '3306');
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${portStr} (must be between 1 and 65535)`);
    }

    const user = await ask('MySQL User', 'root');
    const dbName = await ask('MySQL Database', 'urban_mobility');
    const datasetCsv = await ask('Dataset CSV Path', defaultDatasetPath);

    const password = await askPassword('MySQL Password (hidden): ', iterator);

    rl.close();

    // Validate no newlines in any variable
    for (const [k, v] of Object.entries({ host, port: String(port), user, dbName, datasetCsv, password })) {
      if (/[\r\n]/.test(v)) {
        throw new Error(`Connection value for ${k} cannot contain newlines.`);
      }
    }

    const envContent = [
      `MYSQL_HOST=${JSON.stringify(host)}`,
      `MYSQL_PORT=${port}`,
      `MYSQL_USER=${JSON.stringify(user)}`,
      `MYSQL_PASSWORD=${JSON.stringify(password)}`,
      `MYSQL_DATABASE=${JSON.stringify(dbName)}`,
      'LOG_LEVEL="debug"',
      `DATASET_CSV=${JSON.stringify(datasetCsv)}`,
    ].join('\n') + '\n';

    await fs.writeFile(envPath, envContent, { encoding: 'utf8', mode: 0o600 });

    console.log('\n[SUCCESS] Configuration written to .env successfully!');
    console.log('\nNext steps to initialize your project:');
    console.log('  1. npm run db:setup        # Create database, tables, views, and procedures');
    console.log('  2. npm run data:import     # Validate and import CSV dataset');
    console.log('  3. npm run verify:database # Run database health verification');
    console.log('  4. npm run dev             # Start development server on http://127.0.0.1:3000\n');
  } catch (err) {
    rl.close();
    console.error('\n[ERROR]', err.message);
    process.exit(1);
  }
}

main();
