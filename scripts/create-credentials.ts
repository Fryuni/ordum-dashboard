/**
 * Interactive script to obtain a Bitcraft authentication token.
 *
 * 1. Prompts for your email address
 * 2. Requests a one-time access code (sent to that email)
 * 3. Prompts for the access code
 * 4. Exchanges it for a JWT auth token
 * 5. Writes the token to .env as SPACETIME_TOKEN
 */

const API = 'https://api.bitcraftonline.com/authentication';
const ENV_FILE = '.env';

const email = prompt('Email address:')?.trim();
if (!email) {
  console.error('No email provided.');
  process.exit(1);
}

// Step 1: Request an access code
const codeRes = await fetch(
  `${API}/request-access-code?email=${encodeURIComponent(email)}`,
  { method: 'POST' },
);
if (!codeRes.ok) {
  console.error(`Failed to request access code: ${codeRes.status} ${await codeRes.text()}`);
  process.exit(1);
}
console.log(`Access code sent to ${email}. Check your inbox.`);

// Step 2: Exchange the code for a token
const code = prompt('Access code:')?.trim();
if (!code) {
  console.error('No access code provided.');
  process.exit(1);
}

const authRes = await fetch(
  `${API}/authenticate?email=${encodeURIComponent(email)}&accessCode=${encodeURIComponent(code)}`,
  { method: 'POST' },
);
if (!authRes.ok) {
  console.error(`Authentication failed: ${authRes.status} ${await authRes.text()}`);
  process.exit(1);
}

const token = await authRes.text();
if (!token) {
  console.error('Received empty token.');
  process.exit(1);
}

// Step 3: Persist to .env
const envFile = Bun.file(ENV_FILE);
let env = await envFile.exists() ? await envFile.text() : '';

if (/^SPACETIME_TOKEN=/m.test(env)) {
  env = env.replace(/^SPACETIME_TOKEN=.*/m, `SPACETIME_TOKEN=${token}`);
} else {
  env = env.trimEnd() + (env.length ? '\n' : '') + `SPACETIME_TOKEN=${token}\n`;
}

await Bun.file(ENV_FILE).write(env);
console.log(`Token saved to ${ENV_FILE} as SPACETIME_TOKEN`);
