import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Pencil, Trash2, Loader2, X, Star,
  Package, TrendingUp, ExternalLink, Save,
} from 'lucide-react';
import {
  sponsorService, Sponsor, SponsorshipPackage, SponsorshipSale,
  SPONSOR_CATEGORIES, SALE_STATUS_LABELS, SALE_STATUS_CLASSES,
} from '../services/sponsorService';

type Tab = 'sponsors' | 'packages' | 'sales';

const FMT = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

// ── Sponsor Modal ─────────────────────────────────────────────────────────────
interface SponsorModalProps {
  initial?: Partial<Sponsor>;
  onSave: (s: Partial<Sponsor>) => Promise<void>;
  onClose: () => void;
}
const SponsorModal: React.FC<SponsorModalProps> = ({ initial = {}, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', logo_url: '', website_url: '', description: '', category: '', sort_order: '0', is_active: true, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        website_url: form.website_url.trim() || null,
        description: form.description.trim() || null,
        category: form.category || null,
        sort_order: parseInt(form.sort_order as any) || 0,
        is_active: form.is_active,
      });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial.id ? 'Editar Patrocinador' : 'Novo Patrocinador'} onClose={onClose}>
      <div className="space-y-3 p-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome da empresa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Sem categoria</option>
              {SPONSOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
            <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">URL do Logo</label>
          <input value={form.logo_url} onChange={e => set('logo_url', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
          <input value={form.website_url} onChange={e => set('website_url', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => set('is_active', !form.is_active)}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${form.is_active ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-slate-600">{form.is_active ? 'Ativo (visível no site)' : 'Inativo'}</span>
        </div>
        {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
      </div>
      <ModalFooter onClose={onClose} onSave={submit} saving={saving} />
    </ModalShell>
  );
};

// ── Package Modal ─────────────────────────────────────────────────────────────
interface PackageModalProps {
  initial?: Partial<SponsorshipPackage>;
  onSave: (p: Partial<SponsorshipPackage>) => Promise<void>;
  onClose: () => void;
}
const PackageModal: React.FC<PackageModalProps> = ({ initial = {}, onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', description: '', price: '', benefits: '', is_active: true, ...initial, price: initial.price != null ? String(initial.price) : '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório.'); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: form.price ? parseFloat(form.price) : null,
        benefits: form.benefits.trim() || null,
        is_active: form.is_active,
      });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial.id ? 'Editar Cota' : 'Nova Cota'} onClose={onClose}>
      <div className="space-y-3 p-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nome <span className="text-rose-500">*</span></label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ex: Cota Ouro" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$)</label>
          <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0,00" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Benefícios</label>
          <textarea value={form.benefits} onChange={e => set('benefits', e.target.value)} rows={3} className="input resize-none" placeholder="Lista de benefícios incluídos..." />
        </div>
        {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
      </div>
      <ModalFooter onClose={onClose} onSave={submit} saving={saving} />
    </ModalShell>
  );
};

// ── Sale Modal ────────────────────────────────────────────────────────────────
interface SaleModalProps {
  sponsors: Sponsor[];
  packages: SponsorshipPackage[];
  initial?: Partial<SponsorshipSale>;
  onSave: (s: Partial<SponsorshipSale>) => Promise<void>;
  onClose: () => void;
}
const SaleModal: React.FC<SaleModalProps> = ({ sponsors, packages, initial = {}, onSave, onClose }) => {
  const [form, setForm] = useState({
    sponsor_id: initial.sponsor_id || '',
    package_id: initial.package_id || '',
    amount: initial.amount != null ? String(initial.amount) : '',
    start_date: initial.start_date || '',
    end_date: initial.end_date || '',
    status: initial.status || 'active',
    notes: initial.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const autoFillPrice = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    if (pkg?.price) set('amount', String(pkg.price));
    set('package_id', packageId);
  };

  const submit = async () => {
    if (!form.sponsor_id) { setErr('Selecione um patrocinador.'); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setErr('Valor inválido.'); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({
        sponsor_id: form.sponsor_id,
        package_id: form.package_id || null,
        amount,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status as SponsorshipSale['status'],
        notes: form.notes.trim() || null,
      });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <ModalShell title={initial.id ? 'Editar Contrato' : 'Novo Contrato'} onClose={onClose}>
      <div className="space-y-3 p-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Patrocinador <span className="text-rose-500">*</span></label>
          <select value={form.sponsor_id} onChange={e => set('sponsor_id', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Selecionar...</option>
            {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cota (opcional)</label>
            <select value={form.package_id} onChange={e => autoFillPrice(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Personalizado</option>
              {packages.map(p => <option key={p.id} value={p.id}>{p.name}{p.price ? ` (${FMT(p.price)})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$) <span className="text-rose-500">*</span></label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Início</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fim</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            {Object.entries(SALE_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input resize-none" />
        </div>
        {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
      </div>
      <ModalFooter onClose={onClose} onSave={submit} saving={saving} />
    </ModalShell>
  );
};

// ── Shared modal shell & footer ───────────────────────────────────────────────
const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

const ModalFooter: React.FC<{ onClose: () => void; onSave: () => void; saving: boolean }> = ({ onClose, onSave, saving }) => (
  <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
    <button onClick={onSave} disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Salvar
    </button>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const SponsorManager: React.FC = () => {
  const [tab, setTab] = useState<Tab>('sponsors');
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [packages, setPackages] = useState<SponsorshipPackage[]>([]);
  const [sales, setSales] = useState<SponsorshipSale[]>([]);
  const [loading, setLoading] = useState(true);

  const [sponsorModal, setSponsorModal] = useState<Partial<Sponsor> | null>(null);
  const [packageModal, setPackageModal] = useState<Partial<SponsorshipPackage> | null>(null);
  const [saleModal, setSaleModal] = useState<Partial<SponsorshipSale> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, p, sl] = await Promise.all([
      sponsorService.getAll(),
      sponsorService.getPackages(),
      sponsorService.getSales(),
    ]);
    setSponsors(s); setPackages(p); setSales(sl);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Sponsors CRUD ---
  const saveSponsor = async (data: Partial<Sponsor>) => {
    if (sponsorModal?.id) {
      const updated = await sponsorService.update(sponsorModal.id, data);
      setSponsors(prev => prev.map(s => s.id === updated.id ? updated : s));
    } else {
      const created = await sponsorService.create(data as Omit<Sponsor, 'id' | 'created_at' | 'updated_at'>);
      setSponsors(prev => [...prev, created]);
    }
    setSponsorModal(null);
  };

  const deleteSponsor = async (id: string) => {
    if (!window.confirm('Remover patrocinador? Os contratos vinculados também serão removidos.')) return;
    await sponsorService.delete(id);
    setSponsors(prev => prev.filter(s => s.id !== id));
    setSales(prev => prev.filter(s => s.sponsor_id !== id));
  };

  // --- Packages CRUD ---
  const savePackage = async (data: Partial<SponsorshipPackage>) => {
    if (packageModal?.id) {
      await sponsorService.updatePackage(packageModal.id, data);
      setPackages(prev => prev.map(p => p.id === packageModal.id ? { ...p, ...data } : p));
    } else {
      const created = await sponsorService.createPackage(data as Omit<SponsorshipPackage, 'id' | 'created_at' | 'updated_at'>);
      setPackages(prev => [...prev, created]);
    }
    setPackageModal(null);
  };

  const deletePackage = async (id: string) => {
    if (!window.confirm('Remover cota?')) return;
    await sponsorService.deletePackage(id);
    setPackages(prev => prev.filter(p => p.id !== id));
  };

  // --- Sales CRUD ---
  const saveSale = async (data: Partial<SponsorshipSale>) => {
    if (saleModal?.id) {
      await sponsorService.updateSale(saleModal.id, data);
      setSales(prev => prev.map(s => s.id === saleModal.id ? { ...s, ...data } : s));
    } else {
      const created = await sponsorService.createSale(data as Omit<SponsorshipSale, 'id' | 'created_at' | 'updated_at' | 'sponsor' | 'package'>);
      setSales(prev => [created, ...prev]);
      await load(); // reload to get joined data
    }
    setSaleModal(null);
  };

  const deleteSale = async (id: string) => {
    if (!window.confirm('Remover contrato?')) return;
    await sponsorService.deleteSale(id);
    setSales(prev => prev.filter(s => s.id !== id));
  };

  const totalRevenue = sales.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.amount || 0), 0);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'sponsors', label: 'Patrocinadores', icon: <Building2 className="w-4 h-4" /> },
    { key: 'packages', label: 'Cotas', icon: <Package className="w-4 h-4" /> },
    { key: 'sales', label: 'Contratos', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patrocínios</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie patrocinadores, cotas e contratos.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-slate-400">Ativos</p>
            <p className="text-lg font-bold text-slate-800">{sponsors.filter(s => s.is_active).length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-slate-400">Receita ativa</p>
            <p className="text-lg font-bold text-emerald-600">{FMT(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (tab === 'sponsors') setSponsorModal({});
            else if (tab === 'packages') setPackageModal({});
            else setSaleModal({});
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" />
          {tab === 'sponsors' ? 'Novo Patrocinador' : tab === 'packages' ? 'Nova Cota' : 'Novo Contrato'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : (
        <>
          {/* Sponsors Tab */}
          {tab === 'sponsors' && (
            sponsors.length === 0 ? (
              <Empty icon={<Building2 className="w-10 h-10 opacity-30" />} msg="Nenhum patrocinador cadastrado" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sponsors.map(s => (
                  <div key={s.id} className={`bg-white rounded-xl border ${s.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'} p-5`}>
                    <div className="flex items-start gap-3 mb-3">
                      {s.logo_url
                        ? <img src={s.logo_url} alt={s.name} className="w-12 h-12 rounded-lg object-contain bg-slate-50 border border-slate-100" />
                        : <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-bold">{s.name[0]}</div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{s.name}</p>
                        {s.category && (
                          <span className="inline-block mt-0.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Star className="w-2.5 h-2.5 inline mr-1" />{s.category}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.description && <p className="text-sm text-slate-500 line-clamp-2 mb-3">{s.description}</p>}
                    <div className="flex items-center justify-between">
                      {s.website_url
                        ? <a href={s.website_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
                            <ExternalLink className="w-3 h-3" /> Site
                          </a>
                        : <span />}
                      <div className="flex gap-1">
                        <button onClick={() => setSponsorModal(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSponsor(s.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Packages Tab */}
          {tab === 'packages' && (
            packages.length === 0 ? (
              <Empty icon={<Package className="w-10 h-10 opacity-30" />} msg="Nenhuma cota de patrocínio cadastrada" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setPackageModal(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deletePackage(p.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {p.price != null && <p className="text-xl font-bold text-indigo-600 mb-2">{FMT(p.price)}<span className="text-sm text-slate-400 font-normal">/ano</span></p>}
                    {p.description && <p className="text-sm text-slate-500 mb-2">{p.description}</p>}
                    {p.benefits && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 whitespace-pre-line">{p.benefits}</div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Sales Tab */}
          {tab === 'sales' && (
            sales.length === 0 ? (
              <Empty icon={<TrendingUp className="w-10 h-10 opacity-30" />} msg="Nenhum contrato de patrocínio registrado" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Patrocinador</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Cota</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Valor</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Vigência</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(s => {
                      const sp = s.sponsor as Sponsor | undefined;
                      const pkg = s.package as SponsorshipPackage | undefined;
                      return (
                        <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {sp?.logo_url
                                ? <img src={sp.logo_url} alt={sp.name} className="w-6 h-6 rounded object-contain" />
                                : <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">{sp?.name?.[0]}</div>}
                              <span className="font-medium text-slate-800">{sp?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{pkg?.name || <span className="text-slate-300 italic">Personalizado</span>}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{FMT(s.amount)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {s.start_date ? new Date(s.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                            {s.end_date && ` → ${new Date(s.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SALE_STATUS_CLASSES[s.status || 'active']}`}>
                              {SALE_STATUS_LABELS[s.status || 'active']}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => setSaleModal(s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteSale(s.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* Modals */}
      {sponsorModal !== null && (
        <SponsorModal initial={sponsorModal} onSave={saveSponsor} onClose={() => setSponsorModal(null)} />
      )}
      {packageModal !== null && (
        <PackageModal initial={packageModal} onSave={savePackage} onClose={() => setPackageModal(null)} />
      )}
      {saleModal !== null && (
        <SaleModal sponsors={sponsors} packages={packages} initial={saleModal} onSave={saveSale} onClose={() => setSaleModal(null)} />
      )}
    </div>
  );
};

const Empty: React.FC<{ icon: React.ReactNode; msg: string }> = ({ icon, msg }) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
    {icon}
    <p className="font-medium mt-3">{msg}</p>
  </div>
);


export default SponsorManager;
