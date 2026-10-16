import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Project } from './Projects';
import { References } from '../components/References';
import { PatternTab } from '../components/PatternTab';

type Tab = 'refs' | 'lab' | 'pattern';

export function ProjectPage() {
  const { id = '' } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('refs');

  useEffect(() => {
    supabase.from('projects').select('id,name,status,source_type,is_favorite,updated_at').eq('id', id).maybeSingle()
      .then(({ data, error: e }) => (e ? setError(e.message) : data ? setProject(data as Project) : setError('No se encontró el proyecto.')));
  }, [id]);

  if (error) return <><p role="alert" className="error">{error}</p><Link to="/">Volver a Mis creaciones</Link></>;
  if (!project) return <p role="status">Cargando…</p>;

  return (
    <>
      <header className="head"><Link to="/" className="back">Mis creaciones</Link><h1>{project.name}</h1></header>
      <div role="tablist" className="tabs">
        {([['refs', 'Referencias'], ['lab', 'Laboratorio de IA'], ['pattern', 'Patrón']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'refs' && <References projectId={project.id} />}
      {tab === 'pattern' && <PatternTab projectId={project.id} />}
      {tab === 'lab' && (
        <section className="panel">
          <h2>Análisis por IA: no conectado</h2>
          <p>Todavía no hay ningún proveedor de IA configurado, así que no se genera ningún análisis. Las tablas <code>garment_analyses</code> y las políticas de seguridad ya existen; el análisis llegará en la Fase 7 mediante un servicio en el servidor, nunca desde el navegador.</p>
        </section>
      )}
    </>
  );
}
