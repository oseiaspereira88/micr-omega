export type MockSocketCloseRecord = {
  code?: number;
  reason?: string;
};

export function createMockSocket(
  sent: string[] = [],
  closed: MockSocketCloseRecord[] = []
): WebSocket {
  return {
    readyState: (globalThis as any).WebSocket?.OPEN ?? 1,
    send(payload: string) {
      sent.push(typeof payload === "string" ? payload : String(payload));
    },
    close(code?: number, reason?: string) {
      closed.push({ code, reason });
    },
    addEventListener() {
      /* noop */
    },
    removeEventListener() {
      /* noop */
    },
  } as unknown as WebSocket;
}
