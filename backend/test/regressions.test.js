import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import app from '../src/index.js';
import pool from '../src/db/pool.js';
import { createToken } from '../src/middleware/authenticate.js';

let server;
let base;
let user;
let ownerId;
let writes;
const originalQuery = pool.query;
const originalSecret = process.env.JWT_SECRET;

before(async () => {
  process.env.JWT_SECRET = 'local-regression-test-secret';
  pool.query = async (sql) => {
    if (sql.includes('FROM users')) return { rows: user ? [user] : [] };
    if (sql.includes('SELECT created_by')) return { rows: [{ created_by: ownerId }] };
    if (/DELETE|UPDATE/.test(sql)) writes++;
    return { rows: [{ id: 1 }] };
  };
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  user = { id: 1, role: 'PROFESSOR', is_active: true };
  ownerId = 2;
  writes = 0;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  pool.query = originalQuery;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function request(path, options = {}, tokenUser = { id: 1, role: 'PROFESSOR' }) {
  return fetch(base + path, {
    ...options,
    headers: { Authorization: `Bearer ${createToken(tokenUser)}`, ...options.headers },
  });
}

test('root and authenticated health routes are reachable', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/unknown')).status, 404);
});

for (const path of ['/api/workshops/1', '/api/WORKSHOPS/1', '/api/workshops/%31']) {
  test(`non-owner cannot delete via ${path}`, async () => {
    assert.equal((await request(path, { method: 'DELETE' })).status, 403);
    assert.equal(writes, 0);
  });
}

test('owner and current administrator can delete records', async () => {
  ownerId = 1;
  assert.equal((await request('/api/workshops/%31', { method: 'DELETE' })).status, 204);
  ownerId = 2;
  user.role = 'ADMIN';
  assert.equal((await request('/api/workshops/1', { method: 'DELETE' }, user)).status, 204);
  assert.equal(writes, 2);
});

for (const state of ['inactive', 'deleted']) {
  test(`${state} users cannot continue using an existing token`, async () => {
    user = state === 'deleted' ? null : { ...user, is_active: false };
    assert.equal((await request('/api/health')).status, 401);
  });
}

test('a demoted administrator cannot use the old administrator token', async () => {
  assert.equal((await request('/api/workshops/1', { method: 'DELETE' }, { id: 1, role: 'ADMIN' })).status, 403);
  assert.equal(writes, 0);
});
