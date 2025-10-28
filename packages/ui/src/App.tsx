
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { AnalyzeButton } from './components/AnalyzeButton';
import { ResultCard } from './components/ResultCard';
import { fetchAnalysisData } from './services/binanceService';
import { runFullAnalysis } from './services/analysisService';
import { geminiService } from './services/geminiService';
import { FilterBar, AnalysisScope } from './components/FilterBar';
import { BacktestRunner } from './components/BacktestRunner';
import { Hub } from './components/Hub';
import { LogViewer } from './components/LogViewer';
import { SymbolSelectorModal } from './components/SymbolSelectorModal';
import { AboutModal } from './components/AboutModal';
import { AiAnalysisModal } from './components/AiAnalysisModal';
import { AiChatView } from './components/AiChatView';
import { AiImageAnalysisView } from './components/AiImageAnalysisView';
import { AiHub } from './components/AiHub';
import { AiSettingsView } from './components/AiSettingsView';
import { useFavorites } from './hooks/useFavorites';
import { useTheme } from './hooks/useTheme';
import { useTranslation } from './hooks/useTranslation';
import { TARGET_SYMBOLS } from './constants';
import type { AdvancedAnalysisResult, BacktestHistoryEntry, FetchedData, BacktestParams, BacktestResult, BacktestProgress, AiAnalysisState, AnalysisResultData, AnalysisTimeframe, Candle, FearAndGreedData, BtcDominanceData, TotalMarketCapData, AiSettings, MarketSentiment, Deal, SearchFilters } from './types';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { usageService } from './services/usageService';
import { Loader } from './components/Loader';
import { runBacktest } from './services/backtestingService';
import { logService } from './services/logService';
import { fetchAllMarketData, calculateMarketSentiment } from './services/marketSentimentService';
import { IosInstallBanner } from './components/IosInstallBanner';
import { useUpdate } from './hooks/useUpdate';
import { DocsModal } from './components/DocsModal';
import { cacheService } from './services/cacheService';
import { ConfirmationModal } from './components/ConfirmationModal';
import { BacktestHistoryModal } from './components/BacktestHistoryModal';
import { VerificationView } from './components/VerificationView';
import { SearchView } from './components/SearchView';
import { searchService } from './services/searchService';
import { GlobalErrorAlert } from './components/GlobalErrorAlert';
import { ArbitrageView } from './components/ArbitrageView';


export type AppView = 'hub' | 'analysis' | 'backtest' | 'aiHub' | 'aiChat' | 'aiImageAnalysis' | 'aiSettings' | 'verification' | 'search' | 'arbitrage';

// Type for the PWA install prompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

const formatDataForAi = (data: AnalysisResultData, fearAndGreedIndex: FearAndGreedData | null, t: (key: string, options?: any) => string): string => {
    const { symbol, currentPrice, advancedAnalysis, analysis } = data;
    const { recommendation, entryPoints, profitTargets, stopLoss, riskReward } = advancedAnalysis;

    const formatTimeframe = (tf: AnalysisTimeframe | undefined, candles: Candle[] | null) => {
        if (!tf || tf.price == null) return t('aiSecondOpinion.data.notAvailable');
        const lastCandle = (candles && candles.length > 0) ? candles[candles.length - 1] : null;
        return `
    - RSI(14): ${tf.rsi?.[14]?.toFixed(2) ?? 'N/A'}
    - MACD Hist: ${tf.macd?.hist?.toFixed(2) ?? 'N/A'}
    - ADX: ${tf.adx?.toFixed(2) ?? 'N/A'}
    - ${t('aiSecondOpinion.data.trendStrength')}: ${(tf.trendStrength * 100).toFixed(0)}%
    - ${t('aiSecondOpinion.data.volume')}: ${lastCandle ? lastCandle.volume.toFixed(2) : 'N/A'}`;
    };

    let output = `
## ${t('aiSecondOpinion.data.dealDataFor', { symbol })}
- ${t('aiSecondOpinion.data.currentPrice')}: ${currentPrice.toFixed(4)}

### ${t('aiSecondOpinion.data.systemRecommendation')}
- ${t('aiSecondOpinion.data.recommendation')}: ${recommendation.recommendation}
- ${t('aiSecondOpinion.data.entryPoint')}: ${entryPoints?.[0]?.price.toFixed(4) ?? 'N/A'}
- ${t('aiSecondOpinion.data.stopLoss')}: ${stopLoss?.price.toFixed(4) ?? 'N/A'}
- ${t('aiSecondOpinion.data.targets')}: ${profitTargets?.map(t => t.price.toFixed(4)).join(', ') ?? 'N/A'}
- ${t('aiSecondOpinion.data.riskReward')}: 1:${riskReward?.averageRatio.toFixed(2) ?? 'N/A'}
`;

    if (fearAndGreedIndex) {
        output += `
### ${t('aiSecondOpinion.data.marketContext')}
- ${t('aiSecondOpinion.data.fngIndex')}: ${fearAndGreedIndex.value} (${t(`sentiment.${fearAndGreedIndex.value_classification.replace(' ', '')}`)})
`;
    }

    output += `
### ${t('aiSecondOpinion.data.mainIndicators')}
- **${t('aiSecondOpinion.data.tf1h')}:** ${formatTimeframe(analysis.timeframes['1h'], data.candles_1h)}
- **${t('aiSecondOpinion.data.tf4h')}:** ${formatTimeframe(analysis.timeframes['4h'], data.candles_4h)}
- **${t('aiSecondOpinion.data.tf1d')}:** ${formatTimeframe(analysis.timeframes['1d'], data.candles_1d)}
`;
    return output;
}

const App: React.FC = () => {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [view, setView] = useState<AppView>('hub');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<AdvancedAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState('main_balanced');
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  
  const { favoriteSymbols, toggleFavorite, isFavorite } = useFavorites();
  useTheme();
  const { t, language } = useTranslation();
  const [analysisScope, setAnalysisScope] = useState<AnalysisScope>('comprehensive');
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  
  const [aiSettings, setAiSettings] = useState<AiSettings>({});

  // Backtesting State
  const [backtestParams, setBacktestParams] = useState<Omit<BacktestParams, 'initialCapital'>>({
    symbols: [TARGET_SYMBOLS[TARGET_SYMBOLS.length - 1]],
    strategy: 'main_balanced',
    timePeriod: 1,
  });
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState<BacktestProgress | null>(null);
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  
  // Analysis progress state
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AdvancedAnalysisResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });

  // AI Analysis Modal State
  const [aiAnalysisState, setAiAnalysisState] = useState<AiAnalysisState>({
    isLoading: false,
    resultText: null,
    error: null,
    selectedSymbol: null,
  });
  
  // Market Sentiment States
  const [marketSentiment, setMarketSentiment] = useState<{data: MarketSentiment | null, isLoading: boolean, error: string | null}>({ data: null, isLoading: true, error: null });
  const [fearAndGreedData, setFearAndGreedData] = useState<{data: FearAndGreedData | null; isLoading: boolean; error: string | null}>({ data: null, isLoading: true, error: null });
  const [btcDominanceData, setBtcDominanceData] = useState<{data: BtcDominanceData | null; isLoading: boolean; error: string | null}>({ data: null, isLoading: true, error: null });
  const [totalMarketCapData, setTotalMarketCapData] = useState<{data: TotalMarketCapData | null; isLoading: boolean; error: string | null}>({ data: null, isLoading: true, error: null });

  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallBanner, setShowIosInstallBanner] = useState(false);

  // Abort Controller for cancelling operations
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { updateAvailable, applyUpdate } = useUpdate();

  // History states
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryEntry[]>([]);
  const [isBacktestHistoryOpen, setIsBacktestHistoryOpen] = useState(false);

  // Clear Cache state
  const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState(false);

  // Swipe to go back state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Load history from cache on startup
  useEffect(() => {
    cacheService.load<BacktestHistoryEntry[]>('backtest-history').then(history => {
        if (history) setBacktestHistory(history);
    });
  }, []);

  const handleHardReset = useCallback(async () => {
    setIsClearCacheModalOpen(false);
    await cacheService.hardReset();
    window.location.reload();
  }, []);

  useEffect(() => {
    try {
        const stored = localStorage.getItem('dahab-ai-settings');
        if (stored) {
            setAiSettings(JSON.parse(stored));
        }
    } catch (e) {
        logService.addLog('error', "Failed to load AI settings from localStorage", { error: (e as Error).message });
    }
}, []);

  const handleSaveAiSettings = (newSettings: AiSettings) => {
      setAiSettings(newSettings);
      try {
          localStorage.setItem('dahab-ai-settings', JSON.stringify(newSettings));
          logService.addLog('success', 'AI settings saved successfully.');
      } catch (e) {
          logService.addLog('error', "Failed to save AI settings to localStorage", { error: (e as Error).message });
      }
  };

  const fetchAllMarketInfo = useCallback(async (controller: AbortController) => {
      setMarketSentiment({ data: null, isLoading: true, error: null });
      setFearAndGreedData({ data: null, isLoading: true, error: null });
      setBtcDominanceData({ data: null, isLoading: true, error: null });
      setTotalMarketCapData({ data: null, isLoading: true, error: null });
      
      try {
          const allData = await fetchAllMarketData(controller.signal);

          setFearAndGreedData({ data: allData.fngData, isLoading: false, error: null });
          setBtcDominanceData({ data: allData.btcDominanceData, isLoading: false, error: null });
          setTotalMarketCapData({ data: allData.marketCapData, isLoading: false, error: null });

          const sentimentResult = calculateMarketSentiment(
              allData.tickers,
              allData.fngData,
              allData.marketCapData,
              allData.futuresData
          );
          setMarketSentiment({ data: sentimentResult, isLoading: false, error: null });
          logService.addLog('success', 'Market sentiment updated.', { sentiment: sentimentResult.sentiment, score: sentimentResult.score });
      } catch (err: any) {
          if (err.name === 'AbortError') {
              logService.addLog('warn', 'Market data fetch was aborted.');
              return;
          }
          logService.addLog('error', 'Failed to fetch market sentiment data', { details: (err as Error).message });
          const errorMsg = t('failedToFetch');
          setMarketSentiment({ data: null, isLoading: false, error: errorMsg });
          setFearAndGreedData({ data: null, isLoading: false, error: errorMsg });
          setBtcDominanceData({ data: null, isLoading: false, error: errorMsg });
          setTotalMarketCapData({ data: null, isLoading: false, error: errorMsg });
      }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllMarketInfo(controller);
    return () => controller.abort();
  }, [fetchAllMarketInfo]);

  const onRefreshIndicators = useCallback(() => {
    const controller = new AbortController();
    fetchAllMarketInfo(controller);
  }, [fetchAllMarketInfo]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isInStandaloneMode = ('standalone' in navigator) && ((navigator as any).standalone);
    const hasDismissedBanner = localStorage.getItem('dismissedIosInstallBanner');

    if (isIosDevice && !isInStandaloneMode && !hasDismissedBanner) {
        setShowIosInstallBanner(true);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      logService.addLog('info', `PWA install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
    }
  };

  const handleDismissIosBanner = () => {
    localStorage.setItem('dismissedIosInstallBanner', 'true');
    setShowIosInstallBanner(false);
  };

  useEffect(() => {
    if (results.length > 0) setIsFilterCollapsed(true);
  }, [results]);

  const symbolsToAnalyze = useMemo(() => {
    switch (analysisScope) {
      case 'favorites': return Array.from(favoriteSymbols);
      case 'custom': return customSymbols;
      default: return TARGET_SYMBOLS;
    }
  }, [analysisScope, favoriteSymbols, customSymbols]);

  const usageStats = useMemo(() => {
    if (!currentUser) return { remainingComprehensive: 0, totalComprehensive: 0, remainingOther: 0, totalOther: 0, cooldownMinutes: 0, remainingBacktest: 0, totalBacktest: 0, remainingAiChat: 0, totalAiChat: 0, aiChatCooldownMinutes: 0 };
    return usageService.getRemainingUsage(currentUser.code);
  }, [currentUser, isLoading, isBacktesting, results]);

  const goBack = useCallback(() => {
    if (view === 'aiChat' || view === 'aiImageAnalysis' || view === 'aiSettings') {
        setView('aiHub');
    } else {
      setView('hub');
    }
  }, [view]);

  const minSwipeDistance = 100;

  const onTouchStart = (e: React.TouchEvent) => {
    let target = e.target as HTMLElement;
    while (target && target !== e.currentTarget) {
        if (target.scrollWidth > target.clientWidth) {
            return;
        }
        target = target.parentElement as HTMLElement;
    }
    
    if (view === 'hub') return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (view === 'hub' || touchStart === null) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (view === 'hub' || !touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isSwipeRight = distance < -minSwipeDistance; // LTR back gesture
    const isSwipeLeft = distance > minSwipeDistance;   // RTL back gesture

    const isRtl = language === 'ar';

    if ((isRtl && isSwipeLeft) || (!isRtl && isSwipeRight)) {
      goBack();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const startBacktest = useCallback(async () => {
    if (!currentUser) return;

    const check = usageService.canPerformBacktest(currentUser.code);
    if (!check.allowed) {
        setBacktestError(t('limit_backtest_daily', { limit: usageStats.totalBacktest }));
        return;
    }

    if (backtestParams.symbols.length === 0) {
        setBacktestError(t('pleaseSelectCoin'));
        return;
    }
    
    setIsBacktesting(true);
    setBacktestResults(null);
    setBacktestError(null);
    setBacktestProgress({ status: t('progressStatus.starting'), symbol: "", progress: 0 });

    const controller = new AbortController();
    setAbortController(controller);

    try {
        const finalResults = await runBacktest(
            { ...backtestParams, initialCapital: 10000 },
            setBacktestProgress,
            controller.signal
        );
        setBacktestResults(finalResults);
        usageService.recordBacktestUsage(currentUser.code);

        // Save to history
        const newHistoryEntry: BacktestHistoryEntry = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            result: finalResults,
        };
        setBacktestHistory(prev => {
            const updatedHistory = [newHistoryEntry, ...prev];
            cacheService.save('backtest-history', updatedHistory);
            return updatedHistory;
        });

    } catch (err: any) {
        if (err.name === 'AbortError') {
            setBacktestError('تم إلغاء الاختبار الخلفي.');
            logService.addLog('warn', 'User aborted the backtest.');
        } else {
            console.error("Backtest failed:", err);
            setBacktestError(t('backtestFailed', { message: err.message }));
        }
    } finally {
        setIsBacktesting(false);
        setBacktestProgress(null);
        setAbortController(null);
    }
  }, [backtestParams, t, currentUser, usageStats.totalBacktest]);
  
  const handleAnalyze = useCallback(async () => {
    if (!currentUser) return;
    
    const check = usageService.canPerformAnalysis(currentUser.code, analysisScope, symbolsToAnalyze.length);
    if (!check.allowed) {
        setError(check.message);
        return;
    }

    if (symbolsToAnalyze.length === 0) {
      setError(t('pleaseSelectCoin'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setAnalysisProgress({ current: 0, total: symbolsToAnalyze.length });

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const fetchedData: FetchedData[] = await fetchAnalysisData(symbolsToAnalyze, setAnalysisProgress, controller.signal);
      
      const validFetchedData = fetchedData.filter(d => d !== null) as { json: any }[];
      
      if (validFetchedData.length === 0) {
        if (!controller.signal.aborted) setError(t('errorBinanceFetch'));
        setIsLoading(false);
        setAbortController(null);
        return;
      }
      
      const analysisResults = await runFullAnalysis(validFetchedData, strategy);
      setResults(analysisResults);
      usageService.recordUsage(currentUser.code, analysisScope, symbolsToAnalyze.length);

      // --- New: Save deals for verification ---
      const dealsToSave: Deal[] = [];
      const now = new Date().toISOString();
      analysisResults.forEach((res: AdvancedAnalysisResult) => {
          const rec = res.json.advancedAnalysis.recommendation.recommendation;
          if (rec === 'buy' || rec === 'conditional_buy') {
              dealsToSave.push({
                  id: `${res.json.symbol}-${now}`,
                  timestamp: now,
                  status: 'pending',
                  analysisResult: res.json,
              });
          }
      });
      if (dealsToSave.length > 0) {
          const existingDeals = await cacheService.loadDeals() || [];
          const updatedDeals = [...dealsToSave, ...existingDeals];
          await cacheService.saveDeals(updatedDeals);
          logService.addLog('success', `Automatically saved ${dealsToSave.length} new deals for verification.`);
      }
      // --- End new logic ---

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('تم إلغاء عملية البحث.');
        logService.addLog('warn', 'User aborted the analysis.');
      } else {
        console.error(err);
        setError(t('errorAnalysisContactSupport'));
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  }, [strategy, symbolsToAnalyze, t, currentUser, analysisScope]);

    const handleSearch = useCallback(async (filters: SearchFilters, activeGroups: Set<string>) => {
    if (!currentUser) return;
    
    // Using comprehensive check for search as it scans all coins
    const check = usageService.canPerformAnalysis(currentUser.code, 'comprehensive', TARGET_SYMBOLS.length);
    if (!check.allowed) {
        setSearchError(check.message);
        return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSearchProgress({ current: 0, total: TARGET_SYMBOLS.length });

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const fetchedData: FetchedData[] = await fetchAnalysisData(TARGET_SYMBOLS, setSearchProgress, controller.signal);
      
      const validFetchedData = fetchedData.filter(d => d !== null) as { json: any }[];
      
      if (validFetchedData.length === 0) {
        if (!controller.signal.aborted) setSearchError(t('errorBinanceFetch'));
        setIsSearching(false);
        setAbortController(null);
        return;
      }
      
      // Always use the main_balanced strategy for search to get all necessary data points
      const analysisResults = await runFullAnalysis(validFetchedData, 'main_balanced');
      const filtered = searchService.filterResults(analysisResults, filters, activeGroups);
      setSearchResults(filtered);

      // Record usage as one comprehensive search
      usageService.recordUsage(currentUser.code, 'comprehensive', TARGET_SYMBOLS.length);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setSearchError('تم إلغاء عملية البحث.');
        logService.addLog('warn', 'User aborted the search.');
      } else {
        console.error(err);
        setSearchError(t('errorAnalysisContactSupport'));
      }
    } finally {
      setIsSearching(false);
      setAbortController(null);
    }
  }, [t, currentUser]);

  const handleAskAi = useCallback(async (resultData: AnalysisResultData) => {
    setAiAnalysisState({ isLoading: true, resultText: null, error: null, selectedSymbol: resultData.symbol });
    try {
      const analysisDataString = formatDataForAi(resultData, fearAndGreedData.data, t);
      const prompt = t('aiSecondOpinion.prompt', { analysisDataString });
      
      const aiResponse = await geminiService.getSecondOpinion(prompt, aiSettings);
      setAiAnalysisState(prev => ({ ...prev, isLoading: false, resultText: aiResponse }));
    } catch (err: any) {
      setAiAnalysisState(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  }, [fearAndGreedData.data, t, aiSettings]);

  const closeAiModal = () => setAiAnalysisState({ isLoading: false, resultText: null, error: null, selectedSymbol: null });

  const filteredResults = useMemo(() => {
    if (activeFilters.size === 0) return results;
    return results.filter(result => {
      const analysis = result.json.advancedAnalysis;
      if (!analysis || !analysis.trendAnalysis || !analysis.recommendation) return false;
      const recommendationFilters = new Set(['buy', 'conditional_buy', 'wait']);
      const activeRecommendationFilters = new Set<string>();
      for (const filter of activeFilters) if (recommendationFilters.has(filter)) activeRecommendationFilters.add(filter);
      if (activeRecommendationFilters.size > 0 && !activeRecommendationFilters.has(analysis.recommendation.recommendation)) return false;
      return true;
    });
  }, [results, activeFilters]);

  const renderContent = () => {
    switch (view) {
      case 'hub':
        return <Hub 
            setView={setView} 
            onAiAnalystClick={() => setView('aiHub')}
            user={currentUser}
            usageStats={usageStats}
            fearAndGreedData={fearAndGreedData}
            onRefreshIndicators={onRefreshIndicators}
            marketSentiment={marketSentiment}
            btcDominanceData={btcDominanceData}
            totalMarketCapData={totalMarketCapData}
            onOpenDocs={() => setIsDocsModalOpen(true)}
        />;
      case 'analysis':
        return (
          <>
            <div className="mb-6">
                <AnalyzeButton
                    onClick={handleAnalyze}
                    isLoading={isLoading}
                    symbolCount={symbolsToAnalyze.length}
                />
            </div>
            {results.length === 0 && !isLoading && !error && (
              <div className="text-center py-8">
                <div className="inline-block bg-[rgb(var(--color-panel-bg-val))]/50 p-6 rounded-full border border-[rgb(var(--color-border-val))] mb-6">
                    <svg className="w-12 h-12 text-[rgb(var(--color-primary-accent-val))]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z" opacity=".4"/><path d="M12 7a5 5 0 1 0 5 5a5.006 5.006 0 0 0-5-5Zm0 8a3 3 0 1 1 3-3a3.003 3.003 0 0 1-3 3Z"/></svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">{t('readyToAnalyzeTitle')}</h2>
                <p className="text-lg text-[rgb(var(--color-text-secondary-val))] max-w-2xl mx-auto">{t('readyToAnalyzeDesc')}</p>
              </div>
            )}
            {isLoading && (
              <Loader progress={analysisProgress} />
            )}
            {!isLoading && results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredResults.map((result, index) => (
                  result.json.advancedAnalysis ?
                  <div key={result.json.symbol || index} className="animate-fade-in-scale-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <ResultCard result={result.json} isFavorite={isFavorite(result.json.symbol)} toggleFavorite={toggleFavorite} onAskAi={handleAskAi} />
                  </div>
                  : null
                ))}
              </div>
            )}
            {!isLoading && results.length > 0 && filteredResults.length === 0 && (
                <div className="text-center py-16 col-span-full">
                    <h3 className="text-2xl font-bold text-white">{t('noResults')}</h3>
                    <p className="text-[rgb(var(--color-text-secondary-val))] mt-2">{t('noResultsDesc')}</p>
                </div>
            )}
          </>
        );
      case 'search':
        return <SearchView onSearch={handleSearch} isLoading={isSearching} results={searchResults} progress={searchProgress} error={searchError} />;
      case 'backtest':
        return <BacktestRunner 
            params={backtestParams}
            setParams={setBacktestParams}
            isBacktesting={isBacktesting}
            progress={backtestProgress}
            results={backtestResults}
            setResults={setBacktestResults}
            error={backtestError}
            setError={setBacktestError}
            startBacktest={startBacktest}
            onCancel={() => abortController?.abort()}
            onHistoryClick={() => setIsBacktestHistoryOpen(true)}
        />;
       case 'verification':
        return <VerificationView />;
       case 'aiHub':
        return <AiHub setView={setView} />;
       case 'aiChat':
        return <AiChatView fearAndGreedData={fearAndGreedData.data} btcDominanceData={btcDominanceData.data} aiSettings={aiSettings} />;
      case 'aiImageAnalysis':
        return <AiImageAnalysisView fearAndGreedData={fearAndGreedData.data} btcDominanceData={btcDominanceData.data} aiSettings={aiSettings} />;
      case 'aiSettings':
        return <AiSettingsView settings={aiSettings} onSaveSettings={handleSaveAiSettings} />;
      case 'arbitrage':
        return <ArbitrageView />;
      default:
        return <Hub setView={setView} onAiAnalystClick={() => setView('aiHub')} user={currentUser} usageStats={usageStats} fearAndGreedData={fearAndGreedData} onRefreshIndicators={onRefreshIndicators} 
        marketSentiment={marketSentiment} btcDominanceData={btcDominanceData} totalMarketCapData={totalMarketCapData} onOpenDocs={() => setIsDocsModalOpen(true)} />;
    }
  }
  
  if (isAuthLoading) return <div className="min-h-screen bg-gradient-to-br from-[rgb(var(--color-background-start-val))] to-[rgb(var(--color-background-end-val))]" />;
  if (!currentUser) return <Login />;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-20">
        <Header 
          setView={setView} 
          onAbout={() => setIsAboutModalOpen(true)} 
          onInstallClick={handleInstallClick} 
          showInstallButton={!!deferredPrompt} 
          updateAvailable={updateAvailable}
          onApplyUpdate={applyUpdate}
          onClearCache={() => setIsClearCacheModalOpen(true)}
        />
        {(view === 'analysis' || view === 'search') && <FilterBar
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          strategy={strategy}
          setStrategy={setStrategy}
          isLoading={isLoading || isSearching}
          analysisScope={analysisScope}
          setAnalysisScope={setAnalysisScope}
          onCustomClick={() => setIsSymbolModalOpen(true)}
          favoriteCount={favoriteSymbols.size}
          customCount={customSymbols.length}
          isCollapsed={isFilterCollapsed}
          onToggleCollapse={() => setIsFilterCollapsed(prev => !prev)}
        />}
      </div>

      <main className="flex-grow container mx-auto p-4 sm:p-6" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <GlobalErrorAlert message={error} onClose={() => setError(null)} />
        {renderContent()}
      </main>

      {/* Modals and Global Components */}
      <SymbolSelectorModal isOpen={isSymbolModalOpen} onClose={() => setIsSymbolModalOpen(false)} allSymbols={TARGET_SYMBOLS} currentSelection={customSymbols} onSave={(sel) => { setCustomSymbols(sel); setIsSymbolModalOpen(false); setAnalysisScope('custom'); }} />
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
      <DocsModal isOpen={isDocsModalOpen} onClose={() => setIsDocsModalOpen(false)} />
      <AiAnalysisModal isOpen={!!aiAnalysisState.selectedSymbol} onClose={closeAiModal} symbol={aiAnalysisState.selectedSymbol} isLoading={aiAnalysisState.isLoading} resultText={aiAnalysisState.resultText} error={aiAnalysisState.error} />
      {showIosInstallBanner && <IosInstallBanner onClose={handleDismissIosBanner} />}
      <ConfirmationModal isOpen={isClearCacheModalOpen} onClose={() => setIsClearCacheModalOpen(false)} onConfirm={handleHardReset} title={t('clearCacheConfirmTitle')} message={t('clearCacheConfirmMsg')} />
      <BacktestHistoryModal isOpen={isBacktestHistoryOpen} onClose={() => setIsBacktestHistoryOpen(false)} history={backtestHistory} onSelect={(entry) => { setBacktestResults(entry.result); setIsBacktestHistoryOpen(false); }} />
      <LogViewer />
    </div>
  );
};
export default App;