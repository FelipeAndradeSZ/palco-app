import { useEffect, useMemo, useRef } from 'react';

const STATUS_LABELS = {
  idle: 'Pronto para conectar',
  connecting: 'Conectando...',
  waiting_artist: 'Aguardando o artista',
  ready: 'Transmissão pronta',
  live: 'Ao vivo',
  error: 'Conexão indisponível',
};

export default function LiveStreamPlayer({
  stream,
  status = 'idle',
  error,
  title = 'PALCO ao vivo',
  subtitle = 'A música acontece aqui.',
  initial = 'P',
  muted = false,
  mirrored = false,
  canStart = false,
  isStarted = false,
  onStart,
  actionLabel = 'Ouvir ao vivo',
  className = 'aspect-video',
  showStatus = true,
  showInfo = true,
}) {
  const videoRef = useRef(null);

  const hasMedia = useMemo(() => {
    return Boolean(stream?.getTracks?.().some((track) => track.readyState === 'live'));
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;

    if (stream) {
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-palco-border bg-palco-black shadow-2xl ${className}`}>
      {hasMedia ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,168,67,0.18),transparent_32%),linear-gradient(180deg,rgba(31,33,39,0.94),rgba(5,5,6,0.98))]" />
      )}

      {showStatus && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-palco-live px-3 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-lg">
          <span className="h-2 w-2 rounded-full bg-white" />
          {status === 'live' || status === 'ready' ? 'Ao vivo' : STATUS_LABELS[status] || 'Ao vivo'}
        </div>
      )}

      {!hasMedia && (
        <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-palco-border bg-palco-dark text-4xl font-black text-palco-gold">
            {initial}
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-palco-text">{title}</h3>
          <p className="mt-2 text-sm text-palco-text-muted">{error || subtitle}</p>
          {canStart && !isStarted && (
            <button
              type="button"
              onClick={onStart}
              className="mt-5 rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black transition hover:bg-palco-gold-light"
            >
              {actionLabel}
            </button>
          )}
          {isStarted && !error && (
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-palco-gold">
              {STATUS_LABELS[status] || 'Conectando...'}
            </p>
          )}
        </div>
      )}

      {hasMedia && showInfo && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-palco-black/90 to-transparent p-4">
          <p className="font-display text-lg font-bold text-white drop-shadow-md">{title}</p>
          <p className="mt-1 text-sm text-palco-text-muted drop-shadow-md">
            {error || subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
