import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Pencil, Trash2, ClipboardList, Search } from 'lucide-react';
import { assessmentService, Assessment, DIMENSION_COLORS } from '../services/assessmentService';
import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AthleteOption { id: string; full_name: string; }
interface GroupOption   { id: string; name: string; }

const Assessments: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [athletes,    setAthletes]    = useState<AthleteOption[]>([]);
  const [groups,      setGroups]      = useState<GroupOption[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [filterAthlete, setFilterAthlete] = useState('');
  const [filterGroup,   setFilterGroup]   = useState('');
  const [search,        setSearch]        = useState('');

  const load = async () => {
    setLoading(true);
    const tenantId = getCurrentTenantIdSync();
    const [a, athletesRes, groupsRes] = await Promise.all([
      assessmentService.getAll(),
      supabase.from('athletes').select('id, full_name').eq('tenant_id', tenantId!).order('full_name'),
      supabase.from('groups').select('id, name').eq('tenant_id', tenantId!).order('name'),
    ]);
    setAssessments(a);
    setAthletes((athletesRes.data ?? []) as AthleteOption[]);
    setGroups((groupsRes.data ?? []) as GroupOption[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteAssessment = async (id: string) => {
    if (!window.confirm('Remover esta avaliação?')) return;
    await assessmentService.delete(id);
    setAssessments(prev => prev.filter(a => a.id !== id));
  };

  const filtered = assessments.filter(a => {
    if (filterAthlete && a.athlete_id !== filterAthlete) return false;
    if (filterGroup   && a.group_id   !== filterGroup)   return false;
    if (search && !a.athlete?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('assessments.list.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('assessments.list.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/assessment-templates')}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            {t('assessments.templatesButton')}
          </button>
          <button onClick={() => navigate('/assessments/new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4"/> {t('assessments.newButton')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('assessments.search')}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-48"/>
        </div>
        <select value={filterAthlete} onChange={e => setFilterAthlete(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('plans.allAthletes')}</option>
          {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">Todas turmas</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <ClipboardList className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">{assessments.length === 0 ? t('assessments.empty') : t('common.noResults')}</p>
          {assessments.length === 0 && (
            <button onClick={() => navigate('/assessments/new')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              {t('assessments.createFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">{t('common.athlete')}</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">{t('common.date')}</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">{t('assessments.coach')}</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">{t('common.notes')}</th>
                <th className="px-5 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {a.athlete?.photo_url ? (
                        <img src={a.athlete.photo_url} alt="" className="w-8 h-8 rounded-full object-cover"/>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {a.athlete?.full_name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span className="font-medium text-slate-800 text-sm">{a.athlete?.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden sm:table-cell">{fmtDate(a.assessed_at)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500 hidden md:table-cell">{a.coach?.full_name ?? '—'}</td>
                  <td className="px-5 py-4 text-sm text-slate-400 hidden lg:table-cell truncate max-w-[200px]">{a.notes ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/assessments/${a.id}`)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600">
                        <Pencil className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => deleteAssessment(a.id!)}
                        className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {filtered.length} avaliação{filtered.length !== 1 ? 'ões' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default Assessments;
