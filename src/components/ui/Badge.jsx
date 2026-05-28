/**
 * Badge — Selo de status
 *
 * @param {'live' | 'gold' | 'tier' | 'success' | 'default'} variant
 * @param {React.ReactNode} children
 * @param {boolean} pulse     - Animação de pulso (usado com 'live')
 * @param {string}  className - Classes extras
 */

const variantClasses = {
  live: 'bg-palco-live/20 text-palco-live border-palco-live/30',
  gold: 'bg-palco-gold/15 text-palco-gold border-palco-gold/30',
  tier: 'bg-palco-dark text-palco-gold border-palco-border',
  success: 'bg-palco-success/15 text-palco-success border-palco-success/30',
  default: 'bg-white/5 text-palco-text-muted border-white/10',
};

export default function Badge({
  variant = 'default',
  children,
  pulse = false,
  className = '',
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-0.5 rounded-full border
        text-[11px] font-semibold uppercase tracking-wider
        ${variantClasses[variant] || variantClasses.default}
        ${className}
      `}
    >
      {/* Pulsing dot for live badge */}
      {variant === 'live' && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-palco-live opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-palco-live" />
        </span>
      )}
      {children}
    </span>
  );
}
