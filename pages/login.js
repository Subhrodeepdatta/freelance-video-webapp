import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at top, #fbe9d4 0, #f7f0e5 40%, #f3e7d8 100%)',
  color: '#2b2116',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const cardStyle = {
  background: '#fffaf2',
  borderRadius: 18,
  padding: '24px 28px',
  width: 360,
  boxShadow: '0 18px 40px rgba(80,60,30,0.18)',
  border: '1px solid rgba(210,182,130,0.7)'
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 10,
  borderRadius: 10,
  border: '1px solid rgba(191,161,110,0.9)',
  background: '#fffdf7',
  color: '#2b2116',
  fontSize: 13,
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  background: 'linear-gradient(135deg,#d4a85f,#c07b2a)',
  border: 'none',
  borderRadius: 999,
  padding: '9px 16px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  marginTop: 4,
  boxShadow: '0 8px 18px rgba(173, 126, 54, 0.35)'
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setLoading(false);
    if (error) {
      console.error(error);
      alert('Login failed: ' + error.message);
    } else {
      router.push('/');
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 650 }}>Subh Stories Studio</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Private admin login</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>Email</div>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>Password</div>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 10 }}>
          Create the admin user in Supabase Auth &lt; Authentication &lt; Users.
        </div>
      </div>
    </div>
  );
}
