import { pathToFileURL } from 'node:url';

const PACKAGES = ['verify', 'core', 'cli', 'excel', 'signing', 'batch', 'report', 'mcp'];
const REPO = 'UWMD-OSP/UW-Markdown';
const HEADERS = Object.freeze({ Accept: 'application/json', 'User-Agent': 'UWMD-aggregate-counts/1.0' });
const LIMIT = 8192;

async function aggregate(url, fetcher) {
  try {
    const response = await fetcher(url, { headers: HEADERS, redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { value: null, reason: `http_${response.status}` };
    const reader = response.body.getReader();
    const chunks = []; let length = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > LIMIT) { await reader.cancel(); return { value: null, reason: 'aggregate_too_large' }; }
      chunks.push(value);
    }
    return { value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch { return { value: null, reason: 'aggregate_unavailable' }; }
}

function badgeCount(data) {
  // Do not silently turn compact/rounded badge values into exact counts.
  if (data?.isError || !/^\d+$/.test(data?.message ?? '')) return null;
  const count = Number(data.message);
  return Number.isSafeInteger(count) ? count : null;
}

export async function collectAdoption(fetcher = fetch) {
  const downloads = await Promise.all(PACKAGES.map(async name => {
    const source = `https://api.npmjs.org/downloads/point/last-month/@uwmd/${name}`;
    const result = await aggregate(source, fetcher); const data = result.value;
    const valid = Number.isSafeInteger(data?.downloads) && data.downloads >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(data.start ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(data.end ?? '') && data.package === `@uwmd/${name}`;
    return { package: `@uwmd/${name}`, downloads: valid ? data.downloads : null, start: valid ? data.start : null, end: valid ? data.end : null, source, ...(valid ? {} : { reason: result.reason ?? 'invalid_aggregate' }) };
  }));
  const query = `repo:${REPO} is:issue -author:UWMD-OSP`;
  const sources = { forks: `https://img.shields.io/github/forks/${REPO}.json`, outside_issues: `https://img.shields.io/github/issues-search.json?query=${encodeURIComponent(query)}` };
  const badges = await Promise.all(Object.entries(sources).map(async ([key, source]) => {
    const result = await aggregate(source, fetcher); const count = badgeCount(result.value);
    return [key, { count, source, ...(count === null ? { reason: result.reason ?? 'count_unavailable_or_compact' } : {}) }];
  }));
  return { schema_version: 1, npm_downloads: downloads, ...Object.fromEntries(badges), directory_installs: { count: null, reason: 'no_documented_public_aggregate_endpoint' }, limitations: ['Downloads include CI and maintainer activity; they are not unique users.', 'Fork totals do not prove independent use.', 'Outside issues means issues excluding the public UWMD-OSP account, including closed issues; bots and other maintainer accounts may remain. No author identities or issue records are requested.', 'Badges can be cached; compact values and errors remain unknown.', 'No authentication, cookies, contact headers, user lists or private analytics.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(await collectAdoption(), null, 2)}\n`);
}
