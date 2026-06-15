
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, AlertCircle, Timer, Trophy, Loader2,
  TrendingUp, ShoppingBag, ClipboardList, MoreVertical,
  CheckCircle, XCircle, Clock, DollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  dashboardService, DashboardStats, UpcomingGame, FinancialFlowData,
  AssessmentSummary, AthleteStatusItem, InvitationGameSummary,
} from '../services/dashboardService';
import { Training } from '../services/trainingService';
import { athleteService, Athlete } from '../services/athleteService';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  inactive: '#94a3b8',
  injured: '#f59e0b',
  suspended: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  injured: 'Lesionado',
  suspended: 'Suspenso',
};

const DIMENSION_COLORS: Record<string, string> = {
  technical: '#3b82f6',
  tactical: '#8b5cf6',
  physical: '#22c55e',
  psychological: '#f59e0b',
};

const safeCall = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch(() => def);

const Dashboard: React.FC = () => {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { t, language } = useLanguage();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([]);
  const [recentGames, setRecentGames] = useState<UpcomingGame[]>([]);
  const [nextTraining, setNextTraining] = useState<Training | null>(null);
  const [financialData, setFinancialData] = useState<FinancialFlowData[]>([]);
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentSummary>({ recentCount: 0, avgByDimension: [] });
  const [pendingOrders, setPendingOrders] = useState(0);
  const [athleteStatus, setAthleteStatus] = useState<AthleteStatusItem[]>([]);
  const [invitationSummary, setInvitationSummary] = useState<InvitationGameSummary[]>([]);
  const [recentAthletes, setRecentAthletes] = useState<Athlete[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short' });

  const formatCurrency = (v: number) =>
    'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const getGameTypeColor = (type?: string) => {
    switch (type) {
      case 'league': return 'bg-blue-50 text-blue-600';
      case 'cup': return 'bg-amber-50 text-amber-600';
      case 'tournament': return 'bg-purple-50 text-purple-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getGameResult = (game: UpcomingGame): 'win' | 'loss' | 'draw' | null => {
    if (game.home_score == null || game.away_score == null) return null;
    const ours = game.is_home_game ? game.home_score : game.away_score;
    const opp = game.is_home_game ? game.away_score : game.home_score;
    if (ours > opp) return 'win';
    if (ours < opp) return 'loss';
    return 'draw';
  };

  useEffect(() => {
    if (currentTenant) loadAll();
  }, [currentTenant]);

  useEffect(() => {
    if (currentTenant) loadFinancialData();
  }, [currentTenant, chartView]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        statsData, gamesData, recentGamesData, trainingData,
        assessmentData, ordersCount, statusData, invData, athletesData,
      ] = await Promise.all([
        dashboardService.getStats(),
        safeCall(dashboardService.getUpcomingGames(3), []),
        safeCall(dashboardService.getRecentGameResults(3), []),
        safeCall(dashboardService.getNextTraining(), null),
        safeCall(dashboardService.getAssessmentSummary(), { recentCount: 0, avgByDimension: [] }),
        safeCall(dashboardService.getStorePendingOrders(), 0),
        safeCall(dashboardService.getAthleteStatusDistribution(), []),
        safeCall(dashboardService.getInvitationSummary(), []),
        safeCall(athleteService.getRecent(5), []),
      ]);
      setStats(statsData);
      setUpcomingGames(gamesData);
      setRecentGames(recentGamesData);
      setNextTraining(trainingData);
      setAssessmentSummary(assessmentData);
      setPendingOrders(ordersCount);
      setAthleteStatus(statusData);
      setInvitationSummary(invData);
      setRecentAthletes(athletesData);
    } catch (err: any) {
      console.error(err);
      setError(t('dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async () => {
    try {
      const data = await dashboardService.getFinancialFlowData(chartView);
      setFinancialData(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>{error}</p>
        <button onClick={loadAll} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  const monthRevenue = financialData.length > 0 ? financialData[financialData.length - 1].revenue : 0;
  const pieData = athleteStatus.map(s => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#64748b',
  }));

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  const formatRegistrationDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getAthleteStatusVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'neutral';
      case 'injured': return 'warning';
      case 'suspended': return 'error';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label={t('dashboard.totalAthletes')}
          value={stats?.totalAthletes.toLocaleString(locale) || '0'}
          subValue={t('common.registered')}
          icon={Users}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label={t('dashboard.monthRevenue')}
          value={formatCurrency(monthRevenue)}
          subValue={t('dashboard.monthly')}
          icon={DollarSign}
          iconColor="bg-green-50 text-green-600"
        />
        <StatCard
          label={t('dashboard.pendingFees')}
          value={(stats?.pendingFeesCount || 0) + (stats?.overdueFeesCount || 0)}
          subValue={stats?.overdueFeesCount ? `${stats.overdueFeesCount} vencidas` : t('common.comingSoon')}
          icon={AlertCircle}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatCard
          label={t('dashboard.assessments30d')}
          value={assessmentSummary.recentCount}
          subValue={t('common.registered')}
          icon={ClipboardList}
          iconColor="bg-purple-50 text-purple-600"
        />
        <StatCard
          label={t('dashboard.pendingOrders')}
          value={pendingOrders}
          subValue="aguardando"
          icon={ShoppingBag}
          iconColor="bg-orange-50 text-orange-600"
        />
      </div>

      {/* ── Row 2: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Financial Flow */}
        <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-800">{t('dashboard.financialFlow')}</h3>
              <p className="text-xs text-slate-500">{t('dashboard.revenueVsExpenses')}</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setChartView('weekly')}
                className={`px-3 py-1 text-xs font-semibold rounded ${chartView === 'weekly' ? 'bg-white text-primary shadow-sm' : 'text-slate-600'}`}>
                {t('dashboard.weekly')}
              </button>
              <button onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs font-semibold rounded ${chartView === 'monthly' ? 'bg-white text-primary shadow-sm' : 'text-slate-600'}`}>
                {t('dashboard.monthly')}
              </button>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Receita" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#64748B" strokeWidth={2} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Athlete Status Distribution */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">{t('dashboard.athleteStatus')}</h3>
          <p className="text-xs text-slate-500 mb-4">{stats?.totalAthletes || 0} atletas</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
              <Users className="w-8 h-8" />
            </div>
          ) : (
            <>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, name: string) => [v, name]} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600">{item.name}</span>
                    </span>
                    <span className="font-semibold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Invitation Rate */}
        <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">{t('dashboard.invitationRate')}</h3>
          <p className="text-xs text-slate-500 mb-4">últimos jogos</p>
          {invitationSummary.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300 text-sm text-center gap-2">
              <Trophy className="w-8 h-8" />
              <span>{t('dashboard.noInvitations')}</span>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invitationSummary} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="gameLabel" width={90} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                  <Bar dataKey="accepted" name="Aceitos" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="declined" name="Recusados" stackId="a" fill="#ef4444" />
                  <Bar dataKey="pending" name="Pendentes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Upcoming Games + Recent Results + Next Training ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Upcoming Games */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">{t('dashboard.upcomingGames')}</h3>
            <a href="#/games" className="text-xs font-semibold text-primary hover:underline">{t('common.seeAll')}</a>
          </div>
          {upcomingGames.length === 0 ? (
            <div className="text-center py-8 text-slate-300">
              <Trophy className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">{t('dashboard.noGamesScheduled')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingGames.map(game => (
                <div key={game.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{game.home_team} × {game.away_team}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {game.game_date && formatDate(game.game_date)}
                      {game.venue ? ` • ${game.venue}` : ''}
                    </p>
                    {game.competition && (
                      <span className={`inline-block mt-1 px-1.5 py-0.5 ${getGameTypeColor(game.competition.type)} text-[10px] font-bold rounded uppercase`}>
                        {game.competition.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Results */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">{t('dashboard.recentResults')}</h3>
            <a href="#/games" className="text-xs font-semibold text-primary hover:underline">{t('common.seeAll')}</a>
          </div>
          {recentGames.length === 0 ? (
            <div className="text-center py-8 text-slate-300">
              <Trophy className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">{t('dashboard.noResults')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentGames.map(game => {
                const result = getGameResult(game);
                const resultConfig = {
                  win:  { label: t('dashboard.win'),  cls: 'bg-green-50 text-green-700' },
                  loss: { label: t('dashboard.loss'), cls: 'bg-red-50 text-red-700' },
                  draw: { label: t('dashboard.draw'), cls: 'bg-slate-100 text-slate-600' },
                };
                const rc = result ? resultConfig[result] : null;
                return (
                  <div key={game.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {game.home_team} × {game.away_team}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {game.game_date && formatDate(game.game_date)}
                        {game.competition && ` • ${game.competition.name}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        {game.home_score} – {game.away_score}
                      </p>
                      {rc && (
                        <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${rc.cls}`}>
                          {rc.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Next Training */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">{t('dashboard.nextTraining')}</h3>
          {!nextTraining ? (
            <div className="text-center py-8 text-slate-300">
              <Timer className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">{t('common.comingSoon')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
                  <Timer className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {nextTraining.training_date && formatDate(nextTraining.training_date)}
                  </p>
                  {nextTraining.training_time && (
                    <p className="text-sm text-slate-500 mt-0.5">
                      {nextTraining.training_time.substring(0, 5)}
                      {nextTraining.end_time ? ` – ${nextTraining.end_time.substring(0, 5)}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {nextTraining.category && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Categoria</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{nextTraining.category}</span>
                </div>
              )}
              {nextTraining.location && (
                <p className="text-xs text-slate-500">{nextTraining.location}</p>
              )}
              {nextTraining.focus && (
                <p className="text-xs text-slate-400 italic">{nextTraining.focus}</p>
              )}
              {nextTraining.intensity && (
                <div className="mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    nextTraining.intensity === 'high' ? 'bg-red-50 text-red-600' :
                    nextTraining.intensity === 'medium' ? 'bg-amber-50 text-amber-600' :
                    'bg-green-50 text-green-600'
                  }`}>
                    {nextTraining.intensity === 'high' ? 'Alta' : nextTraining.intensity === 'medium' ? 'Média' : 'Baixa'} intensidade
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Dimension Averages + Recent Athletes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Averages by Dimension */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-800">{t('dashboard.dimensionAvg')}</h3>
              <p className="text-xs text-slate-500">escala 0–10, todas as avaliações</p>
            </div>
            <Link to="/assessments" className="text-xs font-semibold text-primary hover:underline">
              {t('common.seeAll')}
            </Link>
          </div>
          {assessmentSummary.avgByDimension.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-slate-300 text-sm text-center gap-2">
              <ClipboardList className="w-8 h-8" />
              <span>{t('dashboard.noAssessments')}</span>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assessmentSummary.avgByDimension} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${v}/10`, 'Média']} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 12 }} />
                  <Bar dataKey="avg" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: '#475569', formatter: (v: any) => `${v}` }}>
                    {assessmentSummary.avgByDimension.map((entry, i) => (
                      <Cell key={i} fill={DIMENSION_COLORS[entry.dimension] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Athletes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">{t('dashboard.lastAthletes')}</h3>
            <Link to="/athletes" className="text-xs font-semibold text-primary hover:underline">
              {t('common.seeAll')}
            </Link>
          </div>
          {recentAthletes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <Users className="w-8 h-8 mb-2" />
              <p className="text-sm">{t('athletes.noAthletes')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentAthletes.map(athlete => (
                <div key={athlete.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/50 transition-colors">
                  {athlete.photo_url ? (
                    <img src={athlete.photo_url} alt={athlete.full_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">{getInitials(athlete.full_name)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link to={`/athletes/${athlete.id}`} className="text-sm font-medium text-slate-800 hover:text-primary truncate block">
                      {athlete.full_name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {athlete.category || '—'} • {formatRegistrationDate(athlete.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={athlete.status || '—'} variant={getAthleteStatusVariant(athlete.status)} />
                  <Link to={`/athletes/${athlete.id}`} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
