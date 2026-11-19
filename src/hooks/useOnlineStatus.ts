/**
 * useOnlineStatus - Hook pour détecter l'état de connexion
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
    const [isOnline, setIsOnline] = useState(() => {
        // Check if navigator.onLine is available (not in SSR)
        if (typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true;
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
