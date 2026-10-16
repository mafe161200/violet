import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export type Project = { id: string; name: string; status: string; source_type: string; is_favorite: boolean; updated_at: string };

const SOURCES: Record<string, string> = { scratch: 'Desde cero', photo: 'Fotografía de una prenda', references: 'Varias referencias', sketch: 'Boceto' };

export function ProjectsPage() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [name, setName] = useState('');
  const [source, setSource] = useState('scratch');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('projects').select('id,name,status,source_type,is_favorite,updated_at').order('updated_at', { ascending: false });
    if (e) setError(e.message); else { setItems(data as Project[]); setError(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (items ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) && (!onlyFav || p.is_favorite)), [items, q, onlyFav]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error: err } = await supabase.from('projects').insert({ name: name.trim(), source_type: source });
    if (err) return setError(err.message);
    setName(''); await load();
  }
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error: err } = await p; if (err) setError(err.message); await load(); };

  async function rename(p: Project) {
    const next = window.prompt('Nuevo nombre', p.name)?.trim();
    if (next && next !== p.name) await run(supabase.from('projects').update({ name: next }).eq('id', p.id));
  }
  async function remove(p: Project) {
    if (!window.confirm(`¿Eliminar «${p.name}» con sus imágenes y patrones? No se puede deshacer.`)) return;
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError(authError?.message ?? 'No se pudo verificar la sesión.');
      return;
    }

    // Retira todas las referencias antes de borrar el proyecto; no ocultes fallos de Storage.
    const folder = `${authData.user.id}/${p.id}`;
    const storage = supabase.storage.from('reference-images');
    let offset = 0;
    while (true) {
      const { data: files, error: listError } = await storage.list(folder, { limit: 100, offset });
      if (listError) { setError(`No se pudieron consultar las imágenes: ${listError.message}`); return; }
      if (!files?.length) break;
      const { error: storageError } = await storage.remove(files.map((f) => `${folder}/${f.name}`));
      if (storageError) { setError(`No se pudieron eliminar las imágenes: ${storageError.message}`); return; }
      if (files.length < 100) break;
      // La página se reduce al borrar; vuelve a consultar desde el inicio para no saltar archivos.
      offset = 0;
    }

    const { error: deleteError } = await supabase.from('projects').delete().eq('id', p.id);
    if (deleteError) { setError(deleteError.message); return; }
    await load();
  }

  return (
    <>
      <header className="head"><h1>Mis creaciones</h1></header>
      <form className="row" onSubmit={create}>
        <label className="grow">Nuevo proyecto
          <input value={name} maxLength={120} placeholder="Ej. Falda de lino verano" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>Punto de partida
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button className="primary" disabled={!name.trim()}>Crear proyecto</button>
      </form>
      <div className="row">
        <label className="grow">Buscar<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> Solo favoritos</label>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {items === null && !error && <p role="status">Cargando proyectos…</p>}
      {items?.length === 0 && <p className="empty">Aún no tienes proyectos. Escribe un nombre arriba y crea el primero; podrás guardar borradores y seguir después.</p>}
      {items && items.length > 0 && shown.length === 0 && <p className="empty">Ningún proyecto coincide con la búsqueda.</p>}
      <ul className="list">
        {shown.map((p) => (
          <li key={p.id}>
            <div className="grow">
              <Link to={`/p/${p.id}`} className="title">{p.name}</Link>
              <small>{p.status === 'draft' ? 'Borrador' : p.status} · {SOURCES[p.source_type] ?? 'Duplicado'} · {new Date(p.updated_at).toLocaleDateString('es')}</small>
            </div>
            <button className="ghost" aria-pressed={p.is_favorite} onClick={() => run(supabase.from('projects').update({ is_favorite: !p.is_favorite }).eq('id', p.id))}>
              {p.is_favorite ? 'Quitar favorito' : 'Favorito'}
            </button>
            <button className="ghost" onClick={() => rename(p)}>Renombrar</button>
            <button className="ghost danger" onClick={() => remove(p)}>Eliminar</button>
          </li>
        ))}
      </ul>
    </>
  );
}
