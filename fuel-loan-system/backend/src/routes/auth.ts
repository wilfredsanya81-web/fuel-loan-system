import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { login, createUser } from '../services/auth.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import type { UserRole } from '../types/index.js';

const router = Router();

const MAX_PASSWORD_LENGTH = 72; // bcrypt limit

router.post(
  '/login',
  body('phone_number').trim().notEmpty().withMessage('Phone required').isLength({ max: 20 }),
  body('password').notEmpty().withMessage('Password required').isLength({ max: MAX_PASSWORD_LENGTH }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { phone_number, password } = req.body;
    const pass = typeof password === 'string' ? password.slice(0, MAX_PASSWORD_LENGTH) : '';
    const result = await login(phone_number.trim(), pass);
    if (!result) {
      res.status(401).json({ error: 'Invalid phone or password' });
      return;
    }
    const { user, token } = result;
    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role,
        is_active: user.is_active,
      },
    });
  }
);

router.get('/me', authMiddleware, async (req, res) => {
  const { findUserById } = await import('../services/auth.js');
  const user = await findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    user_id: user.user_id,
    full_name: user.full_name,
    phone_number: user.phone_number,
    role: user.role,
    is_active: user.is_active,
  });
});

router.post(
  '/register',
  authMiddleware,
  requireRole('ADMIN'),
  body('full_name').trim().notEmpty(),
  body('phone_number').trim().notEmpty(),
  body('password').isLength({ min: 6, max: MAX_PASSWORD_LENGTH }),
  body('role').isIn(['ADMIN', 'AGENT']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const password = typeof req.body.password === 'string' ? req.body.password.slice(0, MAX_PASSWORD_LENGTH) : req.body.password;
    try {
      const user = await createUser({ ...req.body, password });
      res.status(201).json({
        user_id: user.user_id,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role,
      });
    } catch (e: unknown) {
      const msg = e && typeof (e as { code?: string }).code === 'string' && (e as { code: string }).code === '23505'
        ? 'Phone number already registered'
        : 'Registration failed';
      res.status(400).json({ error: msg });
    }
  }
);

export default router;
