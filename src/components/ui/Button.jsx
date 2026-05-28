/**
 * Button — Botão premium PALCO
 *
 * @param {'primary' | 'secondary' | 'danger' | 'ghost'} variant
 * @param {'sm' | 'md' | 'lg'} size
 * @param {boolean}  loading   - Mostra spinner e desabilita
 * @param {boolean}  disabled
 * @param {string}   className - Classes extras
 * @param {string}   type      - Tipo do botão (button, submit, reset)
 * @param {React.ReactNode} children
 */

import Spinner from './Spinner';

const variantClasses = {
  primary:
    'bg-palco-gold text-palco-black font-semibold hover:bg-palco-gold-light hover:shadow-[0_0_20px_rgba(212,168,67,0.35)] active:bg-palco-gold-dark',
  secondary:
    'bg-transparent border border-palco-gold text-palco-gold hover:bg-palco-gold/10 active:bg-palco-gold/20',
  danger:
    'bg-palco-live text-white font-semibold hover:bg-red-600 active:bg-red-700',
  ghost:
    'bg-transparent text-palco-text-muted hover:text-palco-text hover:bg-white/5 active:bg-white/10',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3 text-base rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-palco-gold/50 focus:ring-offset-2 focus:ring-offset-palco-black
        ${variantClasses[variant] || variantClasses.primary}
        ${sizeClasses[size] || sizeClasses.md}
        ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        ${className}
      `}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
