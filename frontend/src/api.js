function joinUrl(base, path) {
  const b = String(base || '').trim();
  if (!b) return path;
  const p = String(path || '');
  if (!p) return b;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (b.endsWith('/') && p.startsWith('/')) return b.slice(0, -1) + p;
  if (!b.endsWith('/') && !p.startsWith('/')) return `${b}/${p}`;
  return b + p;
}

const TOKEN_KEY = 'bm_access_token';

export function setAccessToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, String(token));
}

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function clearAccessToken() {
  setAccessToken('');
}

export async function api(path, options = {}) {
  const { body, headers, ...rest } = options;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = joinUrl(baseUrl, path);
  const token = getAccessToken();
  let res;
  try {
    res = await fetch(url, {
      ...rest,
      credentials: rest.credentials ?? 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const hint =
      import.meta.env.DEV
        ? ' Comprueba que Docker esté arriba (docker compose up -d) y que el proxy de Vite apunte al puerto WEB_PORT (p. ej. 18080).'
        : ' Abre la app en el mismo host/puerto donde corre el contenedor web (p. ej. http://localhost:18080).';
    throw new Error(`No se pudo conectar con la API.${hint}`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const parts = [data?.error, data?.detail].filter((p) => p != null && String(p).trim() !== '');
    const unique = [...new Set(parts.map(String))];
    const msg = unique.length ? unique.join(' — ') : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
