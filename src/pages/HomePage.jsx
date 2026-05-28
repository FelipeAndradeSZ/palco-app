import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../hooks/useAuth';
import RoomGrid from '../components/features/rooms/RoomGrid';

const brandFlow = [
  { step: '01', title: 'Escolha uma sala', text: 'Ambientes contínuos como Sertanejo Churrasco, Pagode de Mesa e MPB Ambiente.' },
  { step: '02', title: 'Aponte o QR', text: 'A TV vira o ponto de entrada para pedir música, votar e mandar gorjeta.' },
  { step: '03', title: 'Peça sua música', text: 'O público define a música, o valor e uma dedicatória para o artista.' },
  { step: '04', title: 'O artista aceita', text: 'Músicos reais recebem o pedido e executam ao vivo em tempo real.' },
  { step: '05', title: 'O ambiente reage', text: 'Chat, alertas, rankings e batalhas fazem a música virar experiência coletiva.' },
];

const whyPalco = [
  'Música de verdade, ao vivo',
  'Interação real com o artista',
  'Ambiente contínuo, como uma rádio ao vivo',
  'Valorização máxima do músico',
  'Feito para casa, bar, festa ou viagem',
];

const roomSamples = [
  { name: 'Sertanejo Churrasco', status: 'AO VIVO', artist: 'Gustavo Martins', listeners: '1.245' },
  { name: 'Pagode de Mesa', status: 'ABERTA', artist: 'Roda das 7', listeners: '988' },
  { name: 'Rock Clássico', status: 'AO VIVO', artist: 'Ana Ribeiro', listeners: '756' },
  { name: 'MPB Ambiente', status: 'ABERTA', artist: 'Clara Nunes Duo', listeners: '642' },
];

const phoneScreens = [
  {
    number: '1',
    title: 'Salas contínuas',
    heading: 'Salas ao vivo',
    rows: ['Sertanejo Churrasco', 'Pagode de Mesa', 'Rock Clássico', 'MPB Ambiente'],
  },
  {
    number: '2',
    title: 'Experiência de escuta',
    heading: 'Tocando agora',
    rows: ['Gustavo Martins', 'Evidências', 'Fila com 6 pedidos', '1.245 ouvintes'],
  },
  {
    number: '3',
    title: 'Peça sua música',
    heading: 'Pedir música',
    rows: ['Evidências', 'R$ 5', 'R$ 10', 'R$ 20', 'R$ 50'],
  },
  {
    number: '4',
    title: 'Interação ao vivo',
    heading: 'Chat da sala',
    rows: ['Dedicatória da mesa 4', 'Pedido aceito', 'Votação aberta', 'Gorjeta enviada'],
  },
  {
    number: '5',
    title: 'Perfil do artista',
    heading: 'Gustavo Martins',
    rows: ['Premium', '98% aprovação', '3.845 seguidores', 'Contratar show'],
  },
];

const ambienceCards = [
  'Casa',
  'Churrasco',
  'Bar',
  'Festa',
  'Restaurante',
  'Oficina',
];

function EqualizerLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 items-center gap-1" aria-hidden="true">
        {[18, 28, 34, 24, 14].map((height, index) => (
          <span
            key={height}
            className="w-1.5 rounded-full bg-palco-gold shadow-[0_0_14px_rgba(212,168,67,0.35)]"
            style={{ height, opacity: 0.65 + index * 0.07 }}
          />
        ))}
      </div>
      {!compact && (
        <div>
          <p className="font-display text-4xl font-extrabold leading-none text-white sm:text-5xl">
            PALCO
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-palco-text-muted">
            Música ao vivo para o seu momento
          </p>
        </div>
      )}
    </div>
  );
}

function HeroMonitor() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="rounded-[1.35rem] border border-palco-border bg-[#080809] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(44,18,12,0.92),rgba(7,7,8,0.98)_46%,rgba(20,16,12,0.96))]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-white">
                Sala Sertanejo Churrasco
              </p>
              <span className="mt-1 inline-flex rounded-full bg-palco-live px-2 py-0.5 text-[10px] font-black uppercase text-white">
                Ao vivo
              </span>
            </div>
            <div className="text-right text-[11px] text-palco-text-muted">
              <p>Pedidos</p>
              <p className="text-palco-gold">R$ 125 na fila</p>
            </div>
          </div>

          <div className="grid min-h-[280px] grid-cols-[1.25fr_0.95fr] gap-4 p-4 max-sm:grid-cols-1">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_8%,rgba(239,68,68,0.42),transparent_30%),linear-gradient(180deg,rgba(22,24,31,0.35),rgba(0,0,0,0.88))]">
              <div className="absolute inset-x-8 top-6 h-16 rounded-full bg-palco-gold/25 blur-2xl" />
              <div className="absolute left-1/2 top-12 h-32 w-24 -translate-x-1/2 rounded-full bg-palco-gold/15 blur-xl" />
              <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black to-transparent" />
              <div className="relative flex h-full flex-col items-center justify-end px-5 py-6 text-center">
                <div className="mb-5 h-24 w-24 rounded-full border border-palco-gold/40 bg-[radial-gradient(circle_at_50%_30%,#f0c76f,rgba(120,61,34,0.55)_45%,rgba(0,0,0,0.85)_72%)] shadow-[0_0_34px_rgba(212,168,67,0.25)]" />
                <p className="font-display text-xl font-bold text-white">Gustavo Martins</p>
                <p className="text-xs text-palco-text-muted">Tocando agora</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[
                ['Evidências', 'Mesa 4', 'R$ 15'],
                ['Anna Júlia', 'Lucas pediu', 'R$ 10'],
                ['Boate Azul', 'Dedicatória', 'R$ 20'],
              ].map(([song, meta, value]) => (
                <div key={song} className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{song}</p>
                      <p className="text-xs text-palco-text-subtle">{meta}</p>
                    </div>
                    <span className="rounded-full bg-palco-gold/15 px-2 py-1 text-xs font-bold text-palco-gold">
                      {value}
                    </span>
                  </div>
                </div>
              ))}
              <div className="mt-auto rounded-xl border border-palco-gold/25 bg-palco-gold/10 p-3">
                <div className="flex items-end gap-1.5">
                  {[20, 34, 18, 42, 26, 48, 30, 22, 40, 24, 36, 16].map((height) => (
                    <span
                      key={height}
                      className="w-1.5 rounded-full bg-palco-gold"
                      style={{ height }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-palco-text-muted">
                  <span>01:28</span>
                  <span>1.245 ouvintes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-4 w-44 rounded-b-2xl bg-[#050505]" />
      <div className="mx-auto h-2 w-72 rounded-full bg-black/70 blur-[1px]" />
    </div>
  );
}

function QrPanel() {
  const qrValue = typeof window !== 'undefined'
    ? `${window.location.origin}/interact/demo-palco?artist=gustavo-martins`
    : 'https://palco.app/interact/demo-palco?artist=gustavo-martins';

  return (
    <aside className="rounded-2xl border border-palco-gold/45 bg-black/55 p-5 shadow-[0_0_34px_rgba(212,168,67,0.12)]">
      <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-palco-gold">
        Interaja agora
      </p>
      <div className="mx-auto my-4 w-fit rounded-xl bg-white p-2">
        <QRCodeSVG value={qrValue} size={124} level="H" includeMargin={false} />
      </div>
      <p className="text-center text-xs text-palco-text-muted">
        Escaneie para pedir música, votar e mandar gorjeta.
      </p>
      <div className="mt-5 grid gap-2 text-sm">
        {['Peça músicas', 'Dedique para alguém', 'Envie uma gorjeta', 'Participe do chat'].map((item) => (
          <div key={item} className="flex items-center gap-2 text-palco-text">
            <span className="h-2 w-2 rounded-full bg-palco-gold" />
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}

function PhoneFrame({ screen }) {
  return (
    <div className="min-w-[190px] flex-1">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-palco-gold">
        {screen.number}. {screen.title}
      </p>
      <div className="mx-auto h-[360px] max-w-[210px] rounded-[2rem] border border-white/15 bg-[#050506] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="h-full overflow-hidden rounded-[1.55rem] border border-white/10 bg-palco-black">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
            <span className="text-[10px] font-bold text-palco-text-muted">9:31</span>
            <span className="h-1.5 w-10 rounded-full bg-white/20" />
            <span className="text-[10px] text-palco-gold">PALCO</span>
          </div>
          <div className="p-3">
            <h3 className="font-display text-base font-bold text-white">{screen.heading}</h3>
            <div className="mt-4 space-y-2">
              {screen.rows.map((row, index) => (
                <div
                  key={row}
                  className={`rounded-xl border p-3 text-xs ${
                    index === 0
                      ? 'border-palco-gold/40 bg-palco-gold/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-palco-text-muted'
                  }`}
                >
                  {row}
                </div>
              ))}
            </div>
            <div className="mt-5 h-20 rounded-2xl border border-palco-gold/20 bg-[radial-gradient(circle_at_50%_20%,rgba(212,168,67,0.35),transparent_42%),#09090a]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 ${className}`}>
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function HomePage() {
  const { rooms, loading, error } = useRooms();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  function handleRoomClick(room) {
    navigate(isAuthenticated ? `/room/${room.id}` : '/login');
  }

  return (
    <div className="overflow-hidden bg-palco-black">
      <section className="relative min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(212,168,67,0.16),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(127,29,29,0.26),transparent_30%),linear-gradient(180deg,#070707_0%,#0A0A0B_68%,#050505_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent,rgba(212,168,67,0.08)_40%,rgba(0,0,0,0.95))]" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-[0.9fr_1.45fr_0.78fr]">
          <div className="space-y-6">
            <EqualizerLogo />
            <div className="border-l-2 border-palco-gold pl-4">
              <p className="font-display text-xl font-extrabold uppercase text-palco-gold">
                A jukebox humana ao vivo.
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-palco-text-muted">
                Peça sua música. Interaja. Valorize o artista. Deixe rolando em qualquer ambiente social.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(isAuthenticated ? '/tv' : '/register')}
                className="rounded-xl bg-palco-gold px-5 py-3 text-sm font-black text-palco-black shadow-[0_0_24px_rgba(212,168,67,0.24)] transition hover:bg-palco-gold-light"
              >
                Abrir modo ambiente
              </button>
              <button
                type="button"
                onClick={() => navigate(isAuthenticated ? '/artist' : '/register')}
                className="rounded-xl border border-palco-gold/45 px-5 py-3 text-sm font-bold text-palco-gold transition hover:bg-palco-gold/10"
              >
                Sou artista
              </button>
            </div>
          </div>

          <HeroMonitor />
          <QrPanel />
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-[#080808] px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-5">
          {brandFlow.map((item) => (
            <div key={item.step} className="rounded-2xl border border-white/10 bg-palco-card/60 p-4">
              <p className="text-xs font-black text-palco-gold">{item.step}</p>
              <h3 className="mt-3 font-display text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-palco-text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
          <SectionCard title="Por que PALCO?">
            <div className="mt-4 grid gap-2">
              {whyPalco.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 text-sm text-palco-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-palco-gold" />
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Feito para todos os momentos">
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ambienceCards.map((item) => (
                <div key={item} className="rounded-xl border border-palco-gold/20 bg-palco-gold/10 px-3 py-3 text-center text-sm font-semibold text-palco-text">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-palco-text-muted">
              O PALCO foi pensado para TV, JBL, caixa Bluetooth, som automotivo, computador e celular.
            </p>
          </SectionCard>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-palco-gold">
                MVP visual
              </p>
              <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                A experiência que a imagem pede
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-palco-text-muted">
              Salas contínuas, pedido musical, chat, perfil do artista e modo ambiente viram um produto único.
            </p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-5 scrollbar-hide">
            {phoneScreens.map((screen) => (
              <PhoneFrame key={screen.number} screen={screen} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr_0.9fr]">
          <SectionCard title="Modo ambiente">
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/45 p-4">
              <div className="aspect-video rounded-xl border border-palco-gold/25 bg-[radial-gradient(circle_at_50%_20%,rgba(212,168,67,0.28),transparent_35%),#070707] p-5">
                <EqualizerLogo compact />
                <p className="mt-8 font-display text-2xl font-bold text-white">PALCO</p>
                <p className="text-xs uppercase tracking-[0.18em] text-palco-text-muted">Ao vivo na sua TV</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Qualidade que importa">
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['Curadoria de áudio', 'Internet estável', 'Repertório validado', 'Avaliação do público'].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-bold text-white">{item}</p>
                  <p className="mt-1 text-xs leading-5 text-palco-text-subtle">Critério mínimo para manter a experiência profissional.</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Quem recebe o que você envia">
            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-palco-gold/35 bg-[conic-gradient(from_120deg,#D4A843_0_90%,rgba(255,255,255,0.12)_90%_100%)] p-2">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-palco-black">
                  <span className="font-display text-2xl font-black text-white">90%</span>
                  <span className="text-xs text-palco-text-muted">Artista</span>
                </div>
              </div>
              <div className="text-sm text-palco-text-muted">
                <p><span className="font-bold text-palco-gold">10%</span> operação da plataforma</p>
                <p className="mt-2">A proposta central é valorizar quem faz a música acontecer.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-palco-gold/30 bg-[linear-gradient(135deg,rgba(212,168,67,0.12),rgba(255,255,255,0.03)_42%,rgba(239,68,68,0.08))] p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-palco-gold">
                Música ao vivo, interação real
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold text-white">
                O artista toca. O público decide.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-palco-text-muted">
                Este primeiro pacote deixa a página com cara de produto. Os próximos passos conectam QR público, modo TV completo e pagamentos PIX/repasse.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {roomSamples.map((room) => (
                <div key={room.name} className="rounded-xl border border-white/10 bg-black/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-white">{room.name}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black ${room.status === 'AO VIVO' ? 'bg-palco-live text-white' : 'bg-white/10 text-palco-text-muted'}`}>
                      {room.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-palco-text-muted">{room.artist}</p>
                  <p className="mt-3 text-xs text-palco-gold">{room.listeners} ouvintes</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-palco-gold">
              Salas reais do MVP
            </p>
            <h2 className="font-display text-2xl font-bold text-white">Entre em uma sala ao vivo</h2>
          </div>
          <span className="text-sm text-palco-text-subtle">
            {rooms.length} {rooms.length === 1 ? 'sala ativa' : 'salas ativas'}
          </span>
        </div>
        <RoomGrid
          rooms={rooms}
          loading={loading}
          error={error}
          onRoomClick={handleRoomClick}
        />
      </section>
    </div>
  );
}
