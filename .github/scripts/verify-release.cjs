// Builds a fresh package outside the checkout, or re-checks an already packaged
// directory against the same allowlist. Only allowlisted runtime files are read.
const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.resolve(__dirname, '../..'));
const core = ['.nojekyll', 'index.html', 'app.js', 'import.js', 'style.css', 'sw.js',
  'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png'];
const runtimePath = name => core.includes(name) || /^icons\/[\w-]+\.svg$/.test(name);
const checks = [
  ['credential pattern', /\b(?:gh[pousr]_[\w]{20,}|github_pat_[\w]{20,}|AKIA[A-Z0-9]{16}|AIza[\w-]{30,}|xox[baprs]-[\w-]{10,})\b|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*['"][\w./+=-]{16,}/i],
  ['credentials in URL', /https?:\/\/[^\s/'"<>]+@[^\s/'"<>]+/i],
  ['private path', /(?:[a-z]:[\\/]+(?:Users|Documents and Settings)[\\/]|\/(?:Users|home)\/[\w.-]+\/)/i],
  ['development endpoint', /https?:\/\/(?:localhost\b|127\.|0\.0\.0\.0\b|\[::1\])/i],
  ['possible personal identifier', /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i],
  ['test-only content', /\bdebugger\s*;|\b(?:playwright|synthetic fixture|test-only)\b/i]
];

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function scan(name, bytes) {
  // latin1 preserves ASCII strings even in binary metadata; do not log matching text.
  const text = bytes.toString('latin1');
  for (const [type, pattern] of checks) {
    requireThat(!pattern.test(text), `${name}: ${type}`);
  }
}

function releaseList() {
  const files = fs.readFileSync(path.join(root, 'release-files.txt'), 'utf8').trim().split(/\r?\n/);
  requireThat(files.length === 37 && new Set(files).size === files.length, 'Expected 37 distinct release paths');
  requireThat(files.every(runtimePath), 'Release list contains a path outside the runtime allowlist');
  requireThat(core.every(name => files.includes(name)), 'Release list is missing a required core file');
  return files;
}

// Resolves a package directory and refuses anything inside the checkout, so a
// stray path can never be mistaken for the release package.
function outsideCheckout(directory) {
  const resolved = path.resolve(directory);
  const parent = path.dirname(resolved);
  requireThat(fs.existsSync(parent) && fs.statSync(parent).isDirectory(), 'The package parent directory does not exist');
  const target = path.join(fs.realpathSync(parent), path.basename(resolved));
  const relative = path.relative(root, target);
  requireThat(path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`), 'Package directory must be outside the checkout');
  return target;
}

function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    if (entry.isDirectory()) return walk(path.join(dir, entry.name), `${name}/`);
    requireThat(entry.isFile(), 'Unexpected non-file entry in the package');
    return [name];
  });
}

// Structural checks shared by build and re-check. Returns the precache count.
function inspect(contents) {
  const text = name => contents.get(name).toString('utf8');
  const sw = text('sw.js').match(/\bconst ASSETS\s*=\s*\[([\s\S]*?)\];/);
  requireThat(sw, 'sw.js: cannot read the precache declaration');
  const precache = sw[1].trim().split(/\s*,\s*/).filter(Boolean).map(entry => {
    const match = entry.match(/^'\.\/([^']*)'$/);
    requireThat(match, 'sw.js: unsupported precache entry');
    return match[1];
  });
  requireThat(precache.length === 35 && new Set(precache).size === 35 && precache.includes(''), 'sw.js: expected 35 distinct precache URLs including the app root');
  const expected = new Set([...core, ...precache.filter(Boolean)]);
  requireThat(expected.size === contents.size && [...expected].every(name => contents.has(name)), 'Package does not match the core files and precache');

  const html = text('index.html');
  const references = [...html.matchAll(/\b(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)].map(match => match[1]);
  requireThat(references.includes('import.js') && references.every(name => contents.has(name)), 'index.html: missing runtime reference');
  for (const name of ['app.js', 'style.css']) {
    const refs = [...text(name).matchAll(/\.\/(icons\/[\w-]+\.svg)/g)].map(match => match[1]);
    requireThat(refs.every(file => contents.has(file)), `${name}: missing icon reference`);
  }

  let manifest;
  try { manifest = JSON.parse(text('manifest.json')); }
  catch { throw new Error('manifest.json: invalid JSON'); }
  requireThat(manifest.start_url === './index.html' && manifest.display === 'standalone', 'manifest.json: expected relative start URL and standalone mode');
  requireThat(Array.isArray(manifest.icons) && manifest.icons.length === 2, 'manifest.json: expected two PWA icons');
  for (const size of [192, 512]) {
    const name = `icon-${size}.png`;
    const icon = manifest.icons.find(item => item.src === name);
    const png = contents.get(name);
    requireThat(icon?.sizes === `${size}x${size}` && icon.type === 'image/png' && png.length >= 24 &&
      png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && png.toString('ascii', 12, 16) === 'IHDR' &&
      png.readUInt32BE(16) === size && png.readUInt32BE(20) === size, `manifest.json: invalid declaration or PNG dimensions for ${name}`);
  }
  return precache.length;
}

function build(destination) {
  requireThat(destination, 'Usage: node .github/scripts/verify-release.cjs <new directory outside checkout>');
  const target = outsideCheckout(destination);
  requireThat(!fs.existsSync(target), 'Staging directory must not already exist');

  const files = releaseList();
  const contents = new Map();
  for (const name of files) {
    let directory = root;
    const parts = name.split('/');
    for (const [index, part] of parts.entries()) {
      const entry = fs.readdirSync(directory, { withFileTypes: true }).find(item => item.name === part);
      requireThat(entry && (index === parts.length - 1 ? entry.isFile() : entry.isDirectory()), `${name}: missing, wrong case, or not a regular release file`);
      directory = path.join(directory, part);
    }
    const bytes = fs.readFileSync(directory);
    scan(name, bytes);
    contents.set(name, bytes);
  }
  const precacheCount = inspect(contents);

  fs.mkdirSync(target);
  for (const [name, bytes] of contents) {
    const output = path.join(target, name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes, { flag: 'wx' });
  }
  const staged = walk(target);
  requireThat(staged.length === files.length && staged.every(name => contents.has(name)), 'Staged files do not exactly match the release list');
  for (const [name, bytes] of contents) {
    requireThat(fs.readFileSync(path.join(target, name)).equals(bytes), `${name}: staged bytes differ from verified source`);
  }
  console.log(`Verified ${staged.length} release files and ${precacheCount} precache URLs; staged package passed the runtime security scan.`);
}

// Re-checks a package produced earlier in the same workflow run: the file list
// must match exactly and every byte must still equal the checked-out source.
function check(directory) {
  requireThat(directory, 'Usage: node .github/scripts/verify-release.cjs --check <existing package directory outside checkout>');
  const target = outsideCheckout(directory);
  requireThat(fs.existsSync(target) && fs.statSync(target).isDirectory(), 'Package directory does not exist');

  const files = releaseList();
  const packaged = walk(target);
  requireThat(packaged.length === files.length && packaged.every(name => files.includes(name)), 'Package contents do not exactly match the release list');
  const contents = new Map();
  for (const name of files) {
    const entry = path.join(target, ...name.split('/'));
    requireThat(fs.lstatSync(entry).isFile(), `${name}: not a regular file`);
    const bytes = fs.readFileSync(entry);
    scan(name, bytes);
    const source = path.join(root, ...name.split('/'));
    requireThat(fs.existsSync(source) && fs.readFileSync(source).equals(bytes), `${name}: packaged bytes differ from the checked-out source`);
    contents.set(name, bytes);
  }
  const precacheCount = inspect(contents);
  console.log(`Re-verified ${contents.size} packaged files and ${precacheCount} precache URLs against the checkout; the package passed the runtime security scan.`);
}

try {
  const [first, second] = process.argv.slice(2);
  if (first === '--check') check(second);
  else build(first);
} catch (error) {
  // Native filesystem errors can include private absolute paths.
  console.error(error.code ? `Release verification: filesystem error (${error.code})` : error.message);
  process.exitCode = 1;
}
