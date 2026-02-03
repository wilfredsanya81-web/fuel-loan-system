import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', requireRole('ADMIN'), async (_req, res) => {
  const client = await pool.connect();
  try {
    const [activeRes, overdueRes, paidRes, ridersRes, totalDisbursedRes, totalCollectedRes] = await Promise.all([
      client.query('SELECT COUNT(*)::int AS c FROM loans WHERE status = $1', ['ACTIVE']),
      client.query('SELECT COUNT(*)::int AS c FROM loans WHERE status = $1', ['OVERDUE']),
      client.query('SELECT COUNT(*)::int AS c FROM loans WHERE status = $1', ['PAID']),
      client.query('SELECT COUNT(*)::int AS c FROM riders WHERE status = $1', ['ACTIVE']),
      client.query('SELECT COALESCE(SUM(principal_amount), 0)::text AS total FROM loans', []),
      client.query('SELECT COALESCE(SUM(amount_paid), 0)::text AS total FROM payments', []),
    ]);
    res.json({
      active_loans: activeRes.rows[0]?.c ?? 0,
      overdue_loans: overdueRes.rows[0]?.c ?? 0,
      paid_loans: paidRes.rows[0]?.c ?? 0,
      active_riders: ridersRes.rows[0]?.c ?? 0,
      total_disbursed: totalDisbursedRes.rows[0]?.total ?? '0',
      total_collected: totalCollectedRes.rows[0]?.total ?? '0',
    });
  } finally {
    client.release();
  }
});

router.get('/reports/loans', requireRole('ADMIN'), async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 500, 2000);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  let query = `
    SELECT l.*, r.full_name AS rider_name, r.phone_number AS rider_phone
    FROM loans l
    JOIN riders r ON r.rider_id = l.rider_id
  `;
  const params: unknown[] = [];
  if (status && ['ACTIVE', 'OVERDUE', 'PAID'].includes(status)) {
    params.push(status);
    query += ` WHERE l.status = $1`;
  }
  query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  const { rows } = await pool.query(query, params);
  res.json({ loans: rows });
});

export default router;
