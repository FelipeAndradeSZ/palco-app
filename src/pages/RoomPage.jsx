/**
 * RoomPage — Sala ao Vivo
 * 
 * Interface para os ouvintes participarem da sala.
 * Contém o ChatBox (Realtime) e no futuro o sistema de pedidos.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomRealtime } from '../hooks/useRoomRealtime';
import { getRoomById, joinRoom, leaveRoom } from '../services/roomService';
import { getWallet, addFundsCheckout } from '../services/walletService';
import { createSongRequest } from '../services/bountyService';
import { useAuth } from '../hooks/useAuth';
import ChatBox from '../components/features/chat/ChatBox';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import RequestSongModal from '../components/features/bounty/RequestSongModal';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingFunds, setAddingFunds] = useState(false);
  
  // Conecta ao WebSocket
  const { messages, isConnected, sendChatMessage } = useRoomRealtime(roomId);

  useEffect(() => {
    let isMounted = true;

    async function setupRoom() {
      // 1. Busca dados da sala
      const { data: roomData, error: roomError } = await getRoomById(roomId);
      if (roomError || !roomData) {
        navigate('/'); // Redireciona se não achar
        return;
      }
      
      if (isMounted) setRoom(roomData);

      // 2. Registra a entrada do usuário na sala (para métricas de listener_count)
      if (profile?.id) {
        await joinRoom(roomId, profile.id, profile.role);
        
        // 3. Busca a carteira para ver o saldo
        const { data: walletData } = await getWallet(profile.id);
        if (isMounted && walletData) {
          setWallet(walletData);
        }
      }
      
      if (isMounted) setLoading(false);
    }

    setupRoom();

    // Cleanup: Remove usuário da sala ao sair
    return () => {
      isMounted = false;
      if (profile?.id) {
        leaveRoom(roomId, profile.id);
      }
    };
  }, [roomId, profile, navigate]);

  const handleAddFunds = async () => {
    setAddingFunds(true);
    try {
      // Chama o Stripe Checkout real via Edge Functions
      await addFundsCheckout(50, profile.id);
    } catch (err) {
      console.error('Erro ao redirecionar para pagamento', err);
      setAddingFunds(false);
    }
  };

  const handleSongRequest = async (requestData) => {
    const { error } = await createSongRequest({
      roomId,
      ...requestData
    });
    
    if (error) throw new Error(error.message);
    
    // Atualiza o saldo localmente após o pedido (o trigger já deduziu no banco)
    const { data } = await getWallet(profile.id);
    if (data) setWallet(data);
  };

  if (loading || !room) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const artistName = room.current_artist?.name;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header da Sala */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display font-bold text-2xl text-palco-text">
              {room.name}
            </h1>
            {artistName && <Badge variant="live" pulse>AO VIVO</Badge>}
          </div>
          <p className="text-palco-text-muted">
            {artistName ? `Com ${artistName}` : 'Aguardando artista'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="gold">{room.genre}</Badge>
          <div className="text-sm text-palco-text-subtle flex items-center gap-1.5 hidden sm:flex">
            <span className="w-2 h-2 rounded-full bg-palco-success" />
            {room.listener_count || 0} ouvintes
          </div>
          
          {/* Sessão Carteira do Usuário */}
          {profile && profile.role === 'listener' && (
            <div className="flex items-center gap-3 bg-palco-dark/50 px-3 py-1.5 rounded-lg border border-palco-border ml-2">
              <span className="text-sm font-bold text-palco-gold">
                R$ {wallet?.balance?.toFixed(2) || '0.00'}
              </span>
              <button 
                onClick={handleAddFunds}
                disabled={addingFunds}
                className="text-xs text-palco-text hover:text-palco-gold transition-colors font-bold cursor-pointer disabled:opacity-50 border border-palco-border px-2 py-1 rounded"
                title="Comprar saldo via Stripe"
              >
                {addingFunds ? 'Processando...' : '+ R$ 50'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Principal (Layout Responsivo) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        {/* Esquerda: Player/Ações */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto relative">
          
          {/* Botão de Pedir Música (Ação Principal) */}
          {profile && profile.role === 'listener' && artistName && (
            <div className="absolute top-4 left-4 z-10">
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="bg-palco-gold text-palco-black font-display font-bold text-lg px-6 py-3 rounded-full shadow-[0_0_20px_rgba(212,168,67,0.4)] hover:shadow-[0_0_30px_rgba(212,168,67,0.6)] hover:scale-105 transition-all duration-200 flex items-center gap-2 cursor-pointer"
               >
                 <span>🎵</span> Pedir Música
               </button>
            </div>
          )}

          {/* Mockup do Palco */}
          <div className="aspect-video bg-palco-card border border-palco-border rounded-2xl flex items-center justify-center flex-col shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-palco-black/80 via-transparent to-transparent pointer-events-none" />
            <div className="w-24 h-24 rounded-full bg-palco-dark border-4 border-palco-border flex items-center justify-center mb-4 z-10">
               <span className="text-4xl">{artistName ? artistName.charAt(0) : '🎵'}</span>
            </div>
            <p className="font-display font-bold text-xl text-palco-text z-10">
              {artistName || 'O palco está vazio'}
            </p>
            <p className="text-palco-text-muted text-sm mt-2 z-10">
              A música acontece aqui.
            </p>
          </div>
        </div>

        {/* Direita: Chat em Tempo Real */}
        <div className="h-[400px] lg:h-auto min-h-0">
          <ChatBox 
            messages={messages} 
            isConnected={isConnected} 
            onSendMessage={sendChatMessage} 
          />
        </div>

      </div>

      {/* Modal de Pagamento/Pedido */}
      <RequestSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSongRequest}
        currentBalance={wallet?.balance || 0}
      />
    </div>
  );
}
