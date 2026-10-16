import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildSkirt, defaultParams, hasErrors, validateSkirt, type SkirtParams } from '../engine/skirts';
import { piecesToSvg } from '../engine/svg';

type Saved = { id: string; name: string; version: number; validation_status: string; params: SkirtParams; created_at: string };
const NUM: { key: 'waist' | 'hip' | 'length' | 'ease' | 'allowance'; label: string; circ: boolean }[] = [
  { key: 'waist', label: 'Cintura (mm)', circ: true },
  { key: 'hip', label: 'Cadera (mm)', circ: false },
  { key: 'length', label: 'Largo (mm)', circ: true },
  { key: 'ease', label: 'Holgura en cadera (mm)', circ: false },
  { key: 'allowance', label: 'Margen de costura (mm)', circ: true },
];

export function PatternTab({ projectId }: { projectId: string }) {
  const [params, setParams] = useState<SkirtParams>(defaultParams);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);

  const pieces = useMemo(() => buildSkirt(params), [params]);
  const issues = useMemo(() => validateSkirt(params, pieces), [params, pieces]);
  const valid = !hasErrors(issues);
  const svg = useMemo(() => (valid ? piecesToSvg(pieces) : ''), [valid, pieces]);
  const patternName = params.kind === 'straight' ? 'Falda recta' : 'Falda circular';

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('patterns').select('id,name,version,validation_status,params,created_at').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) setMsg({ kind: 'error', text: error.message }); else setSaved((data ?? []) as Saved[]);
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const version = Math.max(0, ...saved.filter((s) => s.name === patternName).map((s) => s.version)) + 1;
      const { data, error } = await supabase.from('patterns').insert({
        project_id: projectId, name: patternName, version, params,
        validation_status: 'geometry_valid', size_label: 'a medida',
      }).select('id').single();
      if (error || !data) {
        setMsg({ kind: 'error', text: error?.message ?? 'No se pudo guardar.' });
        return;
      }
      const patternId = (data as { id: string }).id;
      const rows = pieces.map((p) => ({
        pattern_id: patternId, name: p.name, geometry: p, cut_qty: p.cutQty, notes: p.notes,
        validation_status: validateSkirt(params, [p]).some((i) => i.level === 'error') ? 'unvalidated' : 'geometry_valid',
      }));
      const ins = await supabase.from('pattern_pieces').insert(rows);
      if (ins.error) {
        const rollback = await supabase.from('patterns').delete().eq('id', patternId);
        setMsg({ kind: 'error', text: rollback.error
          ? `No se guardaron las piezas (${ins.error.message}) y tampoco se pudo revertir la versión (${rollback.error.message}).`
          : `No se pudieron guardar las piezas; la versión se revirtió. ${ins.error.message}` });
        return;
      }
      setMsg({ kind: 'ok', text: `Guardado: ${patternName}, versión ${version}.` });
      await load();
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Ocurrió un error inesperado al guardar.' });
    } finally {
      setSaving(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${patternName.toLowerCase().replace(/\s+/g, '-')}.svg` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="editor">
      <div className="params panel">
        <h2>Parámetros</h2>
        <label>Tipo
          <select value={params.kind} onChange={(e) => setParams({ ...params, kind: e.target.value as SkirtParams['kind'] })}>
            <option value="straight">Falda recta</option>
            <option value="circular">Falda circular</option>
          </select>
        </label>
        {NUM.filter((n) => params.kind === 'straight' || n.circ).map((n) => (
          <label key={n.key}>{n.label}
            <input type="number" inputMode="decimal" value={Number.isFinite(params[n.key]) ? params[n.key] : ''}
              onChange={(e) => setParams({ ...params, [n.key]: e.target.valueAsNumber })} />
          </label>
        ))}
        <ul className="issues" aria-live="polite">
          {issues.length === 0 && <li className="ok">La geometría superó las comprobaciones automáticas disponibles.</li>}
          {issues.map((i, k) => <li key={k} className={i.level}>{i.message}</li>)}
        </ul>
        <p className="note">Estas comprobaciones no validan el ajuste corporal ni toda la construcción de la prenda. Haz una toile de prueba y revisa el patrón antes de cortar la tela definitiva.</p>
        <div className="row">
          <button className="primary" onClick={save} disabled={!valid || saving}>{saving ? 'Guardando…' : 'Guardar versión'}</button>
          <button className="ghost" onClick={download} disabled={!valid}>Descargar SVG</button>
        </div>
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind}>{msg.text}</p>}
      </div>
      <div className="canvas panel">
        <label>Zoom {zoom}%<input type="range" min={40} max={300} step={10} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        {valid
          ? <div className="svgwrap" style={{ width: `${zoom}%` }} role="img" aria-label={`Vista previa del patrón de ${patternName.toLowerCase()}`} dangerouslySetInnerHTML={{ __html: svg }} />
          : <p className="empty">Corrige los errores para ver el patrón.</p>}
        <p className="note">Línea continua: corte. Línea discontinua: costura. El cuadrado de 100 mm sirve para comprobar la escala al imprimir al 100 %.</p>
        {saved.length > 0 && (
          <>
            <h2>Versiones guardadas</h2>
            <ul className="list">
              {saved.map((s) => (
                <li key={s.id}>
                  <div className="grow">{s.name} · v{s.version}<small>{s.validation_status === 'geometry_valid' ? 'Geometría válida' : 'Sin validar'} · {new Date(s.created_at).toLocaleString('es')}</small></div>
                  <button className="ghost" onClick={() => setParams(s.params)}>Cargar parámetros</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
