import LiveStreamPlayer from './LiveStreamPlayer';

export default function LocalCamera({ isActive, stream, status, error, artistName }) {
  if (!isActive) return null;

  return (
    <LiveStreamPlayer
      stream={stream}
      status={status}
      error={error}
      title={artistName || 'Sua transmissão'}
      subtitle="Câmera e microfone enviados para os ouvintes desta sala."
      initial={(artistName || 'P').charAt(0).toUpperCase()}
      muted
      mirrored
    />
  );
}
