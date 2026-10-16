// Small key-value storage for the host's settings. Web uses localStorage; Vega uses storage.vega.ts.
// Failures are ignored: settings simply fall back to the defaults.

export async function loadValue(key: string): Promise<string | null> {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export async function saveValue(key: string, value: string): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, quota…): keep the in-memory value only
  }
}
