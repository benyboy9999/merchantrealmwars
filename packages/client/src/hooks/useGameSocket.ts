import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WsEvent } from '@merchant-realms/shared';
import { useAuthStore } from '../stores/auth.js';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket.js';

/**
 * Mounts once at the app root. Connects the socket when authenticated and
 * invalidates React Query caches in response to server-pushed events.
 * No polling — the server tells us when something changes.
 */
export function useGameSocket(): void {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    connectSocket();
    const socket = getSocket();

    const onTickComplete = () => {
      void qc.invalidateQueries({ queryKey: ['empire'] });
      void qc.invalidateQueries({ queryKey: ['keep'] });
      void qc.invalidateQueries({ queryKey: ['exchange-storage'] });
      void qc.invalidateQueries({ queryKey: ['exchange-listings'] });
      void qc.invalidateQueries({ queryKey: ['admin-status'] });
    };

    const onCaravanArrived = () => {
      void qc.invalidateQueries({ queryKey: ['empire'] });
      void qc.invalidateQueries({ queryKey: ['keep'] });
    };

    const onEmpireUpdate = () => {
      void qc.invalidateQueries({ queryKey: ['empire'] });
      void qc.invalidateQueries({ queryKey: ['keep'] });
      void qc.invalidateQueries({ queryKey: ['exchange-storage'] });
    };

    const onOrderMatched = () => {
      void qc.invalidateQueries({ queryKey: ['exchange-storage'] });
      void qc.invalidateQueries({ queryKey: ['exchange-listings'] });
    };

    const onProductionCompleted = (payload: { keepId: string }) => {
      void qc.invalidateQueries({ queryKey: ['keep', payload.keepId] });
    };

    const onProductionBlocked = (payload: { keepId: string }) => {
      void qc.invalidateQueries({ queryKey: ['keep', payload.keepId] });
    };

    socket.on(WsEvent.TICK_COMPLETE, onTickComplete);
    socket.on(WsEvent.CARAVAN_ARRIVED, onCaravanArrived);
    socket.on(WsEvent.EMPIRE_UPDATE, onEmpireUpdate);
    socket.on(WsEvent.EXCHANGE_ORDER_MATCHED, onOrderMatched);
    socket.on(WsEvent.PRODUCTION_COMPLETED, onProductionCompleted);
    socket.on(WsEvent.PRODUCTION_BLOCKED, onProductionBlocked);

    return () => {
      socket.off(WsEvent.TICK_COMPLETE, onTickComplete);
      socket.off(WsEvent.CARAVAN_ARRIVED, onCaravanArrived);
      socket.off(WsEvent.EMPIRE_UPDATE, onEmpireUpdate);
      socket.off(WsEvent.EXCHANGE_ORDER_MATCHED, onOrderMatched);
      socket.off(WsEvent.PRODUCTION_COMPLETED, onProductionCompleted);
      socket.off(WsEvent.PRODUCTION_BLOCKED, onProductionBlocked);
      disconnectSocket();
    };
  }, [token, qc]);
}
