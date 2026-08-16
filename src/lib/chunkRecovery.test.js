import { describe, expect, it } from 'vitest';
import { canReloadForChunkError, isChunkLoadError } from './chunkRecovery';

describe('chunk recovery', () => {
  it('recognizes deployment chunk failures without hiding unrelated errors', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/page-old.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Could not save the profile'))).toBe(false);
  });

  it('prevents an automatic reload loop', () => {
    expect(canReloadForChunkError('99000', 100_000)).toBe(false);
    expect(canReloadForChunkError('80000', 100_000)).toBe(true);
    expect(canReloadForChunkError('invalid', 100_000)).toBe(true);
  });
});
