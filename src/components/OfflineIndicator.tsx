/**
 * OfflineIndicator - Bannière affichée quand l'app est hors-ligne
 */

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold animate-pulse">
            <WifiOff size={14} />
            <span>Mode hors-ligne — Les modifications seront sauvegardées localement</span>
        </div>
    );
}
