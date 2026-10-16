import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { isConfigured, supabase } from './lib/supabase';
import { AuthPage } from './pages/Auth';
import { ProjectsPage } from './pages/Projects';
import { ProjectPage } from './pages/Project';

function SetupNeeded() {
  return (
    <main className="center">
      <div className="panel narrow">
        <h1>Falta conectar Supabase</h1>
        <p>Copia <code>.env.example</code> a <code>.env</code>, pega la URL y la clave anónima de tu proyecto y reinicia <code>npm run dev</code>. La app no muestra datos de ejemplo: sin base de datos no hay nada que guardar.</p>
      </div>
    </main>
  );
}

export function App() {
  const { session, loading, recovery } = useAuth();
  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <main className="center"><p role="status">Cargando…</p></main>;
  if (!session || recovery) return <AuthPage />;

  return (
    <div className="shell">
      <nav className="side" aria-label="Principal">
        <div className="brand">Violet Atelier</div>
        <NavLink to="/">Mis creaciones</NavLink>
        <div className="spacer" />
        <p className="who">{session.user.email}</p>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/p/:id" element={<ProjectPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
