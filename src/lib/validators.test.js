import { describe, expect, it } from 'vitest';
import {
  sanitizeText,
  validateBountyValue,
  validateChatMessage,
  validatePassword,
  validateSongTitle,
} from './validators';

describe('PALCO input validation', () => {
  it('removes markup from user supplied text', () => {
    expect(sanitizeText('  <strong>Evidencias</strong><script>alert(1)</script>  '))
      .toBe('Evidenciasalert(1)');
  });

  it('enforces the financial limits used by the database', () => {
    expect(validateBountyValue(4.99).valid).toBe(false);
    expect(validateBountyValue(5).valid).toBe(true);
    expect(validateBountyValue(500).valid).toBe(true);
    expect(validateBountyValue(500.01).valid).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(validatePassword('musica12').valid).toBe(false);
    expect(validatePassword('Musica12').valid).toBe(true);
  });

  it('normalizes chat and song fields', () => {
    expect(validateChatMessage('  Boa noite!  ')).toMatchObject({
      valid: true,
      sanitized: 'Boa noite!',
    });
    expect(validateSongTitle('  Evidencias  ')).toMatchObject({
      valid: true,
      sanitized: 'Evidencias',
    });
  });
});
