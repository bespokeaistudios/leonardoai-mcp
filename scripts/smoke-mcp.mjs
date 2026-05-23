#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

const expectedTools = new Set([
  'generate_image',
  'get_generation',
  'wait_for_generation',
  'generate_image_and_wait',
  'list_models',
  'download_image',
  'download_generation_images',
]);

const child = spawn(process.execPath, ['dist/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, LEONARDO_AI_API: 'dummy-smoke-key' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

const rl = createInterface({ input: child.stdout });
const pending = new Map();
rl.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    child.kill();
    throw new Error(`Invalid JSON-RPC line from MCP server: ${line}`);
  }
  if (message.id !== undefined && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
  const promise = new Promise((resolve) => pending.set(id, resolve));
  child.stdin.write(`${JSON.stringify(payload)}\n`);
  return promise;
}

function notify(method, params) {
  const payload = { jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) };
  child.stdin.write(`${JSON.stringify(payload)}\n`);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

try {
  const init = await withTimeout(
    send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'leonardo-mcp-smoke', version: '0.1.0' },
    }),
    5000,
    'initialize',
  );
  if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
  notify('notifications/initialized');

  const listed = await withTimeout(send('tools/list'), 5000, 'tools/list');
  if (listed.error) throw new Error(`tools/list failed: ${JSON.stringify(listed.error)}`);
  const names = new Set((listed.result?.tools ?? []).map((tool) => tool.name));
  const missing = [...expectedTools].filter((name) => !names.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing expected tools: ${missing.join(', ')}. Found: ${[...names].sort().join(', ')}`);
  }
  console.log(`MCP smoke test passed. Tools: ${[...names].sort().join(', ')}`);
} finally {
  child.stdin.end();
  child.kill();
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1000))]);
}

if (stderr.trim()) {
  console.error(stderr.trim());
}
