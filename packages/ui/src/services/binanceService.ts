import { CANDLE_COUNTS } from '../constants';
import type { FetchedData, Candle, MarketContext } from '../types';
import { logService } from './logService';

// Delay function to avoid API rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Safe request function with retries
const safeRequest = async (url: string, retries = 3, signal?: AbortSignal): Promise<{ success: boolean; data?: any; error?: string; status?: number }> => {
  for (let i = 0; i < retries; i++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      logService.addLog('success', `GET ${new URL(url).pathname}`, { status: response.status, url });
      return { success: true, data, status: response.status };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logService.addLog('warn', `Request aborted by user: ${url}`);
        throw error;
      }
      console.warn(`Request failed: ${url} (Attempt ${i + 1}/${retries})`, error.message);
      if (i === retries - 1) {
        const status = response?.status || 0;
        console.error(`Request failed after ${retries} attempts: ${url}`);
        logService.addLog('error', `GET ${new URL(url).pathname} failed after ${retries} retries`, { status, error: error.message, url });
        return { success: false, error: error.message, status };
      }
      await delay(200 * (i + 1));
    }
  }
  logService.addLog('error', `GET ${new URL(url).pathname} failed unexpectedly`, { url });
  return { success: false, error: 'Unknown error after retries.', status: 0 };
};


const processCandles = (candles: any[]): Candle[] => {
  return candles.map(candle => ({
    openTime: parseInt(candle[0]),
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5]),
    quoteVolume: parseFloat(candle[7]),
    numTrades: parseInt(candle[8]),
    takerBuyVolume: parseFloat(candle[9]),
    takerBuyQuoteVolume: parseFloat(candle[10]),
    timestamp: new Date(parseInt(candle[0])).toISOString()
  }));
};

const fetchCompleteDataForSymbol = async (symbol: string, btcTicker: any, ethTicker: any, signal?: AbortSignal): Promise<FetchedData | null> => {
  try {
    const tickerPromise = safeRequest(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, 3, signal);
    const candles1hPromise = safeRequest(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${CANDLE_COUNTS['1h']}`, 3, signal);
    const candles4hPromise = safeRequest(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=${CANDLE_COUNTS['4h']}`, 3, signal);
    const candles1dPromise = safeRequest(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${CANDLE_COUNTS['1d']}`, 3, signal);

    const [tickerRes, candles1hRes, candles4hRes, candles1dRes] = await Promise.all([
      tickerPromise,
      candles1hPromise,
      candles4hPromise,
      candles1dPromise,
    ]);

    if (!tickerRes.success || !candles1hRes.success || !candles4hRes.success || !candles1dRes.success) {
      logService.addLog('warn', `Skipping ${symbol} due to failed essential data fetch.`);
      console.error(`Failed to fetch essential data for ${symbol}`);
      return null;
    }

    const tickerData = tickerRes.data;

    const processedTicker = {
      symbol: tickerData.symbol,
      currentPrice: parseFloat(tickerData.lastPrice),
      priceChange: parseFloat(tickerData.priceChange),
      priceChangePercent: parseFloat(tickerData.priceChangePercent),
      volume24h: parseFloat(tickerData.volume),
      weightedAvgPrice: parseFloat(tickerData.weightedAvgPrice),
      prevClosePrice: parseFloat(tickerData.prevClosePrice),
      bidPrice: parseFloat(tickerData.bidPrice),
      bidQty: parseFloat(tickerData.bidQty),
      askPrice: parseFloat(tickerData.askPrice),
      askQty: parseFloat(tickerData.askQty),
      openPrice: parseFloat(tickerData.openPrice),
      highPrice: parseFloat(tickerData.highPrice),
      lowPrice: parseFloat(tickerData.lowPrice),
      quoteVolume: parseFloat(tickerData.quoteVolume),
      openTime: parseInt(tickerData.openTime),
      closeTime: parseInt(tickerData.closeTime),
    };

    const marketContext: MarketContext = {
      btcTrend: btcTicker ? (parseFloat(btcTicker.priceChangePercent) > 0 ? 'bullish' : 'bearish') : 'unknown',
      ethTrend: ethTicker ? (parseFloat(ethTicker.priceChangePercent) > 0 ? 'bullish' : 'bearish') : 'unknown',
      overallMarketTrend: (() => {
        if (!btcTicker || !ethTicker) return 'unknown';
        const bullishCount = (parseFloat(btcTicker.priceChangePercent) > 0 ? 1 : 0) + (parseFloat(ethTicker.priceChangePercent) > 0 ? 1 : 0);
        return bullishCount >= 1 ? 'bullish' : 'bearish';
      })(),
      marketVolatility: btcTicker && ethTicker ? (() => {
        const btcVolatility = ((parseFloat(btcTicker.highPrice) - parseFloat(btcTicker.lowPrice)) / parseFloat(btcTicker.openPrice)) * 100;
        const ethVolatility = ((parseFloat(ethTicker.highPrice) - parseFloat(ethTicker.lowPrice)) / parseFloat(ethTicker.openPrice)) * 100;
        return (btcVolatility + ethVolatility) / 2;
      })() : null
    };

    return {
      json: {
        symbol: symbol,
        currentPrice: processedTicker.currentPrice,
        change24h: processedTicker.priceChangePercent,
        volume24h: processedTicker.volume24h,
        type: 'trading',
        candles_1h: processCandles(candles1hRes.data),
        candles_4h: processCandles(candles4hRes.data),
        candles_1d: processCandles(candles1dRes.data),
        tickerData: processedTicker,
        marketContext: marketContext,
        volumeProfile: null, // Removed to align with backtesting capabilities
        dataQuality: {}, // Simplified
        processingInfo: {}, // Simplified
      }
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.error(`Error processing ${symbol}:`, error);
    logService.addLog('error', `Error processing ${symbol}`, { error: (error as Error).message });
    return null;
  }
};

export const fetchAnalysisData = async (
  symbols: string[],
  onProgress: (progress: { current: number; total: number }) => void,
  signal?: AbortSignal
): Promise<any[]> => {
  logService.addLog('info', 'Fetching market context (BTC & ETH tickers)');
  const btcPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", 3, signal);
  const ethPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT", 3, signal);

  const [btcRes, ethRes] = await Promise.all([btcPromise, ethPromise]);

  const btcTicker = btcRes.success ? btcRes.data : null;
  const ethTicker = ethRes.success ? ethRes.data : null;
  
  const totalSymbols = symbols.length;
  logService.addLog('info', `Starting to fetch data for ${totalSymbols} symbols`);
  const results = [];

  for (let i = 0; i < totalSymbols; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const symbol = symbols[i];
    onProgress({ current: i + 1, total: totalSymbols });
    const result = await fetchCompleteDataForSymbol(symbol, btcTicker, ethTicker, signal);
    if (result) {
        results.push(result);
    } else {
        logService.addLog('warn', `No data returned for symbol ${symbol}. It might be delisted or API failed.`);
    }
    await delay(100); // Smart delay to prevent rate limiting
  }

  logService.addLog('success', `Successfully fetched data for ${results.length}/${totalSymbols} symbols.`);
  return results;
};

export const fetchCandlesByTimeRange = async (
  symbol: string,
  interval: '5m',
  startTime: number,
  endTime: number,
  signal?: AbortSignal
): Promise<Candle[]> => {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
  const response = await safeRequest(url, 3, signal);

  if (response.success && response.data && response.data.length > 0) {
    logService.addLog('info', `[Ambiguity Resolver] Fetched ${response.data.length} ${interval} candles for ${symbol}.`);
    return processCandles(response.data.sort((a: any, b: any) => a[0] - b[0]));
  } else {
    logService.addLog('warn', `[Ambiguity Resolver] Could not fetch high-resolution data for ${symbol}.`, { url, error: response.error });
    return [];
  }
};

export const fetchHistoricalData = async (
  symbol: string,
  interval: '1d' | '4h' | '1h' = '1d',
  years: number = 1,
  signal?: AbortSignal
): Promise<Candle[]> => {
  const BINANCE_API_LIMIT = 1000;
  const totalCandlesToFetch = years * 365 * (interval === '1d' ? 1 : interval === '4h' ? 6 : 24);
  const requestsNeeded = Math.ceil(totalCandlesToFetch / BINANCE_API_LIMIT);
  let allCandles: any[] = [];
  let endTime = Date.now();

  for (let i = 0; i < requestsNeeded; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${BINANCE_API_LIMIT}&endTime=${endTime}`;
    const response = await safeRequest(url, 3, signal);

    if (response.success && response.data.length > 0) {
      allCandles = [...response.data, ...allCandles];
      endTime = response.data[0][0] - 1; // Set endTime to the start of the fetched chunk minus 1ms
    } else {
      logService.addLog('warn', `Could not fetch historical data for ${symbol} in chunk ${i+1}. Stopping.`, { url });
      console.warn(`Could not fetch historical data for ${symbol} in chunk ${i+1}. Stopping.`);
      break; 
    }
    await delay(400); // Delay between paginated requests
  }
  
  logService.addLog('info', `Fetched ${allCandles.length} historical candles for ${symbol} over ${years} year(s).`);
  // Sort and process
  return processCandles(allCandles.sort((a: any, b: any) => a[0] - b[0]));
};

export const fetchRecentCandles = async (
  symbol: string,
  interval: '1d' | '4h' | '1h',
  limit: number,
  signal?: AbortSignal
): Promise<Candle[]> => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${Math.max(1, Math.min(1000, limit))}`;
    const response = await safeRequest(url, 3, signal);
    if (response.success && response.data.length > 0) {
        logService.addLog('info', `Fetched ${response.data.length} recent ${interval} candles for ${symbol}.`);
        return processCandles(response.data);
    }
    logService.addLog('warn', `Could not fetch recent candles for ${symbol}.`, { url });
    return [];
}

export const fetchMarketOverview = async (signal?: AbortSignal): Promise<{ btc: any, eth: any, sol: any, bnb: any } | null> => {
    try {
        logService.addLog('info', 'Fetching market overview (BTC, ETH, SOL, BNB tickers)');
        const btcPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", 3, signal);
        const ethPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT", 3, signal);
        const solPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT", 3, signal);
        const bnbPromise = safeRequest("https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT", 3, signal);

        const [btcRes, ethRes, solRes, bnbRes] = await Promise.all([btcPromise, ethPromise, solPromise, bnbPromise]);

        if (btcRes.success && ethRes.success && solRes.success && bnbRes.success) {
            return { btc: btcRes.data, eth: ethRes.data, sol: solRes.data, bnb: bnbRes.data };
        }
        logService.addLog('warn', 'Failed to fetch one or more market overview tickers.');
        return null;
    } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        logService.addLog('error', 'Failed to fetch market overview', { error: (error as Error).message });
        throw new Error('Failed to fetch market overview data from Binance.');
    }
};

export const fetchDataForAiChat = async (symbol: string, signal?: AbortSignal) => {
    logService.addLog('info', `[AI Chat] Fetching data for ${symbol}`);
    try {
        const candles1dPromise = safeRequest(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=20`, 3, signal);
        const candles1hPromise = safeRequest(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=40`, 3, signal);
        const tickerPromise = safeRequest(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, 3, signal);

        const [candles1dRes, candles1hRes, tickerRes] = await Promise.all([candles1dPromise, candles1hPromise, tickerPromise]);

        if (!candles1dRes.success || !candles1hRes.success || !tickerRes.success) {
            throw new Error('Failed to fetch essential data for AI chat.');
        }

        return {
            candles1d: processCandles(candles1dRes.data),
            candles1h: processCandles(candles1hRes.data),
            ticker: {
                currentPrice: parseFloat(tickerRes.data.lastPrice),
                volume24h: parseFloat(tickerRes.data.volume),
            }
        };
    } catch (error) {
         if ((error as Error).name === 'AbortError') throw error;
        logService.addLog('error', `[AI Chat] Failed to fetch data for ${symbol}`, { error: (error as Error).message });
        throw error;
    }
};