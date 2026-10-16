import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(
  url && key &&
  url.startsWith('https://') &&
  !url.includes('TU-PROYECTO') &&
  !key.includes('tu-clave') &&
  !key.includes('YOUR_')
);
export const supabase = createClient(url ?? 'http://invalid.local', key ?? 'missing-key');
