import { useEffect, useState, useCallback, useRef } from 'react';

const GIFT_TYPES = [
  { min: 5, max: 9.99, emoji: '🎙️', name: 'Microfone de Bronze', color: 'from-amber-700 to-amber-900 border-amber-500' },
  { min: 10, max: 19.99, emoji: '🎸', name: 'Guitarra de Prata', color: 'from-slate-400 to-slate-600 border-slate-300' },
  { min: 20, max: 49.99, emoji: '👑', name: 'Coroa de Ouro', color: 'from-yellow-400 to-yellow-600 border-yellow-300' },
  { min: 50, max: 9999, emoji: '🌟', name: 'Super Estrela', color: 'from-purple-500 via-pink-500 to-red-500 border-pink-400' },
];

function getGiftDetails(amount) {
  return GIFT_TYPES.find(g => amount >= g.min && amount <= g.max) || GIFT_TYPES[0];
}

export default function TikTokInteractions({
  incomingLike,
  onSendLike,
  activeAlerts = [],
  className = '',
}) {
  const [hearts, setHearts] = useState([]);
  const [activeGift, setActiveGift] = useState(null);
  const giftTimeoutRef = useRef(null);

  // Spawn heart
  const spawnHeart = useCallback((x, y) => {
    const id = crypto.randomUUID();
    const colors = ['#EF4444', '#EC4899', '#F43F5E', '#D4A843', '#A855F7', '#3B82F6', '#10B981'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.floor(Math.random() * 20) + 24; // 24px to 44px
    const rotation = Math.floor(Math.random() * 60) - 30; // -30deg to 30deg
    const duration = 1.5 + Math.random() * 0.8; // 1.5s to 2.3s
    const sideDelta = Math.floor(Math.random() * 60) - 30; // slide left/right

    const newHeart = { id, x, y, color, size, rotation, duration, sideDelta };
    setHearts((prev) => [...prev, newHeart]);

    // Clean up heart after animation ends
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, duration * 1000);
  }, []);

  // Listen to incoming likes from other users
  useEffect(() => {
    if (incomingLike && incomingLike.timestamp) {
      spawnHeart(incomingLike.x, incomingLike.y);
    }
  }, [incomingLike, spawnHeart]);

  // Listen to new alerts (tips/gifts)
  useEffect(() => {
    const tipAlerts = activeAlerts.filter(a => a.message_type === 'tip_alert');
    if (tipAlerts.length > 0) {
      const latest = tipAlerts[tipAlerts.length - 1];
      
      // Parse amount from text if not directly available (content might be like "Enviou R$ 10.00 de gorjeta...")
      let amount = 5;
      const match = latest.content?.match(/R\$\s*([0-9.]+)/i);
      if (match && match[1]) {
        amount = parseFloat(match[1]);
      }

      const gift = getGiftDetails(amount);
      const giftAlert = {
        id: latest.id || crypto.randomUUID(),
        senderName: latest.sender?.name || 'Ouvinte',
        amount,
        message: latest.content?.includes(':') ? latest.content.split(':').slice(1).join(':') : null,
        gift,
      };

      if (giftTimeoutRef.current) clearTimeout(giftTimeoutRef.current);
      setActiveGift(giftAlert);

      giftTimeoutRef.current = setTimeout(() => {
        setActiveGift(null);
      }, 4000);
    }
  }, [activeAlerts]);

  // Click on video area
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    spawnHeart(x, y);
    if (onSendLike) {
      onSendLike(x, y);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`absolute inset-0 z-30 cursor-pointer overflow-hidden select-none ${className}`}
    >
      {/* CSS Keyframes for animations */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          10% {
            transform: translateY(-20px) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-250px) translateX(var(--side-delta)) scale(0.8) rotate(var(--rot));
            opacity: 0;
          }
        }
        @keyframes giftPop {
          0% {
            transform: scale(0.3) rotate(-15deg);
            opacity: 0;
          }
          70% {
            transform: scale(1.1) rotate(5deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .floating-heart {
          position: absolute;
          animation: floatUp 2s ease-out forwards;
          pointer-events: none;
        }
        .gift-container {
          animation: giftPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* Floating Hearts */}
      {hearts.map((h) => (
        <svg
          key={h.id}
          className="floating-heart"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            width: `${h.size}px`,
            height: `${h.size}px`,
            color: h.color,
            fill: 'currentColor',
            '--side-delta': `${h.sideDelta}px`,
            '--rot': `${h.rotation}deg`,
            animationDuration: `${h.duration}s`,
          }}
          viewBox="0 0 24 24"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ))}

      {/* Gift Overlay */}
      {activeGift && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4 pointer-events-none z-40">
          <div className={`gift-container flex items-center gap-3.5 bg-gradient-to-r ${activeGift.gift.color} border p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md`}>
            <div className="text-4xl animate-bounce shrink-0">
              {activeGift.gift.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-palco-gold-light">
                Presente Enviado!
              </p>
              <h4 className="font-display font-black text-sm text-white truncate">
                {activeGift.senderName} enviou
              </h4>
              <p className="text-xs font-black text-white mt-0.5">
                {activeGift.gift.name} <span className="text-palco-gold">(R$ {activeGift.amount.toFixed(2)})</span>
              </p>
              {activeGift.message && (
                <p className="text-[10px] italic text-white/80 mt-1 truncate border-l border-white/30 pl-1.5">
                  "{activeGift.message}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
