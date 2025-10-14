import type { DurableObjectState, DurableObjectStorage } from "@cloudflare/workers-types";

export class MockStorage {
  readonly data = new Map<string, unknown>();
  readonly putCounts = new Map<string, number>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.putCounts.set(key, (this.putCounts.get(key) ?? 0) + 1);
    this.data.set(key, typeof structuredClone === "function" ? structuredClone(value) : value);
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.data.delete(key);
    return existed;
  }

  async setAlarm(timestamp: number): Promise<void> {
    this.alarm = timestamp;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  resetCounts(): void {
    this.putCounts.clear();
  }

  getPutCount(key: string): number {
    return this.putCounts.get(key) ?? 0;
  }
}

export class MockDurableObjectState {
  readonly storageImpl = new MockStorage();
  readonly storage: DurableObjectStorage;

  constructor() {
    this.storage = {
      get: (key: string) => this.storageImpl.get(key),
      put: (key: string, value: unknown) => this.storageImpl.put(key, value),
      delete: (key: string) => this.storageImpl.delete(key),
      setAlarm: (timestamp: number) => this.storageImpl.setAlarm(timestamp),
      getAlarm: () => this.storageImpl.getAlarm(),
    } as unknown as DurableObjectStorage;
  }

  waitUntil(): void {
    // no-op for tests
  }
}
