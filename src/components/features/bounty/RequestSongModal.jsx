/**
 * RequestSongModal — Fluxo de pagamento e pedido musical
 */

import { useState } from 'react';
import { validateSongTitle, validateBountyValue, validateDedication } from '../../../lib/validators';
import { BOUNTY_PRESETS } from '../../../lib/constants';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Alert from '../../ui/Alert';

export default function RequestSongModal({ isOpen, onClose, onSubmit, currentBalance, targetArtistName }) {
  const [songTitle, setSongTitle] = useState('');
  const [bountyValue, setBountyValue] = useState(10);
  const [dedication, setDedication] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validações
    const titleVal = validateSongTitle(songTitle);
    if (!titleVal.valid) return setError(titleVal.error);

    const bountyVal = validateBountyValue(bountyValue);
    if (!bountyVal.valid) return setError(bountyVal.error);

    const dedicationVal = validateDedication(dedication);
    if (!dedicationVal.valid) return setError(dedicationVal.error);

    if (currentBalance < bountyValue) {
      return setError(`Saldo insuficiente. Você tem R$ ${currentBalance.toFixed(2)}.`);
    }

    setLoading(true);
    try {
      await onSubmit({
        songTitle: titleVal.sanitized,
        bountyValue: Number(bountyValue),
        dedication: dedicationVal.sanitized,
      });
      // Fecha e limpa após sucesso
      setSongTitle('');
      setBountyValue(10);
      setDedication('');
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao processar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop (Glassmorphism) */}
      <div 
        className="absolute inset-0 bg-palco-black/80 backdrop-blur-sm cursor-pointer"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-palco-card border border-palco-border rounded-2xl shadow-2xl overflow-hidden animate-bounce-in">
        <div className="p-6">
          <h2 className="font-display font-bold text-2xl text-palco-text mb-1">
            Pedir Música
          </h2>
          <p className="text-palco-text-muted text-sm mb-6">
            Apoie {targetArtistName || 'o artista'} e fure a fila com o seu pedido!
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert type="error" message={error} />}

            <Input
              id="song-title"
              label="Qual música você quer ouvir?"
              placeholder="Ex: Evidências - Chitãozinho & Xororó"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              disabled={loading}
              maxLength={200}
            />

            {/* Seleção de Valor (Bounty) */}
            <div>
              <label className="block text-sm font-medium text-palco-text-muted mb-2">
                Valor da Contribuição (R$)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {BOUNTY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setBountyValue(preset.value)}
                    className={`py-2 px-1 rounded-xl border text-sm font-bold transition-all duration-200 ${
                      bountyValue === preset.value
                        ? 'border-palco-gold bg-palco-gold/10 text-palco-gold'
                        : 'border-palco-border bg-palco-dark text-palco-text-subtle hover:border-palco-text hover:text-palco-text'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Input
                id="custom-bounty"
                type="number"
                min="5"
                step="0.01"
                placeholder="Outro valor..."
                value={bountyValue}
                onChange={(e) => setBountyValue(e.target.value)}
                disabled={loading}
              />
              <p className="text-right text-xs text-palco-text-subtle mt-1">
                Saldo disponível: <span className={currentBalance >= bountyValue ? 'text-palco-success' : 'text-palco-live'}>R$ {currentBalance.toFixed(2)}</span>
              </p>
            </div>

            <Input
              id="dedication"
              label="Dedicatória ou Mensagem (Opcional)"
              placeholder="Ex: Para a mesa 4 que tá comemorando!"
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
              disabled={loading}
              maxLength={200}
            />

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="flex-1"
              >
                Pagar R$ {Number(bountyValue).toFixed(2)}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
