import 'dotenv/config';
import readline from 'node:readline';
import * as auth from '../services/auth.js';
import pool from './pool.js';

async function seed() {
  const phone = process.env.SEED_ADMIN_PHONE || process.env.ADMIN_PHONE;
  const password = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || process.env.ADMIN_NAME || 'Admin';

  if (phone && password) {
    try {
      const user = await auth.createUser({
        full_name: name,
        phone_number: phone,
        role: 'ADMIN',
        password,
      });
      console.log('Admin user created:', user.user_id, user.phone_number);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === '23505') console.log('Admin with this phone already exists.');
      else throw e;
    } finally {
      await pool.end();
    }
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  try {
    const p = await ask('Admin phone number: ');
    const pass = await ask('Password (min 6): ');
    const n = (await ask('Full name [Admin]: ')) || 'Admin';
    if (!p.trim() || !pass || pass.length < 6) {
      console.log('Phone and password (min 6) required.');
      rl.close();
      await pool.end();
      process.exit(1);
    }
    const user = await auth.createUser({
      full_name: n,
      phone_number: p.trim(),
      role: 'ADMIN',
      password: pass,
    });
    console.log('Admin user created:', user.user_id, user.phone_number);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === '23505') console.log('Admin with this phone already exists.');
    else throw e;
  } finally {
    rl.close();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
