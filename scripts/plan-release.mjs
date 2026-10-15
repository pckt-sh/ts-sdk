#!/usr/bin/env node
// Decides whether (and at which version) the freshly generated SDK should be published.
//
// Usage: node scripts/plan-release.mjs <previous-spec-path> <notes-output-path>
//
// Run after the new spec has been copied to openapi/openapi.json and `npm run generate`
// has rewritten src/client. Compares the working tree against HEAD:
//   - nothing published yet on npm         -> publish package.json version as-is
//   - package.json bumped by hand above npm -> publish package.json version as-is
//   - no changes in openapi/ or src/client/ -> skip
//   - breaking spec change (oasdiff)        -> major
//   - any other spec change                 -> minor
//   - generated code changed, spec did not  -> patch (e.g. @hey-api/openapi-ts upgrade)
//
// Writes the chosen version into package.json / package-lock.json and emits
// `publish`, `version` and `level` to $GITHUB_OUTPUT (or stdout locally).

import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const [baseSpec, notesPath] = process.argv.slice(2);
const newSpec = 'openapi/openapi.json';
const oasdiff = process.env.OASDIFF_BIN ?? 'oasdiff';

const output = (key, value) => {
  const line = `${key}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
};

const parse = (v) => v.split('-')[0].split('.').map(Number);
const gt = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
const inc = (v, level) => {
  const [major, minor, patch] = parse(v);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const latestPublished = () => {
  const res = spawnSync('npm', ['view', pkg.name, 'version'], { encoding: 'utf8' });
  if (res.status === 0) return res.stdout.trim() || null;
  if (/E404|404 Not Found/.test(res.stderr)) return null;
  throw new Error(`npm view ${pkg.name} failed:\n${res.stderr}`);
};

const oasdiffRun = (...args) =>
  spawnSync(oasdiff, [...args, baseSpec, newSpec], { encoding: 'utf8' });

const latest = latestPublished();
const changed =
  execFileSync('git', ['status', '--porcelain', '--', 'openapi', 'src/client'], {
    encoding: 'utf8',
  }).trim() !== '';
const hasBase = baseSpec && existsSync(baseSpec);
const specChanged = !hasBase || readFileSync(baseSpec, 'utf8') !== readFileSync(newSpec, 'utf8');

let level;
let version;
if (latest === null) {
  level = 'initial';
  version = pkg.version;
} else if (gt(pkg.version, latest)) {
  level = 'manual';
  version = pkg.version;
} else if (!changed) {
  console.error(`No changes in generated SDK; ${pkg.name}@${latest} is up to date.`);
  output('publish', 'false');
  process.exit(0);
} else if (!specChanged) {
  level = 'patch';
} else if (!hasBase) {
  level = 'minor';
} else {
  const res = oasdiffRun('breaking', '--fail-on', 'ERR');
  console.error(res.stdout + res.stderr);
  if (res.status === 0) level = 'minor';
  else if (res.status === 1) level = 'major';
  else throw new Error(`oasdiff exited with ${res.status}`);
}
version ??= inc(latest, level);

// Release notes: API changelog when the spec changed, otherwise a generic line.
let notes = '';
if (hasBase && specChanged) {
  const res = oasdiffRun('changelog', '--format', 'markdown');
  if (res.status === 0) notes = res.stdout.trim();
}
if (!notes) {
  notes =
    level === 'patch'
      ? 'Regenerated SDK (generator update, no API changes).'
      : 'Generated from the PCKT OpenAPI specification.';
}
if (notesPath) writeFileSync(notesPath, `${notes}\n`);

execFileSync('npm', ['version', version, '--no-git-tag-version', '--allow-same-version'], {
  stdio: 'ignore',
});

console.error(`Releasing ${pkg.name}@${version} (${level}, previous: ${latest ?? 'none'})`);
output('publish', 'true');
output('version', version);
output('level', level);
