/**
 * RedZombies — Supabase Cloud Database Configuration
 * 
 * To connect your free Supabase database:
 * 1. Go to https://supabase.com and create a free project.
 * 2. Run the `supabase_setup.sql` script in the Supabase SQL Editor.
 * 3. Go to Project Settings -> API.
 * 4. Copy "Project URL" into `url` below.
 * 5. Copy "anon public" API key into `anonKey` below.
 * 
 * (If left as placeholders, the game automatically runs in offline/local mode!)
 */
const SUPABASE_CONFIG = {
  url: 'https://gttpqhfardtahptehjjb.supabase.co',
  anonKey: 'sb_publishable_2Hm5Y1LGg1HizWVkN2adug_VU3L470P'
};

/**
 * Checks if valid custom Supabase credentials have been provided.
 */
function isSupabaseConfigured() {
  return (
    typeof SUPABASE_CONFIG === 'object' &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE_ANON') &&
    SUPABASE_CONFIG.url.startsWith('https://')
  );
}

// Expose on window scope for script.js
if (typeof window !== 'undefined') {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.isSupabaseConfigured = isSupabaseConfigured;
}
