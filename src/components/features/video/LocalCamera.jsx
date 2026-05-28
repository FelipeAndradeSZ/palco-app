import LiveStreamPlayer from './LiveStreamPlayer';

export default function LocalCamera({ isActive, stream, status, error, artistName }) {
  if (!isActive) return null;

  return (
    <LiveStreamPlayer
      stream={stream}
      status={status}
      error={error}
      title={artistName || 'Sua transmissao'}
      subtitle="Camera e microfone enviados aos ouvintes. Use fone ou mantenha longe de caixas para evitar eco."
      initial={(artistName || 'P').charAt(0).toUpperCase()}
      muted
      mirrored
    />
  );
}
