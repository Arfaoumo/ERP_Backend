const { spawn } = require('child_process');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const waitForOutput = (child, expected, timeoutMs = 30000) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for: ${expected}`)), timeoutMs);
  child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    if (output.includes(expected)) {
      clearTimeout(timeout);
      resolve();
    }
  });
  child.stderr.on('data', (data) => process.stderr.write(data));
  child.once('exit', (code) => {
    clearTimeout(timeout);
    reject(new Error(`Backend exited before startup completed (code ${code}).`));
  });
});

const run = async () => {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const port = 51234;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGODB_URI: replSet.getUri(),
      JWT_SECRET: 'startup-smoke-secret',
      NODE_ENV: 'test',
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForOutput(child, 'Server running');
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}.`);
    const body = await response.json();
    console.log(`Backend startup smoke passed: HTTP ${response.status} (${body.message})`);
  } finally {
    child.kill();
    await replSet.stop();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
