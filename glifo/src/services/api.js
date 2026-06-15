/**
 * Glifo API Service
 * Capa centralizada de comunicacion con el backend
 */

const BASE = 'http://localhost:8000/api/v1';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// -- Stats ----------------------------------------------------------------
export const statsApi = {
  overview:    () => request('/stats/overview'),
  colecciones: () => request('/stats/colecciones'),
};

// -- Piezas ---------------------------------------------------------------
export const piezasApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '' && v !== 'todos' && v !== 'todas') q.set(k, v);
    });
    return request(`/piezas?${q}`);
  },
  obtener:    (id)        => request(`/piezas/${id}`),
  crear:      (data)      => request('/piezas', { method: 'POST', body: JSON.stringify(data) }),
  actualizar: (id, data)  => request(`/piezas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eliminar:   (id)        => request(`/piezas/${id}`, { method: 'DELETE' }),
  reprocesar: (id)        => request(`/piezas/${id}/reprocesar`, { method: 'POST' }),
  subir: (file, titulo, coleccion) => {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('titulo', titulo || '');
    fd.append('coleccion', coleccion || 'Sin coleccion');
    return fetch(`${BASE}/piezas/upload`, { method: 'POST', body: fd }).then(r => {
      if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.detail)));
      return r.json();
    });
  },
};

// -- Jobs / Cola ----------------------------------------------------------
export const jobsApi = {
  listar: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); });
    return request(`/jobs?${q}`);
  },
  cola:    ()   => request('/jobs/cola'),
  obtener: (id) => request(`/jobs/${id}`),
  cancelar:(id) => request(`/jobs/${id}/cancelar`, { method: 'POST' }),
};

// -- Busqueda -------------------------------------------------------------
export const buscarApi = {
  texto: (query, top_k = 10, tipo = null, coleccion = null) =>
    request('/buscar', {
      method: 'POST',
      body: JSON.stringify({ query, top_k, tipo, coleccion }),
    }),
  stats: () => request('/buscar/stats'),
  imagen: (file, top_k = 5) => {
    const fd = new FormData();
    fd.append('imagen', file);
    return fetch(`${BASE}/buscar/imagen?top_k=${top_k}`, { method: 'POST', body: fd })
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(new Error(e.detail)));
        return r.json();
      });
  },
};

// -- Grafo ----------------------------------------------------------------
export const grafoApi = {
  datos:       ()                                      => request('/grafo'),
  stats:       ()                                      => request('/grafo/stats'),
  sincronizar: ()                                      => request('/grafo/sincronizar', { method: 'POST' }),
  vecinos:     (id, profundidad = 2)                   => request(`/grafo/${id}/vecinos?profundidad=${profundidad}`),
  conectar:    (id, destino_id, tipo = 'relacionado', peso = 1.0) =>
    request(`/grafo/${id}/conectar`, { method: 'POST', body: JSON.stringify({ destino_id, tipo, peso }) }),
};

// -- IA -------------------------------------------------------------------
export const iaApi = {
  status:   () => request('/ai/status'),
  backends: () => request('/ai/backends'),
};

// -- Health ---------------------------------------------------------------
export const healthApi = {
  check: () => fetch('http://localhost:8000/health').then(r => r.json()),
};
