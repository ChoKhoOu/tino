import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadRiskConfig, type RiskConfig } from './risk-config.js';
import { ALL_RULES, type OrderInput, type RiskState, type RuleResult } from './risk-rules.js';
import { getTradingClient } from '@/tools/trading/grpc-clients.js';

const RISK_EVENTS_FILE = '.tino/risk-events.log';

export interface PreTradeResult {
  allowed: boolean;
  reason?: string;
}

export class RiskEngine {
  private config: RiskConfig;
  private state: RiskState;

  constructor(config?: RiskConfig) {
    this.config = config ?? loadRiskConfig();
    this.state = {
      positions: {},
      prices: {},
      dailyPnl: 0,
      peakEquity: 0,
      currentEquity: 0,
      recentOrderTimestamps: [],
    };
  }

  getConfig(): RiskConfig {
    return this.config;
  }

  getState(): Readonly<RiskState> {
    return this.state;
  }

  reload(): void {
    this.config = loadRiskConfig();
  }

  updatePosition(instrument: string, quantity: number): void {
    this.state.positions[instrument] = quantity;
  }

  updatePrice(instrument: string, price: number): void {
    this.state.prices[instrument] = price;
  }

  updatePnl(pnl: number): void {
    this.state.dailyPnl = pnl;
  }

  updateEquity(equity: number): void {
    this.state.currentEquity = equity;
    if (equity > this.state.peakEquity) {
      this.state.peakEquity = equity;
    }
  }

  recordOrder(): void {
    this.state.recentOrderTimestamps.push(Date.now());
    const cutoff = Date.now() - 60_000;
    this.state.recentOrderTimestamps = this.state.recentOrderTimestamps.filter((t) => t > cutoff);
  }

  resetDaily(): void {
    this.state.dailyPnl = 0;
    this.state.recentOrderTimestamps = [];
  }

  preTradeCheck(order: OrderInput): PreTradeResult {
    for (const rule of ALL_RULES) {
      const result: RuleResult = rule(order, this.state, this.config);
      if (!result.pass) {
        const triggerKill = result.reason?.includes('Drawdown');
        if (triggerKill) {
          this.triggerKillSwitch().catch(() => {});
        }
        this.logEvent('pre_trade_refused', { order, reason: result.reason });
        return { allowed: false, reason: result.reason };
      }
    }
    return { allowed: true };
  }

  async triggerKillSwitch(): Promise<void> {
    this.logEvent('kill_switch_triggered', { positions: this.state.positions });

    try {
      const client = getTradingClient();
      await client.stopTrading(true);
    } catch (err) {
      this.logEvent('kill_switch_error', { error: String(err) });
    }

    this.state.positions = {};
  }

  private logEvent(event: string, data: Record<string, unknown>): void {
    try {
      const dir = join('.tino');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        ...data,
      });
      appendFileSync(RISK_EVENTS_FILE, entry + '\n');
    } catch {
      // Non-fatal: risk event logging should never break execution
    }
  }
}

let _riskEngine: RiskEngine | null = null;

export function getRiskEngine(): RiskEngine {
  if (!_riskEngine) _riskEngine = new RiskEngine();
  return _riskEngine;
}

export function __setRiskEngine(engine: RiskEngine | null): void {
  _riskEngine = engine;
}

/**
 * Create a PreToolCheck callback from a RiskEngine.
 * Encapsulates the trading_live + submit_order risk check logic.
 */
export function createPreToolCheck(engine: RiskEngine): (toolId: string, args: Record<string, unknown>) => PreTradeResult {
  return (toolId: string, args: Record<string, unknown>): PreTradeResult => {
    if (toolId !== 'trading_live' || args.action !== 'submit_order') {
      return { allowed: true };
    }
    const order = (args.order ?? {}) as Record<string, unknown>;
    const result = engine.preTradeCheck({
      venue: String(args.venue ?? 'SIM'),
      instrument: String(order.instrument ?? ''),
      side: (String(order.side ?? 'buy')) as 'buy' | 'sell',
      quantity: Number(order.quantity ?? 0),
      price: Number(order.price ?? 0),
    });
    if (result.allowed) {
      engine.recordOrder();
    }
    return result;
  };
}
