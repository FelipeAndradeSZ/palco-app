/**
 * Input — Campo de formulário estilizado
 *
 * @param {string}         label     - Rótulo acima do campo
 * @param {string}         error     - Mensagem de erro (ativa estado vermelho)
 * @param {React.ReactNode} icon     - Ícone opcional à esquerda dentro do campo
 * @param {string}         id        - ID do input (e htmlFor do label)
 * @param {string}         className - Classes extras para o wrapper
 * @param {object}         rest      - Props restantes passadas ao <input>
 */

export default function Input({
  label,
  error,
  icon,
  id,
  className = '',
  ...rest
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-palco-text-muted"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-palco-text-subtle">
            {icon}
          </span>
        )}

        <input
          id={id}
          className={`
            w-full rounded-xl bg-palco-dark px-4 py-2.5 text-sm text-palco-text
            placeholder:text-palco-text-subtle
            border outline-none
            transition-colors duration-200
            focus:ring-2 focus:ring-palco-gold/50
            ${icon ? 'pl-10' : ''}
            ${
              error
                ? 'border-palco-live focus:border-palco-live'
                : 'border-palco-border focus:border-palco-gold'
            }
          `}
          {...rest}
        />
      </div>

      {error && (
        <p className="text-xs text-palco-live mt-0.5">{error}</p>
      )}
    </div>
  );
}
