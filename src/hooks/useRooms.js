/**
 * useRooms — Hook para listar salas ao vivo
 */

import { useState, useEffect, useCallback } from 'react';
import { getRooms, subscribeToRooms, unsubscribeFromRooms } from '../services/roomService';

export function useRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await getRooms();
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setRooms(data || []);
    } catch {
      setError('Erro ao carregar salas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let refreshTimer = null;
    const task = setTimeout(() => fetchRooms(), 0);
    const channel = subscribeToRooms(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => fetchRooms({ background: true }), 150);
    });

    return () => {
      clearTimeout(task);
      clearTimeout(refreshTimer);
      unsubscribeFromRooms(channel);
    };
  }, [fetchRooms]);

  return { rooms, loading, error, refetch: fetchRooms };
}
