import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { supabase } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';

const STATUSES = ['pending', 'editing', 'delivered', 'paid'];

const containerStyle = {
  display: 'flex',
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, #191942 0, #050510 40%, #02020a 100%)',
  color: '#f0f0f0',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const sidebarStyle = {
  width: 290,
  borderRight: '1px solid rgba(80,80,150,0.6)',
  padding: 16,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const mainStyle = {
  flex: 1,
  padding: 16,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const topBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4
};

const cardStyle = {
  background: 'rgba(6,6,22,0.96)',
  borderRadius: 14,
  padding: '12px 14px',
  boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
  border: '1px solid rgba(130,130,255,0.18)'
};

const buttonStyle = {
  background: 'linear-gradient(135deg,#5b8cff,#a26bff)',
  border: 'none',
  borderRadius: 999,
  padding: '7px 16px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6
};

const subtleButtonStyle = {
  ...buttonStyle,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)'
};

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  marginBottom: 8,
  borderRadius: 9,
  border: '1px solid rgba(80,80,150,0.8)',
  background: 'rgba(4,4,18,0.96)',
  color: '#f0f0f0',
  fontSize: 13,
  boxSizing: 'border-box'
};

const labelStyle = { fontSize: 11, opacity: 0.75, marginBottom: 2 };

function formatDate(d) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toISOString().slice(0, 10);
  } catch {
    return d;
  }
}

export default function Home() {
  const router = useRouter();
  const { session, authLoading, signOut } = useSupabaseAuth();

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);

  const [clientForm, setClientForm] = useState({
    id: null,
    name: '',
    email: '',
    phone: '',
    logo_path: '',
    notes: ''
  });

  const [projectForm, setProjectForm] = useState({
    id: null,
    name: '',
    type: '',
    deadline: '',
    cost: '',
    status: 'pending',
    file_links: '',
    notes: ''
  });

  const [projects, setProjects] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchClient, setSearchClient] = useState('');
  const [globalStats, setGlobalStats] = useState({ total: 0, paid: 0, pending: 0 });

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  // Redirect to login if not authed
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [authLoading, session, router]);

  // Load data once we have a session
  useEffect(() => {
    if (!session) return;
    loadClients();
    loadGlobalStats();
  }, [session]);

  useEffect(() => {
    if (selectedClientId) {
      loadProjects(selectedClientId);
    } else {
      setProjects([]);
    }
  }, [selectedClientId]);

  async function loadClients() {
    setLoadingClients(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load clients', error);
    } else {
      setClients(data || []);
      if (data && data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    }
    setLoadingClients(false);
  }

  async function loadGlobalStats() {
    const { data, error } = await supabase
      .from('projects')
      .select('cost,status');

    if (error) {
      console.error('Failed to load global stats', error);
      return;
    }
    let total = 0;
    let paid = 0;
    let pending = 0;
    (data || []).forEach(p => {
      const cost = p.cost || 0;
      total += cost;
      if (p.status === 'paid') paid += cost;
      else pending += cost;
    });
    setGlobalStats({ total, paid, pending });
  }

  async function loadProjects(clientId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load projects', error);
    } else {
      setProjects(data || []);
    }
  }

  function resetClientForm() {
    setClientForm({
      id: null,
      name: '',
      email: '',
      phone: '',
      logo_path: '',
      notes: ''
    });
  }

  function resetProjectForm() {
    setProjectForm({
      id: null,
      name: '',
      type: '',
      deadline: '',
      cost: '',
      status: 'pending',
      file_links: '',
      notes: ''
    });
  }

  function onSelectClient(client) {
    setSelectedClientId(client.id);
    resetProjectForm();
    setClientForm({
      id: client.id,
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      logo_path: client.logo_path || '',
      notes: client.notes || ''
    });
  }

  async function handleSaveClient(e) {
    e.preventDefault();
    if (!clientForm.name.trim()) {
      alert('Client name is required');
      return;
    }
    setSavingClient(true);

    try {
      if (clientForm.id) {
        const { data, error } = await supabase
          .from('clients')
          .update({
            name: clientForm.name.trim(),
            email: clientForm.email || null,
            phone: clientForm.phone || null,
            logo_path: clientForm.logo_path || null,
            notes: clientForm.notes || null
          })
          .eq('id', clientForm.id)
          .select()
          .single();

        if (error) throw error;
        await loadClients();
        setClientForm(prev => ({ ...prev, id: data.id }));
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: clientForm.name.trim(),
            email: clientForm.email || null,
            phone: clientForm.phone || null,
            logo_path: clientForm.logo_path || null,
            notes: clientForm.notes || null
          })
          .select()
          .single();

        if (error) throw error;
        await loadClients();
        setSelectedClientId(data.id);
        setClientForm(prev => ({ ...prev, id: data.id }));
      }
    } catch (err) {
      console.error('Save client failed', err);
      alert('Failed to save client (check console).');
    } finally {
      setSavingClient(false);
    }
  }

  async function handleDeleteClient() {
    if (!clientForm.id) return;
    if (!window.confirm('Delete this client and all their projects?')) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientForm.id);

    if (error) {
      console.error('Delete client failed', error);
      alert('Failed to delete client.');
      return;
    }

    resetClientForm();
    setSelectedClientId(null);
    await loadClients();
    await loadGlobalStats();
  }

  function startCreateClient() {
    resetClientForm();
    setSelectedClientId(null);
    setProjects([]);
  }

  function startEditProject(p) {
    setProjectForm({
      id: p.id,
      name: p.name || '',
      type: p.type || '',
      deadline: p.deadline ? formatDate(p.deadline) : '',
      cost: p.cost != null ? String(p.cost) : '',
      status: p.status || 'pending',
      file_links: p.file_links || '',
      notes: p.notes || ''
    });
  }

  async function handleSaveProject(e) {
    e.preventDefault();
    if (!selectedClient) {
      alert('Choose a client first');
      return;
    }
    if (!projectForm.name.trim()) {
      alert('Project name is required');
      return;
    }
    setSavingProject(true);

    const payload = {
      name: projectForm.name.trim(),
      type: projectForm.type || null,
      deadline: projectForm.deadline || null,
      cost: projectForm.cost ? Number(projectForm.cost) : 0,
      status: projectForm.status || 'pending',
      file_links: projectForm.file_links || null,
      notes: projectForm.notes || null
    };

    try {
      if (projectForm.id) {
        const { error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', projectForm.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert({
            ...payload,
            client_id: selectedClient.id
          });

        if (error) throw error;
      }

      await loadProjects(selectedClient.id);
      await loadGlobalStats();
    } catch (err) {
      console.error('Save project failed', err);
      alert('Failed to save project.');
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject(p) {
    if (!window.confirm('Delete this project?')) return;
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', p.id);

    if (error) {
      console.error('Delete project failed', error);
      alert('Failed to delete project.');
      return;
    }
    await loadProjects(selectedClient.id);
    await loadGlobalStats();
    if (projectForm.id === p.id) resetProjectForm();
  }

  function getClientStats() {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    projects.forEach(p => {
      const cost = p.cost || 0;
      totalRevenue += cost;
      if (p.status === 'paid') {
        totalPaid += cost;
      } else {
        totalPending += cost;
      }
    });
    return { totalRevenue, totalPaid, totalPending };
  }

  const stats = getClientStats();

  const filteredClients = useMemo(() => {
    const q = searchClient.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [clients, searchClient]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter(p => p.status === statusFilter);
  }, [projects, statusFilter]);

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    return projects
      .filter(p => p.deadline && p.status !== 'paid')
      .map(p => ({ ...p, deadlineDate: new Date(p.deadline) }))
      .filter(p => !Number.isNaN(p.deadlineDate.getTime()) && p.deadlineDate >= today)
      .sort((a, b) => a.deadlineDate - b.deadlineDate)
      .slice(0, 3);
  }, [projects]);

  function statusBadgeStyle(status) {
    let bg = 'rgba(255,255,255,0.06)';
    if (status === 'paid') bg = 'rgba(0,200,120,0.22)';
    else if (status === 'delivered') bg = 'rgba(0,160,255,0.18)';
    else if (status === 'editing') bg = 'rgba(200,160,0,0.18)';
    else if (status === 'pending') bg = 'rgba(255,160,0,0.15)';
    return {
      padding: '2px 9px',
      borderRadius: 999,
      fontSize: 11,
      textTransform: 'capitalize',
      background: bg
    };
  }

  function handleExportPdf() {
    if (!selectedClient) {
      alert('Select a client first');
      return;
    }
    const doc = new jsPDF();
    const title = `Projects for ${selectedClient.name}`;
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(10);
    const now = new Date().toLocaleString();
    doc.text(`Exported ${now}`, 14, 24);

    const rows = filteredProjects.map(p => [
      p.name,
      p.type || '',
      p.cost != null ? p.cost.toString() : '0',
      p.status,
      p.deadline ? formatDate(p.deadline) : ''
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Project', 'Type', 'Cost (₹)', 'Status', 'Deadline']],
      body: rows
    });

    const fileName = `${selectedClient.name.replace(/[^a-z0-9]+/gi, '_')}_projects.pdf`;
    doc.save(fileName);
  }

  if (authLoading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading…</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userEmail = session.user?.email || 'Admin';

  return (
    <div style={containerStyle}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={topBarStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Subh Stories</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Studio CRM · Web</div>
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.78, marginBottom: 4 }}>
          Logged in as <span style={{ fontWeight: 500 }}>{userEmail}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input
            style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }}
            placeholder="Search clients…"
            value={searchClient}
            onChange={e => setSearchClient(e.target.value)}
          />
          <button style={{ ...buttonStyle, padding: '6px 10px', fontSize: 12 }} onClick={startCreateClient}>
            + New
          </button>
        </div>

        <div
          style={{
            ...cardStyle,
            flex: 1,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            background: 'rgba(5,5,22,0.96)'
          }}
        >
          {loadingClients && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading clients…</div>
          )}
          {!loadingClients && filteredClients.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              No clients yet. Click <strong>+ New</strong> to add one.
            </div>
          )}
          {filteredClients.map(c => (
            <div
              key={c.id}
              onClick={() => onSelectClient(c)}
              style={{
                padding: '6px 8px',
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 13,
                border:
                  selectedClientId === c.id
                    ? '1px solid rgba(120,150,255,0.9)'
                    : '1px solid transparent',
                background:
                  selectedClientId === c.id
                    ? 'linear-gradient(135deg,rgba(91,140,255,0.22),rgba(162,107,255,0.35))'
                    : 'rgba(10,10,32,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {(c.email || c.phone) && (
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {c.email || c.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          style={{ ...subtleButtonStyle, marginTop: 4, width: '100%', justifyContent: 'center' }}
          onClick={signOut}
        >
          Log out
        </button>
      </aside>

      {/* MAIN */}
      <main style={mainStyle}>
        {/* Top stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <div style={{ ...cardStyle, flex: 1, minWidth: 210 }}>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Studio revenue (all clients)</div>
            <div style={{ fontSize: 20, fontWeight: 650, marginTop: 4 }}>
              ₹{globalStats.total.toFixed(0)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              Paid: <span style={{ color: '#33ff99' }}>₹{globalStats.paid.toFixed(0)}</span> ·
              Pending: <span style={{ color: '#ffcc66' }}>₹{globalStats.pending.toFixed(0)}</span>
            </div>
          </div>

          <div style={{ ...cardStyle, flex: 1, minWidth: 210 }}>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Current client</div>
            {selectedClient ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  {selectedClient.name}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                  {selectedClient.email || selectedClient.phone || 'No contact info yet'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 8 }}>Revenue for this client</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  ₹{stats.totalRevenue.toFixed(0)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  Paid: ₹{stats.totalPaid.toFixed(0)} · Pending: ₹{stats.totalPending.toFixed(0)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Select a client from the left or create a new one.
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, flex: 1, minWidth: 210 }}>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Upcoming deadlines</div>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                No upcoming deadlines for this client.
              </div>
            ) : (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {upcomingDeadlines.map(p => (
                  <div key={p.id} style={{ fontSize: 12 }}>
                    <span style={{ opacity: 0.85 }}>{p.name}</span>
                    <span style={{ opacity: 0.65 }}> · {formatDate(p.deadline)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Client form + Projects */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Client form */}
          <section style={{ ...cardStyle, flex: 0.9, minWidth: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {clientForm.id ? 'Edit client' : 'New client'}
              </div>
              {clientForm.id && (
                <span style={{ fontSize: 11, opacity: 0.7 }}>ID: {clientForm.id}</span>
              )}
            </div>
            <form onSubmit={handleSaveClient}>
              <div style={labelStyle}>Name *</div>
              <input
                style={inputStyle}
                value={clientForm.name}
                onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                placeholder="Client / brand name"
              />
              <div style={labelStyle}>Email</div>
              <input
                style={inputStyle}
                value={clientForm.email}
                onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="client@email.com"
              />
              <div style={labelStyle}>Phone</div>
              <input
                style={inputStyle}
                value={clientForm.phone}
                onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                placeholder="+91…"
              />
              <div style={labelStyle}>Logo / Photo URL (optional)</div>
              <input
                style={inputStyle}
                value={clientForm.logo_path}
                onChange={e => setClientForm({ ...clientForm, logo_path: e.target.value })}
                placeholder="https://…"
              />
              <div style={labelStyle}>Notes</div>
              <textarea
                style={{ ...inputStyle, minHeight: 70 }}
                value={clientForm.notes}
                onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                placeholder="Client preferences, tone, brand info…"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" style={buttonStyle} disabled={savingClient}>
                  {savingClient ? 'Saving…' : 'Save client'}
                </button>
                {clientForm.id && (
                  <button
                    type="button"
                    style={subtleButtonStyle}
                    onClick={handleDeleteClient}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Projects */}
          <section style={{ ...cardStyle, flex: 1.4, minWidth: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Projects</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{ ...subtleButtonStyle, padding: '4px 10px', fontSize: 12 }}
                  onClick={resetProjectForm}
                >
                  + New project
                </button>
                <button
                  type="button"
                  style={{ ...subtleButtonStyle, padding: '4px 10px', fontSize: 12 }}
                  onClick={handleExportPdf}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {/* Status filters */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {['all', ...STATUSES].map(s => {
                const isActive = statusFilter === s;
                const count =
                  s === 'all'
                    ? projects.length
                    : projects.filter(p => p.status === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      borderRadius: 999,
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      background: isActive
                        ? 'rgba(120,160,255,0.25)'
                        : 'rgba(255,255,255,0.05)',
                      color: '#f0f0f0'
                    }}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Project form */}
              <div style={{ flex: 1, minWidth: 240 }}>
                <form onSubmit={handleSaveProject}>
                  <div style={labelStyle}>Project name *</div>
                  <input
                    style={inputStyle}
                    value={projectForm.name}
                    onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                    placeholder="Wedding film, Instagram reel…"
                  />
                  <div style={labelStyle}>Type</div>
                  <input
                    style={inputStyle}
                    value={projectForm.type}
                    onChange={e => setProjectForm({ ...projectForm, type: e.target.value })}
                    placeholder="wedding, reel, event…"
                  />
                  <div style={labelStyle}>Deadline</div>
                  <input
                    style={inputStyle}
                    type="date"
                    value={projectForm.deadline}
                    onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  />
                  <div style={labelStyle}>Cost (₹)</div>
                  <input
                    style={inputStyle}
                    type="number"
                    value={projectForm.cost}
                    onChange={e => setProjectForm({ ...projectForm, cost: e.target.value })}
                  />
                  <div style={labelStyle}>Status</div>
                  <select
                    style={inputStyle}
                    value={projectForm.status}
                    onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <div style={labelStyle}>File / asset links</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 40 }}
                    value={projectForm.file_links}
                    onChange={e => setProjectForm({ ...projectForm, file_links: e.target.value })}
                    placeholder="Drive links, folder locations, etc."
                  />
                  <div style={labelStyle}>Notes</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 60 }}
                    value={projectForm.notes}
                    onChange={e => setProjectForm({ ...projectForm, notes: e.target.value })}
                    placeholder="Changes, feedback, delivery notes…"
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="submit" style={buttonStyle} disabled={savingProject || !selectedClient}>
                      {savingProject
                        ? 'Saving…'
                        : projectForm.id
                        ? 'Update project'
                        : 'Save project'}
                    </button>
                    {projectForm.id && (
                      <button
                        type="button"
                        style={subtleButtonStyle}
                        onClick={() => {
                          const p = projects.find(x => x.id === projectForm.id);
                          if (p) handleDeleteProject(p);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Project list */}
              <div style={{ flex: 1.2, minWidth: 260, maxHeight: 360, overflow: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12
                  }}
                >
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, background: '#111122' }}>
                      <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #333355' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #333355' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #333355' }}>₹</th>
                      <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #333355' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #333355' }}>Deadline</th>
                      <th style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid #333355' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: 8, opacity: 0.7 }}>
                          {selectedClient
                            ? 'No projects match this filter.'
                            : 'Select a client to view projects.'}
                        </td>
                      </tr>
                    )}
                    {filteredProjects.map(p => {
                      const isOverdue =
                        p.deadline &&
                        p.status !== 'paid' &&
                        new Date(p.deadline) < new Date();
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: '1px solid #26264a',
                            background: isOverdue ? 'rgba(255,60,90,0.12)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: 6 }}>{p.name}</td>
                          <td style={{ padding: 6 }}>{p.type || '-'}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{(p.cost || 0).toFixed(0)}</td>
                          <td style={{ padding: 6 }}>
                            <span style={statusBadgeStyle(p.status)}>{p.status}</span>
                          </td>
                          <td style={{ padding: 6 }}>{p.deadline ? formatDate(p.deadline) : '-'}</td>
                          <td style={{ padding: 6, textAlign: 'center' }}>
                            <button
                              style={{ ...subtleButtonStyle, padding: '2px 8px', fontSize: 11 }}
                              onClick={() => startEditProject(p)}
                            >
                              Edit
                            </button>{' '}
                            <button
                              style={{ ...subtleButtonStyle, padding: '2px 8px', fontSize: 11 }}
                              onClick={() => handleDeleteProject(p)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
