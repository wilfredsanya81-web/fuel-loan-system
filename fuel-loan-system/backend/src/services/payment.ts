import type { PoolClient } from 'pg';
import pool from '../db/pool.js';
import { getLoanByIdForUpdate } from './loan.js';
import { roundMoney, roundMoneyNum } from '../utils/money.js';

const OVERPAYMENT_TOLERANCE = 0.01; // Allow overpayment up to 0.01 UGX and set balance to 0

export async function recordPayment(params: {
  loanId: number;
  amountPaid: number;
  paymentMethod: string;
  receivedBy: number;
  client?: PoolClient;
}): Promise<{ success: boolean; newBalance?: string; error?: string }> {
  const amountRounded = roundMoneyNum(params.amountPaid);
  if (amountRounded <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  const client = params.client ?? await pool.connect();
  const ownTransaction = !params.client;
  try {
    if (ownTransaction) await client.query('BEGIN');
    const loan = await getLoanByIdForUpdate(client, params.loanId);
    if (!loan) {
      if (ownTransaction) await client.query('ROLLBACK');
      return { success: false, error: 'Loan not found' };
    }
    if (loan.status === 'PAID') {
      if (ownTransaction) await client.query('ROLLBACK');
      return { success: false, error: 'Loan already paid' };
    }
    const outstanding = parseFloat(loan.outstanding_balance);
    if (amountRounded > outstanding + OVERPAYMENT_TOLERANCE) {
      if (ownTransaction) await client.query('ROLLBACK');
      return { success: false, error: 'Amount exceeds outstanding balance' };
    }
    const newBalanceNum = amountRounded >= outstanding
      ? 0
      : roundMoneyNum(outstanding - amountRounded);
    const newBalance = roundMoney(newBalanceNum);

    await client.query(
      `INSERT INTO payments (loan_id, amount_paid, payment_method, received_by) VALUES ($1, $2, $3, $4)`,
      [params.loanId, amountRounded, params.paymentMethod, params.receivedBy]
    );
    await client.query(
      `UPDATE loans SET outstanding_balance = $1 WHERE loan_id = $2`,
      [newBalance, params.loanId]
    );
    if (newBalanceNum <= 0) {
      await client.query(`UPDATE loans SET status = 'PAID' WHERE loan_id = $1`, [params.loanId]);
    }
    if (ownTransaction) await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (e) {
    if (ownTransaction) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownTransaction) client.release();
  }
}

export async function getPaymentsByLoanId(loanId: number) {
  const { rows } = await pool.query(
    `SELECT payment_id, loan_id, amount_paid, payment_method, received_by, payment_time FROM payments WHERE loan_id = $1 ORDER BY payment_time DESC`,
    [loanId]
  );
  return rows;
}

export async function storeCallbackAudit(params: {
  provider: string;
  rawPayload: object;
  externalRef?: string;
  amount?: number;
  status?: string;
  loanId?: number;
  processed: boolean;
}): Promise<number> {
  const { rows } = await pool.query<{ callback_id: number }>(
    `INSERT INTO payment_callbacks (provider, raw_payload, external_ref, amount, status, processed, loan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING callback_id`,
    [
      params.provider,
      JSON.stringify(params.rawPayload),
      params.externalRef ?? null,
      params.amount ?? null,
      params.status ?? null,
      params.processed,
      params.loanId ?? null,
    ]
  );
  return rows[0].callback_id;
}

/** Insert callback using given client (for use inside transaction). */
export async function storeCallbackAuditWithClient(
  client: PoolClient,
  params: {
    provider: string;
    rawPayload: object;
    externalRef?: string;
    amount?: number;
    status?: string;
    processed: boolean;
  }
): Promise<number> {
  const { rows } = await client.query<{ callback_id: number }>(
    `INSERT INTO payment_callbacks (provider, raw_payload, external_ref, amount, status, processed, loan_id)
     VALUES ($1, $2, $3, $4, $5, $6, NULL) RETURNING callback_id`,
    [
      params.provider,
      JSON.stringify(params.rawPayload),
      params.externalRef ?? null,
      params.amount ?? null,
      params.status ?? null,
      params.processed,
    ]
  );
  return rows[0].callback_id;
}

export async function markCallbackProcessed(callbackId: number, loanId: number, client?: PoolClient): Promise<void> {
  const q = client ?? pool;
  await q.query(
    'UPDATE payment_callbacks SET processed = TRUE, loan_id = $1 WHERE callback_id = $2',
    [loanId, callbackId]
  );
}

export async function findCallbackByExternalRef(provider: string, externalRef: string): Promise<{ processed: boolean } | null> {
  const { rows } = await pool.query<{ processed: boolean }>(
    'SELECT processed FROM payment_callbacks WHERE provider = $1 AND external_ref = $2 AND processed = TRUE LIMIT 1',
    [provider, externalRef]
  );
  return rows.length > 0 ? { processed: true } : null;
}

/** Lock all callbacks for (provider, externalRef). Caller must hold transaction. Returns rows with processed flag. */
export async function lockCallbacksByRef(
  client: PoolClient,
  provider: string,
  externalRef: string
): Promise<{ callback_id: number; processed: boolean }[]> {
  const { rows } = await client.query<{ callback_id: number; processed: boolean }>(
    `SELECT callback_id, processed FROM payment_callbacks
     WHERE provider = $1 AND external_ref = $2
     ORDER BY callback_id ASC FOR UPDATE`,
    [provider, externalRef]
  );
  return rows;
}
