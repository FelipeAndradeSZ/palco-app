/**
 * LiveAlertOverlay — Overlay animado para o Modo TV
 * 
 * Consome a fila de alertas do `useRoomRealtime` e exibe
 * pop-ups centralizados estilo Twitch para gorjetas e pedidos.
 */

export default function LiveAlertOverlay({ alerts }) {
  // Exibimos apenas o alerta mais recente da fila no topo para não poluir a TV
  // Como o useRoomRealtime limpa a fila a cada 5s, eles aparecerão sequencialmente.
  const currentAlert = alerts.length > 0 ? alerts[alerts.length - 1] : null;

  if (!currentAlert) return null;

  const isTip = currentAlert.message_type === 'tip_alert';
  const isRequest = currentAlert.message_type === 'request_alert';
  const senderName = currentAlert.sender?.name || 'Alguém';

  return (
    <div className="absolute inset-x-0 top-32 flex justify-center pointer-events-none z-50">
      <div 
        className={`animate-bounce-in max-w-xl w-full mx-4 overflow-hidden rounded-2xl shadow-2xl backdrop-blur-md border 
          ${isTip ? 'bg-palco-gold/20 border-palco-gold/50 shadow-palco-gold/20' : ''}
          ${isRequest ? 'bg-palco-live/20 border-palco-live/50 shadow-palco-live/20' : ''}
        `}
      >
        <div className="px-8 py-6 text-center">
          {/* Icone / Header */}
          <div className="text-4xl mb-2">
            {isTip ? '💰' : '🎵'}
          </div>
          
          <h3 className={`font-display font-extrabold text-2xl mb-1
            ${isTip ? 'text-palco-gold-light' : 'text-red-400'}
          `}>
            {senderName} {isTip ? 'enviou uma GORJETA!' : 'pediu uma MÚSICA!'}
          </h3>
          
          {/* O conteúdo do alerta gerado pelo backend (ex: "Para a mesa 4" ou "Toca Evidências") */}
          <p className="text-palco-text text-xl font-medium mt-3">
            "{currentAlert.content}"
          </p>
        </div>

        {/* Barra de progresso visual de 5s */}
        <div className="h-1.5 w-full bg-palco-black/50">
          <div 
            className={`h-full animate-shrink-width
              ${isTip ? 'bg-palco-gold' : 'bg-palco-live'}
            `}
            style={{ animationDuration: '5s', animationTimingFunction: 'linear' }}
          />
        </div>
      </div>
    </div>
  );
}
