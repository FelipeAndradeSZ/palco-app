export const MAX_P2P_LISTENERS = 12;
export const MAX_PENDING_ICE_CANDIDATES = 64;

const MAX_SIGNAL_ID_LENGTH = 128;
const MAX_SDP_LENGTH = 256_000;
const MAX_CANDIDATE_LENGTH = 16_000;

export function isValidSignalId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_SIGNAL_ID_LENGTH;
}

export function isValidSessionDescription(description, expectedType) {
  return Boolean(
    description
    && description.type === expectedType
    && typeof description.sdp === 'string'
    && description.sdp.length > 0
    && description.sdp.length <= MAX_SDP_LENGTH
  );
}

export function isValidIceCandidate(candidate) {
  return Boolean(
    candidate
    && typeof candidate === 'object'
    && typeof candidate.candidate === 'string'
    && candidate.candidate.length <= MAX_CANDIDATE_LENGTH
  );
}

export function appendBoundedCandidate(queue, candidate) {
  if (!isValidIceCandidate(candidate)) return queue;
  return [...queue.slice(-(MAX_PENDING_ICE_CANDIDATES - 1)), candidate];
}
