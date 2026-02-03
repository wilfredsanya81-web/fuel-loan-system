import { describe, it, expect } from 'vitest';
import {
  computeInitialDue,
  computePenaltyCap,
  computeNextPenalty,
} from '../services/loan.js';

describe('Loan business rules', () => {
  it('initial due = principal × 1.10 (10% service charge)', () => {
    expect(computeInitialDue(100)).toBe(110);
    expect(computeInitialDue(50)).toBe(55);
    expect(computeInitialDue(1000)).toBe(1100);
  });

  it('penalty cap = 50% of principal', () => {
    expect(computePenaltyCap(100)).toBe(50);
    expect(computePenaltyCap(200)).toBe(100);
    expect(computePenaltyCap(1000)).toBe(500);
  });

  it('next penalty = 5% of outstanding (every 24h)', () => {
    expect(computeNextPenalty(110)).toBeCloseTo(5.5, 2);
    expect(computeNextPenalty(100)).toBe(5);
    expect(computeNextPenalty(200)).toBe(10);
  });

  it('penalty compounds: after 2 periods outstanding grows correctly', () => {
    let outstanding = 110;
    const cap = 50;
    let totalPenalty = 0;
    for (let i = 0; i < 2; i++) {
      const penalty = outstanding * 0.05;
      const room = cap - totalPenalty;
      const applied = Math.min(penalty, room);
      totalPenalty += applied;
      outstanding += applied;
    }
    expect(outstanding).toBeCloseTo(110 + 5.5 + (115.5 * 0.05), 2);
  });

  it('initial due and penalty cap round consistently (2 decimals)', () => {
    expect(computeInitialDue(100.001)).toBe(110.00);
    expect(computeInitialDue(99.996)).toBe(110.00);
    expect(computePenaltyCap(100.004)).toBe(50.00);
    expect(computePenaltyCap(100.006)).toBe(50.00);
  });
});
