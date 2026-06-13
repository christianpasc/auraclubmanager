import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, BarChart2, TrendingUp, Trophy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { performanceStatService, STAT_KEYS } from '../services/performanceStatService';
import { athleteService, Athlete } from '../services/athleteService';
import { gameService, Game } from '../services/competitionService';
import { useLanguage } from '../contexts/LanguageContext';

interface GameRow {
  game_id: string;
  label: string;
  stats: Record<string, number>;
}

const CHART_COLORS = ['#6366f1','#14b8a6','#f59e0b','#ec4899','#22c55e','#ef4444','#3b82f6','#8b5cf6','#f97316','#64748b'];

const StatCard: React.FC<{ label: string; value: number; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <div className="bg-white rounded-xl border border-slate-100 p-4 text-center">
    <p className="text-2xl font-bold" style={{ color: color ?? '#6366f1' }}>{value}</p>
    <p className="text-xs font-medium text-slate-600 mt-1">{label}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const PerformanceDashboard: React.FC = () => {
  const { t }    = useLanguage();
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [athlete,    setAthlete]    = useState<Athlete | null>(null);
  const [aggregate,  setAggregate]  = useState<Record<string, number>>({});
  const [gameRows,   setGameRows]   = useState<GameRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [chartKeys,  setChartKeys]  = useState<string[]>(['goals', 'assists', 'minutes_played']);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [ath, agg, perGame] = await Promise.all([
          athleteService.getById(id),
          performanceStatService.getAthleteAggregate(id),
          performanceStatService.getAthletePerGame(id),
        ]);
        setAthlete(ath);
        setAggregate(agg);

        if (perGame.length > 0) {
          // Fetch game labels
          const gameIds = perGame.map(r => r.game_id);
          const gamesData: Game[] = [];
          for (const gid of gameIds) {
            try {
              const g = await gameService.getById(gid);
              gamesData.push(g);
            } catch {}
          }
          const gMap: Record<string, Game> = {};
          gamesData.forEach(g => { if (g.id) gMap[g.id] = g; });

          const rows: GameRow[] = perGame.map(r => {
            const g = gMap[r.game_id];
            const label = g
              ? `${new Date(g.game_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${g.away_team ?? ''}`
              : r.game_id.slice(0, 8);
            return { game_id: r.game_id, label, stats: r.stats };
          });
          setGameRows(rows);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [id]);

  const chartData = gameRows.map(r => ({
    name: r.label,
    ...Object.fromEntries(chartKeys.map(k => [k, r.stats[k] ?? 0])),
  }));

  const keyLabel = (key: string) => STAT_KEYS.find(s => s.key === key)?.label ?? key;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>;
  }

  if (!athlete) {
    return <div className="text-center py-20 text-slate-400"><p>Atleta não encontrado.</p></div>;
  }

  const hasData = Object.keys(aggregate).length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/athletes/${id}`)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{athlete.full_name}</h1>
          <p className="text-slate-500 text-sm flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5"/> {t('performance.title')}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(`/athletes/${id}/evolution`)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <TrendingUp className="w-4 h-4"/> {t('evolution.button')}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Trophy className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">{t('performance.noStats')}</p>
          <p className="text-sm mt-1">{t('performance.registerStats')}</p>
        </div>
      ) : (
        <>
          {/* Aggregate cards */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('performance.aggregateTitle')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {STAT_KEYS.map((s, i) => (
                <StatCard
                  key={s.key}
                  label={s.label}
                  value={aggregate[s.key] ?? 0}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </div>
          </div>

          {/* Per-game chart */}
          {gameRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-700">{t('performance.byGameTitle')}</h2>
                <div className="flex flex-wrap gap-2">
                  {STAT_KEYS.map(s => (
                    <button key={s.key}
                      onClick={() => setChartKeys(prev =>
                        prev.includes(s.key) ? prev.filter(k => k !== s.key) : [...prev, s.key]
                      )}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        chartKeys.includes(s.key)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                      {s.short}
                    </button>
                  ))}
                </div>
              </div>

              {chartKeys.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">{t('performance.selectStat')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false}/>
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(value: number, name: string) => [value, keyLabel(name)]}
                    />
                    {chartKeys.length > 1 && <Legend formatter={keyLabel}/>}
                    {chartKeys.map((k, i) => (
                      <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3,3,0,0]} name={k}/>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PerformanceDashboard;
