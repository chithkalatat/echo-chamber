import { createClient } from 'redis';

// Replace <password> with your actual Upstash Redis password
const client = createClient({ url: 'rediss://default:gQAAAAAAAq7bAAIgcDI5YjVkZjMzYzljMjQ0Njg4YjRmNzQ1ODk0YWE3MmQ3NA@stunning-oriole-175835.upstash.io:6379' });
client.on('error', (err) => console.error('Error:', err.message, err.code));

try {
  console.log('Connecting to Redis...');
  await client.connect();
  console.log('Connected successfully!');
  console.log('PING response:', await client.ping());
} catch (err) {
  console.error('Connection failed:', err.message);
} finally {
  await client.disconnect();
  console.log('Disconnected.');
}
