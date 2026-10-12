import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebase() {
  if (getApps().length) return getApps()[0]!;
  const serviceAccountPath = resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'serviceAccountKey.json');
  if (existsSync(serviceAccountPath)) {
    const serviceAccount: unknown = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    if (!serviceAccount || typeof serviceAccount !== 'object' || !('project_id' in serviceAccount)
      || !('client_email' in serviceAccount) || !('private_key' in serviceAccount)
      || typeof serviceAccount.project_id !== 'string' || typeof serviceAccount.client_email !== 'string'
      || typeof serviceAccount.private_key !== 'string') {
      throw new Error(`Firebase service account file is missing required fields: ${serviceAccountPath}`);
    }
    const account: ServiceAccount = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    };
    return initializeApp({ credential: cert(account) });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
}

export const firestore = getFirestore(initFirebase());
