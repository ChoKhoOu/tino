import { createHmac } from 'crypto';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EXCHANGES: Record<string, (key: string, secret: string) => Promise<ValidationResult>> = {
  binance: validateBinance,
  okx: validateOkx,
  bybit: validateBybit,
};

export async function validateApiKey(
  exchange: string,
  apiKey: string,
  apiSecret: string,
): Promise<ValidationResult> {
  const validator = EXCHANGES[exchange.toLowerCase()];
  if (!validator) {
    return { valid: false, error: `Unsupported exchange: ${exchange}` };
  }
  try {
    return await validator(apiKey, apiSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { valid: false, error: `Connection failed: ${message}` };
  }
}

async function validateBinance(apiKey: string, apiSecret: string): Promise<ValidationResult> {
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = createHmac('sha256', apiSecret).update(query).digest('hex');
  const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;
  const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
  if (res.ok) return { valid: true };
  return { valid: false, error: `Binance API returned ${res.status}` };
}

async function validateOkx(apiKey: string, apiSecret: string): Promise<ValidationResult> {
  const timestamp = new Date().toISOString();
  const preSign = `${timestamp}GET/api/v5/account/balance`;
  const sign = createHmac('sha256', apiSecret).update(preSign).digest('base64');
  const res = await fetch('https://www.okx.com/api/v5/account/balance', {
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': '',
    },
  });
  if (res.ok) return { valid: true };
  return { valid: false, error: `OKX API returned ${res.status}` };
}

async function validateBybit(apiKey: string, apiSecret: string): Promise<ValidationResult> {
  const timestamp = Date.now().toString();
  const params = `accountType=UNIFIED`;
  const preSign = `${timestamp}${apiKey}5000${params}`;
  const sign = createHmac('sha256', apiSecret).update(preSign).digest('hex');
  const url = `https://api.bybit.com/v5/account/wallet-balance?${params}`;
  const res = await fetch(url, {
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-SIGN': sign,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': '5000',
    },
  });
  if (res.ok) return { valid: true };
  return { valid: false, error: `Bybit API returned ${res.status}` };
}
