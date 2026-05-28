/**
 * ChatBox — Componente de Chat em Tempo Real
 * 
 * Exibe histórico de mensagens, auto-scroll, e campo de envio.
 * Renderiza alertas de gorjeta/pedido de forma diferenciada.
 */

import { useState, useRef, useEffect } from 'react';
import { validateChatMessage } from '../../../lib/validators';
import Button from '../../ui/Button';

export default function ChatBox({ messages, onSendMessage, isConnected }) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending || !isConnected) return;

    const validation = validateChatMessage(inputText);
    if (!validation.valid) {
      // Idealmente mostraríamos um toast aqui, por hora apenas ignoramos
      console.warn(validation.error);
      return;
    }

    setSending(true);
    try {
      await onSendMessage(validation.sanitized);
      setInputText('');
    } catch (err) {
      console.error('Erro ao enviar mensagem', err);
    } finally {
      setSending(false);
    }
  };

  // Renderiza a mensagem baseado no seu tipo (text, tip_alert, request_alert)
  const renderMessage = (msg) => {
    const senderName = msg.sender?.name || 'Usuário';
    const isSpecial = msg.message_type !== 'text';
    const isTip = msg.message_type === 'tip_alert';
    const isRequest = msg.message_type === 'request_alert';

    let wrapperClasses = "mb-3 px-3 py-2 rounded-lg text-sm ";
    let headerClasses = "font-bold text-xs mb-1 ";

    if (isTip) {
      wrapperClasses += "bg-palco-gold/10 border border-palco-gold/30";
      headerClasses += "text-palco-gold";
    } else if (isRequest) {
      wrapperClasses += "bg-palco-live/10 border border-palco-live/30";
      headerClasses += "text-palco-live";
    } else {
      wrapperClasses += "bg-transparent";
      headerClasses += "text-palco-text-muted";
    }

    return (
      <div key={msg.id} className={wrapperClasses}>
        <div className={headerClasses}>
          {senderName} {isSpecial && (isTip ? '💰 enviou uma gorjeta!' : '🎵 pediu uma música!')}
        </div>
        <div className={`break-words ${isSpecial ? 'text-palco-text font-medium' : 'text-palco-text'}`}>
          {msg.content}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-palco-card border border-palco-border rounded-xl overflow-hidden">
      {/* Header do Chat */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-palco-border bg-palco-dark/50">
        <h3 className="font-display font-bold text-palco-text">Chat ao Vivo</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-palco-success pulse-animation' : 'bg-palco-text-muted'}`} />
          <span className="text-xs text-palco-text-subtle">
            {isConnected ? 'Conectado' : 'Conectando...'}
          </span>
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-palco-text-subtle text-sm text-center">
            Nenhuma mensagem ainda.<br/>Seja o primeiro a interagir!
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Envio */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-palco-border bg-palco-dark/50 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isConnected ? "Digite sua mensagem..." : "Aguarde..."}
          disabled={!isConnected || sending}
          className="flex-1 bg-palco-black border border-palco-border rounded-lg px-3 py-2 text-sm text-palco-text focus:outline-none focus:border-palco-gold disabled:opacity-50"
          maxLength={500}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!isConnected || !inputText.trim() || sending}
          loading={sending}
          className="shrink-0"
        >
          Enviar
        </Button>
      </form>
    </div>
  );
}
