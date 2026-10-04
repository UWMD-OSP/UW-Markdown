// Anonymous public-registry reads only. No package creation or publication.
// stdout is published/absent; every network/auth/service/malformed response fails.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_PACKAGES } from './release-packages.mjs';

export async function registryVersionState(packageName, version, fetchRegistry = fetch) {
  if (!RELEASE_PACKAGES.some((pkg) => pkg.name === packageName)) {
    throw new Error(`Package outside official release scope: ${packageName}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid package version: ${version}`);
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const response = await fetchRegistry(url, {
    headers: { Accept: 'application/vnd.npm.install-v1+json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 200 && response.status !== 404) {
    throw new Error(`${packageName}: registry HTTP ${response.status}; publication stopped`);
  }
  const metadata = await response.json();
  if (response.status === 404) {
    if (metadata?.error !== 'Not found') throw new Error(`${packageName}: unrecognized registry 404 response`);
    return 'absent';
  }
  if (metadata?.name !== packageName || !metadata.versions || typeof metadata.versions !== 'object' || Array.isArray(metadata.versions)) {
    throw new Error(`${packageName}: malformed registry package metadata`);
  }
  if (!Object.hasOwn(metadata.versions, version)) return 'absent';
  const published = metadata.versions[version];
  if (published?.version !== version || (published.name !== undefined && published.name !== packageName)) {
    throw new Error(`${packageName}@${version}: malformed registry version metadata`);
  }
  return 'published';
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/registry-version-state.mjs <package> <version>');
    console.log(await registryVersionState(process.argv[2], process.argv[3]));
  } catch (error) {
    console.error(`[FAIL] Registry version probe: ${error.message}`);
    process.exitCode = 1;
  }
}
