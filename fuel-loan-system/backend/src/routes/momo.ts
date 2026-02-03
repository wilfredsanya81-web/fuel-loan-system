import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.js';
import * as loanService from '../services/loan.js';
import * as riderService from '../services/rider.js';
import * as mtn from '../services/momo/mtn.js';
import * as airtel from '../services/momo/airtel.js';

const router = Router();
router.use(authMiddleware);

function generateReference(loanId: number, provider: string): string {
  return `loan_${loanId}_${provider}_${Date.now()}`;
}

router.post(
  '/stk-push',
  body('loan_id').isInt({ min: 1 }),
  body('provider').isIn(['MTN', 'AIRTEL']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { loan_id, provider } = req.body;
    const loan = await loanService.getLoanById(loan_id);
    if (!loan) {
      res.status(404).json({ error: 'Loan not found' });
      return;
    }
    const rider = await riderService.findRiderById(loan.rider_id);
    if (!rider?.phone_number) {
      res.status(400).json({ error: 'Rider phone not found' });
      return;
    }
    const amount = parseFloat(loan.outstanding_balance);
    if (amount <= 0) {
      res.status(400).json({ error: 'Loan already fully paid' });
      return;
    }
    const referenceId = generateReference(loan_id, provider);
    const message = `Fuel loan repayment - Loan #${loan_id}`;
    const note = `Loan ${loan_id}`;

    if (provider === 'MTN') {
      const result = await mtn.requestToPay(referenceId, amount, rider.phone_number, message, note);
      if (!result.success) {
        res.status(400).json({ error: result.error || 'MTN request failed' });
        return;
      }
      res.json({ reference_id: referenceId, provider: 'MTN', message: 'STK push sent' });
      return;
    }

    if (provider === 'AIRTEL') {
      const result = await airtel.requestToPay(referenceId, amount, rider.phone_number, message, note);
      if (!result.success) {
        res.status(400).json({ error: result.error || 'Airtel request failed' });
        return;
      }
      res.json({ reference_id: referenceId, provider: 'AIRTEL', message: 'STK push sent' });
      return;
    }

    res.status(400).json({ error: 'Invalid provider' });
  }
);

export default router;
