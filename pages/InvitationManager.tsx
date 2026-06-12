import React, { useEffect, useState, useCallback } from 'react';
import {
  Mail, Plus, Trash2, Copy, Send, CheckCircle2, XCircle, Clock,
  Loader2, Upload, ChevronDown, X, Users
} from 'lucide-react';
import { invitationService, Invitation } from '../services/invitationService';
import { gameService, Game } from '../services/competitionService';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'declined';
type ModalTab = 'single' | 'csv';

interface FormState {
  name: string;
  email: string;
  phone: string;
  game_id: string;
  event_title: string;
  event_date: string;
  message: string;
  expires_at: string;
}

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', game_id: '',
  event_title: '', event_date: '', message: '', expires_at: '',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando',
  accepted: 'Confirmado',
  declined: 'Recusado',
};

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'accepted') return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (status === 'declined') return <XCircle className="w-3.5 h-3.5" />;
  return <Clock className="w-3.5 h-3.5" />;
};

function parseCSV(text: string): { name: string; email: string; phone: string }[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const results: { name: string; email: string; phone: string }[] = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const name = cols[0] || '';
    const email = cols[1] || '';
    const phone = cols[2] || '';
    if (name && (email || phone)) results.push({ name, email, phone });
  }
  return results;
}

const InvitationManager: React.FC = () => {
  const { currentTenant } = useTenant();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gameFilter, setGameFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('single');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [csvText, setCsvText] = useState('');
  const [csvParsed, setCsvParsed] = useState<{ name: string; email: string; phone: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sending, setSending] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, gs] = await Promise.all([invitationService.getAll(), gameService.getAll()]);
      setInvitations(invs);
      setGames(gs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invitations.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (gameFilter && inv.game_id !== gameFilter) return false;
    return true;
  });

  const gameLabel = (g: Game) =>
    `${g.home_team || '?'} × ${g.away_team || '?'}${g.game_date ? ` (${new Date(g.game_date + 'T00:00:00').toLocaleDateString('pt-BR')})` : ''}`;

  const inviteUrl = (token: string) => `${window.location.origin}/#/invite/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendEmail = async (inv: Invitation) => {
    if (!inv.id || !inv.email || sending.has(inv.id)) return;
    setSending(prev => new Set(prev).add(inv.id!));
    await supabase.functions.invoke('send-invitations', {
      body: { invitationIds: [inv.id], baseUrl: window.location.origin },
    });
    setSending(prev => { const s = new Set(prev); s.delete(inv.id!); return s; });
  };

  const sendAll = async () => {
    const withEmail = filtered.filter(inv => inv.email && inv.id && inv.status === 'pending');
    if (!withEmail.length) return;
    const ids = withEmail.map(inv => inv.id!);
    ids.forEach(id => setSending(prev => new Set(prev).add(id)));
    await supabase.functions.invoke('send-invitations', {
      body: { invitationIds: ids, baseUrl: window.location.origin },
    });
    ids.forEach(id => setSending(prev => { const s = new Set(prev); s.delete(id); return s; }));
  };

  const deleteInv = async (id: string) => {
    if (!window.confirm('Remover este convite?')) return;
    setDeleting(id);
    await invitationService.delete(id);
    setInvitations(prev => prev.filter(i => i.id !== id));
    setDeleting(null);
  };

  const handleGameSelect = (gameId: string) => {
    const g = games.find(g => g.id === gameId);
    setForm(f => ({
      ...f,
      game_id: gameId,
      event_title: g ? `${g.home_team || '?'} × ${g.away_team || '?'}` : f.event_title,
      event_date: g?.game_date ? `${g.game_date}T${g.game_time || '00:00'}` : f.event_date,
    }));
  };

  const handleSaveSingle = async () => {
    if (!form.name.trim()) { setSaveError('Nome é obrigatório.'); return; }
    if (!form.email.trim() && !form.phone.trim()) { setSaveError('Informe email ou telefone.'); return; }
    setSaving(true); setSaveError(null);
    try {
      const inv = await invitationService.create({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        game_id: form.game_id || null,
        event_title: form.event_title.trim() || null,
        event_date: form.event_date || null,
        message: form.message.trim() || null,
        expires_at: form.expires_at || null,
        club_name: currentTenant?.name || null,
        status: 'pending',
      });
      setInvitations(prev => [inv, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleParseCSV = () => {
    const rows = parseCSV(csvText);
    setCsvParsed(rows);
  };

  const handleSaveCSV = async () => {
    if (!csvParsed.length) return;
    setSaving(true); setSaveError(null);
    try {
      const rows = csvParsed.map(r => ({
        name: r.name,
        email: r.email || null,
        phone: r.phone || null,
        game_id: form.game_id || null,
        event_title: form.event_title.trim() || null,
        event_date: form.event_date || null,
        message: form.message.trim() || null,
        expires_at: form.expires_at || null,
        club_name: currentTenant?.name || null,
        status: 'pending' as const,
      }));
      const created = await invitationService.createMany(rows);
      setInvitations(prev => [...created, ...prev]);
      setShowModal(false);
      setCsvText(''); setCsvParsed([]);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pendingWithEmail = filtered.filter(i => i.status === 'pending' && i.email).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Convites</h1>
          <p className="text-slate-500 text-sm mt-0.5">Convide pessoas para jogos e eventos sem necessidade de cadastro.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingWithEmail > 0 && (
            <button
              onClick={sendAll}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              Enviar todos ({pendingWithEmail})
            </button>
          )}
          <button
            onClick={() => { setShowModal(true); setModalTab('single'); setForm(EMPTY_FORM); setSaveError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Convite
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'pending', 'accepted', 'declined'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {games.length > 0 && (
          <select
            value={gameFilter}
            onChange={e => setGameFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
          >
            <option value="">Todos os jogos</option>
            {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'accepted', 'declined'] as const).map(s => {
          const count = invitations.filter(i => i.status === s).length;
          return (
            <div key={s} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[s]} mb-2`}>
                <StatusIcon status={s} />
                {STATUS_LABELS[s]}
              </div>
              <p className="text-2xl font-bold text-slate-800">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-3 opacity-40" />
            <p className="font-medium">Nenhum convite encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Convite" para começar.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Contato</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Evento</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Respondido</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{inv.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {inv.email && <div className="truncate max-w-[160px]">{inv.email}</div>}
                    {inv.phone && <div className="text-xs text-slate-400">{inv.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {inv.event_title && <div className="truncate max-w-[160px]">{inv.event_title}</div>}
                    {inv.event_date && (
                      <div className="text-xs text-slate-400">
                        {new Date(inv.event_date).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[inv.status || 'pending']}`}>
                      <StatusIcon status={inv.status || 'pending'} />
                      {STATUS_LABELS[inv.status || 'pending']}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {inv.responded_at ? new Date(inv.responded_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {inv.token && (
                        <button
                          onClick={() => copyLink(inv.token!)}
                          title="Copiar link do convite"
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {copied === inv.token
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                      {inv.email && inv.status === 'pending' && (
                        <button
                          onClick={() => sendEmail(inv)}
                          disabled={sending.has(inv.id!)}
                          title="Enviar email"
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                        >
                          {sending.has(inv.id!)
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Mail className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => deleteInv(inv.id!)}
                        disabled={deleting === inv.id}
                        title="Remover"
                        className="p-1.5 rounded-md hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40"
                      >
                        {deleting === inv.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Novo Convite</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mx-6 mt-4 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setModalTab('single')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modalTab === 'single' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                Individual
              </button>
              <button
                onClick={() => setModalTab('csv')}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${modalTab === 'csv' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                <Upload className="w-3.5 h-3.5 inline mr-1" />
                CSV / Lista
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Common fields: game/event */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Jogo (opcional)</label>
                <select
                  value={form.game_id}
                  onChange={e => handleGameSelect(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Nenhum (evento livre)</option>
                  {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título do evento</label>
                  <input
                    value={form.event_title}
                    onChange={e => setForm(f => ({ ...f, event_title: e.target.value }))}
                    placeholder="ex: Treino coletivo"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data / hora</label>
                  <input
                    type="datetime-local"
                    value={form.event_date}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensagem pessoal (opcional)</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={2}
                  placeholder="Qualquer mensagem adicional..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expira em (opcional)</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Single tab */}
              {modalTab === 'single' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nome completo"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Telefone</label>
                      <input
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="11999999999"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CSV tab */}
              {modalTab === 'csv' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Cole a lista (nome, email, telefone)
                    </label>
                    <textarea
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                      rows={6}
                      placeholder={"João Silva,joao@email.com,11999999999\nMaria Santos,maria@email.com,\nPedro Lima,,21988888888"}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono resize-none"
                    />
                    <button
                      onClick={handleParseCSV}
                      className="mt-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                    >
                      Analisar ({csvText.trim().split('\n').filter(l => l.trim()).length} linhas)
                    </button>
                  </div>
                  {csvParsed.length > 0 && (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200">
                        {csvParsed.length} pessoa{csvParsed.length !== 1 ? 's' : ''} encontrada{csvParsed.length !== 1 ? 's' : ''}
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {csvParsed.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-slate-100 last:border-0">
                            <span className="font-medium text-slate-700 w-28 truncate">{r.name}</span>
                            <span className="text-slate-400 truncate">{r.email || r.phone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {saveError && (
                <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{saveError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={modalTab === 'single' ? handleSaveSingle : handleSaveCSV}
                disabled={saving || (modalTab === 'csv' && csvParsed.length === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {modalTab === 'csv' ? `Criar ${csvParsed.length} convites` : 'Criar convite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationManager;
