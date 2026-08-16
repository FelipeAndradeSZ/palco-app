import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

import { confirmCheckoutSession } from './walletService';

describe('checkout confirmation', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it('shares one request between concurrent confirmations of the same session', async () => {
    let finishRequest;
    mocks.invoke.mockReturnValue(new Promise((resolve) => {
      finishRequest = resolve;
    }));

    const first = confirmCheckoutSession('cs_concurrent');
    const second = confirmCheckoutSession('cs_concurrent');

    expect(first).toBe(second);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    finishRequest({ data: { ok: true, balance: 25 }, error: null });
    await expect(first).resolves.toEqual({ ok: true, balance: 25 });
  });

  it('allows a retry after a failed confirmation', async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'temporarily unavailable' } })
      .mockResolvedValueOnce({ data: { ok: true, balance: 40 }, error: null });

    await expect(confirmCheckoutSession('cs_retry')).rejects.toThrow('temporarily unavailable');
    await expect(confirmCheckoutSession('cs_retry')).resolves.toEqual({ ok: true, balance: 40 });
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });

  it('rejects missing checkout session ids before calling the edge function', async () => {
    await expect(confirmCheckoutSession('')).rejects.toThrow('Sessao de pagamento ausente');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
