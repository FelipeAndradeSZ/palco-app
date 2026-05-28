/**
 * Alert — Componente de feedback
 *
 * @param {'error' | 'success' | 'info' | 'warning'} type
 * @param {string}   message - Texto exibido
 * @param {Function} onClose - Callback opcional para fechar
 */

const config = {
  error: {
    border: 'border-l-palco-live',
    bg: 'bg-palco-live/10',
    text: 'text-palco-live',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  success: {
    border: 'border-l-palco-success',
    bg: 'bg-palco-success/10',
    text: 'text-palco-success',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  info: {
    border: 'border-l-palco-gold',
    bg: 'bg-palco-gold/10',
    text: 'text-palco-gold',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  warning: {
    border: 'border-l-palco-warning',
    bg: 'bg-palco-warning/10',
    text: 'text-palco-warning',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

export default function Alert({ type = 'info', message, onClose }) {
  const { border, bg, text, icon } = config[type] || config.info;

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-3 rounded-lg border-l-4 px-4 py-3
        animate-[fadeIn_0.3s_ease-out]
        ${border} ${bg}
      `}
    >
      <span className={text}>{icon}</span>

      <p className={`text-sm flex-1 ${text}`}>{message}</p>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar alerta"
          className="shrink-0 text-palco-text-subtle hover:text-palco-text transition-colors cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
