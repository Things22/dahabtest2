import React, { useMemo } from 'react';
import { TARGET_SYMBOLS } from '../constants';
import type { BacktestParams, BacktestResult, BacktestProgress } from '../types';
import { BacktestResults } from './BacktestResults';
import { useTranslation } from '../hooks/useTranslation';

interface BacktestRunnerProps {
    params: Omit<BacktestParams, 'initialCapital'>;
    setParams: React.Dispatch<React.SetStateAction<Omit<BacktestParams, 'initialCapital'>>>;
    isBacktesting: boolean;
    progress: BacktestProgress | null;
    results: BacktestResult | null;
    setResults: (results: BacktestResult | null) => void;
    error: string | null;
    setError: (error: string | null) => void;
    startBacktest: () => void;
    onCancel: () => void;
    onHistoryClick: () => void;
}

export const BacktestRunner: React.FC<BacktestRunnerProps> = ({
    params,
    setParams,
    isBacktesting,
    progress,
    results,
    setResults,
    error,
    setError,
    startBacktest,
    onCancel,
    onHistoryClick,
}) => {
    const { t } = useTranslation();
    const labelClass = "font-semibold text-[rgb(var(--color-text-primary-val))] block mb-2 uppercase tracking-wider text-xs";

    const handleSymbolChange = (symbol: string) => {
        setParams(prev => {
            const newSymbols = new Set(prev.symbols);
            if (newSymbols.has(symbol)) {
                newSymbols.delete(symbol);
            } else {
                newSymbols.add(symbol);
            }
            return { ...prev, symbols: Array.from(newSymbols) };
        });
    };

    const handleSelectAll = () => {
        if (params.symbols.length === TARGET_SYMBOLS.length) {
            setParams(p => ({ ...p, symbols: [] }));
        } else {
            setParams(p => ({ ...p, symbols: [...TARGET_SYMBOLS] }));
        }
    }
    
    const warnings = useMemo(() => {
        const w = [];
        if (params.timePeriod >= 1) {
            w.push(t('backtestWarning.slow'));
            if (params.symbols.length > 2) {
                w.push(t('backtestWarning.tooManySymbolsLong'));
            }
        } else if (params.symbols.length > 4) {
            w.push(t('backtestWarning.tooManySymbolsShort'));
        }
        return w;
    }, [params.timePeriod, params.symbols.length, t]);

    return (
        <div className="bg-[rgb(var(--color-panel-bg-val))]/50 backdrop-blur-lg border border-[rgb(var(--color-border-val))]/50 rounded-lg p-6 md:p-8 w-full">
            <div className="text-center mb-8 relative">
                <h2 className="text-3xl font-bold text-[rgb(var(--color-text-heading-val))]">{t('backtestTitle')}</h2>
                <p className="text-[rgb(var(--color-text-secondary-val))] mt-2 max-w-2xl mx-auto">
                    {t('backtestDesc')}
                </p>
                 <button
                    onClick={onHistoryClick}
                    className="absolute top-0 right-0 text-[rgb(var(--color-text-secondary-val))] hover:text-[rgb(var(--color-primary-accent-val))] transition-colors p-2 rounded-full hover:bg-[rgb(var(--color-panel-bg-hover-val))]"
                    title={t('backtestHistory')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {!isBacktesting && !results && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-lg border border-[rgb(var(--color-border-val))] ring-1 ring-inset ring-black/10">
                        <h3 className="font-bold text-lg text-[rgb(var(--color-text-heading-val))] mb-3"><span className="text-[rgb(var(--color-primary-accent-val))]">1.</span> {t('selectCoins')}</h3>
                        <div className="h-80 overflow-y-auto pr-2 space-y-2">
                             <div className="flex items-center sticky top-0 bg-[rgb(var(--color-panel-bg-val))]/80 py-1 backdrop-blur-sm z-10">
                                <input type="checkbox" id="select-all" 
                                       checked={params.symbols.length === TARGET_SYMBOLS.length}
                                       onChange={handleSelectAll}
                                       className="h-4 w-4 rounded border-[rgb(var(--color-border-light-val))] bg-[rgb(var(--color-panel-bg-light-val))] text-[rgb(var(--color-primary-val))] focus:ring-[rgb(var(--color-primary-accent-val))]" />
                                <label htmlFor="select-all" className="mx-3 text-sm font-bold text-[rgb(var(--color-text-primary-val))]">{t('selectAll')}</label>
                            </div>
                            {TARGET_SYMBOLS.map(symbol => (
                                <div key={symbol} className="flex items-center">
                                    <input type="checkbox" id={`sym-${symbol}`} 
                                           checked={params.symbols.includes(symbol)}
                                           onChange={() => handleSymbolChange(symbol)}
                                           className="h-4 w-4 rounded border-[rgb(var(--color-border-light-val))] bg-[rgb(var(--color-panel-bg-light-val))] text-[rgb(var(--color-primary-val))] focus:ring-[rgb(var(--color-primary-accent-val))]" />
                                    <label htmlFor={`sym-${symbol}`} className="mx-3 text-sm text-[rgb(var(--color-text-primary-val))]">{symbol}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-lg border border-[rgb(var(--color-border-val))] space-y-6 ring-1 ring-inset ring-black/10">
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-[rgb(var(--color-text-heading-val))] mb-3"><span className="text-[rgb(var(--color-primary-accent-val))]">2.</span> {t('selectSettings')}</h3>
                            <div>
                                <label htmlFor="strategy" className={labelClass}>{t('strategy')}</label>
                                <select 
                                    id="strategy"
                                    value={params.strategy}
                                    onChange={e => setParams(p => ({ ...p, strategy: e.target.value }))}
                                    className="w-full bg-[rgb(var(--color-panel-bg-light-val))] border border-[rgb(var(--color-border-light-val))] text-[rgb(var(--color-text-primary-val))] rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-accent-val))] focus:border-[rgb(var(--color-primary-accent-val))] p-2"
                                    aria-label={t('strategy')}
                                >
                                    <option value="main_balanced">{t('strategy_main_balanced_name')}</option>
                                    <option value="mean_reversion">{t('strategy_mean_reversion_name')}</option>
                                    <option value="momentum_breakout">{t('strategy_momentum_breakout_name')}</option>
                                    <option value="supply_demand">{t('strategy_supply_demand_name')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-1">
                             <label htmlFor="timePeriod" className={labelClass}>{t('testPeriodLabel')}</label>
                            <select 
                                id="timePeriod"
                                value={params.timePeriod}
                                onChange={e => setParams(p => ({ ...p, timePeriod: parseFloat(e.target.value) }))}
                                className="w-full bg-[rgb(var(--color-panel-bg-light-val))] border border-[rgb(var(--color-border-light-val))] text-[rgb(var(--color-text-primary-val))] rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-accent-val))] focus:border-[rgb(var(--color-primary-accent-val))] p-2"
                                aria-label={t('testPeriodLabel')}
                            >
                               <option value="0.25">{t('periods.0.25')}</option>
                               <option value="0.5">{t('periods.0.5')}</option>
                               <option value="1">{t('periods.1')}</option>
                               <option value="2">{t('periods.2')}</option>
                               <option value="5">{t('periods.5')}</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-white/5 backdrop-blur-md p-4 rounded-lg border border-[rgb(var(--color-border-val))] lg:sticky lg:top-40 ring-1 ring-inset ring-black/10">
                         <h3 className="font-bold text-lg text-[rgb(var(--color-text-heading-val))] mb-3"><span className="text-[rgb(var(--color-primary-accent-val))]">3.</span> {t('startTest')}</h3>
                            <div className="text-sm bg-[rgb(var(--color-panel-bg-val))]/50 p-3 rounded-md border border-[rgb(var(--color-border-val))]">
                                <p><span className="font-semibold text-[rgb(var(--color-text-secondary-val))]">{t('initialCapital')}:</span> {t('initialCapitalValue')}</p>
                                <p><span className="font-semibold text-[rgb(var(--color-text-secondary-val))]">{t('riskManagementLabel')}:</span> {t('riskManagementValue')}</p>
                            </div>
                        
                        {warnings.length > 0 && (
                            <div className="mt-4 p-3 bg-[rgb(var(--color-warning-val))]/10 border-l-4 border-[rgb(var(--color-warning-val))] text-[rgb(var(--color-warning-text-val))] text-xs space-y-1">
                                {warnings.map((w, i) => <p key={i}>- {w}</p>)}
                            </div>
                        )}

                        <button
                            onClick={startBacktest}
                            disabled={params.symbols.length === 0}
                            className="w-full mt-4 bg-[rgb(var(--color-primary-accent-val))]/10 backdrop-blur-md border border-[rgb(var(--color-primary-accent-val))]/20 hover:bg-[rgb(var(--color-primary-accent-val))]/20 hover:border-[rgb(var(--color-primary-accent-val))]/30 disabled:bg-white/5 disabled:border-white/10 disabled:cursor-not-allowed disabled:text-[rgb(var(--color-text-muted-val))] text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-[rgb(var(--color-primary-val))]/20 transition-all"
                        >
                            {t('startBacktest')}
                        </button>
                    </div>
                </div>
            )}
            
            {isBacktesting && progress && (
                <div className="text-center py-16">
                    <h3 className="text-2xl font-bold text-[rgb(var(--color-text-heading-val))] mb-4">{t('backtestingInProgress')}</h3>
                    <p className="text-[rgb(var(--color-text-secondary-val))] mb-6">{progress.status}</p>
                    <div className="w-full max-w-lg mx-auto bg-[rgb(var(--color-panel-bg-light-val))] rounded-full h-4 overflow-hidden">
                      <div className="bg-[rgb(var(--color-primary-val))] h-4 rounded-full text-xs text-white flex items-center justify-center transition-all duration-300" style={{ width: `${progress.progress * 100}%` }}>
                         {`${Math.round(progress.progress * 100)}%`}
                      </div>
                    </div>
                    <p className="text-sm text-[rgb(var(--color-text-primary-val))] mt-4">{t('processingSymbol', { symbol: progress.symbol })}</p>
                     <button
                        onClick={onCancel}
                        className="mt-6 bg-red-500/20 backdrop-blur-md border border-red-500/30 hover:bg-red-500/30 text-white font-bold py-2 px-4 rounded-lg transition-all"
                    >
                        {t('stopTest')}
                    </button>
                </div>
            )}

            {error && (
              <div className="text-center py-8 bg-red-900/20 border border-red-500 rounded-lg p-4">
                <h3 className="text-xl font-bold text-red-400 mb-2">{t('backtestError')}</h3>
                <p className="text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="mt-4 bg-red-600/20 backdrop-blur-md border border-red-500/30 hover:bg-red-600/30 text-white font-bold py-2 px-4 rounded-lg transition-all">
                    {t('tryAgain')}
                </button>
              </div>
            )}
            
            {!isBacktesting && results && (
                <div>
                    <BacktestResults results={results} onReset={() => setResults(null)} />
                </div>
            )}
        </div>
    );
};
