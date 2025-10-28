/* eslint-disable */
// @ts-nocheck
import { logService } from './logService';
import { runMainBalancedStrategy } from './strategies/mainBalancedStrategy';
import { runMeanReversionStrategy } from './strategies/meanReversionStrategy';
import { runMomentumBreakoutStrategy } from './strategies/momentumBreakoutStrategy';
import { runSupplyDemandStrategy } from './strategies/supplyDemandStrategy';


// This file combines and adapts the logic from the user's n8n workflow.
// The code is ported with minimal changes to preserve the original analysis algorithm.
// Type safety is applied at the entry/exit points, but 'any' is used internally
// to avoid a full rewrite of the complex, ported JavaScript logic.


// ========================================================================
// START OF: crypto_indicators_n8n_analysis_v1.js (Node: Code)
// ========================================================================

const CONFIG_V1 = {
  indicators: {
    emaPeriods: [9, 21, 50],
    smaPeriods: [50, 200],
    rsiPeriods: [14, 7, 21],
    stochastic: { k: 14, d: 3, smoothK: 3 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bollinger: { period: 20, stds: 2 },
    atr: 14,
    ichimoku: { tenkan: 9, kijun: 26, senkouB: 52 },
    mfi: 14,
    adx: 14
  },
  scoringWeights: {
    trend: 0.30,
    momentum: 0.25,
    volume: 0.20,
    orderbook: 0.15,
    volatility: 0.10
  },
  thresholds: {
    buy: 0.75,
    conditional: 0.60
  }
};

function last_v1(arr, n = 1) {
  return arr.length ? arr[arr.length - n] : null;
}

function mean_v1(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std_v1(arr) {
  const m = mean_v1(arr);
  if (m === null) return null;
  const v = mean_v1(arr.map(x => Math.pow(x - m, 2)));
  return Math.sqrt(v);
}

function SMA(values, period) {
  if (!values || values.length < period) return null;
  const res = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) res.push(sum / period);
  }
  return res;
}

function EMA(values, period) {
  if (!values || values.length < period) return null;
  const res = [];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period; // SMA seed
  res.push(ema);
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    res.push(ema);
  }
  return res;
}

function RSIFromCloses(closes, period) {
  if (!closes || closes.length <= period) return null;
  const rsivals = [];
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  rsivals.push(100 - (100 / (1 + (avgGain / (avgLoss || 1e-8)))));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgGain / (avgLoss || 1e-8);
    rsivals.push(100 - 100 / (1 + rs));
  }
  return rsivals;
}

function MACD(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow) return null;
  const emaFast = EMA(closes, fast);
  const emaSlow = EMA(closes, slow);
  if (!emaFast || !emaSlow) return null;
  const alignOffset = emaFast.length - emaSlow.length;
  const macdLine = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + alignOffset] - emaSlow[i]);
  }
  const signalLine = EMA(macdLine, signal);
  if (!signalLine) return null;
  const hist = [];
  const histOffset = macdLine.length - signalLine.length;
  for (let i = 0; i < signalLine.length; i++) hist.push(macdLine[i + histOffset] - signalLine[i]);
  return {
    macd: macdLine.slice(histOffset),
    signal: signalLine,
    hist
  };
}

function Stochastic(candles, kPeriod = 14, dPeriod = 3, smoothK = 3) {
  if (!candles || candles.length < kPeriod) return null;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const kValues = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const highSlice = highs.slice(i - (kPeriod - 1), i + 1);
    const lowSlice = lows.slice(i - (kPeriod - 1), i + 1);
    const highestHigh = Math.max(...highSlice);
    const lowestLow = Math.min(...lowSlice);
    const k = 100 * (closes[i] - lowestLow) / (highestHigh - lowestLow || 1e-8);
    kValues.push(k);
  }
  const smoothKValues = [];
  for (let i = smoothK - 1; i < kValues.length; i++) {
    const s = mean_v1(kValues.slice(i - (smoothK - 1), i + 1));
    smoothKValues.push(s);
  }
  const dValues = [];
  for (let i = dPeriod - 1; i < smoothKValues.length; i++) {
    dValues.push(mean_v1(smoothKValues.slice(i - (dPeriod - 1), i + 1)));
  }
  return { k: smoothKValues, d: dValues };
}

function WilliamsR(candles, period = 14) {
  if (!candles || candles.length < period) return null;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const res = [];
  for (let i = period - 1; i < candles.length; i++) {
    const hh = Math.max(...highs.slice(i - (period - 1), i + 1));
    const ll = Math.min(...lows.slice(i - (period - 1), i + 1));
    res.push(-100 * (hh - closes[i]) / (hh - ll || 1e-8));
  }
  return res;
}

function BollingerBands(closes, period = 20, stds = 2) {
  if (!closes || closes.length < period) return null;
  const sma = SMA(closes, period);
  if (!sma) return null;
  const bands = [];
  for (let i = 0; i < sma.length; i++) {
    const window = closes.slice(i, i + period);
    const s = std_v1(window);
    if (s === null) continue;
    bands.push({ mid: sma[i], upper: sma[i] + stds * s, lower: sma[i] - stds * s });
  }
  return bands;
}

function ATR_wilder(candles, period = 14) {
  if (!candles || candles.length <= period) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = mean_v1(trs.slice(0, period));
  const res = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    res.push(atr);
  }
  return res;
}

function VWAP_fromCandles(candles) {
  if (!candles || !candles.length) return null;
  let pv = 0, vol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
  }
  return vol ? pv / vol : null;
}

function MFI(candles, period = 14) {
  if (!candles || candles.length <= period) return null;
  const typical = candles.map(c => (c.high + c.low + c.close) / 3);
  const raw = [];
  for (let i = 1; i < candles.length; i++) raw.push(typical[i] - typical[i - 1]);
  const positiveFlow = [];
  const negativeFlow = [];
  for (let i = 1; i < candles.length; i++) {
    const tp = typical[i];
    const vol = candles[i].volume;
    if (typical[i] > typical[i - 1]) { positiveFlow.push(tp * vol); negativeFlow.push(0); }
    else { negativeFlow.push(tp * vol); positiveFlow.push(0); }
  }
  const res = [];
  for (let i = 0; i <= positiveFlow.length - period; i++) {
    const pf = mean_v1(positiveFlow.slice(i, i + period));
    const nf = mean_v1(negativeFlow.slice(i, i + period));
    const r = pf / (nf || 1e-8);
    res.push(100 - (100 / (1 + r)));
  }
  return res;
}

function OBV(candles) {
  if (!candles || !candles.length) return null;
  const res = [];
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obv += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) obv -= candles[i].volume;
    res.push(obv);
  }
  return res;
}

function ADX(candles, period = 14) {
  if (!candles || candles.length <= period * 2) return null;
  const tr = [];
  const plusDM = [];
  const minusDM = [];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
  }
  const smooth = (arr, p) => {
    const res = [];
    let sum = 0;
    for (let i = 0; i < p; i++) sum += arr[i];
    let prev = sum;
    res.push(prev);
    for (let i = p; i < arr.length; i++) {
      prev = prev - (prev / p) + arr[i];
      res.push(prev);
    }
    return res;
  };
  const sTR = smooth(tr, period);
  const sPlus = smooth(plusDM, period);
  const sMinus = smooth(minusDM, period);
  const pdi = [], mdi = [];
  const start = sTR.length - sPlus.length;
  for (let i = 0; i < sPlus.length; i++) {
    pdi.push(100 * (sPlus[i] / (sTR[i + start] || 1e-8)));
    mdi.push(100 * (sMinus[i] / (sTR[i + start] || 1e-8)));
  }
  const dx = pdi.map((p, i) => 100 * Math.abs(p - mdi[i]) / ((p + mdi[i]) || 1e-8));
  const adx = [];
  if (dx.length >= period) {
    let sum = 0; for (let i = 0; i < period; i++) sum += dx[i];
    let val = sum / period; adx.push(val);
    for (let i = period; i < dx.length; i++) { val = (val * (period - 1) + dx[i]) / period; adx.push(val); }
  }
  return { pdi, mdi, adx };
}

function analyzeTimeframe(candles) {
  if (!candles || candles.length < 30) return { error: 'insufficient_data' };
  const closes = candles.map(c => c.close);

  const ema = {};
  for (const p of CONFIG_V1.indicators.emaPeriods) {
    const e = EMA(closes, p);
    ema[p] = e ? last_v1(e) : null;
  }
  const sma = {};
  for (const p of CONFIG_V1.indicators.smaPeriods) sma[p] = SMA(closes, p) ? last_v1(SMA(closes, p)) : null;

  const rsi = {};
  for (const p of CONFIG_V1.indicators.rsiPeriods) {
    const r = RSIFromCloses(closes, p);
    rsi[p] = r ? last_v1(r) : null;
  }
  const macd = MACD(closes, CONFIG_V1.indicators.macd.fast, CONFIG_V1.indicators.macd.slow, CONFIG_V1.indicators.macd.signal);
  const stochastic = Stochastic(candles, CONFIG_V1.indicators.stochastic.k, CONFIG_V1.indicators.stochastic.d, CONFIG_V1.indicators.stochastic.smoothK);
  const willr = WilliamsR(candles, 14);

  const bb = BollingerBands(closes, CONFIG_V1.indicators.bollinger.period, CONFIG_V1.indicators.bollinger.stds);
  const atrArr = ATR_wilder(candles, CONFIG_V1.indicators.atr);
  const atr = atrArr ? last_v1(atrArr) : null;

  const obv = OBV(candles);
  const mfiArr = MFI(candles, CONFIG_V1.indicators.mfi);
  const mfi = mfiArr ? last_v1(mfiArr) : null;
  const vwap = VWAP_fromCandles(candles);

  const adxStruct = ADX(candles, CONFIG_V1.indicators.adx);
  const adx = adxStruct && adxStruct.adx ? last_v1(adxStruct.adx) : null;

  const price = last_v1(closes);
  const ema21 = ema[21], ema50 = ema[50];
  const trendStrength = (() => {
    const ema21Array = EMA(closes, 21);
    const slope21 = ema21 && ema21Array && ema21Array.length >= 2 ? (ema21 - ema21Array[ema21Array.length - 2]) : 0;
    let s = 0;
    if (price && ema50) s += Math.sign(price - ema50) * Math.min(Math.abs((price - ema50) / (ema50 || 1)), 1);
    if (slope21) s += Math.sign(slope21) * Math.min(Math.abs(slope21) / (ema21 || 1), 1);
    if (adx) s += Math.sign(adx - 20) * Math.min(Math.abs((adx - 20) / 50), 1);
    return Math.max(-1, Math.min(1, s / 3));
  })();

  return {
    price, ema, sma, rsi,
    macd: macd ? { macd: last_v1(macd.macd), signal: last_v1(macd.signal), hist: last_v1(macd.hist) } : null,
    stochastic: stochastic ? { k: last_v1(stochastic.k), d: last_v1(stochastic.d) } : null,
    willr: willr ? last_v1(willr) : null,
    bb: bb ? last_v1(bb) : null,
    atr,
    obv: obv ? last_v1(obv) : null,
    mfi, vwap, adx, trendStrength
  };
}

function computeSignal(analysis1h, analysis4h, analysis1d, orderBook) {
  const trendFlag = (() => {
    const t1 = analysis1d && analysis1d.price && analysis1d.ema && analysis1d.ema[50] && analysis1d.price > analysis1d.ema[50];
    const t2 = analysis4h && analysis4h.price && analysis4h.ema && analysis4h.ema[50] && analysis4h.price > analysis4h.ema[50];
    return (t1 && t2) ? 1 : (t1 || t2) ? 0.5 : 0;
  })();

  const momentumFlag = (() => {
    let score = 0;
    if (analysis1h && analysis1h.macd && analysis1h.macd.hist > 0) score += 0.4;
    if (analysis4h && analysis4h.macd && analysis4h.macd.hist > 0) score += 0.4;
    if (analysis1h && analysis1h.rsi && analysis1h.rsi[14] > 50) score += 0.1;
    return Math.min(1, score);
  })();

  const volumeFlag = (() => {
    let score = 0;
    if (analysis1h && analysis1h.obv) score += 0.5;
    if (analysis1h && analysis1h.mfi && analysis1h.mfi > 50) score += 0.3;
    if (orderBook && orderBook.bids && orderBook.asks) {
      const topBid = parseFloat(orderBook.bids[0][0]);
      const topAsk = parseFloat(orderBook.asks[0][0]);
      const spread = (topAsk - topBid) / ((topAsk + topBid) / 2 || 1);
      if (spread < 0.002) score += 0.2;
    }
    return Math.min(1, score);
  })();

  const orderbookFlag = (() => {
    if (!orderBook) return 0.5;
    const mid = (parseFloat(orderBook.bids[0][0]) + parseFloat(orderBook.asks[0][0])) / 2;
    let bidVol = 0, askVol = 0;
    for (const [p, v] of orderBook.bids) if (Math.abs(p - mid) / mid <= 0.01) bidVol += parseFloat(v);
    for (const [p, v] of orderBook.asks) if (Math.abs(p - mid) / mid <= 0.01) askVol += parseFloat(v);
    if (bidVol + askVol === 0) return 0.5;
    const ratio = bidVol / (askVol || 1e-8);
    if (ratio > 1.2) return 1;
    if (ratio < 0.8) return 0;
    return 0.5;
  })();

  const volatilityFlag = (() => {
    const atr1h = analysis1h ? analysis1h.atr : null;
    const price = analysis1h ? analysis1h.price : null;
    if (!atr1h || !price) return 0.5;
    const atrP = atr1h / price;
    if (atrP < 0.005) return 0.2;
    if (atrP > 0.05) return 0.2;
    return 1 - Math.abs((atrP - 0.02) / 0.02);
  })();

  const w = CONFIG_V1.scoringWeights;
  const finalScore = Math.max(0, Math.min(1, (trendFlag * w.trend) + (momentumFlag * w.momentum) + (volumeFlag * w.volume) + (orderbookFlag * w.orderbook) + (volatilityFlag * w.volatility)));
  const recommendation = finalScore >= CONFIG_V1.thresholds.buy ? 'buy' : finalScore >= CONFIG_V1.thresholds.conditional ? 'conditional' : 'wait';

  return {
    flags: { trendFlag, momentumFlag, volumeFlag, orderbookFlag, volatilityFlag },
    score: finalScore,
    recommendation
  };
}

async function runBaseAnalysis(items) {
  const out = [];
  for (const it of items) {
    try {
      const data = it.json;
      const a1h = analyzeTimeframe(data.candles_1h || []);
      const a4h = analyzeTimeframe(data.candles_4h || []);
      const a1d = analyzeTimeframe(data.candles_1d || []);
      const signal = computeSignal(a1h, a4h, a1d, data.orderBook || null);
      const newJson = Object.assign({}, data, { analysis: { timeframes: { '1h': a1h, '4h': a4h, '1d': a1d }, signal } });
      out.push({ json: newJson });
    } catch (e) {
      out.push({ json: Object.assign({}, it.json, { analysisError: e.message }) });
    }
  }
  return out;
}

const addRelativeMetrics = (items) => {
    if (!items || items.length === 0) return items;

    // High Volume Calculation
    const volumes = items.map(item => item.json.volume24h).filter(v => v > 0).sort((a, b) => a - b);
    const q3Index = Math.floor(volumes.length * 0.75);
    const highVolumeThreshold = volumes[q3Index] || 0;

    return items.map(item => {
        const isHighVolume = item.json.volume24h > highVolumeThreshold;
        return {
            ...item,
            json: {
                ...item.json,
                isHighVolume
            }
        };
    });
};

// Main exported function that chains the analyses
export const runFullAnalysis = async (items, strategy = 'main_balanced') => {
    logService.addLog('info', `Starting full analysis for ${items.length} items with strategy: ${strategy}`);
    try {
        logService.addLog('info', "Starting base analysis...");
        const baseAnalysisResults = await runBaseAnalysis(items);
        logService.addLog('success', "Base analysis complete.");

        logService.addLog('info', `Starting advanced analysis with strategy: ${strategy}...`);
        
        let advancedAnalysisResults;
        switch (strategy) {
            case 'main_balanced':
                advancedAnalysisResults = await runMainBalancedStrategy(baseAnalysisResults);
                break;
            case 'mean_reversion':
                advancedAnalysisResults = await runMeanReversionStrategy(baseAnalysisResults);
                break;
            case 'momentum_breakout':
                advancedAnalysisResults = await runMomentumBreakoutStrategy(baseAnalysisResults);
                break;
            case 'supply_demand':
                advancedAnalysisResults = await runSupplyDemandStrategy(baseAnalysisResults);
                break;
            default:
                 logService.addLog('warn', `Unknown strategy '${strategy}', falling back to 'main_balanced'.`);
                 advancedAnalysisResults = await runMainBalancedStrategy(baseAnalysisResults);
        }
        logService.addLog('success', `Advanced analysis for '${strategy}' complete.`);
        
        logService.addLog('info', "Adding relative metrics...");
        const finalResults = addRelativeMetrics(advancedAnalysisResults);
        
        logService.addLog('success', "Full analysis complete.");
        return finalResults;
    } catch (error) {
        logService.addLog('error', "An unexpected error occurred during runFullAnalysis.", { error: error.message, stack: error.stack });
        throw error; // Re-throw the error to be caught by the UI
    }
};