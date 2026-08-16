import { describe, expect, it } from 'vitest';
import { getLoginUrl, getSafeReturnPath } from './navigation';

describe('safe navigation', () => {
  it('preserves internal room URLs and their query string', () => {
    expect(getSafeReturnPath('/room/abc?artist=artist-1')).toBe('/room/abc?artist=artist-1');
  });

  it.each([
    'https://example.com',
    '//example.com/path',
    '/\\example.com/path',
    'rooms',
  ])('rejects unsafe return path %s', (value) => {
    expect(getSafeReturnPath(value, '/rooms')).toBe('/rooms');
  });

  it('encodes the intended destination in the login URL', () => {
    expect(getLoginUrl('/room/a?artist=b')).toBe('/login?returnTo=%2Froom%2Fa%3Fartist%3Db');
  });
});
