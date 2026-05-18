import fs from 'node:fs';
import { execSync } from 'node:child_process';

const trackedFiles = execSync('git ls-files -z', { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const allowedTrackedFiles = new Set(['.env.example']);

const forbiddenPathRules = [
  { name: 'dotenv file', regex: /^\.env($|\.)/i },
  { name: 'service account file', regex: /serviceaccount/i },
  { name: 'firebase admin key file', regex: /firebase-admin-key\.json$/i },
  { name: 'private key file', regex: /\.(pem|p12|pfx)$/i },
  { name: 'private key file', regex: /(^|\/)id_rsa(\.pub)?$/i },
  { name: 'private key file', regex: /\.key(\.|$)/i },
];

const contentRules = [
  { name: 'firebase api key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'private key block', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'service account json', regex: /"type"\s*:\s*"service_account"/ },
  { name: 'service account private key', regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/ },
];

const skipContentRules = [
  /^dist\//,
  /^node_modules\//,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^public\/.*\.(png|jpg|jpeg|gif|webp|ico|svg)$/i,
];

const findings = [];

const isLikelyBinary = (buffer) => {
  const sampleSize = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleSize; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
};

for (const filePath of trackedFiles) {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() || normalized;

  const pathViolation = forbiddenPathRules.find((rule) => rule.regex.test(fileName) || rule.regex.test(normalized));
  if (pathViolation && !allowedTrackedFiles.has(normalized)) {
    findings.push({ filePath: normalized, reason: `forbidden tracked file (${pathViolation.name})` });
  }

  if (skipContentRules.some((rule) => rule.test(normalized))) {
    continue;
  }

  if (!fs.existsSync(normalized)) {
    continue;
  }

  const buffer = fs.readFileSync(normalized);
  if (isLikelyBinary(buffer)) {
    continue;
  }

  const content = buffer.toString('utf8');
  for (const rule of contentRules) {
    if (rule.regex.test(content)) {
      findings.push({ filePath: normalized, reason: `content matches ${rule.name}` });
      break;
    }
  }
}

if (findings.length > 0) {
  console.error('[security:secrets] Potential secret leaks found in tracked files:');
  for (const finding of findings) {
    console.error(`- ${finding.filePath}: ${finding.reason}`);
  }
  process.exit(1);
}

console.log('[security:secrets] OK: no obvious secrets found in tracked files.');
