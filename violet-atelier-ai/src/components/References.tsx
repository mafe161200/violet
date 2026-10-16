import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabase';

type Img = { id: string; storage_path: string; url?: string };
const OK = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 10 * 1024 * 1024;
const BUCKET = 'reference-images';

export function References({ projectId }: { projectId: string }) {
  const [imgs, setImgs] = useState<Img[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('reference_images').select('id,storage_path').eq('project_id', projectId).order('created_at');
    if (e) return setError(e.message);
    const rows = (data ?? []) as Img[];
    const { data: signed } = rows.length ? await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600) : { data: [] };
    setImgs(rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? undefined })));
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setBusy(true); setError(null);
    const { data: u, error: userError } = await supabase.auth.getUser();
    if (userError || !u.user) { setError(userError?.message ?? 'No se pudo verificar la sesión.'); setBusy(false); return; }
    for (const f of files) {
      if (!OK.includes(f.type)) { setError(`«${f.name}»: usa JPG, PNG o WebP.`); continue; }
      if (f.size > MAX) { setError(`«${f.name}» pesa más de 10 MB.`); continue; }
      const ext = f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1];
      const path = `${u.user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (up.error) { setError(up.error.message); continue; }
      const ins = await supabase.from('reference_images').insert({ project_id: projectId, storage_path: path, mime: f.type, bytes: f.size });
      if (ins.error) { await supabase.storage.from(BUCKET).remove([path]); setError(ins.error.message); }
    }
    setBusy(false); await load();
  }

  async function remove(i: Img) {
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    setError(null);
    const { error: rowError } = await supabase.from('reference_images').delete().eq('id', i.id);
    if (rowError) { setError(rowError.message); return; }
    const { error: fileError } = await supabase.storage.from(BUCKET).remove([i.storage_path]);
    if (fileError) setError(`La referencia se quitó del proyecto, pero no se pudo borrar el archivo almacenado: ${fileError.message}`);
    await load();
  }

  return (
    <section>
      <label className="drop">Añadir imágenes (JPG, PNG o WebP, hasta 10 MB)
        <input type="file" accept={OK.join(',')} multiple onChange={upload} disabled={busy} />
      </label>
      {busy && <p role="status">Subiendo…</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {imgs?.length === 0 && <p className="empty">Este proyecto no tiene referencias. Sube una fotografía de la prenda o un boceto para empezar.</p>}
      <ul className="gallery">
        {imgs?.map((i) => (
          <li key={i.id}>
            {i.url ? <img src={i.url} alt="Imagen de referencia del proyecto" /> : <div className="ph">Sin vista previa</div>}
            <button className="ghost danger" onClick={() => remove(i)}>Eliminar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
