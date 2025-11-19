import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.error('Error getting session', error);
      }
      setSession(session);
      setAuthLoading(false);
    }

    load();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, authLoading, signOut };
}
