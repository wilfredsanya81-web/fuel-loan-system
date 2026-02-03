const getToken = () => localStorage.getItem('fuel_admin_token');

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { body?: object }
): Promise<{ data?: T; error?: string }> {
  const { body, ...rest } = options ?? {};
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(path.startsWith('http') ? path : `/api${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : rest.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? data.message ?? `Request failed (${res.status})` };
    return { data: data as T };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error' };
  }
}
