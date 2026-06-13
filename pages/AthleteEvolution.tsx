import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, TrendingUp, ClipboardList,
  Plus, Pencil, Trash2, X, Save,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { evolutionService, PerformanceReview, DimensionSeries } from '../services/evolutionService';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteInfo { id: string; full_name: string; photo_url?: string | null; }

// Merges multiple series into [{date, Technical: 7.2, Physical: 6.0, ...}] for Recharts
function buildChartData(series: DimensionSeries[]): Record<string, string | number>[] {
  const allDates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].sort();
  return allDates.map(date => {
    const row: Record<string, string | number> = { date: fmtDate(date) };
    for (const s of series) {
      const pt = s.points.find(p => p.date === date);
      if (pt) row[s.label] = pt.avg;
    }
    return row;
  });
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
function fmtPeriod(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// ── Review Modal ──────────────────────────────────────────────────────────────
interface ReviewModalProps {
  initial: Partial<PerformanceReview>;
  athleteId: string;
  onSave: (r: PerformanceReview) => void;
  onClose: () => void;
}
const ReviewModal: React.FC<ReviewModalProps> = ({ initial, athleteId, onSave, onClose }) => {
  const { t } = useLanguage();
  const [periodStart,   setPeriodStart]   = useState(initial.period_start ?? '');
  const [periodEnd,     setPeriodEnd]     = useState(initial.period_end ?? '');
  const [summary,       setSummary]       = useState(initial.summary ?? '');
  const [strengths,     setStrengths]     = useState(initial.strengths ?? '');
  const [improvements,  setImprovements]  = useState(initial.improvements ?? '');
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState<string | null>(null);

  const submit = async () => {
    if (!periodStart || !periodEnd) { setErr('Defina o período da revisão.'); return; }
    if (periodEnd < periodStart)    { setErr('Data de término deve ser após o início.'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = { athlete_id: athleteId, period_start: periodStart, period_end: periodEnd,
        summary: summary.trim() || null, strengths: strengths.trim() || null, improvements: improvements.trim() || null };
      const result = initial.id
        ? await evolutionService.updateReview(initial.id, payload)
        : await evolutionService.createReview(payload);
      onSave(result);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? t('evolution.modal.editTitle') : t('evolution.modal.newTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('evolution.periodStart')}</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('evolution.periodEnd')}</label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('evolution.summary')}</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              placeholder="Avaliação geral do período..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('evolution.strengths')}</label>
            <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2}
              placeholder="O que o atleta faz bem..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('evolution.improvements')}</label>
            <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2}
              placeholder="O que precisa desenvolver..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t('common.cancel')}</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const AthleteEvolution: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [loading,   setLoading]   = useState(true);
  const [athlete,   setAthlete]   = useState<AthleteInfo | null>(null);
  const [series,    setSeries]    = useState<DimensionSeries[]>([]);
  const [reviews,   setReviews]   = useState<PerformanceReview[]>([]);
  const [tab,       setTab]       = useState<'chart' | 'reviews'>('chart');
  const [modal,     setModal]     = useState<Partial<PerformanceReview> | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [athleteRes, { series: s }, rev] = await Promise.all([
        supabase.from('athletes').select('id, full_name, photo_url').eq('id', id).single(),
        evolutionService.getProgressData(id),
        evolutionService.getReviews(id),
      ]);
      setAthlete(athleteRes.data as AthleteInfo);
      setSeries(s);
      setReviews(rev);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSaveReview = (r: PerformanceReview) => {
    setReviews(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
      return [r, ...prev];
    });
    setModal(null);
  };

  const deleteReview = async (reviewId: string) => {
    if (!window.confirm('Remover esta revisão?')) return;
    await evolutionService.deleteReview(reviewId);
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  };

  const chartData = buildChartData(series);
  const hasData   = series.length > 0 && chartData.length > 0;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500"/>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/athletes/${id}`)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt="" className="w-10 h-10 rounded-full object-cover"/>
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            {athlete?.full_name?.charAt(0) ?? '?'}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-800">{athlete?.full_name}</h1>
          <p className="text-sm text-slate-500">{t('evolution.title')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([['chart', t('evolution.tab.chart')], ['reviews', t('evolution.tab.reviews')]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {k === 'chart' ? <TrendingUp className="w-4 h-4"/> : <ClipboardList className="w-4 h-4"/>}
            {l}
          </button>
        ))}
      </div>

      {/* ── Chart Tab ── */}
      {tab === 'chart' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <TrendingUp className="w-12 h-12 mb-3 opacity-30"/>
              <p className="font-medium">{t('evolution.noData')}</p>
              <p className="text-sm mt-1">{t('evolution.noDataAction')}</p>
              <button onClick={() => navigate('/assessments/new')}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                {t('assessments.create')}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-600 mb-4">{t('evolution.chart.label')}</h2>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [`${value}/10`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }}/>
                  {series.map(s => (
                    <Line
                      key={s.dimension}
                      type="monotone"
                      dataKey={s.label}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 4, fill: s.color }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Dimension summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {series.map(s => {
                  const last = s.points[s.points.length - 1];
                  const prev = s.points[s.points.length - 2];
                  const delta = last && prev ? last.avg - prev.avg : null;
                  return (
                    <div key={s.dimension} className="rounded-xl p-3 border" style={{ borderColor: s.color + '40', backgroundColor: s.color + '10' }}>
                      <p className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{last?.avg ?? '—'}</p>
                      {delta !== null && (
                        <p className={`text-xs mt-0.5 ${delta >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
                          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} {t('evolution.chart.previous')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Reviews Tab ── */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setModal({ athlete_id: id })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus className="w-4 h-4"/> {t('evolution.newReview')}
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
              <ClipboardList className="w-12 h-12 mb-3 opacity-30"/>
              <p className="font-medium">{t('evolution.reviews.empty')}</p>
            </div>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {fmtPeriod(r.period_start)} – {fmtPeriod(r.period_end)}
                    </p>
                    {r.coach?.full_name && <p className="text-xs text-slate-400 mt-0.5">por {r.coach.full_name}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setModal(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteReview(r.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                {r.summary && <p className="text-sm text-slate-600 mb-3">{r.summary}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {r.strengths && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">{t('evolution.strengths')}</p>
                      <p className="text-sm text-green-800 whitespace-pre-line">{r.strengths}</p>
                    </div>
                  )}
                  {r.improvements && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">{t('evolution.improvements')}</p>
                      <p className="text-sm text-amber-800 whitespace-pre-line">{r.improvements}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modal !== null && (
        <ReviewModal
          initial={modal}
          athleteId={id!}
          onSave={handleSaveReview}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default AthleteEvolution;
