import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { clubSiteService, ClubSite, Post } from '../services/clubSiteService';
import { supabase } from '../lib/supabase';
import { computeStandings, StandingRow } from '../utils/standings';
import {
  Phone, Mail, Instagram, Facebook, Youtube, Twitter,
  Trophy, Calendar, Loader2, ExternalLink, ChevronRight, ArrowLeft,
} from 'lucide-react';

interface TenantPublic {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
}

interface Competition {
  id: string;
  name: string;
  season: string | null;
  category: string | null;
  status: string;
  type: string | null;
}

interface Game {
  id: string;
  competition_id: string | null;
  home_team: string;
  away_team: string;
  match_date: string | null;
  match_time: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  round: string | null;
  location: string | null;
}

interface CompetitionTeam {
  team_name: string;
  group_name: string | null;
  is_our_club: boolean;
}

interface CompetitionDetail {
  competition: Competition;
  games: Game[];
  teams: CompetitionTeam[];
  standings: StandingRow[];
  groupStandings: Record<string, StandingRow[]>;
}

type ActiveSection = 'home' | 'news' | 'competitions' | 'games';

const PublicSite: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [site, setSite] = useState<ClubSite | null>(null);
  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [sponsors, setSponsors] = useState<{ id: string; name: string; logo_url: string | null; website_url: string | null; category: string | null }[]>([]);

  // Competition detail
  const [selectedComp, setSelectedComp] = useState<CompetitionDetail | null>(null);
  const [compLoading, setCompLoading] = useState(false);

  useEffect(() => {
    if (slug) load(slug);
  }, [slug]);

  const load = async (s: string) => {
    setLoading(true);
    try {
      const result = await clubSiteService.getBySlug(s);
      if (!result) { setNotFound(true); return; }
      setSite(result.site);
      setTenant(result.tenant);

      const [p, compsRes, gamesRes] = await Promise.all([
        clubSiteService.getPostsByTenantId(result.tenant.id),
        supabase.from('competitions').select('id, name, season, category, status, type')
          .eq('tenant_id', result.tenant.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('games').select('id, competition_id, home_team, away_team, match_date, match_time, home_score, away_score, status, round, location')
          .eq('tenant_id', result.tenant.id).order('match_date', { ascending: false }).limit(10),
      ]);

      setPosts(p);
      setCompetitions((compsRes.data || []) as Competition[]);
      setRecentGames((gamesRes.data || []) as Game[]);

      const { data: sponsorsData } = await supabase
        .from('sponsors')
        .select('id, name, logo_url, website_url, category')
        .eq('tenant_id', result.tenant.id)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      setSponsors(sponsorsData || []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const loadCompetitionDetail = useCallback(async (comp: Competition) => {
    setCompLoading(true);
    setSelectedComp(null);
    try {
      const [gamesRes, teamsRes] = await Promise.all([
        supabase.from('games')
          .select('id, competition_id, home_team, away_team, match_date, match_time, home_score, away_score, status, round, location')
          .eq('competition_id', comp.id)
          .order('match_date', { ascending: false }),
        supabase.from('competition_teams')
          .select('team_name, group_name, is_our_club')
          .eq('competition_id', comp.id),
      ]);

      const games = (gamesRes.data || []) as Game[];
      const teams = (teamsRes.data || []) as CompetitionTeam[];
      const teamNames = teams.map(t => t.team_name);

      const hasGroups = teams.some(t => t.group_name);
      let standings: StandingRow[] = [];
      let groupStandings: Record<string, StandingRow[]> = {};

      if (hasGroups) {
        const groupMap: Record<string, string[]> = {};
        for (const t of teams) {
          const g = t.group_name || 'Geral';
          if (!groupMap[g]) groupMap[g] = [];
          groupMap[g].push(t.team_name);
        }
        for (const [grp, grpTeams] of Object.entries(groupMap)) {
          const grpGames = games.filter(g => grpTeams.includes(g.home_team) && grpTeams.includes(g.away_team));
          groupStandings[grp] = computeStandings(grpTeams, grpGames);
        }
      } else {
        standings = computeStandings(teamNames, games);
      }

      setSelectedComp({ competition: comp, games, teams, standings, groupStandings });
    } finally {
      setCompLoading(false);
    }
  }, []);

  // ── Loading / Not Found ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (notFound || !site || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-500">
        <Trophy className="w-16 h-16 mb-4 text-slate-300" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Site não encontrado</h1>
        <p className="text-sm">O clube com este endereço não possui site público.</p>
      </div>
    );
  }

  const primary = site.primary_color || tenant.primary_color || '#1a56db';
  const secondary = site.secondary_color || '#1e3a8a';

  const fmtDate = (d: string | null, time?: string | null) => {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    return time ? `${date} • ${time}` : date;
  };

  const fmtScore = (g: Game) => g.home_score !== null ? `${g.home_score} × ${g.away_score}` : 'vs';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':  return 'bg-green-100 text-green-700';
      case 'finished': return 'bg-slate-100 text-slate-600';
      default:         return 'bg-blue-100 text-blue-700';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ongoing':  return 'Em andamento';
      case 'finished': return 'Finalizado';
      default:         return 'Em breve';
    }
  };

  const navLinks: { id: ActiveSection; label: string }[] = [
    { id: 'home', label: 'Início' },
    ...(site.show_competitions && competitions.length > 0 ? [{ id: 'competitions' as ActiveSection, label: 'Competições' }] : []),
    ...(site.show_games && recentGames.length > 0 ? [{ id: 'games' as ActiveSection, label: 'Jogos' }] : []),
    ...(posts.length > 0 ? [{ id: 'news' as ActiveSection, label: 'Notícias' }] : []),
  ];

  // ── Standings table component ────────────────────────────────────────────────

  const StandingsTable: React.FC<{ rows: StandingRow[]; ourClubNames: Set<string> }> = ({ rows, ourClubNames }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
            <th className="text-left py-2 pl-2 w-6">#</th>
            <th className="text-left py-2 pl-3">Time</th>
            <th className="text-center py-2 w-8">J</th>
            <th className="text-center py-2 w-8">V</th>
            <th className="text-center py-2 w-8">E</th>
            <th className="text-center py-2 w-8">D</th>
            <th className="text-center py-2 w-12">GP</th>
            <th className="text-center py-2 w-12">GC</th>
            <th className="text-center py-2 w-8">SG</th>
            <th className="text-center py-2 w-8 font-black">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isOurs = ourClubNames.has(r.team);
            return (
              <tr key={r.team} className={`border-b border-slate-100 ${isOurs ? 'font-bold' : ''}`}
                style={isOurs ? { background: `${primary}10` } : undefined}>
                <td className="py-2 pl-2 text-slate-400 text-xs">{i + 1}</td>
                <td className="py-2 pl-3">
                  <span style={isOurs ? { color: primary } : undefined}>{r.team}</span>
                </td>
                <td className="text-center py-2 text-slate-600">{r.played}</td>
                <td className="text-center py-2 text-green-600">{r.wins}</td>
                <td className="text-center py-2 text-slate-500">{r.draws}</td>
                <td className="text-center py-2 text-red-500">{r.losses}</td>
                <td className="text-center py-2 text-slate-600">{r.goalsFor}</td>
                <td className="text-center py-2 text-slate-600">{r.goalsAgainst}</td>
                <td className="text-center py-2 text-slate-600">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                <td className="text-center py-2 font-black" style={{ color: primary }}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Game row component ────────────────────────────────────────────────────────

  const GameRow: React.FC<{ g: Game; ourClubNames: Set<string> }> = ({ g, ourClubNames }) => {
    const homeIsOurs = ourClubNames.has(g.home_team);
    const awayIsOurs = ourClubNames.has(g.away_team);
    return (
      <div className="p-4 bg-white rounded-xl border border-slate-200">
        {(g.round || g.location) && (
          <p className="text-xs text-slate-400 mb-2 text-center">{[g.round, g.location].filter(Boolean).join(' · ')}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className={`flex-1 font-semibold text-sm truncate ${homeIsOurs ? 'font-black' : 'text-slate-700'}`}
            style={homeIsOurs ? { color: primary } : undefined}>
            {g.home_team}
          </span>
          <div className="flex-shrink-0 px-4 py-1.5 rounded-xl font-black text-sm"
            style={{ background: `${primary}15`, color: primary }}>
            {fmtScore(g)}
          </div>
          <span className={`flex-1 font-semibold text-sm truncate text-right ${awayIsOurs ? 'font-black' : 'text-slate-700'}`}
            style={awayIsOurs ? { color: primary } : undefined}>
            {g.away_team}
          </span>
        </div>
        <p className="text-xs text-slate-400 text-center mt-1.5">{fmtDate(g.match_date, g.match_time)}</p>
      </div>
    );
  };

  // ── Competition Detail ────────────────────────────────────────────────────────

  const CompetitionDetailView: React.FC = () => {
    const detail = selectedComp;
    if (!detail) return null;
    const { competition, games, teams, standings } = detail;
    const groupStandings: Record<string, StandingRow[]> = detail.groupStandings;
    const ourClubNames = new Set(teams.filter(t => t.is_our_club).map(t => t.team_name));
    const hasGroups = Object.keys(groupStandings).length > 0;
    const hasStandings = hasGroups
      ? Object.values(groupStandings).some((r: StandingRow[]) => r.length > 0)
      : standings.length > 0;
    const finishedGames = games.filter(g => g.status === 'finished');
    const upcomingGames = games.filter(g => g.status !== 'finished').reverse();

    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        {/* Back button */}
        <button onClick={() => setSelectedComp(null)}
          className="flex items-center gap-2 text-sm font-semibold mb-6 hover:opacity-70 transition-opacity"
          style={{ color: primary }}>
          <ArrowLeft className="w-4 h-4" /> Voltar para competições
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800">{competition.name}</h2>
            {(competition.season || competition.category) && (
              <p className="text-slate-500 mt-1">{[competition.season, competition.category].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <span className={`px-3 py-1.5 text-xs font-bold rounded-full flex-shrink-0 ${statusBadge(competition.status)}`}>
            {statusLabel(competition.status)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Standings */}
          {site!.show_standings && hasStandings && (
            <div>
              <h3 className="text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: primary }} /> Classificação
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                {hasGroups ? (
                  <div className="space-y-6">
                    {Object.entries(groupStandings).sort(([a], [b]) => a.localeCompare(b)).map(([group, rows]: [string, StandingRow[]]) => (
                      rows.length > 0 && (
                        <div key={group}>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Grupo {group}</p>
                          <StandingsTable rows={rows} ourClubNames={ourClubNames} />
                        </div>
                      )
                    ))}
                  </div>
                ) : (
                  <StandingsTable rows={standings} ourClubNames={ourClubNames} />
                )}
              </div>
            </div>
          )}

          {/* Games */}
          {site!.show_games && (
            <div className="space-y-6">
              {upcomingGames.length > 0 && (
                <div>
                  <h3 className="text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: primary }} /> Próximos Jogos
                  </h3>
                  <div className="space-y-3">
                    {upcomingGames.slice(0, 5).map(g => (
                      <GameRow key={g.id} g={g} ourClubNames={ourClubNames} />
                    ))}
                  </div>
                </div>
              )}
              {finishedGames.length > 0 && (
                <div>
                  <h3 className="text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: primary }} /> Resultados
                  </h3>
                  <div className="space-y-3">
                    {finishedGames.slice(0, 8).map(g => (
                      <GameRow key={g.id} g={g} ourClubNames={ourClubNames} />
                    ))}
                  </div>
                </div>
              )}
              {games.length === 0 && (
                <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">Nenhum jogo cadastrado.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Navbar ── */}
      <header style={{ background: primary }} className="sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <button onClick={() => { setActiveSection('home'); setSelectedComp(null); }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="text-white font-bold text-lg tracking-tight">{tenant.name}</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <button key={link.id} onClick={() => { setActiveSection(link.id); setSelectedComp(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeSection === link.id ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}>
                {link.label}
              </button>
            ))}
          </nav>

          <a href={`#/site/${slug}/enroll`}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
            style={{ color: primary }}>
            Matricular-se
          </a>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2">
          {navLinks.map(link => (
            <button key={link.id} onClick={() => { setActiveSection(link.id); setSelectedComp(null); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === link.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
              }`}>
              {link.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Competition detail overlay ── */}
      {activeSection === 'competitions' && (compLoading || selectedComp) && (
        compLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} />
          </div>
        ) : (
          <CompetitionDetailView />
        )
      )}

      {/* ── Home ── */}
      {activeSection === 'home' && (
        <>
          {/* Hero */}
          <section className="relative flex flex-col items-center justify-center text-center py-24 px-4"
            style={{
              background: site.hero_image_url
                ? `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)) center/cover, url(${site.hero_image_url}) center/cover`
                : `linear-gradient(135deg, ${primary}, ${secondary})`,
              minHeight: '60vh',
            }}>
            {tenant.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name}
                className="w-24 h-24 rounded-2xl object-cover shadow-2xl mb-6 border-4 border-white/20" />
            )}
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 drop-shadow-lg">{tenant.name}</h1>
            {site.about_text && (
              <p className="text-white/90 text-lg max-w-xl mx-auto mb-8">
                {site.about_text.slice(0, 160)}{site.about_text.length > 160 ? '…' : ''}
              </p>
            )}
            <a href={`#/site/${slug}/enroll`}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white font-bold text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all"
              style={{ color: primary }}>
              Quero me matricular <ChevronRight className="w-4 h-4" />
            </a>
          </section>

          {/* Quick cards */}
          <section className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {site.show_competitions && competitions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl" style={{ background: `${primary}20` }}>
                    <Trophy className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-bold text-slate-800">Competições</h3>
                </div>
                <ul className="space-y-2">
                  {competitions.slice(0, 3).map(c => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <button onClick={() => { setActiveSection('competitions'); loadCompetitionDetail(c); }}
                        className="text-slate-700 font-medium hover:underline text-left"
                        style={{ color: primary }}>
                        {c.name}
                      </button>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ml-2 flex-shrink-0 ${statusBadge(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setActiveSection('competitions')}
                  className="mt-4 text-xs font-semibold flex items-center gap-1" style={{ color: primary }}>
                  Ver todas <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {site.show_games && recentGames.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl" style={{ background: `${primary}20` }}>
                    <Calendar className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-bold text-slate-800">Últimos Jogos</h3>
                </div>
                <ul className="space-y-3">
                  {recentGames.slice(0, 3).map(g => (
                    <li key={g.id} className="text-sm">
                      <div className="flex items-center justify-between font-semibold text-slate-700">
                        <span className="truncate max-w-[90px]">{g.home_team}</span>
                        <span className="px-2 font-black text-xs mx-1 flex-shrink-0" style={{ color: primary }}>{fmtScore(g)}</span>
                        <span className="truncate max-w-[90px] text-right">{g.away_team}</span>
                      </div>
                      <p className="text-slate-400 text-xs text-center mt-0.5">{fmtDate(g.match_date)}</p>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setActiveSection('games')}
                  className="mt-4 text-xs font-semibold flex items-center gap-1" style={{ color: primary }}>
                  Ver todos <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {(site.contact_email || site.contact_phone) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4">Contato</h3>
                <ul className="space-y-3">
                  {site.contact_email && (
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="w-4 h-4 flex-shrink-0" style={{ color: primary }} />
                      <a href={`mailto:${site.contact_email}`} className="hover:underline">{site.contact_email}</a>
                    </li>
                  )}
                  {site.contact_phone && (
                    <li className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4 flex-shrink-0" style={{ color: primary }} />
                      <span>{site.contact_phone}</span>
                    </li>
                  )}
                </ul>
                <div className="flex gap-2 mt-4">
                  {site.social_links.instagram && (
                    <a href={site.social_links.instagram} target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-pink-500 transition-colors">
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {site.social_links.facebook && (
                    <a href={site.social_links.facebook} target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {site.social_links.youtube && (
                    <a href={site.social_links.youtube} target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors">
                      <Youtube className="w-4 h-4" />
                    </a>
                  )}
                  {site.social_links.twitter && (
                    <a href={site.social_links.twitter} target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-sky-500 transition-colors">
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Latest posts */}
          {posts.length > 0 && (
            <section className="max-w-6xl mx-auto px-4 pb-16">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-800">Últimas Notícias</h2>
                <button onClick={() => setActiveSection('news')}
                  className="text-sm font-semibold flex items-center gap-1" style={{ color: primary }}>
                  Ver todas <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {posts.slice(0, 3).map(post => (
                  <article key={post.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {post.cover_image_url && (
                      <img src={post.cover_image_url} alt={post.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-5">
                      <p className="text-xs text-slate-400 mb-2">{post.published_at ? fmtDate(post.published_at.slice(0, 10)) : ''}</p>
                      <h3 className="font-bold text-slate-800 leading-snug mb-2">{post.title}</h3>
                      {post.excerpt && <p className="text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── News ── */}
      {activeSection === 'news' && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-black text-slate-800 mb-8">Notícias</h2>
          {posts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhuma notícia publicada ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <article key={post.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt={post.title} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-5">
                    <p className="text-xs text-slate-400 mb-2">{post.published_at ? fmtDate(post.published_at.slice(0, 10)) : ''}</p>
                    <h3 className="font-bold text-slate-800 leading-snug mb-2">{post.title}</h3>
                    {post.excerpt && <p className="text-sm text-slate-500 mb-3">{post.excerpt}</p>}
                    {post.content && (
                      <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">{post.content}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Competitions list ── */}
      {activeSection === 'competitions' && !compLoading && !selectedComp && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-black text-slate-800 mb-8">Competições</h2>
          {competitions.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhuma competição cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {competitions.map(c => (
                <button key={c.id} onClick={() => loadCompetitionDetail(c)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all flex items-center justify-between group">
                  <div>
                    <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors">{c.name}</h3>
                    {(c.season || c.category) && (
                      <p className="text-sm text-slate-500 mt-0.5">{[c.season, c.category].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusBadge(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Games list ── */}
      {activeSection === 'games' && (
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-black text-slate-800 mb-8">Jogos</h2>
          {recentGames.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum jogo cadastrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentGames.map(g => (
                <GameRow key={g.id} g={g} ourClubNames={new Set()} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Sponsors ── */}
      {sponsors.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-100">
          <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Nossos Patrocinadores</p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            {sponsors.map(s => {
              const inner = s.logo_url
                ? <img src={s.logo_url} alt={s.name} className="h-10 w-auto max-w-[120px] object-contain grayscale hover:grayscale-0 transition-all" />
                : <span className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">{s.name}</span>;
              return s.website_url
                ? <a key={s.id} href={s.website_url} target="_blank" rel="noreferrer" title={s.name}>{inner}</a>
                : <div key={s.id} title={s.name}>{inner}</div>;
            })}
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer style={{ background: secondary }} className="py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-white/70 text-sm">
          <p>© {new Date().getFullYear()} {tenant.name}. Powered by Aura Club Manager.</p>
          <a href="#/" className="mt-2 inline-flex items-center gap-1 text-white/50 hover:text-white/80 text-xs transition-colors">
            <ExternalLink className="w-3 h-3" /> Área administrativa
          </a>
        </div>
      </footer>
    </div>
  );
};

export default PublicSite;
