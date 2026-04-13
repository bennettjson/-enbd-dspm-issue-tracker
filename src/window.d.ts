// Claude artifact shared storage API
interface ClaudeStorageResult {
  value: string | null
}
interface ClaudeStorage {
  get(key: string, shared: boolean): Promise<ClaudeStorageResult | null>
  set(key: string, value: string, shared: boolean): Promise<void>
}
declare global {
  interface Window {
    storage?: ClaudeStorage
  }
}
export {}
