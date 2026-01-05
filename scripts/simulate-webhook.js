const http = require('http');

const PORT = 3000;
const PATH = '/api/webhooks/squadcast';

const events = {
  created: {
    "name": "recording_session.created",
    "sessionID": "sq_session_999",
    "sessionTitle": "Simulation Session",
    "orgID": "org_sim",
    "showID": "show_sim",
    "showName": "Simulation Show"
  },
  started: {
    "name": "recording.started",
    "sessionID": "sq_session_999",
    "sessionTitle": "Simulation Session",
    "orgID": "org_sim"
  },
  stopped: {
    "name": "recording.stopped",
    "sessionID": "sq_session_999",
    "sessionTitle": "Simulation Session",
    "orgID": "org_sim"
  }
};

function sendWebhook(type) {
  const payload = events[type];
  if (!payload) {
    console.error('Unknown event type:', type);
    process.exit(1);
  }

  const data = JSON.stringify(payload);
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Event: ${type}`);
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => {
      process.stdout.write(d);
    });
    res.on('end', () => {
      console.log('\n---');
    });
  });

  req.on('error', (error) => {
    console.error('Error sending webhook:', error);
  });

  req.write(data);
  req.end();
}

const type = process.argv[2];
if (!type) {
  console.log('Usage: node simulate-webhook.js <created|started|stopped>');
  process.exit(0);
}

sendWebhook(type);
