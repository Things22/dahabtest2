import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useFavorites = () => {
    const { currentUser, updateUserFavorites } = useAuth();
    // Keep the state internal to the hook, but sync it with the auth context
    const [internalFavorites, setInternalFavorites] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (currentUser?.favorites) {
            setInternalFavorites(new Set(currentUser.favorites));
        } else {
            setInternalFavorites(new Set());
        }
    }, [currentUser]);

    const toggleFavorite = useCallback((symbol: string) => {
        setInternalFavorites(prev => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(symbol)) {
                newFavorites.delete(symbol);
            } else {
                newFavorites.add(symbol);
            }
            // Propagate the change up to the context
            updateUserFavorites(newFavorites);
            return newFavorites;
        });
    }, [updateUserFavorites]);

    const isFavorite = useCallback((symbol: string): boolean => {
        return internalFavorites.has(symbol);
    }, [internalFavorites]);

    return { favoriteSymbols: internalFavorites, toggleFavorite, isFavorite };
};
