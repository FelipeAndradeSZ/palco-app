import LiveStreamPlayer from './LiveStreamPlayer';

export default function LocalCamera({ isActive, stream, status, error, artistName }) {
  if (!isActive) return null;

  const hasVideo = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));

  return (
    <LiveStreamPlayer
      stream={stream}
      status={status}
      error={error}
      title={artistName || 'Sua transmissao'}
      subtitle={hasVideo
        ? 'Camera e microfone enviados aos ouvintes. Use fone ou mantenha longe de caixas para evitar eco.'
        : 'Microfone enviado aos ouvintes em modo somente audio.'}
      initial={(artistName || 'P').charAt(0).toUpperCase()}
      muted
      mirrored
    />
  );
}
