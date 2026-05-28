/**
 * Constantes do PALCO
 * 
 * Espelham os ENUMs do banco de dados para manter consistência
 * entre frontend e backend. Se um ENUM mudar no banco,
 * deve ser atualizado aqui também.
 */

// ============================
// Roles de usuário
// ============================
export const USER_ROLES = Object.freeze({
  LISTENER: 'listener',
  VENUE: 'venue',
  ARTIST: 'artist',
});

export const USER_ROLE_LABELS = Object.freeze({
  [USER_ROLES.LISTENER]: 'Ouvinte',
  [USER_ROLES.VENUE]: 'Estabelecimento',
  [USER_ROLES.ARTIST]: 'Artista',
});

// ============================
// Quality Tiers dos artistas
// ============================
export const QUALITY_TIERS = Object.freeze({
  BRONZE: 'bronze',
  PRATA: 'prata',
  OURO: 'ouro',
  PREMIUM: 'premium',
  VERIFIED: 'verified',
});

export const QUALITY_TIER_LABELS = Object.freeze({
  [QUALITY_TIERS.BRONZE]: 'Bronze',
  [QUALITY_TIERS.PRATA]: 'Prata',
  [QUALITY_TIERS.OURO]: 'Ouro',
  [QUALITY_TIERS.PREMIUM]: 'Premium',
  [QUALITY_TIERS.VERIFIED]: 'Verified Artist',
});

// ============================
// Planos de assinatura (venues)
// ============================
export const SUBSCRIPTION_PLANS = Object.freeze({
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
});

// ============================
// Vibe levels das salas
// ============================
export const VIBE_LEVELS = Object.freeze({
  CALMO: 'calmo',
  ANIMADO: 'animado',
  INTERATIVO: 'interativo',
});

export const VIBE_LEVEL_LABELS = Object.freeze({
  [VIBE_LEVELS.CALMO]: '🎵 Calmo',
  [VIBE_LEVELS.ANIMADO]: '🔥 Animado',
  [VIBE_LEVELS.INTERATIVO]: '🎤 Interativo',
});

export const BRAZIL_REGIONS = Object.freeze([
  { value: 'norte', label: 'Norte' },
  { value: 'nordeste', label: 'Nordeste' },
  { value: 'centro-oeste', label: 'Centro-Oeste' },
  { value: 'sudeste', label: 'Sudeste' },
  { value: 'sul', label: 'Sul' },
]);

// ============================
// Status de pedidos musicais
// ============================
export const REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PLAYING: 'playing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const REQUEST_STATUS_LABELS = Object.freeze({
  [REQUEST_STATUS.PENDING]: 'Na fila',
  [REQUEST_STATUS.ACCEPTED]: 'Aceito',
  [REQUEST_STATUS.PLAYING]: 'Tocando agora',
  [REQUEST_STATUS.COMPLETED]: 'Concluído',
  [REQUEST_STATUS.CANCELLED]: 'Cancelado',
});

// ============================
// Status de batalhas
// ============================
export const BATTLE_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  VOTING: 'voting',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
});

export const BATTLE_CATEGORIES = Object.freeze([
  { key: 'voice', label: 'Melhor voz' },
  { key: 'interpretation', label: 'Interpretacao' },
  { key: 'solo', label: 'Melhor solo' },
  { key: 'presence', label: 'Presenca' },
]);

// ============================
// Tipos de transação
// ============================
export const TRANSACTION_TYPES = Object.freeze({
  SONG_REQUEST: 'song_request',
  TIP: 'tip',
  BATTLE_REWARD: 'battle_reward',
  SUBSCRIPTION: 'subscription',
});

// ============================
// Tipos de mensagem no chat
// ============================
export const MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  TIP_ALERT: 'tip_alert',
  REQUEST_ALERT: 'request_alert',
  SYSTEM: 'system',
});

// ============================
// Regras de negócio
// ============================
export const BUSINESS_RULES = Object.freeze({
  MIN_BOUNTY_VALUE: 5.00,
  MAX_BOUNTY_VALUE: 500.00,
  PLATFORM_FEE_PERCENTAGE: 0.10, // 10%
  ARTIST_SHARE_PERCENTAGE: 0.90, // 90%
  MAX_CHAT_MESSAGE_LENGTH: 500,
  MAX_DEDICATION_LENGTH: 200,
  MIN_PASSWORD_LENGTH: 8,
  MAX_NAME_LENGTH: 150,
  MAX_SONG_TITLE_LENGTH: 200,
});

// ============================
// Gêneros musicais
// ============================
export const MUSIC_GENRES = Object.freeze([
  'Sertanejo',
  'Pagode',
  'Samba',
  'Rock',
  'Pop Rock',
  'MPB',
  'Blues',
  'Gospel',
  'Acústico',
  'Trap Acústico',
  'Moda de Viola',
  'Instrumental',
  'Jazz',
  'Forró',
  'Bossa Nova',
]);

// ============================
// Valores predefinidos de pedido
// ============================
export const BOUNTY_PRESETS = Object.freeze([
  { value: 5, label: 'R$ 5' },
  { value: 10, label: 'R$ 10' },
  { value: 20, label: 'R$ 20' },
  { value: 50, label: 'R$ 50' },
]);
