import { getPort, authIsRequired, getApiToken, wasApiTokenExplicitlySet, getExportTimezone, validateTimezone } from './middleware/config-accessors.js';
import { setupWebSocket } from './websocket/index.js';

export function startServer(app, sessionParser) {
  const desiredPort = getPort();

  // Validate export timezone at startup
  const exportTimezone = getExportTimezone();
  try {
    validateTimezone(exportTimezone);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    console.error('  Set RECNOTES_EXPORT_TIMEZONE to a valid IANA timezone name.');
    process.exit(1);
  }

  function startServerOnPort(port) {
    return new Promise((resolve, reject) => {
      const s = app.listen(port, () => resolve(s));
      s.on('error', (err) => reject(err));
    });
  }

  (async () => {
    let port = desiredPort;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const server = await startServerOnPort(port);
        console.log(`\n✓ Recording Notes running at http://localhost:${port}`);
        if (authIsRequired()) {
          console.log('  Auth mode: Login required (RECNOTES_AUTH_USERNAME & RECNOTES_AUTH_PASSWORD set)');
        } else {
          console.warn('  Warning: No authorization configured. Do not use this setup in untrusted environments. See .env.example for details.');
        }
        console.log(`  Export timezone: ${getExportTimezone()}`);
        const token = getApiToken();
        if (token) {
          if (wasApiTokenExplicitlySet()) {
            console.log(`  API token: ****${token.slice(-4)}`);
          } else {
            console.log(`  API token (auto-generated): ${token}`);
          }
        }
        // WebSocket setup (only after server is listening)
        setupWebSocket(server, sessionParser);

        // Store server reference for external access (e.g., tests)
        globalThis.__RECNOTES_SERVER_READY__ = true;

        break;
      } catch (err) {
        if (err.code === 'EADDRINUSE' && attempts < maxAttempts - 1) {
          console.warn(`  Port ${port} is in use, trying ${port + 1}...`);
          port++;
          attempts++;
        } else {
          console.error(`  Failed to start server on port ${port}: ${err.message}`);
          console.error('  Set RECNOTES_PORT to a different port and try again.');
          process.exit(1);
        }
      }
    }
  })();
}
