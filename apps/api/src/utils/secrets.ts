import crypto from 'crypto';
import { config } from '../config/env';

// AES-256-GCM encryption for secrets stored in the database (e.g. the OpenAI
// API key). Protects DB dumps/backups; the server itself can always decrypt —
// it has to, to use the secret.
//
// Key source: APP_ENCRYPTION_KEY env var if set, otherwise derived from
// JWT_SECRET. Rotating JWT_SECRET without APP_ENCRYPTION_KEY invalidates
// stored secrets (they must be re-entered in the UI).

function encryptionKey(): Buffer {
    const source = config.APP_ENCRYPTION_KEY || config.JWT_SECRET;
    return crypto.createHash('sha256').update(source).digest();
}

export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded: string): string | null {
    try {
        const raw = Buffer.from(encoded, 'base64');
        const iv = raw.subarray(0, 12);
        const tag = raw.subarray(12, 28);
        const ciphertext = raw.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
        // Wrong/rotated key or corrupted data — treat as "no secret stored"
        return null;
    }
}
