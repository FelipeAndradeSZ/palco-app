/**
 * Spinner — Indicador de carregamento
 *
 * @param {'sm' | 'md' | 'lg'} size  - Tamanho do spinner
 * @param {string}              className - Classes extras
 */

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-3',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`
        inline-block animate-spin rounded-full
        border-palco-gold border-t-transparent
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
    />
  );
}
