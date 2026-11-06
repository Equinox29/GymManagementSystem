import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Load the secret key from .env. Without it, saved contacts cannot be read.
export function encryptionKey() {
  const value = process.env.FIELD_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(value))
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hex characters. Run npm run db:setup.'
    );
  return Buffer.from(value, 'hex');
}
export function encryptContact(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 190)
    throw new Error('Emergency contact must be at most 190 characters');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from('members.emergency_contact:v1'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'enc',
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}
export function decryptContact(value) {
  if (value == null || value === '') return null;
  const [prefix, version, iv, tag, ciphertext, extra] = String(value).split(':');
  if (prefix !== 'enc' || version !== 'v1' || !iv || !tag || !ciphertext || extra !== undefined)
    throw new Error('Invalid encrypted emergency contact; run the database migration');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from('members.emergency_contact:v1'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
export const revealContact = (row) =>
  row ? { ...row, emergencyContact: decryptContact(row.emergencyContact) } : row;
