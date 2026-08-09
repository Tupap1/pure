import { useEffect } from 'react';
import { processSyncQueue, pullRemoteState } from '../sync/sync-engine';

export function useSyncEngine(intervalMs = 15000) {
  useEffect(() => {
    // 1. Initial pull and flush queue on mount
    pullRemoteState().then(() => processSyncQueue());

    // 2. Periodic background sync timer
    const timer = setInterval(() => {
      processSyncQueue();
    }, intervalMs);

    // 3. Online event listener
    const handleOnline = () => {
      processSyncQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [intervalMs]);
}
