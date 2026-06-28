import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Gera um token aleatorio (para refresh tokens, reset de senha, etc.) */
export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}

/** Hash deterministico (SHA-256) para armazenar tokens com seguranca */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
