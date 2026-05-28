/**
 * Card — Container com visual premium
 *
 * @param {React.ReactNode} children
 * @param {string}  className - Classes extras
 * @param {boolean} hover     - Ativa efeito de hover (brilho na borda + escala sutil)
 * @param {Function} onClick  - Callback de clique (se fornecido, renderiza como interativo)
 */

export default function Card({
  children,
  className = '',
  hover = false,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={`
        bg-palco-card border border-palco-border rounded-xl
        backdrop-blur-sm
        transition-all duration-200 ease-out
        ${hover ? 'hover:border-palco-text-subtle hover:scale-[1.01]' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
