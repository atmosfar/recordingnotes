import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  ws.send(JSON.stringify({ type: 'CREATE_SESSION', name: 'Automated WS Test' }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  if (message.type === 'SESSION_CREATED' && message.id) {
    console.log('SUCCESS: Received SESSION_CREATED with ID:', message.id);
    process.exit(0);
  } else if (message.type === 'SESSION_LIST_UPDATE') {
    console.log('Received list update (expected)');
  }
});

setTimeout(() => {
  console.error('TIMEOUT: Did not receive SESSION_CREATED event');
  process.exit(1);
}, 5000);