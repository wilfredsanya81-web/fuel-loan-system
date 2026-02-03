import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import type { User, UserRole } from '../types/index.js';
import { signToken } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function findUserByPhone(phoneNumber: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    'SELECT * FROM users WHERE phone_number = $1 AND is_active = TRUE',
    [phoneNumber]
  );
  return rows[0] ?? null;
}

export async function findUserById(userId: number): Promise<User | null> {
  const { rows } = await pool.query<User>('SELECT * FROM users WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function login(phoneNumber: string, password: string): Promise<{ user: User; token: string } | null> {
  const user = await findUserByPhone(phoneNumber);
  if (!user?.password_hash) return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;
  const token = signToken(user.user_id, user.role);
  return { user, token };
}

export async function createUser(data: {
  full_name: string;
  phone_number: string;
  role: UserRole;
  password: string;
}): Promise<User> {
  const hash = await hashPassword(data.password);
  const { rows } = await pool.query<User>(
    `INSERT INTO users (full_name, phone_number, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, full_name, phone_number, role, password_hash, is_active, created_at`,
    [data.full_name, data.phone_number, data.role, hash]
  );
  return rows[0];
}
