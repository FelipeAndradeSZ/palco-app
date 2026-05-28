/**
 * ArtistRequestQueue — Fila de controle de pedidos para o artista
 */

import { useState } from 'react';
import { updateRequestStatus } from '../../../services/bountyService';
import Button from '../../ui/Button';

export default function ArtistRequestQueue({ activeRequests, onStatusChanged }) {
  const [processingId, setProcessingId] = useState(null);

  const pendingRequests = activeRequests.filter(r => r.status === 'pending');
  const acceptedRequests = activeRequests.filter(r => r.status === 'accepted' || r.status === 'playing');

  const handleStatusChange = async (id, newStatus) => {
    setProcessingId(id);
    try {
      await updateRequestStatus(id, newStatus);
      if (onStatusChanged) {
        onStatusChanged();
      }
    } catch (err) {
      console.error('Erro ao atualizar pedido:', err);
    } finally {
      setProcessingId(null);
    }
  };


  const renderRequestItem = (req, isPending) => {
    const requesterName = req.requester?.name || 'Alguém';
    return (
      <div key={req.id} className={`p-4 rounded-xl border mb-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all ${isPending ? 'bg-palco-card border-palco-border' : 'bg-palco-gold/5 border-palco-gold/30'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-display font-bold text-lg text-palco-text">{req.song_title}</span>
            <span className="text-palco-success font-bold text-sm bg-palco-success/10 px-2 py-0.5 rounded">
              R$ {req.bounty_value.toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-palco-text-muted">
            Pedido por <span className="text-palco-text-subtle font-medium">{requesterName}</span>
          </p>
          {req.target_artist?.name && (
            <p className="text-xs text-palco-gold mt-1">
              Direcionado para {req.target_artist.name}
            </p>
          )}
          {req.dedication && (
            <p className="text-sm text-palco-text italic mt-2 border-l-2 border-palco-gold pl-2">
              "{req.dedication}"
            </p>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {isPending ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none text-palco-live hover:text-red-400 hover:bg-palco-live/10"
                onClick={() => handleStatusChange(req.id, 'cancelled')}
                disabled={processingId === req.id}
              >
                Recusar
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => handleStatusChange(req.id, 'accepted')}
                loading={processingId === req.id}
              >
                Aceitar
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => handleStatusChange(req.id, 'completed')}
              loading={processingId === req.id}
            >
              ✅ Marcar como Tocado
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Repertório Atual */}
      <section>
        <h3 className="font-display font-bold text-xl text-palco-gold mb-4 flex items-center gap-2">
          <span>🎸</span> Repertório Atual (Aceitos)
        </h3>
        {acceptedRequests.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-palco-border rounded-xl text-palco-text-subtle">
            Nenhuma música na fila no momento. Aceite pedidos abaixo!
          </div>
        ) : (
          acceptedRequests.map(req => renderRequestItem(req, false))
        )}
      </section>

      {/* Fila de Pedidos */}
      <section>
        <h3 className="font-display font-bold text-xl text-palco-text mb-4 flex items-center gap-2">
          <span>⏳</span> Fila de Pedidos
          {pendingRequests.length > 0 && (
            <span className="bg-palco-live text-white text-xs px-2 py-0.5 rounded-full">
              {pendingRequests.length} novos
            </span>
          )}
        </h3>
        {pendingRequests.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-palco-border rounded-xl text-palco-text-subtle">
            Aguardando novos pedidos...
          </div>
        ) : (
          pendingRequests.map(req => renderRequestItem(req, true))
        )}
      </section>
    </div>
  );
}
