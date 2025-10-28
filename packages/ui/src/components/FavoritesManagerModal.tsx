import React, { useState, useMemo } from 'react';
import { TARGET_SYMBOLS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

interface FavoritesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteSymbols: Set<string>;
  toggleFavorite: (symbol: string) => void;
}

export const FavoritesManagerModal: React.FC<FavoritesManagerModalProps> = ({ isOpen, onClose, favoriteSymbols, toggleFavorite }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSymbols = useMemo(() => {
    if (!searchTerm) return TARGET_SYMBOLS;
    return TARGET_SYMBOLS.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--color-panel-bg-val))] rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[rgb(var(--color-border-val))]">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text-heading-val))]">{t('manageFavoritesTitle')}</h2>
          <p className="text-sm text-[rgb(var(--color-text-secondary-val))]">{t('manageFavoritesDescModal')}</p>
        </div>
        <div className="p-4">
          <input
            type="text"
            placeholder={t('searchForCoin')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[rgb(var(--color-panel-bg-light-val))] border border-[rgb(var(--color-border-light-val))] text-[rgb(var(--color-text-primary-val))] rounded-md p-2 focus:ring-2 focus:ring-[rgb(var(--color-primary-accent-val))]"
          />
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-2">
          {filteredSymbols.map(symbol => (
            <div 
                key={symbol} 
                className="interactive-list-item flex items-center justify-between bg-[rgb(var(--color-panel-bg-light-val))]/50 p-2 rounded-md cursor-pointer hover:bg-[rgb(var(--color-panel-bg-hover-val))] transition-colors"
                onClick={() => toggleFavorite(symbol)}
                onMouseMove={handleMouseMove}
            >
              <span className="text-[rgb(var(--color-text-primary-val))] font-medium">{symbol}</span>
              <button 
                  title={favoriteSymbols.has(symbol) ? t('removeFromFavorites') : t('addToFavorites')}
                  className="text-[rgb(var(--color-text-muted-val))] hover:text-[rgb(var(--color-warning-text-val))] transition-colors p-1 rounded-full hover:bg-white/10"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" 
                          className={favoriteSymbols.has(symbol) ? 'text-[rgb(var(--color-warning-text-val))]' : 'text-[rgb(var(--color-border-light-val))]'}
                      />
                  </svg>
              </button>
            </div>
          ))}
           {filteredSymbols.length === 0 && (
              <p className="text-[rgb(var(--color-text-muted-val))] text-center py-4">{t('noCoinsFound')}</p>
           )}
        </div>
        <div className="p-4 border-t border-[rgb(var(--color-border-val))] flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-[rgb(var(--color-primary-accent-val))]/10 backdrop-blur-md border border-[rgb(var(--color-primary-accent-val))]/20 text-white font-bold rounded-lg hover:bg-[rgb(var(--color-primary-accent-val))]/20 transition-colors">
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
