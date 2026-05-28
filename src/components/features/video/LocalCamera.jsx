import { useEffect, useRef, useState } from 'react';

export default function LocalCamera({ isActive }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Erro ao acessar a camera:', err);
        setError('Nao foi possivel acessar a camera e microfone. Verifique as permissoes do navegador.');
      }
    }

    if (isActive) startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-palco-border bg-palco-black shadow-2xl">
      {error ? (
        <div className="px-6 text-center text-sm text-palco-text-muted">
          <p className="mb-2 text-2xl">Camera indisponivel</p>
          {error}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
          />
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-palco-live px-3 py-1 text-xs font-bold tracking-widest text-white shadow-lg">
            <span className="h-2 w-2 rounded-full bg-white" />
            AO VIVO
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-palco-black/80 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" title="Microfone ativo" />
              <span className="text-sm font-medium text-white drop-shadow-md">Sua transmissao esta no ar</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
