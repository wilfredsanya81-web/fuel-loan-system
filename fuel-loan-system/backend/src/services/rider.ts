import pool from '../db/pool.js';
import type { Rider } from '../types/index.js';

export async function createRider(data: {
  full_name: string;
  phone_number: string;
  national_id?: string;
  motorcycle_number?: string;
  stage_location?: string;
}): Promise<Rider> {
  const { rows } = await pool.query<Rider>(
    `INSERT INTO riders (full_name, phone_number, national_id, motorcycle_number, stage_location)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      data.full_name,
      data.phone_number,
      data.national_id ?? null,
      data.motorcycle_number ?? null,
      data.stage_location ?? null,
    ]
  );
  return rows[0];
}

export async function findRiderById(riderId: number): Promise<Rider | null> {
  const { rows } = await pool.query<Rider>('SELECT * FROM riders WHERE rider_id = $1', [riderId]);
  return rows[0] ?? null;
}

export async function findRiderByPhone(phoneNumber: string): Promise<Rider | null> {
  const { rows } = await pool.query<Rider>('SELECT * FROM riders WHERE phone_number = $1', [phoneNumber]);
  return rows[0] ?? null;
}

export async function searchRiders(query: string): Promise<Rider[]> {
  const pattern = `%${query.trim()}%`;
  const { rows } = await pool.query<Rider>(
    `SELECT * FROM riders WHERE full_name ILIKE $1 OR phone_number ILIKE $1 OR national_id ILIKE $1 OR motorcycle_number ILIKE $1 ORDER BY full_name LIMIT 50`,
    [pattern]
  );
  return rows;
}

export async function listRiders(limit = 100, offset = 0): Promise<Rider[]> {
  const { rows } = await pool.query<Rider>(
    'SELECT * FROM riders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}

export async function updateRiderStatus(riderId: number, status: 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED'): Promise<void> {
  await pool.query('UPDATE riders SET status = $1 WHERE rider_id = $2', [status, riderId]);
}

export async function updateRider(riderId: number, data: Partial<Pick<Rider, 'full_name' | 'phone_number' | 'national_id' | 'motorcycle_number' | 'stage_location'>>): Promise<Rider | null> {
  const rider = await findRiderById(riderId);
  if (!rider) return null;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.full_name !== undefined) { updates.push(`full_name = $${i++}`); values.push(data.full_name); }
  if (data.phone_number !== undefined) { updates.push(`phone_number = $${i++}`); values.push(data.phone_number); }
  if (data.national_id !== undefined) { updates.push(`national_id = $${i++}`); values.push(data.national_id); }
  if (data.motorcycle_number !== undefined) { updates.push(`motorcycle_number = $${i++}`); values.push(data.motorcycle_number); }
  if (data.stage_location !== undefined) { updates.push(`stage_location = $${i++}`); values.push(data.stage_location); }
  if (updates.length === 0) return rider;
  values.push(riderId);
  const { rows } = await pool.query<Rider>(
    `UPDATE riders SET ${updates.join(', ')} WHERE rider_id = $${i} RETURNING *`,
    values
  );
  return rows[0] ?? null;
}
