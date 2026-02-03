import cron from 'node-cron';
import * as loanService from '../services/loan.js';

export function startPenaltyCron(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const { processed, applied } = await loanService.runPenaltyCron();
      const suspended = await loanService.suspendRidersOverdue72h();
      if (processed > 0 || applied > 0 || suspended > 0) {
        console.log(`[Cron] Penalties: ${processed} loans processed, ${applied} penalty applications; ${suspended} riders suspended.`);
      }
    } catch (e) {
      console.error('[Cron] Penalty job error:', e);
    }
  }, { timezone: 'Africa/Kampala' });
  console.log('[Cron] Hourly penalty job scheduled (Africa/Kampala).');
}
