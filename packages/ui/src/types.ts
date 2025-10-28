// FIX: Removed circular import and defined AnalysisReason type.
export type AnalysisReason = {
  key: string;
  params?: Record<string, string | number>;
} | string;

export interface User {
  code: string; // The original plain-text code
  username: string; // The display name associated with the code
  tier: 'VIP' | 'Basic' | 'ULTRA';
  favorites: string[];
  expiryDate: string;
}

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  numTrades: number;
  takerBuyVolume: number;
  takerBuyQuoteVolume: number;
  timestamp: string;
}

export interface TickerData {
  symbol: string;
  currentPrice: number;
  priceChangePercent: number;
  volume24h: number;
  // Add other relevant fields from ticker data
}

export interface MarketContext {
    btcTrend: 'bullish' | 'bearish' | 'unknown';
    ethTrend: 'bullish' | 'bearish' | 'unknown';
    overallMarketTrend: 'bullish' | 'bearish' | 'unknown';
    marketVolatility: number | null;
}

export interface VolumeProfile {
    highVolumeNodes: number[];
    valueArea: number[];
}

export interface FetchedData {
    json: {
        symbol: string;
        currentPrice: number;
        change24h: number;
        volume24h: number;
        type: string;
        candles_1h: Candle[];
        candles_4h: Candle[];
        candles_1d: Candle[];
        tickerData: TickerData;
        marketContext: MarketContext;
        volumeProfile: VolumeProfile | null;
        dataQuality: any;
        processingInfo: any;
    };
}

export interface AnalysisTimeframe {
  price: number;
  ema: { [key: number]: number | null };
  sma: { [key: number]: number | null };
  rsi: { [key: number]: number | null };
  macd: { macd: number | null; signal: number | null; hist: number | null } | null;
  stochastic: { k: number | null; d: number | null } | null;
  willr: number | null;
  bb: { mid: number; upper: number; lower: number } | null;
  atr: number | null;
  obv: number | null;
  mfi: number | null;
  vwap: number | null;
  adx: number | null;
  trendStrength: number;
}

export interface BaseAnalysis {
    timeframes: {
        '1h': AnalysisTimeframe;
        '4h'?: AnalysisTimeframe;
        '1d'?: AnalysisTimeframe;
    };
    signal: {
        flags: any;
        score: number;
        recommendation: string;
    };
}

export interface AdvancedAnalysis {
    recommendation: {
        recommendation: string;
        confidenceScore: number;
        detailedReasons: AnalysisReason[];
    };
    trendAnalysis: {
        direction: string;
        confidence: number;
    };
    detailedReport: string;
    stopLoss?: { price: number; distance: number } | null;
    profitTargets?: { price: number; ratio: number }[];
    riskReward?: { averageRatio: number } | null;
    entryPoints?: {
        type: string;
        price: number;
        confidence: number;
        reason: AnalysisReason;
        level: number;
        requiredConfirmation: boolean;
    }[];
    // Fix: Added missing optional properties to align with analysis service output.
    candlePatterns?: { name: string, direction: string }[];
    supportResistance?: {
      support: { price: number; strength: number; count: number }[];
      resistance: { price: number; strength: number; count: number }[];
    };
    // Add other fields from the advanced analysis object if needed
}

export interface AnalysisResultData {
    symbol: string;
    currentPrice: number;
    volume24h: number;
    change24h: number; // Ensure this is here for price change filters
    isHighVolume?: boolean;
    analysis: BaseAnalysis;
    advancedAnalysis: AdvancedAnalysis;
    candles_1h: Candle[];
    candles_4h: Candle[];
    candles_1d: Candle[];
}

export interface AdvancedAnalysisResult {
    json: AnalysisResultData;
}

export interface AiAnalysisState {
  isLoading: boolean;
  resultText: string | null;
  error: string | null;
  selectedSymbol: string | null;
}

// --- New Types for AI Chat ---
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// --- New Types for AI Settings ---
export type AiProvider = 'gemini' | 'openai' | 'claude' | 'openrouter' | 'groq' | 'deepseek' | 'qwen';

export interface AiProviderConfig {
    apiKey: string | null;
    model?: string;
}

export type AiSettings = {
    [key in AiProvider]?: AiProviderConfig;
};

export interface AiDataContextConfig {
  includeAnalysis: boolean;
  analysisStrategy: string;
  includeCandles1h: boolean;
  candles1hCount: number;
  includeCandles4h: boolean;
  candles4hCount: number;
  includeCandles1d: boolean;
  candles1dCount: number;
  includeIndicators: boolean;
  includeFng: boolean;
  includeBtcDom: boolean;
}


// --- New Types for Scheduler and Backtesting ---

export interface SchedulerConfig {
    isEnabled: boolean;
    interval: number; // in minutes
}

export interface BacktestParams {
    symbols: string[];
    strategy: string;
    timePeriod: number; // in years
    initialCapital: number;
}

export interface Trade {
    symbol: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    profitPercent: number;
    reason: 'target' | 'stop-loss' | 'end';
    stopLoss: number;
    takeProfit: number;
    entryAnalysis: AnalysisResultData;
    postExitPrice: number | null;
}

export interface BacktestResult {
    params: BacktestParams;
    finalBalance: number;
    totalReturnPercent: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    equityCurve: { date: string; balance: number }[];
    trades: Trade[];
    ambiguousTradesResolved?: number;
    ambiguousTradesFailed?: number;
}

export interface BacktestProgress {
    status: string;
    symbol: string;
    progress: number; // 0 to 1
}

// --- New Types for Logging ---
export type LogType = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
    id: number;
    timestamp: Date;
    type: LogType;
    message: string;
    details?: string;
}

// --- Market Sentiment & News Types ---
export interface FearAndGreedData {
    value: number;
    value_classification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
    timestamp: string;
    time_until_update?: string;
}

export interface BtcDominanceData {
    btc_dominance: number;
}

export interface TotalMarketCapData {
    total_market_cap_usd: number;
    market_cap_change_percentage_24h_usd: number;
}

export interface FuturesData {
  globalLongShortRatio: number;
  fundingRate: number;
}

export interface MarketSentiment {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // A score from -1 (very bearish) to 1 (very bullish)
}

export interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}


// --- History Types ---
export interface BacktestHistoryEntry {
  id: string;
  date: string;
  result: BacktestResult;
}

// --- Verification Types ---
export type DealStatus = 'pending' | 'completed';
export type VerificationResultStatus = 'hit_target' | 'hit_stoploss' | 'running' | 'error';

export interface VerificationResult {
    status: VerificationResultStatus;
    exitPrice?: number;
    exitDate?: string;
    profitPercent?: number;
    achievedTarget?: number;
    message?: string;
}

export interface Deal {
    id: string;
    timestamp: string;
    status: DealStatus;
    analysisResult: AnalysisResultData;
    verificationResult?: VerificationResult;
}

// --- Search Filter Types ---
export type IndicatorTimeframe = '1h' | '4h' | '1d';

export interface SearchFilters {
  // Price & Volume
  priceIncrease?: number; 
  priceDecrease?: number; 
  isHighVolume?: boolean;
  // Candle
  lastCandleStatus?: 'any' | 'bullish' | 'bearish' | 'doji';
  candleTimeframe?: IndicatorTimeframe;
  // Structure
  isBreakingSupport?: boolean;
  // Indicators
  indicatorTimeframe?: IndicatorTimeframe;
  rsiCondition?: 'any' | 'oversold' | 'overbought'; // < 30 or > 70
  macdCondition?: 'any' | 'bullish_cross' | 'bearish_cross';
  maCondition?: 'any' | 'price_above_sma50' | 'price_below_sma50';
}

// --- Arbitrage Types ---
export interface ArbitrageOpportunity {
  symbol: string;
  buyFrom: {
    exchange: string;
    price: number;
  };
  sellTo: {
    exchange: string;
    price: number;
  };
  profitPercentage: number;
}

export interface Exchange {
  id: string;
  name: string;
}
