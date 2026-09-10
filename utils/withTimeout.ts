// Guards against native Firebase calls that hang forever with no error — e.g. phone-auth
// device-attestation handshakes (Play Integrity / APNs) that never resolve when the
// underlying certificate/APNs config is missing. Bounds any awaited call so callers
// always get a definite success or a clear, timely error instead of spinning forever.
export const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out. Please check your connection and try again.`)), ms)
    ),
  ]);
};
