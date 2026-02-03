import type { PoolClient } from 'pg';
import pool from '../db/pool.js';
import type { Loan, LoanStatus } from '../types/index.js';
import { roundMoney, roundMoneyNum } from '../utils/money.js';

const SERVICE_CHARGE_PERCENT = 0.1;   // 10%
const PENALTY_PERCENT_PER_DAY = 0.05; // 5% every 24h
const MAX_PENALTY_PERCENT = 0.5;      // 50% of principal
const LOAN_DURATION_HOURS = 24;
const SUSPEND_RIDER_AFTER_HOURS_OVERDUE = 72;

export function computeInitialDue(principal: number): number {
  return roundMoneyNum(principal * (1 + SERVICE_CHARGE_PERCENT));
}

export function computePenaltyCap(principal: number): number {
  return roundMoneyNum(principal * MAX_PENALTY_PERCENT);
}

export function computeNextPenalty(outstanding: number): number {
  return roundMoneyNum(outstanding * PENALTY_PERCENT_PER_DAY);
}

export async function hasActiveOrOverdueLoan(riderId: number): Promise<boolean> {
  const { rows } = await pool.query<{ loan_id: number }>(
    `SELECT loan_id FROM loans WHERE rider_id = $1 AND status IN ('ACTIVE','OVERDUE')`,
    [riderId]
  );
  return rows.length > 0;
}

async function hasActiveOrOverdueLoanWithClient(client: PoolClient, riderId: number): Promise<boolean> {
  const { rows } = await client.query<{ loan_id: number }>(
    `SELECT loan_id FROM loans WHERE rider_id = $1 AND status IN ('ACTIVE','OVERDUE')`,
    [riderId]
  );
  return rows.length > 0;
}

/** Lock loan row for update. Caller must hold client and transaction. */
export async function getLoanByIdForUpdate(client: PoolClient, loanId: number): Promise<Loan | null> {
  const { rows } = await client.query<Loan>(
    'SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE',
    [loanId]
  );
  return rows[0] ?? null;
}

export async function getLoanById(loanId: number): Promise<Loan | null> {
  const { rows } = await pool.query<Loan>('SELECT * FROM loans WHERE loan_id = $1', [loanId]);
  return rows[0] ?? null;
}

export async function createLoan(params: {
  riderId: number;
  agentId: number;
  principalAmount: number;
}): Promise<Loan> {
  const { riderId, agentId, principalAmount } = params;
  const principalRounded = roundMoneyNum(principalAmount);
  const serviceCharge = roundMoneyNum(principalRounded * SERVICE_CHARGE_PERCENT);
  const initialDue = roundMoneyNum(principalRounded + serviceCharge);
  const penaltyCap = roundMoneyNum(principalRounded * MAX_PENALTY_PERCENT);
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt.getTime() + LOAN_DURATION_HOURS * 60 * 60 * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const riderRows = await client.query(
      'SELECT rider_id, status FROM riders WHERE rider_id = $1 FOR UPDATE',
      [riderId]
    );
    if (riderRows.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Rider not found');
    }
    if (riderRows.rows[0].status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      throw new Error('Rider is not active');
    }
    const hasActive = await hasActiveOrOverdueLoanWithClient(client, riderId);
    if (hasActive) {
      await client.query('ROLLBACK');
      throw new Error('Rider already has an active or overdue loan');
    }
    const { rows } = await client.query<Loan>(
      `INSERT INTO loans (
        rider_id, agent_id, principal_amount, service_charge,
        outstanding_balance, total_penalty, penalty_cap, issued_at, due_at, status
      ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, 'ACTIVE')
      RETURNING *`,
      [riderId, agentId, principalRounded, serviceCharge, initialDue, penaltyCap, issuedAt, dueAt]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getActiveLoans(agentId?: number): Promise<Loan[]> {
  if (agentId != null) {
    const { rows } = await pool.query<Loan>(
      `SELECT * FROM loans WHERE status = 'ACTIVE' AND agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );
    return rows;
  }
  const { rows } = await pool.query<Loan>(
    `SELECT * FROM loans WHERE status = 'ACTIVE' ORDER BY created_at DESC`
  );
  return rows;
}

export async function getOverdueLoans(agentId?: number): Promise<Loan[]> {
  if (agentId != null) {
    const { rows } = await pool.query<Loan>(
      `SELECT * FROM loans WHERE status = 'OVERDUE' AND agent_id = $1 ORDER BY due_at ASC`,
      [agentId]
    );
    return rows;
  }
  const { rows } = await pool.query<Loan>(
    `SELECT * FROM loans WHERE status = 'OVERDUE' ORDER BY due_at ASC`
  );
  return rows;
}

export async function updateLoanStatus(loanId: number, status: LoanStatus): Promise<void> {
  await pool.query('UPDATE loans SET status = $1 WHERE loan_id = $2', [status, loanId]);
}

export async function applyPenaltyToLoan(loanId: number, client?: PoolClient): Promise<{ applied: boolean; newBalance: string }> {
  const ownClient = client ?? await pool.connect();
  const release = !client;
  try {
    if (!client) await ownClient.query('BEGIN');
    const { rows } = await ownClient.query<Loan>(
      'SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE',
      [loanId]
    );
    const loan = rows[0];
    if (!loan || loan.status === 'PAID') {
      if (!client) await ownClient.query('ROLLBACK');
      return { applied: false, newBalance: '0' };
    }
    const principal = parseFloat(loan.principal_amount);
    const penaltyCap = loan.penalty_cap != null
      ? parseFloat(loan.penalty_cap)
      : roundMoneyNum(principal * MAX_PENALTY_PERCENT);
    const totalPenaltySoFar = parseFloat(loan.total_penalty);
    if (roundMoneyNum(totalPenaltySoFar) >= roundMoneyNum(penaltyCap)) {
      if (!client) await ownClient.query('ROLLBACK');
      return { applied: false, newBalance: loan.outstanding_balance };
    }
    const outstanding = parseFloat(loan.outstanding_balance);
    const penaltyAmount = roundMoneyNum(outstanding * PENALTY_PERCENT_PER_DAY);
    const roomLeft = Math.max(0, roundMoneyNum(roundMoneyNum(penaltyCap) - roundMoneyNum(totalPenaltySoFar)));
    const cappedPenalty = roundMoneyNum(Math.min(penaltyAmount, roomLeft));
    const newOutstanding = roundMoney(outstanding + cappedPenalty);
    const newTotalPenaltyFinal = roundMoney(totalPenaltySoFar + cappedPenalty);

    await ownClient.query(
      `UPDATE loans SET outstanding_balance = $1, total_penalty = $2, last_penalty_applied_at = CURRENT_TIMESTAMP WHERE loan_id = $3`,
      [newOutstanding, newTotalPenaltyFinal, loanId]
    );
    await ownClient.query(
      `INSERT INTO penalties (loan_id, penalty_amount) VALUES ($1, $2)`,
      [loanId, cappedPenalty]
    );
    if (!client) await ownClient.query('COMMIT');
    return { applied: true, newBalance: newOutstanding };
  } catch (e) {
    if (!client) await ownClient.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (release) ownClient.release();
  }
}

export async function runPenaltyCron(): Promise<{ processed: number; applied: number }> {
  const now = new Date();
  const { rows: overdueLoans } = await pool.query<Loan>(
    `SELECT loan_id, due_at, last_penalty_applied_at, status FROM loans WHERE status IN ('ACTIVE','OVERDUE') AND due_at < $1`,
    [now]
  );
  let processed = 0;
  let applied = 0;
  for (const loan of overdueLoans) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: locked } = await client.query<Loan>(
        'SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE',
        [loan.loan_id]
      );
      const current = locked[0];
      if (!current || current.status === 'PAID') {
        await client.query('ROLLBACK');
        continue;
      }
      await client.query(`UPDATE loans SET status = 'OVERDUE' WHERE loan_id = $1`, [loan.loan_id]);
      const lastApplied = current.last_penalty_applied_at
        ? new Date(current.last_penalty_applied_at)
        : current.due_at
          ? new Date(current.due_at)
          : now;
      const hoursSinceLastPenalty = (now.getTime() - lastApplied.getTime()) / (60 * 60 * 1000);
      const periodsToApply = Math.floor(hoursSinceLastPenalty / 24);
      for (let i = 0; i < periodsToApply; i++) {
        const result = await applyPenaltyToLoan(loan.loan_id, client);
        if (result.applied) applied++;
      }
      await client.query('COMMIT');
      processed++;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[PenaltyCron] Loan ${loan.loan_id} failed:`, e);
    } finally {
      client.release();
    }
  }
  return { processed, applied };
}

export async function suspendRidersOverdue72h(): Promise<number> {
  const cutoff = new Date(Date.now() - SUSPEND_RIDER_AFTER_HOURS_OVERDUE * 60 * 60 * 1000);
  const { rowCount } = await pool.query(
    `UPDATE riders SET status = 'SUSPENDED'
     WHERE rider_id IN (
       SELECT DISTINCT rider_id FROM loans
       WHERE status = 'OVERDUE' AND due_at < $1
     ) AND status = 'ACTIVE'`,
    [cutoff]
  );
  return rowCount ?? 0;
}
