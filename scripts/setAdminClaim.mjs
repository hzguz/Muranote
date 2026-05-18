import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const args = process.argv.slice(2);
const hasConfirmFlag = args.includes('--confirm');
const positionalArgs = args.filter((arg) => arg !== '--confirm');

const uid = positionalArgs[0];
const valueArg = positionalArgs[1];
const isValidUid = typeof uid === 'string' && /^[^\s]{1,128}$/.test(uid);

const auditLogPath = path.resolve(process.cwd(), 'scripts', 'admin-claim-audit.log');
const operator = process.env.USERNAME || process.env.USER || 'unknown';

const writeAuditLog = (entry) => {
  const payload = {
    timestamp: new Date().toISOString(),
    operator,
    ...entry,
  };

  try {
    fs.appendFileSync(auditLogPath, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {
    // Avoid blocking claim updates if local log cannot be written.
  }
};

if (!uid || !valueArg || !['true', 'false'].includes(valueArg) || !isValidUid) {
  console.error('Uso: npm run admin:claim -- <UID> <true|false> --confirm');
  console.error('Regras: UID sem espacos e com no maximo 128 caracteres.');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid: uid || null,
    requestedAdmin: valueArg || null,
    status: 'rejected',
    reason: 'invalid-arguments',
  });
  process.exit(1);
}

const isAdmin = valueArg === 'true';

if (!hasConfirmFlag) {
  console.error('Confirmacao obrigatoria ausente.');
  console.error('Repita com: npm run admin:claim -- <UID> <true|false> --confirm');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'rejected',
    reason: 'missing-confirm-flag',
  });
  process.exit(1);
}

const keyPathArg = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPathArg) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_PATH apontando para o JSON da service account.');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: 'missing-credentials-env',
  });
  process.exit(1);
}

const resolvedKeyPath = path.resolve(process.cwd(), keyPathArg);
if (!fs.existsSync(resolvedKeyPath)) {
  console.error(`Arquivo de credencial não encontrado: ${resolvedKeyPath}`);
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: 'credentials-file-not-found',
    credentialsPath: resolvedKeyPath,
  });
  process.exit(1);
}

if (path.extname(resolvedKeyPath).toLowerCase() !== '.json') {
  console.error('Credencial invalida: o arquivo precisa ser .json.');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: 'invalid-credentials-extension',
    credentialsPath: resolvedKeyPath,
  });
  process.exit(1);
}

let serviceAccount;

try {
  const serviceAccountRaw = fs.readFileSync(resolvedKeyPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountRaw);
} catch {
  console.error('Falha ao ler ou interpretar o JSON da service account.');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: 'invalid-service-account-json',
    credentialsPath: resolvedKeyPath,
  });
  process.exit(1);
}

if (
  !serviceAccount ||
  typeof serviceAccount.project_id !== 'string' ||
  typeof serviceAccount.client_email !== 'string' ||
  typeof serviceAccount.private_key !== 'string'
) {
  console.error('Service account invalida: faltam campos obrigatorios (project_id, client_email, private_key).');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: 'incomplete-service-account',
    credentialsPath: resolvedKeyPath,
  });
  process.exit(1);
}

console.log(`[admin:claim] Confirmado: uid=${uid} admin=${isAdmin}`);
console.log(`[admin:claim] Operador local: ${operator}`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

try {
  await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });
  await admin.auth().revokeRefreshTokens(uid);
  console.log(`Claim atualizado com sucesso: uid=${uid} admin=${isAdmin}`);
  console.log('Peça para o usuário fazer logout/login para renovar o token.');
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'success',
  });
} catch (error) {
  console.error('Falha ao atualizar claim:', error);
  writeAuditLog({
    action: 'setCustomUserClaims',
    uid,
    requestedAdmin: isAdmin,
    status: 'failed',
    reason: error instanceof Error ? error.message : 'unknown-error',
  });
  process.exit(1);
}
