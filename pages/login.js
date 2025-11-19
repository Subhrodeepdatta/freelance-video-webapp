import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at top, #191942 0, #050510 45%, #02020a 100%)',
  color: '#f0f0f0',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const cardStyle = {
  background: 'rgba(6,6,22,0.96)',
  borderRadius: 16,
  padding: '22px 26px',
  width: 360,
  boxShadow: '0 22px 55px rgba(0,0,0,0.65)',
  border: '1px solid rgba(130,130,255,0.25)'
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 10,
  borderRadius: 10,
  border: '1px solid rgba(90,90,160,0.9)',
  background: '#050518',
  color: '#f0f0f0',
  fontSize: 13,
  boxSizing: 'border-box'
};

const buttonStyle = {
  width: '100%',
  background: 'linear-gradient(135deg,#5b8cff,#a26bff)',
  border: 'none',
  borderRadius: 999,
  padding: '9px 16px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  marginTop: 4
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
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Subh Stories Studio</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Private admin login</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>Email</div>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
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
