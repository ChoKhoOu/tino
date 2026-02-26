import {
  StrategyCreateResponseSchema,
  StrategyListResponseSchema,
  StrategySchema,
  type StrategyCreate,
  type Strategy,
  type StrategyListResponse,
  type StrategyCreateResponse,
} from './schemas/strategy.js';
import {
  BacktestRunSchema,
  BacktestCreateResponseSchema,
  type BacktestCreate,
  type BacktestRun,
  type BacktestCreateResponse,
} from './schemas/backtest.js';
import {
  LiveSessionSchema,
  LiveDeployResponseSchema,
  KillSwitchResponseSchema,
  type LiveDeploy,
  type LiveSession,
  type LiveDeployResponse,
  type KillSwitchResponse,
} from './schemas/live-session.js';
import {
  RiskProfileSchema,
  type RiskProfile,
  type RiskProfileUpdate,
} from './schemas/risk.js';
import { z } from 'zod';

export class EngineApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'EngineApiError';
  }
}

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

const HealthResponseSchema = z.object({
  status: z.string(),
  engine_version: z.string(),
  nautilus_version: z.string(),
  active_live_sessions: z.number(),
  running_backtests: z.number(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export class EngineClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // --- Health ---

  async health(): Promise<HealthResponse> {
    return this._get('/api/health', HealthResponseSchema);
  }

  // --- Strategies ---

  async createStrategy(data: StrategyCreate): Promise<StrategyCreateResponse> {
    return this._post('/api/strategies', data, StrategyCreateResponseSchema);
  }

  async listStrategies(
    limit = 20,
    offset = 0,
  ): Promise<StrategyListResponse> {
    return this._get(
      `/api/strategies?limit=${limit}&offset=${offset}`,
      StrategyListResponseSchema,
    );
  }

  async getStrategy(versionHash: string): Promise<Strategy> {
    return this._get(
      `/api/strategies/${encodeURIComponent(versionHash)}`,
      StrategySchema,
    );
  }

  // --- Backtesting ---

  async submitBacktest(data: BacktestCreate): Promise<BacktestCreateResponse> {
    return this._post('/api/backtest', data, BacktestCreateResponseSchema);
  }

  async getBacktest(id: string): Promise<BacktestRun> {
    return this._get(`/api/backtest/${id}`, BacktestRunSchema);
  }

  // --- Live Trading ---

  async deployLive(data: LiveDeploy): Promise<LiveDeployResponse> {
    return this._post('/api/live/deploy', data, LiveDeployResponseSchema);
  }

  async pauseLive(id: string): Promise<void> {
    await this._post(`/api/live/${id}/pause`, {}, z.unknown());
  }

  async resumeLive(
    id: string,
    confirmedBySession: string,
  ): Promise<void> {
    await this._post(
      `/api/live/${id}/resume`,
      { confirmed_by_session: confirmedBySession },
      z.unknown(),
    );
  }

  async stopLive(id: string): Promise<void> {
    await this._post(`/api/live/${id}/stop`, {}, z.unknown());
  }

  async killSwitch(): Promise<KillSwitchResponse> {
    return this._post('/api/kill-switch', {}, KillSwitchResponseSchema);
  }

  async getLiveSession(id: string): Promise<LiveSession> {
    return this._get(`/api/live/${id}`, LiveSessionSchema);
  }

  // --- Risk ---

  async getRiskProfile(): Promise<RiskProfile> {
    return this._get('/api/risk/profile', RiskProfileSchema);
  }

  async updateRiskProfile(data: RiskProfileUpdate): Promise<RiskProfile> {
    return this._put('/api/risk/profile', data, RiskProfileSchema);
  }

  // --- Data ---

  async getDataCacheStatus(): Promise<unknown> {
    return this._get('/api/data/cache/status', z.unknown());
  }

  // --- Internal HTTP helpers ---

  private async _get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.output<S>> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return this._handleResponse(response, schema);
  }

  private async _post<S extends z.ZodTypeAny>(
    path: string,
    body: unknown,
    schema: S,
  ): Promise<z.output<S>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this._handleResponse(response, schema);
  }

  private async _put<S extends z.ZodTypeAny>(
    path: string,
    body: unknown,
    schema: S,
  ): Promise<z.output<S>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this._handleResponse(response, schema);
  }

  private async _handleResponse<S extends z.ZodTypeAny>(
    response: Response,
    schema: S,
  ): Promise<z.output<S>> {
    if (!response.ok) {
      let errorData: { error: string; message: string; details?: unknown };
      try {
        const raw = await response.json();
        errorData = ErrorResponseSchema.parse(raw);
      } catch {
        errorData = {
          error: 'UNKNOWN_ERROR',
          message: response.statusText || 'Request failed',
        };
      }
      throw new EngineApiError(
        response.status,
        errorData.error,
        errorData.message,
        errorData.details,
      );
    }

    const data = await response.json();
    return schema.parse(data);
  }
}
