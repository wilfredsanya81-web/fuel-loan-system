/**
 * MTN MoMo Collections API (Uganda).
 * STK push to collect from rider phone; callbacks for async payment status.
 */

const MTN_BASE_SANDBOX = 'https://sandbox.momodeveloper.mtn.com';
const MTN_BASE_PRODUCTION = 'https://momodeveloper.mtn.com';

export interface MTNStkRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: { partyIdType: 'MSISDN'; partyId: string };
  payerMessage: string;
  payeeNote: string;
}

export interface MTNStkResponse {
  financialTransactionId?: string;
  externalId?: string;
  status?: string;
  reason?: { code: string; message: string };
}

export async function requestToPay(
  referenceId: string,
  amount: number,
  payerMsisdn: string,
  payerMessage: string,
  payeeNote: string
): Promise<{ success: boolean; transactionId?: string; externalId?: string; error?: string }> {
  const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  const apiKey = process.env.MTN_MOMO_API_KEY;
  const apiUser = process.env.MTN_MOMO_API_USER;
  const env = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
  const base = env === 'production' ? MTN_BASE_PRODUCTION : MTN_BASE_SANDBOX;

  if (!subscriptionKey || !apiKey || !apiUser) {
    return { success: false, error: 'MTN MoMo credentials not configured' };
  }

  const msisdn = payerMsisdn.replace(/\D/g, '');
  const ugandaPrefix = msisdn.startsWith('256') ? msisdn : `256${msisdn.replace(/^0/, '')}`;

  const body: MTNStkRequest = {
    amount: amount.toFixed(2),
    currency: 'UGX',
    externalId: referenceId,
    payer: { partyIdType: 'MSISDN', partyId: ugandaPrefix },
    payerMessage: payerMessage.substring(0, 255),
    payeeNote: payeeNote.substring(0, 255),
  };

  try {
    const tokenRes = await fetch(`${base}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return { success: false, error: `Token: ${errText}` };
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const stkRes = await fetch(`${base}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'X-Reference-Id': referenceId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (stkRes.status === 202 || stkRes.ok) {
      return { success: true, transactionId: referenceId, externalId: referenceId };
    }
    const errBody = await stkRes.text();
    return { success: false, error: errBody };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export async function getTransactionStatus(referenceId: string): Promise<{ status: string; amount?: number; reason?: string } | null> {
  const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
  const apiKey = process.env.MTN_MOMO_API_KEY;
  const apiUser = process.env.MTN_MOMO_API_USER;
  const env = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';
  const base = env === 'production' ? MTN_BASE_PRODUCTION : MTN_BASE_SANDBOX;

  if (!subscriptionKey || !apiKey || !apiUser) return null;

  try {
    const tokenRes = await fetch(`${base}/collection/token/`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    if (!tokenRes.ok) return null;
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const res = await fetch(`${base}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { status: data.status || 'UNKNOWN', amount: data.amount };
  } catch {
    return null;
  }
}
