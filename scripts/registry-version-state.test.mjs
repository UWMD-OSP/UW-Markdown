import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registryVersionState } from './registry-version-state.mjs';
import { RELEASE_PACKAGES } from './release-packages.mjs';

const reply = (status, body) => async () => new Response(JSON.stringify(body), { status });
const pkg = '@uwmd/module-data-center';
const version = '0.1.9';

test('all six intended packages skip a confirmed existing version', async () => {
  assert.equal(RELEASE_PACKAGES.length, 6);
  for (const { name } of RELEASE_PACKAGES) {
    assert.equal(await registryVersionState(name, version, reply(200, { name, versions: { [version]: { name, version } } })), 'published');
  }
});

test('only a recognized public package 404 or an absent version in valid metadata allows publication', async () => {
  assert.equal(await registryVersionState(pkg, version, reply(404, { error: 'Not found' })), 'absent');
  assert.equal(await registryVersionState(pkg, version, reply(200, { name: pkg, versions: { '0.0.0-stage': { version: '0.0.0-stage' } } })), 'absent');
});

test('authentication, throttling and registry outages fail closed', async () => {
  for (const status of [401, 403, 429, 500, 502, 503]) {
    await assert.rejects(registryVersionState(pkg, version, reply(status, { error: 'failure' })), new RegExp(`HTTP ${status}`));
  }
});

test('malformed success and 404 responses fail closed', async () => {
  for (const body of [{}, { name: 'other', versions: {} }, { name: pkg, versions: [] }, { name: pkg, versions: { [version]: { version: '0.1.8' } } }]) {
    await assert.rejects(registryVersionState(pkg, version, reply(200, body)), /malformed/);
  }
  await assert.rejects(registryVersionState(pkg, version, reply(404, { error: 'Unauthorized' })), /unrecognized/);
  await assert.rejects(registryVersionState(pkg, version, async () => new Response('not json', { status: 200 })), SyntaxError);
});

test('DNS, timeout, and unexpected redirect failures never become absence', async () => {
  for (const message of ['DNS unavailable', 'request timed out', 'unexpected redirect']) {
    await assert.rejects(registryVersionState(pkg, version, async () => { throw new Error(message); }), new RegExp(message));
  }
});

test('probe targets the public canonical package endpoint without credentials or stale-cache preference', async () => {
  await registryVersionState(pkg, version, async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/%40uwmd%2Fmodule-data-center');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  });
  await assert.rejects(registryVersionState('@uwmd/excel', version), /outside official release scope/);
  await assert.rejects(registryVersionState(pkg, 'latest'), /Invalid package version/);
});
