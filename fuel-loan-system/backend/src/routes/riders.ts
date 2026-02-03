import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import * as riderService from '../services/rider.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/search',
  query('q').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const riders = await riderService.searchRiders(req.query.q as string);
    res.json({ riders });
  }
);

router.get('/:riderId', async (req, res) => {
  const id = parseInt(req.params.riderId, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid rider ID' });
    return;
  }
  const rider = await riderService.findRiderById(id);
  if (!rider) {
    res.status(404).json({ error: 'Rider not found' });
    return;
  }
  res.json(rider);
});

router.get('/', requireRole('ADMIN'), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 200);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const riders = await riderService.listRiders(limit, offset);
  res.json({ riders });
});

router.post(
  '/',
  body('full_name').trim().notEmpty(),
  body('phone_number').trim().notEmpty(),
  body('national_id').optional().trim(),
  body('motorcycle_number').optional().trim(),
  body('stage_location').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const rider = await riderService.createRider(req.body);
      res.status(201).json(rider);
    } catch (e: unknown) {
      const code = e && typeof (e as { code?: string }).code === 'string' ? (e as { code: string }).code : '';
      if (code === '23505') res.status(400).json({ error: 'Phone or national ID already exists' });
      else res.status(500).json({ error: 'Failed to create rider' });
    }
  }
);

router.patch(
  '/:riderId',
  requireRole('ADMIN'),
  body('full_name').optional().trim().notEmpty(),
  body('phone_number').optional().trim().notEmpty(),
  body('national_id').optional().trim(),
  body('motorcycle_number').optional().trim(),
  body('stage_location').optional().trim(),
  body('status').optional().isIn(['ACTIVE', 'SUSPENDED', 'BLACKLISTED']),
  async (req, res) => {
    const id = parseInt(req.params.riderId, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid rider ID' });
      return;
    }
    const { status, ...rest } = req.body;
    if (status) await riderService.updateRiderStatus(id, status);
    const rider = await riderService.updateRider(id, rest);
    if (!rider) {
      res.status(404).json({ error: 'Rider not found' });
      return;
    }
    res.json(rider);
  }
);

export default router;
