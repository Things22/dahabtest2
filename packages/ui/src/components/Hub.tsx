import React, { useState } from 'react';
import type { AppView } from '../App';
import type { User, FearAndGreedData, BtcDominanceData, TotalMarketCapData, MarketSentiment } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { UserInfoPanel } from './UserInfoPanel';
import { FearAndGreedIndex } from './FearAndGreedIndex';
import { BtcDominanceIndicator } from './BtcDominanceIndicator';
import { TotalMarketCapIndicator } from './TotalMarketCapIndicator';
import { HelpModal } from './HelpModal';

interface HubProps {
    setView: (view: AppView) => void;
    onAiAnalystClick: () => void;
    user: User | null;
    usageStats: { 
        remainingComprehensive: number; 
        totalComprehensive: number;
        remainingOther: number; 
        totalOther: number;
        cooldownMinutes: number; 
        remainingBacktest: number; 
        totalBacktest: number;
        remainingAiChat: number;
        totalAiChat: number;
        aiChatCooldownMinutes: number;
    };
    fearAndGreedData: { data: FearAndGreedData | null, isLoading: boolean, error: string | null };
    onRefreshIndicators: () => void;
    marketSentiment: { data: MarketSentiment | null, isLoading: boolean, error: string | null };
    btcDominanceData: { data: BtcDominanceData | null, isLoading: boolean, error: string | null };
    totalMarketCapData: { data: TotalMarketCapData | null, isLoading: boolean, error: string | null };
    onOpenDocs: () => void;
}

const badgeColors: { [key: string]: string } = {
    // For Experts
    'للخبراء': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    'For Experts': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    'Для экспертов': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    '专家专用': 'bg-blue-500/20 text-blue-300 ring-blue-500/30',
    // For Researchers
    'للباحثين والمحللين': 'bg-teal-500/20 text-teal-300 ring-teal-500/30',
    'For Researchers & Analysts': 'bg-teal-500/20 text-teal-300 ring-teal-500/30',
    'Для исследователей и аналитиков': 'bg-teal-500/20 text-teal-300 ring-teal-500/30',
    '供研究人员和分析师使用': 'bg-teal-500/20 text-teal-300 ring-teal-500/30',
    // Experimental
    'تجريبي': 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
    'Experimental': 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
    'Экспериментально': 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
    '实验性': 'bg-purple-500/20 text-purple-300 ring-purple-500/30',
    // In Development
    'قيد التطوير': 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
    'In Development': 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
    'В разработке': 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
    '开发中': 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
};

const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void; isDisabled?: boolean; badges?: string[]; onHelpClick: () => void; }> = ({ title, description, icon, onClick, isDisabled, badges, onHelpClick }) => {
    
    const hoverClasses = isDisabled ? '' : "hover:border-[rgb(var(--color-primary-accent-val))]/20 hover:bg-[rgb(var(--color-panel-bg-hover-val))] hover:-translate-y-1";
    const disabledClasses = isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer';

    return (
        <div
            onClick={isDisabled ? undefined : onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !isDisabled && onClick() }}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            className={`group relative bg-[rgb(var(--color-panel-bg-val))] backdrop-blur-lg border border-[rgb(var(--color-border-val))] rounded-lg p-4 text-center transition-all duration-300 overflow-hidden ${hoverClasses} ${disabledClasses}`}
        >
             <button
                onClick={(e) => {
                    e.stopPropagation();
                    onHelpClick();
                }}
                className="absolute top-2 left-2 rtl:left-auto rtl:right-2 z-20 h-6 w-6 flex items-center justify-center bg-red-600/50 text-white rounded-full text-sm font-bold hover:bg-red-500 transition-all scale-90 group-hover:scale-100 opacity-70 group-hover:opacity-100"
                aria-label={`Help for ${title}`}
             >
                ?
             </button>

             {badges && badges.length > 0 && (
                <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 flex flex-wrap-reverse gap-1 z-20 justify-end">
                    {badges.map(badge => (
                        <div key={badge} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${badgeColors[badge] || 'bg-gray-500/20 text-gray-300 ring-gray-500/30'}`}>
                            {badge}
                        </div>
                    ))}
                </div>
             )}
             <div className="relative z-10 flex flex-col items-center">
                <div className={`flex justify-center items-center mb-3 transition-colors duration-300 ${isDisabled ? 'text-[rgb(var(--color-text-secondary-val))]' : 'text-[rgb(var(--color-primary-accent-val))] group-hover:text-[rgb(var(--color-primary-val))]'}`}>
                    {icon}
                </div>
                <h3 className="text-base font-bold text-[rgb(var(--color-text-heading-val))] mb-1">{title}</h3>
                <p className="text-xs text-[rgb(var(--color-text-secondary-val))]">{description}</p>
            </div>
        </div>
    );
};

export const Hub: React.FC<HubProps> = ({ setView, onAiAnalystClick, user, usageStats, fearAndGreedData, onRefreshIndicators, 
    marketSentiment, btcDominanceData, totalMarketCapData, onOpenDocs }) => {
    const { t } = useTranslation();
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [helpModalContent, setHelpModalContent] = useState({ title: '', content: '' });

    const showHelp = (title: string, content: string) => {
        setHelpModalContent({ title, content });
        setIsHelpModalOpen(true);
    };

    const Indicators = () => (
        <>
            <FearAndGreedIndex 
                fearAndGreedData={fearAndGreedData}
                onRefresh={onRefreshIndicators}
            />
            <BtcDominanceIndicator btcDominanceData={btcDominanceData} onRefresh={onRefreshIndicators} />
            <TotalMarketCapIndicator totalMarketCapData={totalMarketCapData} onRefresh={onRefreshIndicators} />
        </>
    );
    
    const RepeatedIndicators = () => (
        <div className="flex flex-shrink-0 gap-x-4">
            <Indicators />
            <Indicators />
            <Indicators />
            <Indicators />
        </div>
    );

    return (
        <div className="flex flex-col items-center min-h-full pt-4 pb-6">
            <div className="w-full max-w-4xl mb-4 space-y-4">
                {user && <UserInfoPanel user={user} usageStats={usageStats} marketSentiment={marketSentiment} onOpenDocs={onOpenDocs} />}
                
                 <div className="relative flex overflow-x-hidden bg-white/5 backdrop-blur-lg border border-[rgb(var(--color-border-val))] rounded-lg">
                    <div className="py-1 flex animate-marquee whitespace-nowrap">
                        <RepeatedIndicators />
                    </div>
                    <div className="absolute top-0 py-1 flex animate-marquee2 whitespace-nowrap">
                        <RepeatedIndicators />
                    </div>
                </div>
            </div>
            
            <div className="flex items-center w-full max-w-4xl my-6">
                <div className="flex-grow border-t border-[rgb(var(--color-primary-accent-val))]/20"></div>
                <span className="mx-4 flex-shrink-0 text-sm font-bold tracking-widest uppercase text-[rgb(var(--color-text-secondary-val))]">{t('services')}</span>
                <div className="flex-grow border-t border-[rgb(var(--color-primary-accent-val))]/20"></div>
            </div>
            
            <div className="relative max-w-4xl w-full">
                <svg aria-hidden="true" className="absolute inset-0 w-full h-full z-0 pointer-events-none hidden md:block">
                    <defs>
                        <filter id="snake-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    <path 
                        d="M 50% -20% V 120%"
                        fill="none"
                        stroke="rgb(var(--color-primary-accent-val))"
                        strokeWidth="2"
                        className="snake-path-1"
                        filter="url(#snake-glow)"
                    />
                </svg>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    <ToolCard
                        title={t('liveAnalysis')}
                        description={t('liveAnalysisDesc')}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-electric-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z" opacity=".4"/><path d="M12 7a5 5 0 1 0 5 5a5.006 5.006 0 0 0-5-5Zm0 8a3 3 0 1 1 3-3a3.003 3.003 0 0 1-3 3Z"/></svg>
                        }
                        onClick={() => setView('analysis')}
                        onHelpClick={() => showHelp(t('liveAnalysis'), t('help.liveAnalysis'))}
                    />
                    <ToolCard
                        title={t('verification.title')}
                        description={t('verification.description')}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.009 8.009 0 0 1-8 8Z" opacity=".4"/>
                                <path d="m16.632 9.073-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.97 1.97l4.97-4.97a.75.75 0 1 1 1.06 1.06Z"/>
                            </svg>
                        }
                        onClick={() => setView('verification')}
                        onHelpClick={() => showHelp(t('verification.title'), t('help.verification'))}
                    />
                    <ToolCard
                        title={t('search.title')}
                        description={t('search.description')}
                        badges={[t('forResearchers')]}
                        icon={
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 12.414V17a1 1 0 01-1.447.894l-2-1A1 1 0 018 16.051V12.414L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                           </svg>
                        }
                        onClick={() => setView('search')}
                        onHelpClick={() => showHelp(t('search.title'), t('help.search'))}
                    />
                     <ToolCard
                        title={t('aiChatToolTitle')}
                        description={t('aiChatToolDesc')}
                        icon={
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5m1.5.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V3.75c0-.414.336-.75.75-.75h1.5a.75.75 0 0 1 .75.75v16.5m.75-16.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v16.5c0 .414.336-.75.75.75h1.5a.75.75 0 0 0 .75-.75V4.5m3.75.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V3.75c0-.414.336-.75.75-.75h1.5a.75.75 0 0 1 .75.75v16.5m.75-16.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v16.5c0 .414.336-.75.75.75h1.5a.75.75 0 0 0 .75-.75V4.5M12 12h9" />
                            </svg>
                        }
                        onClick={onAiAnalystClick}
                        onHelpClick={() => showHelp(t('aiChatToolTitle'), t('help.aiAnalyst'))}
                    />
                    <ToolCard
                        title={t('backtesting')}
                        description={t('backtestingDesc')}
                        badges={[t('forExperts')]}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M11.75 16.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" opacity=".4"/><path d="M4.5 6.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10Zm0 4a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"/><path d="M21 2.75H3A1.25 1.25 0 0 0 1.75 4v16A1.25 1.25 0 0 0 3 21.25h18A1.25 1.25 0 0 0 22.25 20V4A1.25 1.25 0 0 0 21 2.75ZM20.75 17h-8a.75.75 0 0 0-.75.75v2h-8A.75.75 0 0 1 3.25 19V4.75h17a.5.5 0 0 1 .5.5v11.75Z"/></svg>
                        }
                        onClick={() => setView('backtest')}
                        onHelpClick={() => showHelp(t('backtesting'), t('help.backtesting'))}
                    />
                    <ToolCard
                        title={t('investmentSearch.title')}
                        description={t('investmentSearch.description')}
                        isDisabled={true}
                        badges={[t('underDevelopment')]}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16.32 14.9a8 8 0 1 0-1.41 1.41l5.38 5.38a1 1 0 0 0 1.41-1.41zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" opacity=".4"/>
                                <path d="M11.6 10.5c.2-.3.2-.6 0-.9l-1-1.5c-.3-.4-.8-.5-1.2-.2L8 9.7V9.5c0-.8-.7-1.5-1.5-1.5h-1c-.8 0-1.5.7-1.5 1.5v1c0 .8.7 1.5 1.5 1.5H6c.8 0 1.5-.7 1.5-1.5v-.2l1.4 1.9c.2.3.6.4 1 .2l1.7-.9z" />
                            </svg>
                        }
                        onClick={() => {}}
                        onHelpClick={() => showHelp(t('investmentSearch.title'), t('help.investmentSearch'))}
                    />
                    {/* Custom compact card for Arbitrage */}
                    <div
                        onClick={() => setView('arbitrage')}
                        className="group relative bg-[rgb(var(--color-panel-bg-val))] backdrop-blur-lg border border-[rgb(var(--color-border-val))] rounded-lg p-3 text-left rtl:text-right transition-all duration-300 overflow-hidden hover:border-[rgb(var(--color-primary-accent-val))]/20 hover:bg-[rgb(var(--color-panel-bg-hover-val))] hover:-translate-y-1 col-span-1 md:col-span-2 cursor-pointer"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                showHelp(t('arbitrage.title'), t('help.arbitrage'));
                            }}
                            className="absolute top-2 left-2 rtl:left-auto rtl:right-2 z-20 h-6 w-6 flex items-center justify-center bg-red-600/50 text-white rounded-full text-sm font-bold hover:bg-red-500 transition-all scale-90 group-hover:scale-100 opacity-70 group-hover:opacity-100"
                            aria-label={`Help for ${t('arbitrage.title')}`}
                        >
                            ?
                        </button>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="text-[rgb(var(--color-primary-accent-val))]">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6.71 16.71 5.29 15.29 9.59 11H3v-2h6.59l-4.3-4.29 1.42-1.42 5.71 5.71a1 1 0 0 1 0 1.41Z" opacity=".4"/>
                                        <path d="M17.29 7.29 18.71 8.71 14.41 13H21v2h-6.59l4.3 4.29-1.42 1.42-5.71-5.71a1 1 0 0 1 0-1.41Z"/>
                                    </svg>
                                </div>
                                <h3 className="text-base font-bold text-[rgb(var(--color-text-heading-val))]">{t('arbitrage.title')}</h3>
                            </div>
                            <p className="text-xs text-[rgb(var(--color-text-secondary-val))] mb-2">{t('arbitrage.description')}</p>
                            <div className="flex flex-wrap gap-1">
                                {[t('forExperts'), t('underDevelopment'), t('arbitrage.experimental')].map(badge => (
                                    <div key={badge} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${badgeColors[badge] || 'bg-gray-500/20 text-gray-300 ring-gray-500/30'}`}>
                                        {badge}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <HelpModal 
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                title={helpModalContent.title}
                content={helpModalContent.content}
            />
        </div>
    );
};
