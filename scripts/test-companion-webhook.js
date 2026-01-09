/**
 * This script simulates Bitfocus Companion interacting with the Recording Notes webhook.
 * Usage: node scripts/test-companion-webhook.js [baseURL]
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';

async function test() {
  console.log(`Testing Companion Webhook at ${baseUrl}...`);

  try {
    // 1. Create Session
    console.log('\n--- 1. Create Session ---');
    const createRes = await fetch(`${baseUrl}/api/webhooks/companion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Companion Lifecycle Test' })
    });
    const createData = await createRes.json();
    console.log('Response:', createData);
    const sessionId = createData.id;

    if (!sessionId) throw new Error('Failed to get session ID');

    // 2. Start Session
    console.log('\n--- 2. Start Session ---');
    const startRes = await fetch(`${baseUrl}/api/webhooks/companion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id: sessionId })
    });
    const startData = await startRes.json();
    console.log('Response:', startData);

    // 3. Stop Session
    console.log('\n--- 3. Stop Session ---');
    const stopRes = await fetch(`${baseUrl}/api/webhooks/companion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id: sessionId })
    });
    const stopData = await stopRes.json();
    console.log('Response:', stopData);

    console.log('\nFull lifecycle test completed successfully!');
  } catch (error) {
    console.error('Test Failed:', error.message);
    process.exit(1);
  }
}

test();
