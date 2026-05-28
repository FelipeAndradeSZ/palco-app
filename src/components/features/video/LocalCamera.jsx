import { useEffect, useRef, useState } from 'react';

export default function LocalCamera({ isActive }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    let activeStream = null;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true, // we request audio so the artist sees they are "broadcasting", but we mute local playback to avoid echo
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Erro ao acessar a câmera:', err);
        setError('Não foi possível acessar a câmera e microfone. Verifique as permissões do navegador.');
      }
    }

    if (isActive) {
      startCamera();
    } else {
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="relative w-full aspect-video bg-palco-black rounded-2xl overflow-hidden border border-palco-border shadow-2xl flex items-center justify-center">
      {error ? (
        <div className="text-palco-text-muted text-sm text-center px-6">
          <p className="text-2xl mb-2">📷❌</p>
          {error}
        </div>
      ) : (
        <>
          {/* O autoPlay e muted são necessários. Muted evita que o artista ouça a si mesmo (microfonia). */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]" // mirror effect
          />
          {/* Overlay de LIVE */}
          <div className="absolute top-4 left-4 bg-palco-live text-white font-bold text-xs tracking-widest px-3 py-1 rounded-full animate-pulse flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            AO VIVO
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-palco-black/80 to-transparent">
            <div className="flex items-center gap-3">
               <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" title="Microfone ativo"></div>
               <span className="text-white font-medium text-sm drop-shadow-md">Sua transmissão está no ar</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
