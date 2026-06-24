#!/usr/bin/env node

'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function usage() {
  console.log(`
Recording Notes v${pkg.version} — Live timestamped note-taking system

Usage:
  recordingnotes start     Start the server (default)
  recordingnotes init-db   Initialize the database schema
  recordingnotes --help    Show this message
`);
}

const cmd = process.argv[2];

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'start') {
  // DB initialization is handled by server.js via getDb()
  if (cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(0);
  } else {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const child = spawn('node', [serverPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    // Forward shutdown signals to the child process
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, () => {
        child.kill(signal);
      });
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.exit(0); // Graceful shutdown via signal
      } else if (code !== 0) {
        process.exit(code);
      }
    });

    child.on('error', (err) => {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });
  }
} else if (cmd === 'init-db') {
  const initDbPath = path.join(__dirname, 'init-db.js');
  execSync(`node ${initDbPath}`, { stdio: 'inherit' });
} else {
  console.error(`Unknown command: ${cmd}`);
  usage();
}
