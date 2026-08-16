import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRooms } from '../hooks/useRooms';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import Alert from '../components/ui/Alert';
import { getActiveArtists, getArtistInteractionUrl } from '../lib/roomArtists';
import { getLoginUrl } from '../lib/navigation';

const brandFlow = [
  { step: '01', title: 'Escolha uma sala', text: 'Ambientes contínuos como Sertanejo Churrasco, Pagode de Mesa e MPB.' },
  { step: '02', title: 'Aponte o QR Code', text: 'A TV vira o portal rápido para pedir música, votar e mandar gorjetas.' },
  { step: '03', title: 'Peça sua música', text: 'O público define o título, o valor da gorjeta e uma dedicatória.' },
  { step: '04', title: 'O artista aceita', text: 'Músicos reais visualizam o pedido e tocam ao vivo no ambiente.' },
  { step: '05', title: 'A sala reage', text: 'Alertas flutuantes, chat e curtidas em tempo real criam um show coletivo.' },
];

const whyPalco = [
  'Música de verdade, 100% ao vivo',
  'Interação direta e repasse ágil para o artista',
  'Salas contínuas perfeitas para estabelecimentos',
  'Valorização real da profissão de músico',
  'Leve o show para a TV, bar, churrasco ou festa',
];

const ambienceCards = [
  '🌴 Bar de Praia',
  '🍖 Churrasco',
  '🍻 Pub / Chopperia',
  '🍔 Hamburgueria',
  '🍷 Restaurante',
  '🎉 Festas e Viagens',
];

function EqualizerLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 items-center gap-1" aria-hidden="true">
        {[22, 34, 42, 28, 16].map((height, index) => (
          <span
            key={index}
            className="w-1.5 rounded-full bg-palco-gold shadow-[0_0_15px_rgba(212,168,67,0.5)] animate-pulse"
            style={{ 
              height, 
              animationDelay: `${index * 0.15}s`,
              animationDuration: '0.8s'
            }}
          />
        ))}
      </div>
      {!compact && (
        <div>
          <h1 className="font-display text-4xl font-black tracking-wide leading-none text-white sm:text-5xl">
            PALCO
          </h1>
          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-palco-gold">
            Música ao vivo para o seu momento
          </p>
        </div>
      )}
    </div>
  );
}

function HeroMonitor({ room, artists, loading, onOpen }) {
  const artist = artists[0] || null;
  const isLive = Boolean(artist);

  return (
    <div className="relative w-full max-w-[450px] mx-auto group">
      <div className="rounded-[2rem] border border-palco-border/80 bg-[#080809]/95 p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.85)] transition-all duration-500 hover:border-palco-gold/45 hover:shadow-[0_25px_60px_rgba(212,168,67,0.08)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(40,24,15,0.7),rgba(10,10,12,0.99)_50%,rgba(20,20,25,0.8))]">
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-3 bg-black/40">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-palco-text-muted">
                {room?.name || 'PALCO AO VIVO'}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-palco-live animate-pulse' : 'bg-palco-text-subtle'}`} />
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  isLive ? 'bg-palco-live text-white' : 'bg-white/10 text-palco-text-muted'
                }`}>
                  {loading ? 'CONECTANDO' : isLive ? 'AO VIVO' : 'AGUARDANDO ARTISTA'}
                </span>
              </div>
            </div>
            <div className="text-right text-[10px] font-bold text-palco-text-muted">
              <p>Na sala</p>
              <p className="text-palco-gold font-black">
                {artists.length} {artists.length === 1 ? 'artista' : 'artistas'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-3.5 p-3.5">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_15%,rgba(212,168,67,0.22),transparent_40%),linear-gradient(180deg,rgba(20,20,25,0.4),rgba(5,5,7,0.95))] min-h-[220px] flex flex-col justify-end">
              <div className="absolute inset-x-4 top-8 h-20 rounded-full bg-palco-gold/10 blur-2xl" />
              <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black via-black/85 to-transparent" />
              <div className="relative flex flex-col items-center justify-end px-4 py-5 text-center z-10">
                <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-palco-gold bg-palco-gold/15 font-display text-xl font-black text-palco-gold shadow-[0_0_25px_rgba(212,168,67,0.4)]">
                  {artist?.avatar_url ? (
                    <img src={artist.avatar_url} alt={artist.name} className="h-full w-full object-cover" />
                  ) : (
                    artist?.name?.charAt(0)?.toUpperCase() || 'P'
                  )}
                </div>
                <p className="font-display text-lg font-black tracking-wide text-white">
                  {artist?.name || (loading ? 'Buscando transmissões' : 'O próximo show começa aqui')}
                </p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-palco-gold-light">
                  {artist?.current_song || artist?.main_genre || (room ? 'Sala disponível' : 'Música ao vivo de verdade')}
                </p>
                {room && (
                  <button
                    type="button"
                    onClick={onOpen}
                    className="mt-4 rounded-xl bg-palco-gold px-4 py-2 text-xs font-black text-palco-black transition hover:bg-palco-gold-light"
                  >
                    {isLive ? 'Entrar nesta live' : 'Ver esta sala'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {(artists.length > 0 ? artists.slice(0, 3) : [null, null, null]).map((liveArtist, index) => (
                <div key={liveArtist?.id || `empty-${index}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition duration-300 hover:border-palco-gold/20 hover:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-white">
                        {liveArtist?.name || (loading ? 'Carregando...' : 'Espaço livre no palco')}
                      </p>
                      <p className="truncate text-[9px] font-semibold text-palco-text-muted">
                        {liveArtist?.current_song || liveArtist?.main_genre || 'Artistas podem entrar nesta sala'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${
                      liveArtist
                        ? 'border-palco-success/20 bg-palco-success/15 text-palco-success'
                        : 'border-white/10 bg-white/[0.03] text-palco-text-subtle'
                    }`}>
                      {liveArtist ? 'AO VIVO' : 'LIVRE'}
                    </span>
                  </div>
                </div>
              ))}

              <div className="mt-auto rounded-xl border border-palco-gold/20 bg-palco-gold/5 p-2.5">
                <div className="flex items-end justify-between gap-[3px] h-6 px-1">
                  {[12, 22, 14, 24, 18, 20, 16, 22, 10, 18, 12, 14].map((height, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-palco-gold/85"
                      style={{ 
                        height: `${height}px`,
                        animation: 'pulse 1s ease-in-out infinite',
                        animationDelay: `${i * 0.08}s`
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[9px] font-black uppercase text-palco-text-muted">
                  <span>{room?.genre || 'Brasil'}</span>
                  <span className="text-palco-gold">
                    {room?.listener_count || 0} {(room?.listener_count || 0) === 1 ? 'ouvinte' : 'ouvintes'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-36 rounded-b-2xl bg-[#0b0b0d] border-x border-b border-white/5 shadow-md" />
      <div className="mx-auto h-1.5 w-60 rounded-full bg-black/80 blur-[1px]" />
    </div>
  );
}

function QrPanel({ room, artist }) {
  const destination = room && artist
    ? getArtistInteractionUrl(room.id, artist.id)
    : '/rooms';
  const qrValue = typeof window !== 'undefined'
    ? `${window.location.origin}${destination}`
    : `https://palco-app-drab.vercel.app${destination}`;

  return (
    <aside className="rounded-[1.5rem] border border-palco-gold/45 bg-black/60 p-6 shadow-[0_0_40px_rgba(212,168,67,0.1)] flex flex-col justify-between w-full max-w-[320px] mx-auto">
      <div>
        <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-palco-gold">
          {artist ? 'INTERAJA NESTA LIVE' : 'ENCONTRE UMA LIVE'}
        </p>
        
        <div className="mx-auto my-5 w-fit rounded-2xl bg-white p-3 shadow-2xl border border-palco-gold/30">
          <QRCodeSVG value={qrValue} size={110} level="H" includeMargin={false} />
        </div>
        
        <p className="text-center text-xs font-semibold text-palco-text-muted leading-relaxed px-2">
          {artist
            ? `Pedidos, votos e gorjetas vão direto para ${artist.name}.`
            : 'Escaneie para escolher uma sala e encontrar artistas ao vivo.'}
        </p>
      </div>

      <div className="mt-6 border-t border-palco-border/50 pt-4 space-y-2.5 text-xs font-bold text-palco-text-muted">
        {[
          { icon: '🎵', text: 'Peça músicas' },
          { icon: '❤️', text: 'Dedique para alguém' },
          { icon: '💰', text: 'Envie uma gorjeta' },
          { icon: '💬', text: 'Participe do chat' }
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-2.5 px-1 hover:text-white transition duration-300">
            <span className="text-sm shrink-0">{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { rooms, loading: roomsLoading, error: roomsError } = useRooms();
  const navigate = useNavigate();

  const featuredRooms = rooms.slice(0, 3);
  const heroRoom = rooms.find((room) => getActiveArtists(room).length > 0) || rooms[0] || null;
  const heroArtists = getActiveArtists(heroRoom);
  const heroArtist = heroArtists[0] || null;

  function openRoom(room, artist = null) {
    const path = artist
      ? `/room/${encodeURIComponent(room.id)}?artist=${encodeURIComponent(artist.id)}`
      : `/room/${encodeURIComponent(room.id)}`;
    navigate(isAuthenticated ? path : getLoginUrl(path));
  }

  return (
    <div className="overflow-hidden bg-palco-black text-palco-text">
      
      {/* HERO SECTION: Split layout resembling mockup image */}
      <section className="relative min-h-[calc(100vh-4rem)] px-4 py-16 sm:px-6 lg:px-8 flex items-center justify-center">
        
        {/* Glowing auroras backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(212,168,67,0.13),transparent_38%),radial-gradient(circle_at_80%_35%,rgba(239,68,68,0.08),transparent_42%),linear-gradient(180deg,#070708_0%,#0c0c0e_60%,#050505_100%)] pointer-events-none" />
        
        {/* Soft gold horizontal strip at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(212,168,67,0.05)_50%,rgba(0,0,0,0.98))] pointer-events-none" />

        <div className="relative mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.8fr_1.3fr_0.8fr]">
            
            {/* COLUMN 1: Brand & CTA */}
            <div className="space-y-8 flex flex-col justify-center">
              <EqualizerLogo />
              <div className="border-l-4 border-palco-gold pl-5 space-y-3">
                <p className="font-display text-2xl font-black uppercase tracking-wide text-palco-gold">
                  A jukebox humana ao vivo.
                </p>
                <p className="text-sm leading-relaxed text-palco-text-muted">
                  Peça suas músicas preferidas, mande dedicatórias especiais e envie gorjetas em tempo real. Valorize artistas reais e transforme qualquer ambiente em um show privado.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/rooms')}
                  className="rounded-2xl bg-palco-gold px-6 py-4 text-sm font-black text-palco-black shadow-[0_4px_25px_rgba(212,168,67,0.3)] transition hover:bg-palco-gold-light active:scale-95 cursor-pointer"
                >
                  Ver salas ao vivo
                </button>
                <button
                  type="button"
                  onClick={() => navigate(isAuthenticated ? '/artist' : '/register')}
                  className="rounded-2xl border-2 border-palco-gold/45 px-6 py-4 text-sm font-bold text-palco-gold backdrop-blur-sm transition hover:bg-palco-gold/10 active:scale-95 cursor-pointer"
                >
                  Sou artista
                </button>
              </div>
            </div>

            {/* COLUMN 2: Television Monitor Widget */}
            <HeroMonitor
              room={heroRoom}
              artists={heroArtists}
              loading={roomsLoading}
              onOpen={() => heroRoom && openRoom(heroRoom, heroArtist)}
            />

            {/* COLUMN 3: QR Code Info Widget */}
            <QrPanel room={heroRoom} artist={heroArtist} />

          </div>
        </div>
      </section>

      {/* ACTIVE ROOMS SECTION: Real-time DB Integration */}
      <section className="relative px-4 py-16 sm:px-6 lg:px-8 border-t border-palco-border/40 bg-black/40">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-palco-gold">
                SALAS DISPONÍVEIS
              </p>
              <h2 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
                Escolha e participe ao vivo
              </h2>
            </div>
            <button
              onClick={() => navigate('/rooms')}
              className="text-xs font-black uppercase tracking-widest text-palco-gold hover:text-palco-gold-light transition duration-300"
            >
              Ver todas as salas →
            </button>
          </div>

          {roomsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : roomsError ? (
            <Alert type="error" message={roomsError} />
          ) : featuredRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-palco-border p-12 text-center text-palco-text-muted">
              Nenhuma sala ativa no momento. Crie ou configure um show no painel!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredRooms.map((room) => {
                const activeArtistList = getActiveArtists(room);
                const isLive = activeArtistList.length > 0;

                return (
                  <Card key={room.id} hover className="flex flex-col justify-between p-6 cursor-pointer" onClick={() => openRoom(room, activeArtistList[0])}>
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <Badge variant="gold" className="text-[10px]">{room.genre || 'Estilo'}</Badge>
                        <Badge variant={isLive ? 'live' : 'default'} pulse={isLive}>
                          {isLive ? 'AO VIVO' : 'ABERTA'}
                        </Badge>
                      </div>

                      <h3 className="font-display font-black text-xl text-white group-hover:text-palco-gold transition duration-300">
                        {room.name}
                      </h3>
                      
                      <p className="mt-2 text-xs text-palco-text-muted leading-relaxed">
                        {room.genre === 'Sertanejo' 
                          ? 'Perfeito para churrascos, cervejadas e momentos descontraídos.' 
                          : room.genre === 'Pagode'
                          ? 'Mesa redonda, cerveja gelada e os maiores clássicos do samba.'
                          : 'Música ao vivo de alta fidelidade transmitida por artistas reais.'
                        }
                      </p>

                      {isLive && (
                        <div className="mt-5 border-t border-palco-border/50 pt-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-palco-gold mb-1.5">No Palco</p>
                          <p className="text-xs font-semibold text-white truncate">
                            🎙️ {activeArtistList.map((artist) => artist.name).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-palco-border/50 pt-4">
                      <span className="text-[10px] font-black uppercase text-palco-text-subtle">
                        👥 {room.listener_count || 0} ouvintes
                      </span>
                      <span className="text-xs font-black text-palco-gold hover:underline">
                        Entrar na sala
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* BRAND FLOW SECTION: 5 Steps */}
      <section className="relative border-y border-white/10 bg-[#080809] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-palco-gold">COMO FUNCIONA</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">Do QR Code ao Show ao Vivo</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            {brandFlow.map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/5 bg-palco-card/50 p-5 hover:border-palco-gold/30 hover:-translate-y-1 transition duration-300 flex flex-col justify-between min-h-[180px]">
                <p className="font-display font-black text-4xl text-palco-gold/20">{item.step}</p>
                <div>
                  <h3 className="mt-3 font-display font-bold text-sm text-white tracking-wide">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-palco-text-muted">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES / VALUE PROP SECTION */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 gap-8 lg:grid-cols-2">
          
          {/* Why PALCO */}
          <div className="rounded-2xl border border-white/5 bg-palco-card/30 p-6 flex flex-col justify-between">
            <h3 className="font-display font-black text-xl text-white mb-6 tracking-wide">
              Por que escolher o PALCO?
            </h3>
            <div className="space-y-3">
              {whyPalco.map((item) => (
                <div key={item} className="flex items-center gap-3.5 rounded-xl bg-black/25 border border-white/5 px-4 py-3 text-xs font-bold text-palco-text-muted hover:border-palco-gold/25 hover:text-white transition duration-300">
                  <span className="h-2 w-2 rounded-full bg-palco-gold shadow-[0_0_8px_rgba(212,168,67,0.4)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Ambiances Grid */}
          <div className="rounded-2xl border border-white/5 bg-palco-card/30 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-display font-black text-xl text-white mb-2 tracking-wide">
                Feito para todos os momentos
              </h3>
              <p className="text-xs text-palco-text-muted mb-6">
                Leve a Jukebox humana em alta definição para qualquer lugar e integre a comunidade.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ambienceCards.map((item) => (
                <div key={item} className="rounded-xl border border-palco-gold/20 bg-palco-gold/5 px-3 py-4 text-center text-xs font-black text-white hover:bg-palco-gold/10 transition duration-300">
                  {item}
                </div>
              ))}
            </div>
            
            <p className="mt-5 text-xs text-palco-text-subtle text-center">
              O PALCO foi projetado para TVs, Smartphones, tablets e caixas de som de todos os tamanhos.
            </p>
          </div>

        </div>
      </section>

      {/* REVENUE SHARE SPLIT CARD */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-palco-gold/30 bg-[linear-gradient(135deg,rgba(212,168,67,0.08),rgba(255,255,255,0.02)_40%,rgba(239,68,68,0.05))] p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute top-0 right-0 w-80 h-80 bg-palco-gold/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="space-y-4 max-w-xl">
              <span className="inline-flex rounded-full bg-palco-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-palco-gold">
                VALORIZAÇÃO SOCIAL DO MÚSICO
              </span>
              <h2 className="font-display text-3xl font-black text-white">
                Quem recebe o valor que você envia?
              </h2>
              <p className="text-sm leading-relaxed text-palco-text-muted">
                Acreditamos na economia circular e no fomento da cultura musical. Por isso, a divisão financeira do PALCO garante a maior fatia possível para quem faz o show acontecer.
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0 bg-black/45 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-palco-gold/50 bg-[conic-gradient(from_0deg,#D4A843_0_324deg,rgba(255,255,255,0.12)_324deg_360deg)] p-1.5 shadow-[0_0_20px_rgba(212,168,67,0.15)]">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-palco-black">
                  <span className="font-display text-2xl font-black text-white">90%</span>
                  <span className="text-[9px] font-black uppercase text-palco-gold">Artista</span>
                </div>
              </div>
              <div className="text-xs font-bold text-palco-text-muted space-y-1">
                <p>💸 <span className="font-black text-palco-gold">90% repassados</span> diretamente ao músico</p>
                <p>⚙️ <span className="font-semibold text-white">10% retidos</span> para custos de transação e operação</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
