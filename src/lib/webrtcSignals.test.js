import { describe, expect, it } from 'vitest';
import {
  MAX_PENDING_ICE_CANDIDATES,
  appendBoundedCandidate,
  isValidIceCandidate,
  isValidSessionDescription,
  isValidSignalId,
} from './webrtcSignals';

describe('WebRTC signal validation', () => {
  it('accepts expected descriptions and rejects malformed or oversized SDP', () => {
    expect(isValidSessionDescription({ type: 'offer', sdp: 'v=0\r\n' }, 'offer')).toBe(true);
    expect(isValidSessionDescription({ type: 'answer', sdp: 'v=0\r\n' }, 'offer')).toBe(false);
    expect(isValidSessionDescription({ type: 'offer', sdp: 'x'.repeat(256_001) }, 'offer')).toBe(false);
  });

  it('validates identifiers and ICE candidate payloads', () => {
    expect(isValidSignalId('listener-123')).toBe(true);
    expect(isValidSignalId('')).toBe(false);
    expect(isValidSignalId('x'.repeat(129))).toBe(false);
    expect(isValidIceCandidate({ candidate: 'candidate:1 1 udp 1 127.0.0.1 9 typ host' })).toBe(true);
    expect(isValidIceCandidate({ candidate: 42 })).toBe(false);
  });

  it('keeps candidate queues bounded', () => {
    let queue = [];
    for (let index = 0; index < MAX_PENDING_ICE_CANDIDATES + 10; index += 1) {
      queue = appendBoundedCandidate(queue, { candidate: `candidate:${index}` });
    }

    expect(queue).toHaveLength(MAX_PENDING_ICE_CANDIDATES);
    expect(queue[0].candidate).toBe('candidate:10');
  });
});
