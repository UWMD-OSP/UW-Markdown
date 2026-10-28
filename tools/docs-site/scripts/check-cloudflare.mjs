#!/usr/bin/env node
// Run against `wrangler dev --local`, not VitePress preview: this checks the host.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8787');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use a local Wrangler server');
const checks = [];
async function request(path, method = 'GET') {
  const response = await fetch(new URL(path, origin), { method, signal: AbortSignal.timeout(10000) });
  checks.push({ method, path, status: response.status, finalPath: new URL(response.url).pathname });
  return response;
}

// Allow the local asset server to start. HTTP failures after startup are findings.
const deadline = Date.now() + 120000;
for (;;) {
  try {
    const ready = await fetch(origin, { signal: AbortSignal.timeout(1000) });
    await ready.body?.cancel();
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

for (const path of ['/', '/spec/format', '/conformance/', '/editor/', '/viewer/app/']) {
  for (const method of ['GET', 'HEAD']) {
    const response = await request(path, method);
    assert.equal(response.status, 200, `${method} ${path}`);
    assert.match(response.headers.get('content-type'), /^text\/html\b/);
    if (method === 'GET') assert.match(await response.text(), /<!doctype html>/i);
    else assert.equal(await response.text(), '');
  }
}
for (const path of ['/__uwmd_missing__/', '/spec/__uwmd_missing__', '/assets/__uwmd_missing__.js', '/_headers']) {
  for (const method of ['GET', 'HEAD']) {
    const response = await request(path, method);
    assert.equal(response.status, 404, `${method} ${path} must not fall back to the homepage`);
    if (method === 'GET') assert.match(await response.text(), /404/);
    else assert.equal(await response.text(), '');
  }
}
for (const path of ['/llms.txt', '/llms-full.txt']) {
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, s-maxage=3600');
  assert.match(await response.text(), /UW Markdown/);
}
for (const name of ['blank-screener.uw.md', 'blank-analyst.uw.md', 'blank-screener.uwx.md', 'blank-analyst.uwx.md']) {
  const response = await request(`/downloads/templates/${name}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${name}"`);
  assert.match(await response.text(), /uw_version:/);
}
for (const [path, type] of [['/favicon.svg', /^image\/svg\+xml\b/], ['/schemas/uw-document-envelope.xsd', /^(application|text)\/xml\b/], ['/spec/metrics/builtin.json', /^application\/json\b/]]) {
  const response = await request(path);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), type);
  await response.body?.cancel();
}
for (const [path, source] of [
  ['/spec/format', 'spec/UW_FORMAT_SPEC.md'],
  ['/guide/glossary', 'docs/GLOSSARY.md'],
  ['/about/versions', 'VERSIONS.md'],
  ['/about/rfcs/template', 'docs/rfcs/0000-template.md'],
  ['/tutorials/quickstart', 'tools/docs-site/tutorials/quickstart.md'],
  ['/ai/', 'tools/docs-site/ai/index.md'],
]) {
  const response = await request(path);
  assert.equal(response.status, 200);
  const href = `https://github.com/UWMD-OSP/UW-Markdown/edit/main/${source}`;
  assert.ok((await response.text()).includes(`href="${href}"`), `${path}: edit link must target ${source}`);
}
const dist = fileURLToPath(new URL('../.vitepress/dist/', import.meta.url));
const sitemap = await request('/sitemap.xml');
assert.equal(sitemap.status, 200, 'The sitemap must be a real asset, not the 404 page');
assert.match(sitemap.headers.get('content-type'), /^(application|text)\/xml\b/);
const sitemapText = await sitemap.text();
assert.match(sitemapText, /<loc>https:\/\/www\.uwmd\.org\//);
assert.doesNotMatch(sitemapText, /<loc>[^<]*\/404(?:\.html)?<\/loc>/);
const schemas = new URL('../../../spec/schemas/', import.meta.url);
for (const name of (await readdir(schemas)).filter(name => name.endsWith('.json') || name.endsWith('.xsd'))) {
  const response = await request(`/schemas/${name}`);
  assert.equal(response.status, 200, `Schema download: ${name}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(name, schemas)), `Schema bytes: ${name}`);
}
for (const [folder, extension, type] of [['assets', '.js', /^(application|text)\/javascript\b/], ['assets', '.css', /^text\/css\b/], ['editor/assets', '.js', /^(application|text)\/javascript\b/]]) {
  const name = (await readdir(`${dist}/${folder}`)).find(file => file.endsWith(extension));
  assert.ok(name, `${folder}: missing built ${extension}`);
  const response = await request(`/${folder}/${name}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), type);
  await response.body?.cancel();
}
console.log(JSON.stringify({ server: origin.origin, checks: checks.length, results: checks }, null, 2));
