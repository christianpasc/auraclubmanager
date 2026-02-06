
import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle,
  AlertCircle,
  Timer,
  Trophy,
  Loader2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line
} from 'recharts';
import StatCard from '../components/StatCard';
import { useTenant } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dashboardService, DashboardStats, UpcomingGame, FinancialFlowData } from '../services/dashboardService';
import { Training } from '../services/trainingService';

const Dashboard: React.FC = () => {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGame[]>([]);
  const [nextTraining, setNextTraining] = useState<Training | null>(null);
  const [financialData, setFinancialData] = useState<FinancialFlowData[]>([]);
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  const getGameTypeLabel = (type?: string) => {
    switch (type) {
      case 'league': return t('competitions.type.league');
      case 'cup': return t('competitions.type.cup');
      case 'tournament': return t('competitions.type.tournament');
      case 'friendly': return t('competitions.type.friendly');
      default: return t('games.game');
    }
  };

  const getGameTypeColor = (type?: string) => {
    switch (type) {
      case 'league': return 'bg-blue-50 text-blue-600';
      case 'cup': return 'bg-amber-50 text-amber-600';
      case 'tournament': return 'bg-purple-50 text-purple-600';
      case 'friendly': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  useEffect(() => {
    if (currentTenant) {
      loadDashboardData();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (currentTenant) {
      loadFinancialData();
    }
  }, [currentTenant, chartView]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, gamesData, trainingData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getUpcomingGames(3),
        dashboardService.getNextTraining(),
      ]);

      setStats(statsData);
      setUpcomingGames(gamesData);
      setNextTraining(trainingData);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        console.log('Dashboard data fetch aborted');
        return;
      }
      console.error('Error loading dashboard data:', err);
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
      console.error('Error loading financial data:', err);
    }
  };

  const formatTrainingDate = (training: Training) => {
    if (!training.training_date) return '';
    const date = new Date(training.training_date + 'T00:00:00');
    const locale = language === 'en-US' ? 'en-US' : language === 'es-ES' ? 'es-ES' : 'pt-BR';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  const formatTrainingTime = (training: Training) => {
    if (!training.training_time) return '';
    return training.training_time.substring(0, 5);
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
        <button
          onClick={loadDashboardData}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  const enrollmentPercentage = stats && stats.totalAthletes > 0
    ? Math.round((stats.activeEnrollments / stats.totalAthletes) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t('dashboard.totalAthletes')}
          value={stats?.totalAthletes.toLocaleString(language) || '0'}
          subValue={t('common.registered')}
          icon={Users}
          iconColor="bg-blue-50 text-blue-600"
        />
        <StatCard
          label={t('dashboard.activeEnrollments')}
          value={stats?.activeEnrollments.toLocaleString(language) || '0'}
          subValue={`${enrollmentPercentage}% ${t('common.ofTotal')}`}
          icon={CheckCircle}
          iconColor="bg-green-50 text-green-600"
        />
        <StatCard
          label={t('dashboard.pendingFees')}
          value={(stats?.pendingFeesCount || 0) + (stats?.overdueFeesCount || 0)}
          subValue={stats?.overdueFeesCount ? `${stats.overdueFeesCount} ${t('monthlyFees.overdue')}` : t('common.comingSoon')}
          icon={AlertCircle}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatCard
          label={t('dashboard.nextTraining')}
          value={nextTraining ? formatTrainingDate(nextTraining) : '—'}
          subValue={nextTraining ? `${formatTrainingTime(nextTraining)} • ${nextTraining.category || t('common.general')}` : t('common.comingSoon')}
          icon={Timer}
          iconColor="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-800">{t('dashboard.financialFlow')}</h3>
              <p className="text-xs text-slate-500">{t('dashboard.revenueVsExpenses')}</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setChartView('weekly')}
                className={`px-3 py-1 text-xs font-semibold ${chartView === 'weekly' ? 'bg-white text-primary rounded shadow-sm' : 'text-slate-600'}`}
              >
                {t('dashboard.weekly')}
              </button>
              <button
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs font-semibold ${chartView === 'monthly' ? 'bg-white text-primary rounded shadow-sm' : 'text-slate-600'}`}
              >
                {t('dashboard.monthly')}
              </button>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Line type="monotone" dataKey="expenses" stroke="#64748B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next Matches Sidebar */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">{t('dashboard.upcomingGames')}</h3>
            <a href="#/games" className="text-xs font-semibold text-primary hover:underline">{t('common.seeAll')}</a>
          </div>

          <div className="space-y-6">
            {upcomingGames.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('dashboard.noGamesScheduled')}</p>
              </div>
            ) : (
              upcomingGames.map((game, i) => (
                <div key={game.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-slate-300" />
                    </div>
                    {i < upcomingGames.length - 1 && <div className="w-px h-full bg-slate-100 mt-2"></div>}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-bold text-slate-800">
                      {game.home_team} {t('games.vs')} {game.away_team}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {game.game_date && formatDate(game.game_date)} • {game.venue || t('common.locationTBD')}
                    </p>
                    <span className={`inline-block mt-2 px-2 py-0.5 ${getGameTypeColor(game.competition?.type)} text-[10px] font-bold rounded uppercase`}>
                      {game.competition?.name || getGameTypeLabel(game.competition?.type)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
