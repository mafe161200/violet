import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const { recovery, endRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        endRecovery();
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) setMsg({ kind: 'ok', text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg({ kind: 'ok', text: 'Si el correo existe, recibirás un enlace para crear una contraseña nueva.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'No se pudo completar la acción.' });
    } finally { setBusy(false); }
  }

  const title = recovery ? 'Crea una contraseña nueva' : mode === 'login' ? 'Entrar al atelier' : mode === 'register' ? 'Crear cuenta' : 'Recuperar contraseña';
  return (
    <main className="center">
      <form className="panel narrow" onSubmit={submit}>
        <h1>{title}</h1>
        {!recovery && (
          <label>Correo
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        {(recovery || mode !== 'reset') && (
          <label>{recovery ? 'Contraseña nueva' : 'Contraseña'}
            <input type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind}>{msg.text}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Un momento…' : recovery ? 'Guardar contraseña' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>
        {!recovery && (
          <div className="links">
            {mode !== 'login' && <button type="button" className="link" onClick={() => setMode('login')}>Ya tengo cuenta</button>}
            {mode !== 'register' && <button type="button" className="link" onClick={() => setMode('register')}>Crear cuenta</button>}
            {mode !== 'reset' && <button type="button" className="link" onClick={() => setMode('reset')}>Olvidé mi contraseña</button>}
          </div>
        )}
      </form>
    </main>
  );
}
