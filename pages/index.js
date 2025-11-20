import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { supabase } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/lib/useSupabaseAuth';

const WORK_STATUSES = ['not_started', 'editing', 'review', 'delivered', 'archived'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];

const containerStyle = {
  display: 'flex',
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, #fbe9d4 0, #f7f0e5 40%, #f3e7d8 100%)',
  color: '#2b2116',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const sidebarStyle = {
  width: 280,
  borderRight: '1px solid rgba(210,182,130,0.7)',
  padding: 18,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  background: 'rgba(250,242,230,0.9)',
  backdropFilter: 'blur(6px)'
};

const mainStyle = {
  flex: 1,
  padding: 18,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const cardStyle = {
  background: '#fffaf2',
  borderRadius: 14,
  padding: '12px 14px',
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
  boxShadow: '0 8px 18px rgba(173, 126, 54, 0.35)'
};

const subtleButtonStyle = {
  ...buttonStyle,
  background: 'rgba(255,255,255,0.7)',
  color: '#7b5523',
  boxShadow: 'none',
  border: '1px solid rgba(210,182,130,0.9)'
};

const dangerButtonStyle = {
  ...subtleButtonStyle,
  color: '#8a1b1b',
  border: '1px solid rgba(196,72,60,0.7)',
  background: 'rgba(255,238,236,0.9)'
};

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  marginBottom: 8,
  borderRadius: 9,
  border: '1px solid rgba(191,161,110,0.9)',
  background: '#fffdf7',
  color: '#2b2116',
  fontSize: 13,
  boxSizing: 'border-box'
};

const labelStyle = { fontSize: 11, opacity: 0.8, marginBottom: 2 };

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
    work_status: 'not_started',
    payment_status: 'unpaid',
    advance: '',
    file_links: '',
    notes: ''
  });

  const [projects, setProjects] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchClient, setSearchClient] = useState('');
  const [globalStats, setGlobalStats] = useState({ total: 0, received: 0, pending: 0 });

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/login');
    }
  }, [authLoading, session, router]);

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
      .select('cost, advance, payment_status');

    if (error) {
      console.error('Failed to load global stats', error);
      return;
    }
    let total = 0;
    let received = 0;
    let pending = 0;
    (data || []).forEach(p => {
      const { cost, received: rcvd, pending: pend } = calcAmounts(p);
      total += cost;
      received += rcvd;
      pending += pend;
    });
    setGlobalStats({ total, received, pending });
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
      work_status: 'not_started',
      payment_status: 'unpaid',
      advance: '',
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
      work_status: p.work_status || 'not_started',
      payment_status: p.payment_status || 'unpaid',
      advance: p.advance != null ? String(p.advance) : '',
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
      work_status: projectForm.work_status || 'not_started',
      payment_status: projectForm.payment_status || 'unpaid',
      advance: projectForm.advance ? Number(projectForm.advance) : 0,
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
    let total = 0;
    let received = 0;
    let pending = 0;
    projects.forEach(p => {
      const amounts = calcAmounts(p);
      total += amounts.cost;
      received += amounts.received;
      pending += amounts.pending;
    });
    return { total, received, pending };
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
    return projects.filter(p => {
      const statusOk = statusFilter === 'all' || p.work_status === statusFilter;
      const payOk = paymentFilter === 'all' || p.payment_status === paymentFilter;
      return statusOk && payOk;
    });
  }, [projects, statusFilter, paymentFilter]);

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    return projects
      .filter(p => p.deadline && p.payment_status !== 'paid')
      .map(p => ({ ...p, deadlineDate: new Date(p.deadline) }))
      .filter(p => !Number.isNaN(p.deadlineDate.getTime()) && p.deadlineDate >= today)
      .sort((a, b) => a.deadlineDate - b.deadlineDate)
      .slice(0, 3);
  }, [projects]);

  function workBadgeStyle(status) {
    let bg = 'rgba(240,200,140,0.4)';
    if (status === 'editing') bg = 'rgba(247,210,140,0.6)';
    if (status === 'review') bg = 'rgba(183,196,115,0.5)';
    if (status === 'delivered') bg = 'rgba(186,214,153,0.6)';
    if (status === 'archived') bg = 'rgba(210,210,210,0.6)';
    return {
      padding: '2px 9px',
      borderRadius: 999,
      fontSize: 11,
      textTransform: 'capitalize',
      background: bg
    };
  }

  function paymentBadgeStyle(status) {
    let bg = 'rgba(255,230,180,0.6)';
    if (status === 'unpaid') bg = 'rgba(255,210,196,0.7)';
    if (status === 'partial') bg = 'rgba(255,233,180,0.9)';
    if (status === 'paid') bg = 'rgba(188,225,174,0.95)';
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

    const rows = filteredProjects.map(p => {
      const { cost, advance, received, pending } = calcAmounts(p);
      return [
        p.name,
        p.type || '',
        cost.toString(),
        advance.toString(),
        received.toString(),
        pending.toString(),
        p.work_status || '',
        p.payment_status || '',
        p.deadline ? formatDate(p.deadline) : ''
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Project', 'Type', 'Budget', 'Advance', 'Received', 'Pending', 'Work', 'Payment', 'Deadline']],
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
        <div>
          <div style={{ fontSize: 20, fontWeight: 650 }}>Subh Stories</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Studio CRM · Admin</div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.78 }}>
          Logged in as <span style={{ fontWeight: 500 }}>{userEmail}</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...inputStyle, marginBottom: 0, fontSize: 12 }}
            placeholder="Search clients…"
            value={searchClient}
            onChange={e => setSearchClient(e.target.value)}
          />
          <button
            type="button"
            style={{ ...buttonStyle, padding: '6px 10px', fontSize: 12 }}
            onClick={startCreateClient}
          >
            + New
          </button>
        </div>

        <div style={{ ...softCardStyle, flex: 1, overflowY: 'auto' }}>
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
                marginBottom: 4,
                border:
                  selectedClientId === c.id
                    ? '1px solid rgba(210,182,130,0.95)'
                    : '1px solid transparent',
                background:
                  selectedClientId === c.id
                    ? 'rgba(248,231,201,0.9)'
                    : 'transparent'
              }}
            >
              <div style={{ fontWeight: 500 }}>{c.name}</div>
              {(c.email || c.phone) && (
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {c.email || c.phone}
                </div>
              )}
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
        {/* TOP ROW: Global + client summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Total studio budget</div>
            <div style={{ fontSize: 22, fontWeight: 650, marginTop: 4 }}>
              ₹{globalStats.total.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              Received:{' '}
              <span style={{ color: '#4f7c2a', fontWeight: 600 }}>
                ₹{globalStats.received.toFixed(0)}
              </span>{' '}
              · Pending:{' '}
              <span style={{ color: '#b06020', fontWeight: 600 }}>
                ₹{globalStats.pending.toFixed(0)}
              </span>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Current client</div>
            {selectedClient ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                  {selectedClient.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                  {selectedClient.email || selectedClient.phone || 'No contact info yet'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
                  Budget / payments
                </div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  Total: <strong>₹{stats.total.toFixed(0)}</strong>
                </div>
                <div style={{ fontSize: 12 }}>
                  Received:{' '}
                  <span style={{ color: '#4f7c2a', fontWeight: 600 }}>
                    ₹{stats.received.toFixed(0)}
                  </span>{' '}
                  · Pending:{' '}
                  <span style={{ color: '#b06020', fontWeight: 600 }}>
                    ₹{stats.pending.toFixed(0)}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Select a client from the left or create a new one.
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Upcoming deadlines</div>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                No upcoming deadlines for this client.
              </div>
            ) : (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {upcomingDeadlines.map(p => (
                  <div key={p.id} style={{ fontSize: 12 }}>
                    <span>{p.name}</span>
                    <span style={{ opacity: 0.7 }}> · {formatDate(p.deadline)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECOND ROW: Client form + Projects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(320px, 1.3fr)', gap: 12 }}>
          {/* Client form */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {clientForm.id ? 'Edit client' : 'New client'}
              </div>
              {clientForm.id && (
                <span style={{ fontSize: 11, opacity: 0.6 }}>ID: {clientForm.id}</span>
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
                    style={dangerButtonStyle}
                    onClick={handleDeleteClient}
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Projects */}
          <section style={cardStyle}>
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

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, opacity: 0.8 }}>Work:</span>
                {['all', ...WORK_STATUSES].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      borderRadius: 999,
                      border: 'none',
                      padding: '3px 9px',
                      fontSize: 11,
                      cursor: 'pointer',
                      background:
                        statusFilter === s ? 'rgba(212,168,95,0.3)' : 'rgba(255,255,255,0.7)',
                      color: '#5c3b18'
                    }}
                  >
                    {s === 'all' ? 'All' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, opacity: 0.8 }}>Payment:</span>
                {['all', ...PAYMENT_STATUSES].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPaymentFilter(s)}
                    style={{
                      borderRadius: 999,
                      border: 'none',
                      padding: '3px 9px',
                      fontSize: 11,
                      cursor: 'pointer',
                      background:
                        paymentFilter === s ? 'rgba(212,168,95,0.3)' : 'rgba(255,255,255,0.7)',
                      color: '#5c3b18'
                    }}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 0.9fr) minmax(260px, 1.1fr)', gap: 12 }}>
              {/* Project form */}
              <div style={softCardStyle}>
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Deadline</div>
                      <input
                        style={inputStyle}
                        type="date"
                        value={projectForm.deadline}
                        onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Budget (₹)</div>
                      <input
                        style={inputStyle}
                        type="number"
                        value={projectForm.cost}
                        onChange={e => setProjectForm({ ...projectForm, cost: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Advance (₹)</div>
                      <input
                        style={inputStyle}
                        type="number"
                        value={projectForm.advance}
                        onChange={e => setProjectForm({ ...projectForm, advance: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Payment status</div>
                      <select
                        style={inputStyle}
                        value={projectForm.payment_status}
                        onChange={e => setProjectForm({ ...projectForm, payment_status: e.target.value })}
                      >
                        {PAYMENT_STATUSES.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Work status</div>
                    <select
                      style={inputStyle}
                      value={projectForm.work_status}
                      onChange={e => setProjectForm({ ...projectForm, work_status: e.target.value })}
                    >
                      {WORK_STATUSES.map(s => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={labelStyle}>File / asset links</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 40 }}
                    value={projectForm.file_links}
                    onChange={e => setProjectForm({ ...projectForm, file_links: e.target.value })}
                    placeholder="Drive links, folder locations, etc."
                  />
                  <div style={labelStyle}>Notes</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 50 }}
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
                        style={dangerButtonStyle}
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

              {/* Project table */}
              <div style={softCardStyle}>
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 12
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e3d2b0' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e3d2b0' }}>₹</th>
                        <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e3d2b0' }}>Work</th>
                        <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e3d2b0' }}>Payment</th>
                        <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #e3d2b0' }}>Due</th>
                        <th style={{ textAlign: 'center', padding: 6, borderBottom: '1px solid #e3d2b0' }}>Actions</th>
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
                        const { cost, received, pending } = calcAmounts(p);
                        const overdue =
                          p.deadline &&
                          p.payment_status !== 'paid' &&
                          new Date(p.deadline) < new Date();
                        return (
                          <tr
                            key={p.id}
                            style={{
                              borderBottom: '1px solid #f0e0c3',
                              background: overdue ? 'rgba(255,224,210,0.6)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: 6 }}>
                              <div style={{ fontWeight: 500 }}>{p.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.7 }}>
                                {p.type || '-'}
                              </div>
                            </td>
                            <td style={{ padding: 6 }}>
                              <div style={{ fontSize: 12 }}>₹{cost.toFixed(0)}</div>
                              <div style={{ fontSize: 11, opacity: 0.7 }}>
                                Rec: ₹{received.toFixed(0)}
                              </div>
                            </td>
                            <td style={{ padding: 6 }}>
                              <span style={workBadgeStyle(p.work_status || 'not_started')}>
                                {(p.work_status || 'not_started').replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ padding: 6 }}>
                              <span style={paymentBadgeStyle(p.payment_status || 'unpaid')}>
                                {p.payment_status || 'unpaid'}
                              </span>
                            </td>
                            <td style={{ padding: 6 }}>
                              <div style={{ fontSize: 12 }}>
                                ₹{pending.toFixed(0)}
                              </div>
                              <div style={{ fontSize: 11, opacity: 0.7 }}>
                                {p.deadline ? formatDate(p.deadline) : '-'}
                              </div>
                            </td>
                            <td style={{ padding: 6, textAlign: 'center' }}>
                              <button
                                type="button"
                                style={{ ...subtleButtonStyle, padding: '2px 8px', fontSize: 11 }}
                                onClick={() => startEditProject(p)}
                              >
                                Edit
                              </button>{' '}
                              <button
                                type="button"
                                style={{ ...dangerButtonStyle, padding: '2px 8px', fontSize: 11 }}
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
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
