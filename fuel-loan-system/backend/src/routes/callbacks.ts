import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import * as paymentService from '../services/payment.js';

const router = Router();

/** User ID to attribute callback payments to (system/admin). Default 1. */
const CALLBACK_RECEIVED_BY = Math.max(1, parseInt(process.env.SYSTEM_USER_ID || '1', 10));

function parseBody(req: Request): Record<string, unknown> {
  if (typeof req.body === 'object' && req.body !== null) return req.body as Record<string, unknown>;
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : {};
  } catch {
    return {};
  }
}

router.post('/mtn', async (req: Request, res: Response) => {
  const raw = parseBody(req);
  const referenceId = (raw.referenceId ?? raw.reference ?? raw.externalId ?? raw.financialTransactionId ?? '') as string;
  const status = (raw.status ?? raw.result?.result ?? '') as string;
  const amount = parseFloat((raw.amount ?? raw.debitAmount ?? 0) as string) || 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const callbackId = await paymentService.storeCallbackAuditWithClient(client, {
      provider: 'MTN',
      rawPayload: raw,
      externalRef: referenceId,
      amount,
      status,
      processed: false,
    });
    if (!referenceId) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    const rows = await paymentService.lockCallbacksByRef(client, 'MTN', referenceId);
    const anyProcessed = rows.some((r) => r.processed);
    if (anyProcessed) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    const successStatuses = ['SUCCESSFUL', 'SUCCESS', 'COMPLETED'];
    if (!successStatuses.includes(String(status).toUpperCase())) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    let loanId: number | undefined;
    const refMatch = referenceId.match(/loan[_-]?(\d+)/i);
    if (refMatch) loanId = parseInt(refMatch[1], 10);
    const toProcess = rows.find((r) => !r.processed);
    if (loanId && amount > 0 && toProcess) {
      const result = await paymentService.recordPayment({
        loanId,
        amountPaid: amount,
        paymentMethod: 'MTN',
        receivedBy: CALLBACK_RECEIVED_BY,
        client,
      });
      if (result.success) {
        await paymentService.markCallbackProcessed(toProcess.callback_id, loanId, client);
      }
    }
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    client.release();
  }
  res.status(200).send();
});

router.post('/airtel', async (req: Request, res: Response) => {
  const raw = parseBody(req);
  const referenceId = (raw.reference ?? raw.transaction_id ?? raw.id ?? '') as string;
  const status = (raw.status ?? raw.transaction?.status ?? raw.result?.status ?? '') as string;
  const amount = parseFloat((raw.amount ?? raw.transaction?.amount ?? 0) as string) || 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const callbackId = await paymentService.storeCallbackAuditWithClient(client, {
      provider: 'AIRTEL',
      rawPayload: raw,
      externalRef: referenceId,
      amount,
      status,
      processed: false,
    });
    if (!referenceId) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    const rows = await paymentService.lockCallbacksByRef(client, 'AIRTEL', referenceId);
    const anyProcessed = rows.some((r) => r.processed);
    if (anyProcessed) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    const successStatuses = ['TS', 'TSI', 'SUCCESS', 'COMPLETED', 'SUCCESSFUL'];
    if (!successStatuses.includes(String(status).toUpperCase())) {
      await client.query('COMMIT');
      res.status(200).send();
      return;
    }
    let loanId: number | undefined;
    const refMatch = referenceId.match(/loan[_-]?(\d+)/i);
    if (refMatch) loanId = parseInt(refMatch[1], 10);
    const toProcess = rows.find((r) => !r.processed);
    if (loanId && amount > 0 && toProcess) {
      const result = await paymentService.recordPayment({
        loanId,
        amountPaid: amount,
        paymentMethod: 'AIRTEL',
        receivedBy: CALLBACK_RECEIVED_BY,
        client,
      });
      if (result.success) {
        await paymentService.markCallbackProcessed(toProcess.callback_id, loanId, client);
      }
    }
    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    client.release();
  }
  res.status(200).send();
});

export default router;
