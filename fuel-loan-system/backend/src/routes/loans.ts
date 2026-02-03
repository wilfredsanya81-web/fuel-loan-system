import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import * as loanService from '../services/loan.js';
import * as riderService from '../services/rider.js';
import * as paymentService from '../services/payment.js';
import { roundMoneyNum } from '../utils/money.js';

const router = Router();
router.use(authMiddleware);

const MAX_PRINCIPAL_UGX = 50_000_000;

router.post(
  '/',
  body('rider_id').isInt({ min: 1 }),
  body('principal_amount').isFloat({ min: 0.01, max: MAX_PRINCIPAL_UGX }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { rider_id, principal_amount } = req.body;
    const principal = parseFloat(principal_amount);
    if (principal > MAX_PRINCIPAL_UGX) {
      res.status(400).json({ error: `Principal cannot exceed ${MAX_PRINCIPAL_UGX.toLocaleString()} UGX` });
      return;
    }
    try {
      const loan = await loanService.createLoan({
        riderId: rider_id,
        agentId: req.user!.userId,
        principalAmount: principal,
      });
      res.status(201).json(loan);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create loan';
      if (msg === 'Rider not found') res.status(404).json({ error: msg });
      else if (msg === 'Rider is not active' || msg === 'Rider already has an active or overdue loan') res.status(400).json({ error: msg });
      else res.status(500).json({ error: 'Failed to create loan' });
    }
  }
);

router.get('/active', async (req, res) => {
  const agentId = req.user!.role === 'AGENT' ? req.user!.userId : undefined;
  const loans = await loanService.getActiveLoans(agentId);
  res.json({ loans });
});

router.get('/overdue', async (req, res) => {
  const agentId = req.user!.role === 'AGENT' ? req.user!.userId : undefined;
  const loans = await loanService.getOverdueLoans(agentId);
  res.json({ loans });
});

router.get('/:loanId', param('loanId').isInt({ min: 1 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Invalid loan ID' });
    return;
  }
  const loanId = parseInt(req.params.loanId, 10);
  const loan = await loanService.getLoanById(loanId);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found' });
    return;
  }
  if (req.user!.role === 'AGENT' && loan.agent_id !== req.user!.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const payments = await paymentService.getPaymentsByLoanId(loanId);
  const rider = await riderService.findRiderById(loan.rider_id);
  res.json({ loan, payments, rider });
});

router.post(
  '/:loanId/payments',
  param('loanId').isInt({ min: 1 }),
  body('amount_paid').isFloat({ min: 0.01 }),
  body('payment_method').trim().notEmpty().isIn(['CASH', 'MTN', 'AIRTEL', 'BANK', 'OTHER']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const loanId = parseInt(req.params.loanId, 10);
    const result = await paymentService.recordPayment({
      loanId,
      amountPaid: parseFloat(req.body.amount_paid),
      paymentMethod: req.body.payment_method,
      receivedBy: req.user!.userId,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Payment failed' });
      return;
    }
    const loan = await loanService.getLoanById(loanId);
    res.json({ success: true, new_balance: result.newBalance, loan });
  }
);

router.patch(
  '/:loanId/admin-adjust',
  requireRole('ADMIN'),
  param('loanId').isInt({ min: 1 }),
  body('outstanding_balance').optional().isFloat({ min: 0 }),
  body('total_penalty').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['ACTIVE', 'OVERDUE', 'PAID']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const loanId = parseInt(req.params.loanId, 10);
    const loan = await loanService.getLoanById(loanId);
    if (!loan) {
      res.status(404).json({ error: 'Loan not found' });
      return;
    }
    const principal = parseFloat(loan.principal_amount);
    const penaltyCap = roundMoneyNum(principal * 0.5);
    if (req.body.total_penalty !== undefined) {
      const penalty = roundMoneyNum(parseFloat(String(req.body.total_penalty)));
      if (penalty > penaltyCap) {
        res.status(400).json({ error: `Total penalty cannot exceed ${penaltyCap.toFixed(2)} (50% of principal)` });
        return;
      }
    }
    if (req.body.outstanding_balance !== undefined) {
      const ob = roundMoneyNum(parseFloat(String(req.body.outstanding_balance)));
      if (ob < 0) {
        res.status(400).json({ error: 'Outstanding balance cannot be negative' });
        return;
      }
    }
    const pool = (await import('../db/pool.js')).default;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (req.body.outstanding_balance !== undefined) {
        const ob = roundMoneyNum(parseFloat(String(req.body.outstanding_balance)));
        await client.query('UPDATE loans SET outstanding_balance = $1 WHERE loan_id = $2', [ob.toFixed(2), loanId]);
      }
      if (req.body.total_penalty !== undefined) {
        const penalty = roundMoneyNum(parseFloat(String(req.body.total_penalty)));
        await client.query('UPDATE loans SET total_penalty = $1 WHERE loan_id = $2', [penalty.toFixed(2), loanId]);
      }
      if (req.body.status !== undefined) {
        await client.query('UPDATE loans SET status = $1 WHERE loan_id = $2', [req.body.status, loanId]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    const updated = await loanService.getLoanById(loanId);
    res.json(updated);
  }
);

export default router;
