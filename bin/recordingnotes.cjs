#!/usr/bin/env node

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function usage() {
  console.log(`
Recording Notes v${pkg.version} — Minimalist podcast note-taking system

Usage:
  recordingnotes start     Start the server (default)
  recordingnotes init-db   Initialize the database schema
  recordingnotes --help    Show this message
`);
}

const cmd = process.argv[2];

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'start') {
  // Ensure the DB exists before starting
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'dev.db');
  if (!fs.existsSync(dbPath)) {
    try {
      execSync('node init-db.js', { stdio: 'inherit' });
    } catch (e) {
      console.error('Failed to initialize database. Please check your DB_PATH.');
      process.exit(1);
    }
  }

  // Start the server
  const serverPath = path.join(__dirname, '..', 'server.js');
  if (cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(0);
  } else {
    execSync(`node ${serverPath}`, { stdio: 'inherit' });
  }
} else if (cmd === 'init-db') {
  const initDbPath = path.join(__dirname, '..', 'init-db.js');
  execSync(`node ${initDbPath}`, { stdio: 'inherit' });
} else {
  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exit(1);
}
