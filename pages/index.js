import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  background: 'radial-gradient(circle at top, #fbe9d4 0, #f7f0e5 40%, #f3e7d8 100%)',
  color: '#2b2116',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif'
};

const shellStyle = {
  width: '100%',
  maxWidth: 1120,
  padding: '18px 18px 28px 18px',
  boxSizing: 'border-box'
};

const cardStyle = {
  background: '#fffaf2',
  borderRadius: 16,
  padding: '14px 18px',
  boxShadow: '0 14px 30px rgba(150,120,70,0.16)',
  border: '1px solid rgba(210,182,130,0.75)'
};

const softCardStyle = {
  background: '#fffdf7',
  borderRadius: 12,
  padding: '10px 12px',
  border: '1px solid rgba(223,201,155,0.7)'
};

const buttonStyle = {
  background: 'linear-gradient(135deg,#d4a85f,#c07b2a)',
  border: 'none',
  borderRadius: 999,
  padding: '7px 16px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  boxShadow: '0 8px 18px rgba(173, 126, 54, 0.35)',
  textDecoration: 'none'
};

const subtleButtonStyle = {
  ...buttonStyle,
  background: 'rgba(255,255,255,0.7)',
  color: '#7b5523',
  boxShadow: 'none',
  border: '1px solid rgba(210,182,130,0.9)'
};

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 9,
  border: '1px solid rgba(191,161,110,0.9)',
  background: '#fffdf7',
  color: '#2b2116',
  fontSize: 13,
  boxSizing: 'border-box'
};

function calcAmounts(project) {
  const cost = project.cost || 0;
  const advance = project.advance || 0;
  let received = 0;
  if (project.payment_status === 'paid') {
    received = cost;
  } else if (project.payment_status === 'partial') {
    received = advance;
  } else {
    received = 0;
  }
  const pending = Math.max(cost - received, 0);
  return { cost, advance, received, pending };
}

export default function DashboardHome() {
  const router = useRouter();
  const { session, authLoading, signOut } = useSupabaseAuth();

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchClient, setSearchClient] = useState('');

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    loadData();
  }, [session]);

  async function loadData() {
    const [{ data: clientData, error: clientErr }, { data: projData, error: projErr }] =
      await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('client_id, cost, advance, payment_status')
      ]);

    if (clientErr) console.error('Clients error', clientErr);
    if (projErr) console.error('Projects error', projErr);

    setClients(clientData || []);
    setProjects(projData || []);
  }

  const clientStatsMap = useMemo(() => {
    const map = {};
    projects.forEach(p => {
      const { cost, received, pending } = calcAmounts(p);
      if (!map[p.client_id]) {
        map[p.client_id] = { total: 0, received: 0, pending: 0, projects: 0 };
      }
      map[p.client_id].total += cost;
      map[p.client_id].received += received;
      map[p.client_id].pending += pending;
      map[p.client_id].projects += 1;
    });
    return map;
  }, [projects]);

  const globalStats = useMemo(() => {
    let total = 0;
    let received = 0;
    let pending = 0;
    Object.values(clientStatsMap).forEach(s => {
      total += s.total;
      received += s.received;
      pending += s.pending;
    });
    return { total, received, pending };
  }, [clientStatsMap]);

  const filteredClients = useMemo(() => {
    const q = searchClient.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [clients, searchClient]);

  const maxTotal = useMemo(() => {
    let max = 0;
    filteredClients.forEach(c => {
      const stats = clientStatsMap[c.id];
      if (stats && stats.total > max) max = stats.total;
    });
    return max || 1;
  }, [filteredClients, clientStatsMap]);

  if (authLoading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>Loading…</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userEmail = session.user?.email || 'Admin';

  return (
    <div style={containerStyle}>
      <div style={shellStyle}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 650 }}>Subh Stories · Studio Overview</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Clean snapshot of all clients and money at a glance.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.78 }}>
              Logged in as <span style={{ fontWeight: 500 }}>{userEmail}</span>
            </div>
            <button
              type=\"button\"
              style={{ ...subtleButtonStyle, marginTop: 6, padding: '4px 10px', fontSize: 12 }}
              onClick={signOut}
            >
              Log out
            </button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
            gap: 12,
            marginBottom: 14
          }}
        >
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total studio budget</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              ₹{globalStats.total.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Received:{' '}
              <span style={{ fontWeight: 600, color: '#4f7c2a' }}>
                ₹{globalStats.received.toFixed(0)}
              </span>{' '}
              · Pending:{' '}
              <span style={{ fontWeight: 600, color: '#b06020' }}>
                ₹{globalStats.pending.toFixed(0)}
              </span>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Clients & projects</div>
            <div style={{ display: 'flex', marginTop: 6, gap: 24, alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 650 }}>{clients.length}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>Total clients</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 650 }}>{projects.length}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>Total projects</div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px,1.15fr) minmax(260px,0.9fr)',
            gap: 14
          }}
        >
          {/* GRAPH */}
          <div style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Revenue by client</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  Bars show total budget; darker segment is pending amount.
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>
                {filteredClients.length} client{filteredClients.length === 1 ? '' : 's'}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, maxWidth: 280 }}
                placeholder=\"Search client…\"
                value={searchClient}
                onChange={e => setSearchClient(e.target.value)}
              />
            </div>

            <div style={{ ...softCardStyle, maxHeight: 320, overflowY: 'auto' }}>
              {filteredClients.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  No clients match this search.
                </div>
              )}
              {filteredClients.map(c => {
                const stats = clientStatsMap[c.id] || {
                  total: 0,
                  received: 0,
                  pending: 0,
                  projects: 0
                };
                const totalWidth = Math.max((stats.total / maxTotal) * 100, 8);
                const pendingWidth =
                  stats.total > 0 ? (stats.pending / stats.total) * 100 : 0;

                return (
                  <div
                    key={c.id}
                    style={{
                      marginBottom: 10,
                      paddingBottom: 6,
                      borderBottom: '1px dashed #ead6ae'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 4
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.75 }}>
                        {stats.projects} project{stats.projects === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        height: 16,
                        borderRadius: 999,
                        background: '#f5ebdc',
                        overflow: 'hidden',
                        marginBottom: 4
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${totalWidth}%`,
                          maxWidth: '100%',
                          background:
                            'linear-gradient(90deg, #f1c67a, #d89b4a)'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: `${pendingWidth}%`,
                          maxWidth: '100%',
                          background:
                            'linear-gradient(90deg, rgba(191,75,34,0.1), rgba(191,75,34,0.55))'
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        opacity: 0.8
                      }}
                    >
                      <div>
                        Total: <strong>₹{stats.total.toFixed(0)}</strong>
                      </div>
                      <div>
                        Rec: ₹{stats.received.toFixed(0)} · Pend:{' '}
                        <span style={{ color: '#b06020' }}>
                          ₹{stats.pending.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CLIENT LIST / JUMP */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Client dashboards</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  Open focused dashboards to manage projects & invoices.
                </div>
              </div>
            </div>

            <div style={{ ...softCardStyle, maxHeight: 340, overflowY: 'auto' }}>
              {clients.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  No clients yet. Add clients directly in Supabase or via a future admin screen.
                </div>
              )}
              {clients.map(c => {
                const stats = clientStatsMap[c.id] || {
                  total: 0,
                  received: 0,
                  pending: 0,
                  projects: 0
                };
                return (
                  <div
                    key={c.id}
                    style={{
                      padding: '8px 8px',
                      marginBottom: 6,
                      borderRadius: 10,
                      border: '1px solid rgba(226,201,151,0.8)',
                      background: '#fffbf4'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {c.email || c.phone || 'No contact info'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11 }}>
                        <div>Budget: ₹{stats.total.toFixed(0)}</div>
                        <div style={{ color: '#b06020' }}>
                          Pending: ₹{stats.pending.toFixed(0)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Link
                        href={`/clients/${c.id}`}
                        style={{
                          ...buttonStyle,
                          padding: '5px 10px',
                          fontSize: 12
                        }}
                      >
                        Open client dashboard
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
