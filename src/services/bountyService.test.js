import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  },
}));

vi.mock('./chatService', () => ({
  sendMessage: mocks.sendMessage,
}));

import { sendTip } from './bountyService';

describe('idempotent artist tips', () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.sendMessage.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'listener-1' } } });
  });

  it('sends the operation id to the protected RPC and publishes one alert', async () => {
    mocks.rpc.mockResolvedValue({
      data: { created: true, interaction: { id: 'tip-1' } },
      error: null,
    });
    mocks.sendMessage.mockResolvedValue({ data: { id: 'message-1' }, error: null });

    const result = await sendTip('room-1', 10, 'Obrigado', 'artist-1', 'operation-1');

    expect(mocks.rpc).toHaveBeenCalledWith('send_artist_tip_idempotent', {
      p_room_id: 'room-1',
      p_artist_id: 'artist-1',
      p_amount: 10,
      p_message: 'Obrigado',
      p_client_request_id: 'operation-1',
    });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });

  it('does not duplicate the chat alert when a completed operation is recovered', async () => {
    mocks.rpc.mockResolvedValue({
      data: { created: false, interaction: { id: 'tip-1' } },
      error: null,
    });

    const result = await sendTip('room-1', 10, '', 'artist-1', 'operation-1');

    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: {
        created: false,
        interaction: { id: 'tip-1' },
        recovered: true,
      },
      error: null,
    });
  });
});
