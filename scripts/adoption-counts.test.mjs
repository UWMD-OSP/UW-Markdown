import assert from 'node:assert/strict';
import test from 'node:test';
import { collectAdoption } from './adoption-counts.mjs';

const response = value => new Response(JSON.stringify(value));
test('requests only anonymous aggregate endpoints and retains only counts', async () => {
  const urls = [];
  const report = await collectAdoption(async (url, options) => {
    urls.push(url);
    assert.deepEqual(options.headers, { Accept: 'application/json', 'User-Agent': 'UWMD-aggregate-counts/1.0' });
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    if (url.startsWith('https://api.npmjs.org/')) return response({ downloads: 17, start: '2026-09-01', end: '2026-09-30', package: url.slice(url.indexOf('@uwmd/')) });
    assert.ok(url.startsWith('https://img.shields.io/github/'));
    if (url.includes('issues-search')) assert.ok(url.includes('/UWMD-OSP/UW-Markdown.json?query='));
    return response({ message: '3', label: 'aggregate' });
  });
  assert.equal(urls.length, 11); assert.equal(report.npm_downloads[0].downloads, 17);
  assert.equal(report.forks.count, 3); assert.equal(report.issues_excluding_publisher_account.count, 3);
  assert.equal(report.directory_installs.count, null); assert.equal(report.outside_issues.count, null);
});
test('unavailable, rounded, negative and oversized aggregates never become zero', async () => {
  for (const message of ['1.2k', '-1', 'unknown']) {
    const report = await collectAdoption(async () => response({ message }));
    assert.equal(report.forks.count, null); assert.equal(report.npm_downloads[0].downloads, null);
  }
  const oversized = await collectAdoption(async () => new Response('x'.repeat(8193)));
  assert.equal(oversized.forks.reason, 'aggregate_too_large');
  const failed = await collectAdoption(async () => { throw new Error('synthetic failure'); });
  assert.equal(failed.issues_excluding_publisher_account.reason, 'aggregate_unavailable');
  assert.ok(!JSON.stringify(failed).includes('synthetic failure'));
});


test('includes the released lake package and preserves a valid zero aggregate', async () => {
  const requested = [];
  const report = await collectAdoption(async (url) => {
    requested.push(url);
    if (url === 'https://api.npmjs.org/downloads/point/last-month/@uwmd/lake') {
      return response({ downloads: 0, start: '2026-09-01', end: '2026-09-30', package: '@uwmd/lake' });
    }
    return new Response('', { status: 404 });
  });
  assert.equal(requested.filter(url => url.endsWith('/@uwmd/lake')).length, 1);
  assert.equal(report.npm_downloads.find(row => row.package === '@uwmd/lake').downloads, 0);
  assert.equal(report.npm_downloads.find(row => row.package === '@uwmd/mcp').downloads, null);
  assert.equal(report.outside_issues.count, null);
  assert.equal(report.directory_installs.count, null);
});
