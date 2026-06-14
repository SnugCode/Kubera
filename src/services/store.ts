const BASE = '/api/store'

export async function loadStore<T>(key: string): Promise<T[]> {
  try {
    const res = await fetch(`${BASE}/${key}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function saveStore<T>(key: string, data: T[]): Promise<void> {
  try {
    await fetch(`${BASE}/${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    })
  } catch {
    // Silently ignore — data stays in-memory via Pinia
  }
}
