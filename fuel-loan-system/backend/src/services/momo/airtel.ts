/**
 * Airtel Money Collections API (Uganda).
 * STK push to collect from rider; callbacks for async payment status.
 */

const AIRTEL_SANDBOX = 'https://openapi.airtel.africa';
const AIRTEL_PRODUCTION = 'https://openapi.airtel.africa';

export interface AirtelStkRequest {
  reference: string;
  subscriber: { country: string; currency: string; msisdn: string };
  transaction: { amount: string; country: string; currency: string; id: string };
}

export async function requestToPay(
  referenceId: string,
  amount: number,
  payerMsisdn: string,
  _payerMessage: string,
  _payeeNote: string
): Promise<{ success: boolean; transactionId?: string; externalId?: string; error?: string }> {
  const clientId = process.env.AIRTEL_CLIENT_ID;
  const clientSecret = process.env.AIRTEL_CLIENT_SECRET;
  const env = process.env.AIRTEL_ENVIRONMENT || 'sandbox';
  const base = env === 'production' ? AIRTEL_PRODUCTION : AIRTEL_SANDBOX;

  if (!clientId || !clientSecret) {
    return { success: false, error: 'Airtel credentials not configured' };
  }

  const msisdn = payerMsisdn.replace(/\D/g, '');
  const ugandaMsisdn = msisdn.startsWith('256') ? msisdn : `256${msisdn.replace(/^0/, '')}`;

  try {
    const tokenRes = await fetch(`${base}/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return { success: false, error: `Token: ${errText}` };
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const body = {
      reference: referenceId,
      subscriber: { country: 'UG', currency: 'UGX', msisdn: ugandaMsisdn },
      transaction: {
        amount: amount.toFixed(2),
        country: 'UG',
        currency: 'UGX',
        id: referenceId,
      },
    };

    const stkRes = await fetch(`${base}/merchant/v1/payments/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (stkRes.status >= 200 && stkRes.status < 300) {
      return { success: true, transactionId: referenceId, externalId: referenceId };
    }
    const errBody = await stkRes.text();
    return { success: false, error: errBody };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
