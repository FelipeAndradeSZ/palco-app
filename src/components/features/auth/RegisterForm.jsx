/**
 * RegisterForm — Formulário de cadastro
 * 
 * Campos adaptativos: se role = artist, mostra seleção de gênero.
 * Validação completa antes de enviar.
 */

import { useState } from 'react';
import { validateEmail, validatePassword, validateName } from '../../../lib/validators';
import { signInWithOAuth } from '../../../services/authService';
import { USER_ROLES, USER_ROLE_LABELS, MUSIC_GENRES } from '../../../lib/constants';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Alert from '../../ui/Alert';

export default function RegisterForm({ onSubmit, loading, error }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: USER_ROLES.LISTENER,
    mainGenre: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate() {
    const errors = {};
    const nameResult = validateName(form.name);
    if (!nameResult.valid) errors.name = nameResult.error;
    const emailResult = validateEmail(form.email);
    if (!emailResult.valid) errors.email = emailResult.error;
    const passwordResult = validatePassword(form.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'As senhas não coincidem.';
    if (form.role === USER_ROLES.ARTIST && !form.mainGenre) errors.mainGenre = 'Selecione seu gênero musical principal.';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      role: form.role,
      mainGenre: form.role === USER_ROLES.ARTIST ? form.mainGenre : undefined,
    });
  }

  const handleOAuth = async (provider) => {
    // Salva a role selecionada (se houver) para resgatar na volta do OAuth
    if (form.role) {
      localStorage.setItem('@palco/pending_role', form.role);
    }
    const { error } = await signInWithOAuth(provider);
    if (error) console.error('OAuth Error:', error);
  };

  return (
    <div className="space-y-6">
      {/* Social Register */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleOAuth('google')}
          disabled={loading}
          className="flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          Google
        </Button>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleOAuth('apple')}
          disabled={loading}
          className="flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z"/></svg>
          Apple
        </Button>
      </div>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-palco-border"></div>
        <span className="flex-shrink-0 mx-4 text-palco-text-subtle text-xs uppercase">Ou cadastre com email</span>
        <div className="flex-grow border-t border-palco-border"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <Alert type="error" message={error} />
        )}

      <Input
        id="register-name"
        label="Nome"
        type="text"
        placeholder="Seu nome ou nome artístico"
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        error={validationErrors.name}
        autoComplete="name"
      />

      <Input
        id="register-email"
        label="Email"
        type="email"
        placeholder="seu@email.com"
        value={form.email}
        onChange={(e) => updateField('email', e.target.value)}
        error={validationErrors.email}
        autoComplete="email"
      />

      <Input
        id="register-password"
        label="Senha"
        type="password"
        placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número"
        value={form.password}
        onChange={(e) => updateField('password', e.target.value)}
        error={validationErrors.password}
        autoComplete="new-password"
      />

      <Input
        id="register-confirm-password"
        label="Confirmar Senha"
        type="password"
        placeholder="Repita a senha"
        value={form.confirmPassword}
        onChange={(e) => updateField('confirmPassword', e.target.value)}
        error={validationErrors.confirmPassword}
        autoComplete="new-password"
      />

      {/* Seleção de Role */}
      <div>
        <label className="block text-sm font-medium text-palco-text-muted mb-2">
          Eu sou
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => updateField('role', value)}
              className={`py-2 px-1 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer ${
                form.role === value
                  ? 'border-palco-gold bg-palco-gold/10 text-palco-gold'
                  : 'border-palco-border bg-palco-dark text-palco-text-muted hover:border-palco-text-subtle'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Gênero musical (apenas para artistas) */}
      {form.role === USER_ROLES.ARTIST && (
        <div>
          <label
            htmlFor="register-genre"
            className="block text-sm font-medium text-palco-text-muted mb-2"
          >
            Gênero Musical Principal
          </label>
          <select
            id="register-genre"
            value={form.mainGenre}
            onChange={(e) => updateField('mainGenre', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl bg-palco-dark border text-palco-text text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-palco-gold/50 ${
              validationErrors.mainGenre
                ? 'border-red-500'
                : 'border-palco-border focus:border-palco-gold'
            }`}
          >
            <option value="">Selecione um gênero</option>
            {MUSIC_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
          {validationErrors.mainGenre && (
            <p className="mt-1.5 text-sm text-red-400">
              {validationErrors.mainGenre}
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full"
      >
        Criar Conta
      </Button>
    </form>
    </div>
  );
}
