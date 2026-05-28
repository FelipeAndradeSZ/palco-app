/**
 * useRooms — Hook para listar salas ao vivo
 */

import { useState, useEffect, useCallback } from 'react';
import { getRooms } from '../services/roomService';

export function useRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
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
    const task = setTimeout(fetchRooms, 0);
    return () => clearTimeout(task);
  }, [fetchRooms]);

  return { rooms, loading, error, refetch: fetchRooms };
}
