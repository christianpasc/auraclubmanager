
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Trophy, Calendar, Save, ArrowLeft, Loader2, Plus, Trash2,
    Users, BarChart2, Shuffle, GitBranch, Shield, Layers, Repeat2, FileDown,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    competitionService, gameService, competitionTeamsService,
    Competition, Game, CompetitionTeam,
    competitionTypes, competitionStatuses, gameStatuses,
} from '../services/competitionService';
import { useLanguage } from '../contexts/LanguageContext';
import { useTenant } from '../contexts/TenantContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StandingRow {
    team: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
}

interface Matchup {
    leg1: Partial<Game>;
    leg2?: Partial<Game>;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function generateRoundRobin(teamNames: string[]): Partial<Game>[] {
    const fixtures: Partial<Game>[] = [];
    const teams = teamNames.length % 2 !== 0 ? [...teamNames, 'BYE'] : [...teamNames];
    const n = teams.length;
    const rotating = teams.slice(1);
    for (let r = 0; r < n - 1; r++) {
        const circle = [teams[0], ...rotating];
        for (let i = 0; i < n / 2; i++) {
            const home = circle[i];
            const away = circle[n - 1 - i];
            if (home !== 'BYE' && away !== 'BYE')
                fixtures.push({ round: `Rodada ${r + 1}`, home_team: home, away_team: away, status: 'scheduled' });
        }
        rotating.unshift(rotating.pop()!);
    }
    return fixtures;
}

function generateKnockout(teamNames: string[], format: 4 | 8 | 16, idaEvolta = false): Partial<Game>[] {
    const fixtures: Partial<Game>[] = [];
    const TBD = 'A definir';
    const roundLabels: Record<number, string> = {
        16: 'Oitavas de Final', 8: 'Quartas de Final', 4: 'Semifinal', 2: 'Final',
    };

    const addMatch = (round: string, home: string, away: string, twoLegs = idaEvolta) => {
        if (twoLegs) {
            fixtures.push({ round, home_team: home, away_team: away, status: 'scheduled', notes: 'Ida' });
            fixtures.push({ round, home_team: away, away_team: home, status: 'scheduled', notes: 'Volta' });
        } else {
            fixtures.push({ round, home_team: home, away_team: away, status: 'scheduled' });
        }
    };

    const seeded = [...teamNames];
    while (seeded.length < format) seeded.push(TBD);
    for (let i = 0; i < format / 2; i++)
        addMatch(roundLabels[format], seeded[i], seeded[format - 1 - i]);

    let remaining = format / 2;
    while (remaining >= 2) {
        if (remaining === 2) {
            addMatch('Final', TBD, TBD);
            fixtures.push({ round: '3º Lugar', home_team: TBD, away_team: TBD, status: 'scheduled' });
            break;
        }
        for (let i = 0; i < remaining / 2; i++)
            addMatch(roundLabels[remaining], TBD, TBD);
        remaining = remaining / 2;
    }
    return fixtures;
}

function computeStandings(teamNames: string[], games: Partial<Game>[]): StandingRow[] {
    const rows: Record<string, StandingRow> = {};
    for (const t of teamNames)
        rows[t] = { team: t, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
    for (const g of games) {
        if (g.status !== 'finished' || g.home_score == null || g.away_score == null) continue;
        if (!g.home_team || !g.away_team || g.home_team === 'A definir' || g.away_team === 'A definir') continue;
        const h = g.home_team, a = g.away_team;
        if (!rows[h]) rows[h] = { team: h, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
        if (!rows[a]) rows[a] = { team: a, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
        rows[h].played++; rows[a].played++;
        rows[h].goalsFor += g.home_score; rows[h].goalsAgainst += g.away_score;
        rows[a].goalsFor += g.away_score; rows[a].goalsAgainst += g.home_score;
        if (g.home_score > g.away_score) { rows[h].wins++; rows[h].points += 3; rows[a].losses++; }
        else if (g.home_score < g.away_score) { rows[a].wins++; rows[a].points += 3; rows[h].losses++; }
        else { rows[h].draws++; rows[a].draws++; rows[h].points++; rows[a].points++; }
    }
    return Object.values(rows)
        .map(r => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }))
        .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
}

const KNOCKOUT_ROUNDS = new Set(['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final', '3º Lugar']);
const KNOCKOUT_ORDER = ['Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final', '3º Lugar'];

function isKnockoutRound(round?: string) { return KNOCKOUT_ROUNDS.has(round || ''); }

function getSeedLabel(team: string, gStandings: Record<string, StandingRow[]>): string | null {
    for (const [group, rows] of Object.entries(gStandings)) {
        const idx = rows.findIndex(r => r.team === team);
        if (idx >= 0) return `${idx + 1}º Grp.${group}`;
    }
    return null;
}

function fmtScore(score?: number | null): string {
    return score != null ? String(score) : '-';
}

function fmtDate(date?: string, time?: string): string {
    if (!date) return '';
    const d = new Date(date + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return time ? `${dd}/${mm} ${time}` : `${dd}/${mm}`;
}

function getAggregate(leg1: Partial<Game>, leg2: Partial<Game>): { a: number; b: number } | null {
    if (leg1.home_score == null || leg1.away_score == null ||
        leg2.home_score == null || leg2.away_score == null) return null;
    return { a: leg1.home_score + leg2.away_score, b: leg1.away_score + leg2.home_score };
}

function groupMatchups(roundGames: Partial<Game>[]): Matchup[] {
    const result: Matchup[] = [];
    const used = new Set<number>();
    for (let i = 0; i < roundGames.length; i++) {
        if (used.has(i)) continue;
        const g = roundGames[i];
        if (g.notes === 'Ida') {
            const voltaIdx = roundGames.findIndex((g2, j) =>
                !used.has(j) && j !== i && g2.notes === 'Volta' &&
                g2.home_team === g.away_team && g2.away_team === g.home_team
            );
            if (voltaIdx >= 0) {
                used.add(i); used.add(voltaIdx);
                result.push({ leg1: g, leg2: roundGames[voltaIdx] });
                continue;
            }
        }
        used.add(i);
        result.push({ leg1: g });
    }
    return result;
}

function groupByRound(games: Partial<Game>[]): { round: string; games: Partial<Game>[] }[] {
    const groups: { round: string; games: Partial<Game>[] }[] = [];
    const seen: string[] = [];
    games.forEach(g => {
        const round = g.round || 'Sem Rodada';
        if (!seen.includes(round)) { seen.push(round); groups.push({ round, games: [] }); }
        groups.find(gr => gr.round === round)!.games.push(g);
    });
    return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    const { t } = useLanguage();
    const map: Record<string, { cls: string; key: string }> = {
        finished:    { cls: 'bg-green-100 text-green-700',   key: 'competitionForm.status.fin' },
        in_progress: { cls: 'bg-yellow-100 text-yellow-700', key: 'competitionForm.status.live' },
        scheduled:   { cls: 'bg-slate-100 text-slate-500',   key: 'competitionForm.status.scheduled' },
        postponed:   { cls: 'bg-orange-100 text-orange-600', key: 'competitionForm.status.postponed' },
        cancelled:   { cls: 'bg-red-100 text-red-600',       key: 'competitionForm.status.cancelled' },
    };
    const s = map[status || 'scheduled'] ?? map.scheduled;
    return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${s.cls}`}>{t(s.key)}</span>;
};

const MatchupCard: React.FC<{
    matchup: Matchup;
    gStandings?: Record<string, StandingRow[]>;
    teams: CompetitionTeam[];
}> = ({ matchup, gStandings = {}, teams }) => {
    const { t } = useLanguage();
    const { leg1, leg2 } = matchup;

    const displayTeam = (name?: string) =>
        !name || name === 'A definir' ? t('competitionForm.rounds.tbd') : name;

    const homeLabel = getSeedLabel(leg1.home_team || '', gStandings);
    const awayLabel = getSeedLabel(leg1.away_team || '', gStandings);
    const isOurHome = teams.find(t2 => t2.team_name === leg1.home_team)?.is_our_club;
    const isOurAway = teams.find(t2 => t2.team_name === leg1.away_team)?.is_our_club;

    if (leg2) {
        const agg = getAggregate(leg1, leg2);
        const winner = agg ? (agg.a > agg.b ? leg1.home_team : agg.b > agg.a ? leg1.away_team : null) : null;
        return (
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <div>
                        {homeLabel && <p className="text-xs text-slate-400">{homeLabel}</p>}
                        <p className={`font-bold ${isOurHome ? 'text-primary' : 'text-slate-700'}`}>{displayTeam(leg1.home_team)}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-400 px-2">{t('competitionForm.matchup.vs')}</span>
                    <div className="text-right">
                        {awayLabel && <p className="text-xs text-slate-400">{awayLabel}</p>}
                        <p className={`font-bold ${isOurAway ? 'text-primary' : 'text-slate-700'}`}>{displayTeam(leg1.away_team)}</p>
                    </div>
                </div>
                <div className="space-y-1">
                    {[
                        { label: t('competitionForm.matchup.leg1'), game: leg1 },
                        { label: t('competitionForm.matchup.leg2'), game: leg2 },
                    ].map(({ label, game }) => (
                        <div key={label} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                            <span className="text-slate-400 font-semibold w-14 flex-shrink-0">{label}</span>
                            <span className="flex-1 text-slate-600 truncate">{displayTeam(game.home_team)}</span>
                            <span className="font-bold text-slate-800 mx-1">{fmtScore(game.home_score)} – {fmtScore(game.away_score)}</span>
                            <span className="flex-1 text-right text-slate-600 truncate">{displayTeam(game.away_team)}</span>
                            {game.game_date && <span className="text-slate-400 flex-shrink-0">{fmtDate(game.game_date, game.game_time)}</span>}
                            <StatusBadge status={game.status} />
                        </div>
                    ))}
                </div>
                {agg && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-500 font-semibold">{t('competitionForm.matchup.aggregate')}</span>
                        <span className="font-bold text-slate-800">{agg.a} – {agg.b}</span>
                        {winner
                            ? <span className="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded-full">{displayTeam(winner)} {t('competitionForm.matchup.advances')}</span>
                            : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold rounded-full">{t('competitionForm.matchup.open')}</span>
                        }
                    </div>
                )}
            </div>
        );
    }

    // Single leg
    const finished = leg1.status === 'finished';
    return (
        <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
            <div className="flex-1 text-right">
                {homeLabel && <p className="text-xs text-slate-400">{homeLabel}</p>}
                <p className={`text-sm font-bold ${isOurHome ? 'text-primary' : 'text-slate-700'}`}>{displayTeam(leg1.home_team)}</p>
            </div>
            <div className="flex items-center gap-1 px-2 min-w-[4.5rem] justify-center">
                <span className={`text-lg font-bold ${finished ? 'text-slate-800' : 'text-slate-300'}`}>{fmtScore(leg1.home_score)}</span>
                <span className="text-slate-400 text-sm">×</span>
                <span className={`text-lg font-bold ${finished ? 'text-slate-800' : 'text-slate-300'}`}>{fmtScore(leg1.away_score)}</span>
            </div>
            <div className="flex-1">
                {awayLabel && <p className="text-xs text-slate-400">{awayLabel}</p>}
                <p className={`text-sm font-bold ${isOurAway ? 'text-primary' : 'text-slate-700'}`}>{displayTeam(leg1.away_team)}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <StatusBadge status={leg1.status} />
                {leg1.game_date && <span className="text-xs text-slate-400">{fmtDate(leg1.game_date, leg1.game_time)}</span>}
            </div>
        </div>
    );
};

const StandingsTable: React.FC<{ rows: StandingRow[]; teams: CompetitionTeam[] }> = ({ rows, teams }) => {
    const { t } = useLanguage();
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 w-7">#</th>
                        <th className="text-left py-2 px-3 text-xs font-bold text-slate-500">{t('competitionForm.table.team')}</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-400 text-center">J</th>
                        <th className="py-2 px-2 text-xs font-bold text-green-600 text-center">V</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-400 text-center">E</th>
                        <th className="py-2 px-2 text-xs font-bold text-red-500 text-center">D</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-400 text-center">GP</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-400 text-center">GC</th>
                        <th className="py-2 px-2 text-xs font-bold text-slate-400 text-center">SG</th>
                        <th className="py-2 px-2 text-xs font-bold text-primary text-center">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, pos) => {
                        const isOurClub = teams.find(t2 => t2.team_name === row.team)?.is_our_club;
                        return (
                            <tr key={row.team} className={`border-b border-slate-100 hover:bg-slate-50 ${isOurClub ? 'bg-primary/5' : ''}`}>
                                <td className="py-2 px-3 text-slate-400 text-xs text-center">{pos + 1}</td>
                                <td className="py-2 px-3">
                                    <div className="flex items-center gap-1.5">
                                        {isOurClub && <Shield className="w-3 h-3 text-primary flex-shrink-0" />}
                                        <span className={`font-semibold text-sm ${isOurClub ? 'text-primary' : 'text-slate-700'}`}>{row.team}</span>
                                    </div>
                                </td>
                                <td className="py-2 px-2 text-center text-slate-600 text-sm">{row.played}</td>
                                <td className="py-2 px-2 text-center text-green-600 font-semibold text-sm">{row.wins}</td>
                                <td className="py-2 px-2 text-center text-slate-500 text-sm">{row.draws}</td>
                                <td className="py-2 px-2 text-center text-red-500 text-sm">{row.losses}</td>
                                <td className="py-2 px-2 text-center text-slate-600 text-sm">{row.goalsFor}</td>
                                <td className="py-2 px-2 text-center text-slate-600 text-sm">{row.goalsAgainst}</td>
                                <td className="py-2 px-2 text-center text-slate-600 text-sm">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                <td className="py-2 px-2 text-center font-bold text-slate-800">{row.points}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2 px-3 pb-2">J · V · E · D · GP · GC · SG · Pts</p>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

type TabId = 'info' | 'teams' | 'games' | 'standings';

const CompetitionForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { t } = useLanguage();
    const { currentTenant } = useTenant();

    const [activeTab, setActiveTab] = useState<TabId>('info');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const skipDirtyRef = useRef(0);
    const pendingNavRef = useRef<string | null>(null);

    const [competition, setCompetition] = useState<Partial<Competition>>({ name: '', status: 'upcoming', type: 'league' });
    const [teams, setTeams] = useState<CompetitionTeam[]>([]);
    const [useGroups, setUseGroups] = useState(false);
    const [numGroups, setNumGroups] = useState(4);
    const [games, setGames] = useState<Partial<Game>[]>([]);
    const [knockoutFormat, setKnockoutFormat] = useState<4 | 8 | 16>(8);
    const [qualifiers, setQualifiers] = useState<string[]>([]);
    const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
    const [idaEvolta, setIdaEvolta] = useState(false);

    const categories = ['Sub-7', 'Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-20', 'Profissional'];

    // Translates stored round names (Portuguese in DB) to display language
    const translateRound = (round: string): string => {
        const known: Record<string, string> = {
            'Oitavas de Final': t('competitionForm.rounds.lastSixteen'),
            'Quartas de Final': t('competitionForm.rounds.quarterFinal'),
            'Semifinal': t('competitionForm.rounds.semiFinal'),
            'Final': t('competitionForm.rounds.final'),
            '3º Lugar': t('competitionForm.rounds.thirdPlace'),
        };
        if (known[round]) return known[round];
        const rodadaMatch = round.match(/^Rodada (\d+)$/);
        if (rodadaMatch) return `${t('competitionForm.rounds.round')} ${rodadaMatch[1]}`;
        const groupMatch = round.match(/^Grupo ([A-H]) - Rodada (\d+)$/);
        if (groupMatch) return `${t('competitionForm.rounds.group')} ${groupMatch[1]} - ${t('competitionForm.rounds.round')} ${groupMatch[2]}`;
        return round;
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const groupLetters = useMemo(() => 'ABCDEFGH'.slice(0, numGroups).split(''), [numGroups]);

    const activeGroups = useMemo(() =>
        useGroups
            ? [...new Set(teams.map(t2 => t2.group_name).filter(Boolean) as string[])].sort()
            : [],
    [useGroups, teams]);

    const teamNames = useMemo(() => teams.map(t2 => t2.team_name).filter(Boolean), [teams]);

    const groupStandings = useMemo(() => {
        const result: Record<string, StandingRow[]> = {};
        for (const letter of activeGroups) {
            const gTeams = teams.filter(t2 => t2.group_name === letter).map(t2 => t2.team_name).filter(Boolean);
            const gGames = games.filter(g => gTeams.includes(g.home_team || '') && gTeams.includes(g.away_team || ''));
            result[letter] = computeStandings(gTeams, gGames);
        }
        return result;
    }, [activeGroups, teams, games]);

    const overallStandings = useMemo(() =>
        useGroups ? [] : computeStandings(teamNames, games),
    [useGroups, teamNames, games]);

    const knockoutGames = useMemo(() => games.filter(g => isKnockoutRound(g.round)), [games]);

    const gamesByRound = useMemo(() => {
        const groups: { round: string; entries: { idx: number; game: Partial<Game> }[] }[] = [];
        const seen: string[] = [];
        games.forEach((game, idx) => {
            const round = game.round || 'Sem Rodada';
            if (!seen.includes(round)) { seen.push(round); groups.push({ round, entries: [] }); }
            groups.find(g => g.round === round)!.entries.push({ idx, game });
        });
        return groups;
    }, [games]);

    const numRoundsRR = teamNames.length >= 2 ? (teamNames.length % 2 === 0 ? teamNames.length - 1 : teamNames.length) : 0;
    const numGamesRR = teamNames.length >= 2 ? (teamNames.length * (teamNames.length - 1)) / 2 : 0;

    // ── Load ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (id) { loadCompetition(id); }
        else if (currentTenant) { setTeams([{ team_name: currentTenant.name, is_our_club: true, sort_order: 0 }]); }
    }, [id, currentTenant?.id]);

    const loadCompetition = async (compId: string) => {
        setLoading(true);
        try {
            const [compData, gamesData, teamsData] = await Promise.all([
                competitionService.getById(compId),
                gameService.getByCompetition(compId),
                competitionTeamsService.getByCompetition(compId),
            ]);
            setCompetition(compData);
            setGames(gamesData);
            if (teamsData.length > 0) {
                setTeams(teamsData);
                if (teamsData.some(t2 => t2.group_name)) {
                    setUseGroups(true);
                    const uniqueGroups = new Set(teamsData.map(t2 => t2.group_name).filter(Boolean));
                    setNumGroups(Math.max(uniqueGroups.size, 2));
                }
            } else if (currentTenant) {
                setTeams([{ team_name: currentTenant.name, is_our_club: true, sort_order: 0 }]);
            }
            if (gamesData.some(g => g.notes === 'Ida' || g.notes === 'Volta')) setIdaEvolta(true);
        } catch (err) { setError(t('competitionForm.error.loading')); console.error(err); }
        finally { setLoading(false); skipDirtyRef.current++; }
    };

    // ── Dirty tracking ────────────────────────────────────────────────────────

    useEffect(() => {
        if (skipDirtyRef.current > 0) { skipDirtyRef.current--; return; }
        setIsDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [competition, teams, games]);

    // Warn on tab close / browser refresh
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const safeNavigate = (to: string) => {
        if (isDirty) { pendingNavRef.current = to; setShowUnsavedDialog(true); }
        else navigate(to);
    };

    const confirmLeave = () => { setShowUnsavedDialog(false); navigate(pendingNavRef.current || '/competitions'); };
    const cancelLeave  = () => { setShowUnsavedDialog(false); pendingNavRef.current = null; };

    const updateCompetition = (field: keyof Competition, value: any) =>
        setCompetition(prev => ({ ...prev, [field]: value }));

    const addTeam = () => setTeams(prev => [...prev, { team_name: '', is_our_club: false, sort_order: prev.length }]);
    const updateTeamName = (idx: number, name: string) => setTeams(prev => prev.map((t2, i) => i === idx ? { ...t2, team_name: name } : t2));
    const updateTeamGroup = (idx: number, group: string) => setTeams(prev => prev.map((t2, i) => i === idx ? { ...t2, group_name: group } : t2));
    const removeTeam = (idx: number) => setTeams(prev => prev.filter((_, i) => i !== idx));

    const autoDistribute = () =>
        setTeams(prev => prev.map((t2, i) => ({ ...t2, group_name: groupLetters[i % numGroups] })));

    const handleGenerateRoundRobin = () => {
        const valid = teamNames.filter(n => n.trim());
        if (valid.length < 2) { setError(t('competitionForm.teams.error.minTeams')); return; }
        if (games.length > 0 && !window.confirm(t('competitionForm.teams.confirm.replaceGames'))) return;
        setGames(generateRoundRobin(valid)); setActiveTab('games'); setError(null);
    };

    const handleGenerateKnockout = () => {
        const valid = teamNames.filter(n => n.trim());
        if (valid.length < 2) { setError(t('competitionForm.teams.error.minTeams')); return; }
        if (games.length > 0 && !window.confirm(t('competitionForm.teams.confirm.replaceGames'))) return;
        setGames(generateKnockout(valid, knockoutFormat, idaEvolta)); setActiveTab('games'); setError(null);
    };

    const handleGenerateGroupStage = () => {
        if (!teams.some(t2 => t2.team_name.trim() && t2.group_name)) { setError(t('competitionForm.teams.error.distributeFirst')); return; }
        if (games.some(g => !isKnockoutRound(g.round)) && !window.confirm(t('competitionForm.teams.confirm.replaceGroupGames'))) return;
        const fixtures: Partial<Game>[] = [];
        for (const letter of activeGroups) {
            const gTeams = teams.filter(t2 => t2.group_name === letter).map(t2 => t2.team_name).filter(Boolean);
            if (gTeams.length < 2) continue;
            generateRoundRobin(gTeams).forEach(f => fixtures.push({ ...f, round: `Grupo ${letter} - ${f.round}` }));
        }
        setGames([...fixtures, ...games.filter(g => isKnockoutRound(g.round))]);
        setActiveTab('games'); setError(null);
    };

    const autoSelectQualifiers = () => {
        const selected: string[] = [];
        for (let rank = 0; rank < qualifiersPerGroup; rank++)
            for (const letter of activeGroups) {
                const row = groupStandings[letter]?.[rank];
                if (row) selected.push(row.team);
            }
        setQualifiers(selected);
    };

    const toggleQualifier = (team: string) =>
        setQualifiers(prev => prev.includes(team) ? prev.filter(t2 => t2 !== team) : [...prev, team]);

    const handleGenerateKnockoutFromQualifiers = () => {
        if (qualifiers.length < 2) { setError(t('competitionForm.teams.error.minQualifiers')); return; }
        setGames([...games.filter(g => !isKnockoutRound(g.round)), ...generateKnockout(qualifiers, knockoutFormat, idaEvolta)]);
        setActiveTab('games'); setError(null);
    };

    const addGame = () => {
        const lastRound = games.length > 0 ? (games[games.length - 1].round || 'Rodada 1') : 'Rodada 1';
        setGames(prev => [...prev, { round: lastRound, home_team: teamNames[0] || '', away_team: '', status: 'scheduled' }]);
    };
    const updateGame = (idx: number, field: keyof Game, value: any) =>
        setGames(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
    const removeGame = (idx: number) => setGames(prev => prev.filter((_, i) => i !== idx));

    const handleExportPdf = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = 210;
        const mg = 14;
        let y = 0;

        const cBlue:   [number, number, number] = [59, 130, 246];
        const cDark:   [number, number, number] = [30,  41,  59];
        const cMid:    [number, number, number] = [100, 116, 139];
        const cLight:  [number, number, number] = [248, 250, 252];
        const cPurple: [number, number, number] = [124,  58, 237];

        const checkPage = (need = 20) => {
            if (y + need > 280) { doc.addPage(); y = mg; }
        };

        const dispTeam = (name?: string) =>
            !name || name === 'A definir' ? t('competitionForm.rounds.tbd') : name;

        const statusLabel = (s?: string): string =>
            ({ finished: t('competitionForm.status.fin'), in_progress: t('competitionForm.status.live'), scheduled: t('competitionForm.status.scheduled'), postponed: t('competitionForm.status.postponed'), cancelled: t('competitionForm.status.cancelled') } as Record<string, string>)[s || 'scheduled'] ?? '';

        // ── Header ──────────────────────────────────────────────────────────
        doc.setFillColor(...cBlue);
        doc.rect(0, 0, pageW, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(competition.name || '', mg, 13, { maxWidth: pageW - mg * 2 });

        const meta: string[] = [];
        const typeLabel = competitionTypes.find(c => c.value === competition.type)?.label;
        if (typeLabel) meta.push(typeLabel);
        if (competition.category) meta.push(competition.category);
        if (competition.season) meta.push(competition.season);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (meta.length) doc.text(meta.join('  ·  '), mg, 23);

        y = 36;
        doc.setTextColor(0, 0, 0);

        // ── Section banner ───────────────────────────────────────────────────
        const sectionBanner = (text: string, color: [number, number, number] = cDark) => {
            checkPage(12);
            doc.setFillColor(...color);
            doc.rect(mg, y, pageW - mg * 2, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(text.toUpperCase(), mg + 3, y + 5);
            doc.setTextColor(0, 0, 0);
            y += 10;
        };

        // ── Sub-header ───────────────────────────────────────────────────────
        const subBanner = (text: string) => {
            checkPage(10);
            doc.setFillColor(...cLight);
            doc.rect(mg, y, pageW - mg * 2, 6, 'F');
            doc.setFillColor(...cBlue);
            doc.rect(mg, y, 2, 6, 'F');
            doc.setTextColor(...cDark);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.text(text, mg + 5, y + 4.5);
            doc.setTextColor(0, 0, 0);
            y += 9;
        };

        const getLastY = () => {
            const fy = (doc as any).lastAutoTable?.finalY;
            return typeof fy === 'number' ? fy : y;
        };

        // ── Standings table ──────────────────────────────────────────────────
        const standingsTable = (rows: StandingRow[]) => {
            if (rows.length === 0) return;
            checkPage(20);
            autoTable(doc, {
                startY: y,
                margin: { left: mg, right: mg },
                head: [['#', t('competitionForm.table.team'), 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'Pts']],
                body: rows.map((row, pos) => [
                    pos + 1, row.team, row.played, row.wins, row.draws, row.losses,
                    row.goalsFor, row.goalsAgainst,
                    row.goalDiff > 0 ? `+${row.goalDiff}` : String(row.goalDiff),
                    row.points,
                ]),
                styles: { fontSize: 8, cellPadding: 1.8 },
                headStyles: { fillColor: cBlue, textColor: [255, 255, 255] as [number,number,number], fontStyle: 'bold', fontSize: 7.5 },
                alternateRowStyles: { fillColor: cLight },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 7 },
                    2: { halign: 'center', cellWidth: 9 },
                    3: { halign: 'center', cellWidth: 9 },
                    4: { halign: 'center', cellWidth: 9 },
                    5: { halign: 'center', cellWidth: 9 },
                    6: { halign: 'center', cellWidth: 11 },
                    7: { halign: 'center', cellWidth: 11 },
                    8: { halign: 'center', cellWidth: 10 },
                    9: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
                },
            });
            y = getLastY() + 5;
        };

        // ── Games table ──────────────────────────────────────────────────────
        const gamesTable = (gamesData: Partial<Game>[], groupLetter?: string) => {
            const byRound = groupByRound(gamesData);
            if (byRound.length === 0) return;
            const body: any[] = [];
            for (const { round, games: rGames } of byRound) {
                const label = groupLetter
                    ? translateRound(round.replace(`Grupo ${groupLetter} - `, ''))
                    : translateRound(round);
                body.push([{ content: label, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] as [number,number,number], textColor: cDark, fontSize: 7.5 } }]);
                for (const { leg1, leg2 } of groupMatchups(rGames)) {
                    if (leg2) {
                        body.push([
                            { content: dispTeam(leg1.home_team), styles: { halign: 'right', fontStyle: 'bold' } },
                            { content: `${fmtScore(leg1.home_score)} – ${fmtScore(leg1.away_score)}`, styles: { halign: 'center', fontStyle: 'bold' } },
                            dispTeam(leg1.away_team),
                            { content: fmtDate(leg1.game_date, leg1.game_time), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                            { content: t('competitionForm.matchup.leg1'), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                        ]);
                        body.push([
                            { content: dispTeam(leg2.home_team), styles: { halign: 'right' } },
                            { content: `${fmtScore(leg2.home_score)} – ${fmtScore(leg2.away_score)}`, styles: { halign: 'center', fontStyle: 'bold' } },
                            dispTeam(leg2.away_team),
                            { content: fmtDate(leg2.game_date, leg2.game_time), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                            { content: t('competitionForm.matchup.leg2'), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                        ]);
                        const agg = getAggregate(leg1, leg2);
                        if (agg) {
                            body.push([{ content: `${t('competitionForm.matchup.aggregate')} ${agg.a} – ${agg.b}`, colSpan: 5, styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 252, 231] as [number,number,number], textColor: [22, 101, 52] as [number,number,number], fontSize: 7.5 } }]);
                        }
                    } else {
                        body.push([
                            { content: dispTeam(leg1.home_team), styles: { halign: 'right' } },
                            { content: `${fmtScore(leg1.home_score)} – ${fmtScore(leg1.away_score)}`, styles: { halign: 'center', fontStyle: 'bold' } },
                            dispTeam(leg1.away_team),
                            { content: fmtDate(leg1.game_date, leg1.game_time), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                            { content: statusLabel(leg1.status), styles: { halign: 'center', textColor: cMid, fontSize: 7 } },
                        ]);
                    }
                }
            }
            checkPage(20);
            autoTable(doc, {
                startY: y,
                margin: { left: mg, right: mg },
                body,
                styles: { fontSize: 8, cellPadding: 1.8, overflow: 'ellipsize' },
                columnStyles: {
                    0: { cellWidth: 60, halign: 'right' },
                    1: { cellWidth: 18, halign: 'center' },
                    2: { cellWidth: 60, halign: 'left' },
                    3: { cellWidth: 22, halign: 'center' },
                    4: { cellWidth: 22, halign: 'center' },
                },
            });
            y = getLastY() + 6;
        };

        // ── Group stage ──────────────────────────────────────────────────────
        if (useGroups && activeGroups.length > 0) {
            sectionBanner(t('competitionForm.standings.groupStage'));
            for (const letter of activeGroups) {
                const rows = groupStandings[letter] || [];
                const gTeams = teams.filter(t2 => t2.group_name === letter).map(t2 => t2.team_name).filter(Boolean);
                const gGames = games.filter(g =>
                    !isKnockoutRound(g.round) && (
                        g.round?.startsWith(`Grupo ${letter}`) ||
                        (gTeams.length > 0 && gTeams.includes(g.home_team || '') && gTeams.includes(g.away_team || ''))
                    )
                );
                subBanner(`${t('competitionForm.rounds.group')} ${letter}`);
                standingsTable(rows);
                if (gGames.length > 0) {
                    checkPage(10);
                    doc.setFontSize(7);
                    doc.setTextColor(...cMid);
                    doc.text(t('competitionForm.standings.gamesSection').toUpperCase(), mg, y);
                    y += 4;
                    gamesTable(gGames, letter);
                }
            }
        } else if (!useGroups) {
            sectionBanner(t('competitionForm.standings.overallTitle'));
            standingsTable(overallStandings);
            const nonKnockout = games.filter(g => !isKnockoutRound(g.round));
            if (nonKnockout.length > 0) gamesTable(nonKnockout);
        }

        // ── Knockout ─────────────────────────────────────────────────────────
        if (knockoutGames.length > 0) {
            sectionBanner(t('competitionForm.standings.knockoutStage'), cPurple);
            for (const roundName of KNOCKOUT_ORDER.filter(r => knockoutGames.some(g => g.round === r))) {
                subBanner(translateRound(roundName));
                gamesTable(knockoutGames.filter(g => g.round === roundName));
            }
        }

        // ── Footer on every page ─────────────────────────────────────────────
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...cMid);
            doc.setDrawColor(200, 210, 220);
            doc.setLineWidth(0.2);
            doc.line(mg, 287, pageW - mg, 287);
            doc.text('Aura Club Manager', mg, 292);
            doc.text(`${new Date().toLocaleDateString()}  ·  ${i} / ${pageCount}`, pageW - mg, 292, { align: 'right' });
        }

        const filename = (competition.name || 'competition')
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        doc.save(`${filename || 'competition'}.pdf`);
    };

    const handleSave = async () => {
        if (!competition.name?.trim()) { setError(t('competitionForm.error.nameRequired')); setActiveTab('info'); return; }
        setSaving(true); setError(null);
        try {
            let competitionId = id;
            if (isEditing && id) { await competitionService.update(id, competition); }
            else { const c = await competitionService.create(competition as Competition); competitionId = c.id; }
            if (!competitionId) throw new Error('No competition ID');

            await competitionTeamsService.deleteByCompetition(competitionId);
            const validTeams = teams.filter(t2 => t2.team_name.trim());
            if (validTeams.length > 0)
                await competitionTeamsService.createMany(validTeams.map((t2, i) => ({ ...t2, competition_id: competitionId!, sort_order: i })));

            if (isEditing && id) {
                const dbGames = await gameService.getByCompetition(id);
                const keptIds = new Set(games.filter(g => g.id).map(g => g.id!));
                for (const dg of dbGames) if (!keptIds.has(dg.id!)) await gameService.delete(dg.id!);
                for (const game of games) {
                    const { competition: _c, id: _id, ...gameData } = game as any;
                    if (game.id) await gameService.update(game.id, { ...gameData, competition_id: competitionId });
                    else await gameService.create({ ...gameData, competition_id: competitionId });
                }
            } else if (games.length > 0) {
                await gameService.createMany(games.map(g => { const { competition: _c, id: _id, ...gd } = g as any; return { ...gd, competition_id: competitionId! }; }));
            }
            setIsDirty(false);
            if (isEditing) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                navigate('/competitions');
            }
        } catch (err) { setError(t('competitionForm.error.saving')); console.error(err); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

    const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
        { id: 'info',      icon: Trophy,    label: t('competitionForm.tab.info') },
        { id: 'teams',     icon: Users,     label: `${t('competitionForm.tab.teams')} (${teams.length})` },
        { id: 'games',     icon: Calendar,  label: `${t('competitionForm.tab.games')} (${games.length})` },
        { id: 'standings', icon: BarChart2, label: t('competitionForm.tab.standings') },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => safeNavigate('/competitions')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? t('competitionForm.editTitle') : t('competitionForm.newTitle')}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? t('competitionForm.editSubtitle') : t('competitionForm.newSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {saved && (
                        <span className="text-green-600 font-semibold text-sm">✓ Salvo</span>
                    )}
                    {isDirty && !saved && (
                        <span className="text-amber-500 text-sm font-medium hidden sm:block">{t('competitionForm.unsaved.badge')}</span>
                    )}
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {t('common.save')}
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600">{error}</p></div>}

            {saved && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <p className="text-sm text-green-700 font-medium">{t('competitionForm.savedSuccess')}</p>
                </div>
            )}

            {/* Unsaved changes dialog */}
            {showUnsavedDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800">{t('competitionForm.unsaved.title')}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">{t('competitionForm.unsaved.message')}</p>
                        <div className="flex gap-3 justify-end pt-1">
                            <button onClick={cancelLeave} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                {t('competitionForm.unsaved.continue')}
                            </button>
                            <button onClick={confirmLeave} className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                                {t('competitionForm.unsaved.leave')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}>
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
                        </button>
                    ))}
                </div>

                <div className="p-6">

                    {/* ── Informações ────────────────────────────────────── */}
                    {activeTab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.name')} *</label><input type="text" value={competition.name || ''} onChange={e => updateCompetition('name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Ex: Campeonato Paulista" /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.type')}</label><select value={competition.type || 'league'} onChange={e => updateCompetition('type', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">{competitionTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}</select></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.category')}</label><select value={competition.category || ''} onChange={e => updateCompetition('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"><option value="">{t('trainingForm.field.select')}</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.season')}</label><input type="text" value={competition.season || ''} onChange={e => updateCompetition('season', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="2025" /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.start')}</label><input type="date" value={competition.start_date || ''} onChange={e => updateCompetition('start_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.end')}</label><input type="date" value={competition.end_date || ''} onChange={e => updateCompetition('end_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('common.status')}</label><select value={competition.status || 'upcoming'} onChange={e => updateCompetition('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">{competitionStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                            <div><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.organizer')}</label><input type="text" value={competition.organizer || ''} onChange={e => updateCompetition('organizer', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></div>
                            <div className="md:col-span-2"><label className="block text-sm font-semibold text-slate-700 mb-2">{t('competitionForm.field.description')}</label><textarea value={competition.description || ''} onChange={e => updateCompetition('description', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" /></div>
                            {(competition.status === 'finished' || competition.final_position) && (
                                <div className="md:col-span-2 pt-5 border-t border-slate-100">
                                    <h4 className="text-sm font-bold text-slate-700 mb-4">🏅 {t('competitionForm.section.finalResult')}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.finalPosition')}</label><input type="number" min="1" value={competition.final_position || ''} onChange={e => updateCompetition('final_position', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.totalTeams')}</label><input type="number" min="1" value={competition.total_teams || ''} onChange={e => updateCompetition('total_teams', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.goalsFor')}</label><input type="number" min="0" value={competition.goals_for ?? ''} onChange={e => updateCompetition('goals_for', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.goalsAgainst')}</label><input type="number" min="0" value={competition.goals_against ?? ''} onChange={e => updateCompetition('goals_against', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center" /></div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.wins')}</label><input type="number" min="0" value={competition.wins ?? ''} onChange={e => updateCompetition('wins', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-center font-semibold text-green-700" /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.draws')}</label><input type="number" min="0" value={competition.draws ?? ''} onChange={e => updateCompetition('draws', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-center font-semibold text-slate-600" /></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.field.losses')}</label><input type="number" min="0" value={competition.losses ?? ''} onChange={e => updateCompetition('losses', e.target.value ? parseInt(e.target.value) : undefined)} className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-center font-semibold text-red-700" /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Times ────────────────────────────────────────────── */}
                    {activeTab === 'teams' && (
                        <div className="space-y-5 max-w-2xl">
                            <div className="space-y-2">
                                {teams.map((team, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className={`flex-shrink-0 w-28 px-2 py-1.5 text-xs font-bold rounded-md text-center ${team.is_our_club ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                                            {team.is_our_club ? t('competitionForm.teams.ourClub') : t('competitionForm.teams.opponent')}
                                        </span>
                                        <input type="text" value={team.team_name} onChange={e => updateTeamName(idx, e.target.value)} disabled={team.is_our_club} className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm disabled:bg-slate-100 disabled:cursor-not-allowed" placeholder={t('competitionForm.teams.teamName')} />
                                        {useGroups && (
                                            <select value={team.group_name || ''} onChange={e => updateTeamGroup(idx, e.target.value)} className="w-28 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none">
                                                <option value="">{t('competitionForm.teams.groupPlaceholder')}</option>
                                                {groupLetters.map(l => <option key={l} value={l}>{t('competitionForm.rounds.group')} {l}</option>)}
                                            </select>
                                        )}
                                        {!team.is_our_club && <button onClick={() => removeTeam(idx)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                                    </div>
                                ))}
                            </div>

                            <button onClick={addTeam} className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary rounded-lg transition-colors text-sm font-medium w-full justify-center">
                                <Plus className="w-4 h-4" /> {t('competitionForm.teams.addOpponent')}
                            </button>

                            <div className="pt-4 border-t border-slate-100">
                                <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                                    <div onClick={() => setUseGroups(v => !v)} className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${useGroups ? 'bg-primary' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${useGroups ? 'left-6' : 'left-1'}`} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{t('competitionForm.teams.useGroups')}</span>
                                </label>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                                <div onClick={() => setIdaEvolta(v => !v)} className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${idaEvolta ? 'bg-primary' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${idaEvolta ? 'left-6' : 'left-1'}`} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                    <Repeat2 className="w-4 h-4 text-slate-500" /> {t('competitionForm.teams.legToggle')}
                                </span>
                            </label>

                            {/* ── Sem grupos ── */}
                            {!useGroups && (
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-slate-700">{t('competitionForm.teams.generate.title')}</p>
                                    <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <Shuffle className="w-9 h-9 text-blue-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-blue-800">{t('competitionForm.teams.rr.label')}</p>
                                            <p className="text-xs text-blue-600 mt-0.5">
                                                {teamNames.length} {t('competitionForm.teams.teamsWord')} → {numRoundsRR} {t('competitionForm.teams.rr.rounds')} · {numGamesRR} {t('competitionForm.teams.rr.games')}
                                            </p>
                                        </div>
                                        <button onClick={handleGenerateRoundRobin} disabled={teamNames.length < 2} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex-shrink-0">{t('competitionForm.teams.generate.btn')}</button>
                                    </div>
                                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                                        <div className="flex items-center gap-4">
                                            <GitBranch className="w-9 h-9 text-purple-500 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-purple-800">{t('competitionForm.teams.knockout.label')} {idaEvolta && <span className="ml-1 text-xs font-normal">{t('competitionForm.teams.knockout.twoLeg')}</span>}</p>
                                                <p className="text-xs text-purple-600 mt-0.5">{t('competitionForm.teams.knockout.desc')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-purple-700">{t('competitionForm.teams.format')}</span>
                                            {([4, 8, 16] as const).map(f => <button key={f} onClick={() => setKnockoutFormat(f)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${knockoutFormat === f ? 'bg-purple-500 text-white' : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-100'}`}>{f} {t('competitionForm.teams.teamsWord')}</button>)}
                                            <button onClick={handleGenerateKnockout} disabled={teamNames.length < 2} className="ml-auto px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors">{t('competitionForm.teams.generate.btn')}</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Com grupos ── */}
                            {useGroups && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-sm font-semibold text-slate-700">{t('competitionForm.teams.numGroups')}</span>
                                        {([2, 3, 4, 5, 6, 7, 8] as const).map(n => <button key={n} onClick={() => setNumGroups(n)} className={`w-9 h-9 text-sm font-bold rounded-lg transition-colors ${numGroups === n ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{n}</button>)}
                                        <button onClick={autoDistribute} className="ml-2 flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"><Shuffle className="w-3.5 h-3.5" />{t('competitionForm.teams.autoDistribute')}</button>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <Layers className="w-9 h-9 text-blue-500 flex-shrink-0" />
                                        <div className="flex-1"><p className="text-sm font-bold text-blue-800">{t('competitionForm.teams.gs.label')}</p><p className="text-xs text-blue-600 mt-0.5">{t('competitionForm.teams.gs.desc')}</p></div>
                                        <button onClick={handleGenerateGroupStage} disabled={activeGroups.length < 1} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex-shrink-0">{t('competitionForm.teams.generate.btn')}</button>
                                    </div>
                                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
                                        <div className="flex items-center gap-4">
                                            <GitBranch className="w-9 h-9 text-purple-500 flex-shrink-0" />
                                            <div><p className="text-sm font-bold text-purple-800">{t('competitionForm.teams.qualifiers.label')} {idaEvolta && <span className="text-xs font-normal">{t('competitionForm.teams.knockout.twoLeg')}</span>}</p><p className="text-xs text-purple-600 mt-0.5">{t('competitionForm.teams.qualifiers.desc')}</p></div>
                                        </div>
                                        {activeGroups.length === 0 ? (
                                            <p className="text-xs text-purple-600 italic">{t('competitionForm.teams.qualifiers.distributeFirst')}</p>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-semibold text-purple-700">{t('competitionForm.teams.qualifiers.perGroup')}</span>
                                                    {[1, 2, 3, 4].map(n => <button key={n} onClick={() => setQualifiersPerGroup(n)} className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${qualifiersPerGroup === n ? 'bg-purple-500 text-white' : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-100'}`}>{n}</button>)}
                                                    <button onClick={autoSelectQualifiers} className="ml-1 flex items-center gap-1 px-3 py-1.5 bg-purple-200 hover:bg-purple-300 text-purple-800 text-xs font-bold rounded-lg">{t('competitionForm.teams.qualifiers.selectTop')} {qualifiersPerGroup}</button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {activeGroups.map(letter => {
                                                        const rows = groupStandings[letter] || [];
                                                        return (
                                                            <div key={letter} className="bg-white rounded-lg border border-purple-100 overflow-hidden">
                                                                <div className="px-3 py-2 bg-purple-100"><span className="text-xs font-bold text-purple-700">{t('competitionForm.rounds.group')} {letter}</span></div>
                                                                {rows.length === 0
                                                                    ? <p className="px-3 py-2 text-xs text-slate-400 italic">{t('competitionForm.teams.qualifiers.noGames')}</p>
                                                                    : rows.map((row, pos) => {
                                                                        const checked = qualifiers.includes(row.team);
                                                                        return (
                                                                            <label key={row.team} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 border-t border-slate-50 ${checked ? 'bg-green-50' : ''}`}>
                                                                                <input type="checkbox" checked={checked} onChange={() => toggleQualifier(row.team)} className="w-3.5 h-3.5 rounded text-primary" />
                                                                                <span className="text-xs text-slate-400 w-4 text-center">{pos + 1}</span>
                                                                                <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{row.team}</span>
                                                                                <span className={`text-xs font-bold ${checked ? 'text-green-600' : 'text-slate-500'}`}>{row.points}pts</span>
                                                                            </label>
                                                                        );
                                                                    })
                                                                }
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {qualifiers.length > 0 && (
                                                    <p className="text-xs text-purple-700 font-medium">
                                                        {qualifiers.length} {qualifiers.length !== 1 ? t('competitionForm.teams.qualifiers.qualifierPlural') : t('competitionForm.teams.qualifiers.qualifier')}: {qualifiers.join(', ')}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-purple-100">
                                                    <span className="text-xs font-semibold text-purple-700">{t('competitionForm.teams.format')}</span>
                                                    {([4, 8, 16] as const).map(f => <button key={f} onClick={() => setKnockoutFormat(f)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${knockoutFormat === f ? 'bg-purple-500 text-white' : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-100'}`}>{f} {t('competitionForm.teams.teamsWord')}</button>)}
                                                    <button onClick={handleGenerateKnockoutFromQualifiers} disabled={qualifiers.length < 2} className="ml-auto px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors">{t('competitionForm.teams.qualifiers.generateKnockout')}</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Jogos ─────────────────────────────────────────────── */}
                    {activeTab === 'games' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    {games.length} {games.length === 1 ? t('competitionForm.games.gameSingular') : t('competitionForm.games.gamePlural')} · {gamesByRound.length} {gamesByRound.length === 1 ? t('competitionForm.games.roundSingular') : t('competitionForm.games.roundPlural')}
                                </p>
                                <button onClick={addGame} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary font-semibold text-sm rounded-lg hover:bg-primary/20 transition-colors"><Plus className="w-4 h-4" />{t('competitionForm.games.add')}</button>
                            </div>
                            {games.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="font-semibold">{t('competitionForm.games.none')}</p>
                                    <p className="text-sm mt-1">{t('competitionForm.games.autoGenerate')}</p>
                                </div>
                            ) : (
                                <div className="space-y-7">
                                    {gamesByRound.map(({ round, entries }) => {
                                        const isKnockout = isKnockoutRound(round);
                                        return (
                                            <div key={round}>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${isKnockout ? 'bg-purple-100 text-purple-700' : 'bg-primary/10 text-primary'}`}>{translateRound(round)}</span>
                                                    <div className="flex-1 h-px bg-slate-100" />
                                                    <span className="text-xs text-slate-400">{entries.length} {entries.length === 1 ? t('competitionForm.games.gameSingular') : t('competitionForm.games.gamePlural')}</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {entries.map(({ idx, game }) => (
                                                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <input type="text" value={game.round || ''} onChange={e => updateGame(idx, 'round', e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium w-48" placeholder={t('competitionForm.games.roundName')} />
                                                                <button onClick={() => removeGame(idx)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.home')}</label>
                                                                    <select value={game.home_team || ''} onChange={e => updateGame(idx, 'home_team', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                                                        <option value="">{t('competitionForm.games.selectTeam')}</option>
                                                                        <option value="A definir">{t('competitionForm.games.toDefine')}</option>
                                                                        {teamNames.map(n => <option key={n} value={n}>{n}</option>)}
                                                                        {game.home_team && !teamNames.includes(game.home_team) && game.home_team !== 'A definir' && <option value={game.home_team}>{game.home_team}</option>}
                                                                    </select>
                                                                </div>
                                                                <div className="text-center">
                                                                    <label className="block text-xs font-semibold text-slate-500 mb-1 text-center">{t('competitionForm.games.score')}</label>
                                                                    <div className="flex items-center gap-2">
                                                                        <input type="number" min="0" value={game.home_score ?? ''} onChange={e => updateGame(idx, 'home_score', e.target.value !== '' ? parseInt(e.target.value) : undefined)} className="w-14 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="-" />
                                                                        <span className="text-slate-400 font-bold">×</span>
                                                                        <input type="number" min="0" value={game.away_score ?? ''} onChange={e => updateGame(idx, 'away_score', e.target.value !== '' ? parseInt(e.target.value) : undefined)} className="w-14 px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold" placeholder="-" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.away')}</label>
                                                                    <select value={game.away_team || ''} onChange={e => updateGame(idx, 'away_team', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                                                                        <option value="">{t('competitionForm.games.selectTeam')}</option>
                                                                        <option value="A definir">{t('competitionForm.games.toDefine')}</option>
                                                                        {teamNames.map(n => <option key={n} value={n}>{n}</option>)}
                                                                        {game.away_team && !teamNames.includes(game.away_team) && game.away_team !== 'A definir' && <option value={game.away_team}>{game.away_team}</option>}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.date')}</label><input type="date" value={game.game_date || ''} onChange={e => updateGame(idx, 'game_date', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" /></div>
                                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.time')}</label><input type="time" value={game.game_time || ''} onChange={e => updateGame(idx, 'game_time', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" /></div>
                                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.venue')}</label><input type="text" value={game.venue || ''} onChange={e => updateGame(idx, 'venue', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder={t('competitionForm.games.venuePlaceholder')} /></div>
                                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">{t('competitionForm.games.status')}</label><select value={game.status || 'scheduled'} onChange={e => updateGame(idx, 'status', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">{gameStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Tabela ────────────────────────────────────────────── */}
                    {activeTab === 'standings' && (
                        <div className="space-y-6">
                            <div className="flex justify-end">
                                <button
                                    onClick={handleExportPdf}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                                >
                                    <FileDown className="w-4 h-4" />
                                    {t('competitionForm.standings.exportPdf')}
                                </button>
                            </div>
                            <div className="space-y-10">
                            {useGroups ? (
                                activeGroups.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="font-semibold">{t('competitionForm.standings.noGroups')}</p>
                                        <p className="text-sm mt-1">{t('competitionForm.standings.distributeFirst')}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {activeGroups.map(letter => {
                                            const rows = groupStandings[letter] || [];
                                            const gTeams = teams.filter(t2 => t2.group_name === letter).map(t2 => t2.team_name).filter(Boolean);
                                            const gGames = games.filter(g => gTeams.includes(g.home_team || '') && gTeams.includes(g.away_team || ''));
                                            const gByRound = groupByRound(gGames);
                                            return (
                                                <div key={letter} className="border border-slate-200 rounded-xl overflow-hidden">
                                                    <div className="px-4 py-3 bg-primary/5 border-b border-slate-200 flex items-center gap-2">
                                                        <span className="w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0">{letter}</span>
                                                        <span className="text-sm font-bold text-slate-700">{t('competitionForm.rounds.group')} {letter}</span>
                                                        <span className="ml-auto text-xs text-slate-400">{gTeams.length} {t('competitionForm.standings.teamsWord')}</span>
                                                    </div>
                                                    {rows.length > 0
                                                        ? <StandingsTable rows={rows} teams={teams} />
                                                        : <p className="px-4 py-3 text-sm text-slate-400 italic">{t('competitionForm.standings.noFinished')}</p>
                                                    }
                                                    {gByRound.length > 0 && (
                                                        <div className="border-t border-slate-200">
                                                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('competitionForm.standings.gamesSection')}</span>
                                                            </div>
                                                            <div className="p-3 space-y-3">
                                                                {gByRound.map(({ round, games: rGames }) => (
                                                                    <div key={round}>
                                                                        <p className="text-xs font-semibold text-slate-400 mb-1.5">
                                                                            {translateRound(round.replace(`Grupo ${letter} - `, ''))}
                                                                        </p>
                                                                        <div className="space-y-1.5">
                                                                            {groupMatchups(rGames).map((m, i) => (
                                                                                <MatchupCard key={i} matchup={m} gStandings={groupStandings} teams={teams} />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                                overallStandings.length === 0 && knockoutGames.length === 0 ? (
                                    <div className="text-center py-16 text-slate-400">
                                        <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="font-semibold">{t('competitionForm.standings.noData')}</p>
                                        <p className="text-sm mt-1">{t('competitionForm.standings.noDataDesc')}</p>
                                    </div>
                                ) : (
                                    overallStandings.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <StandingsTable rows={overallStandings} teams={teams} />
                                        </div>
                                    )
                                )
                            )}

                            {/* ── Fase eliminatória ── */}
                            {knockoutGames.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <GitBranch className="w-5 h-5 text-purple-500" />
                                        <h3 className="text-base font-bold text-slate-700">{t('competitionForm.standings.knockoutStage')}</h3>
                                        <div className="flex-1 h-px bg-slate-200" />
                                    </div>
                                    <div className="space-y-6">
                                        {KNOCKOUT_ORDER.filter(r => knockoutGames.some(g => g.round === r)).map(roundName => {
                                            const rGames = knockoutGames.filter(g => g.round === roundName);
                                            const matchups = groupMatchups(rGames);
                                            return (
                                                <div key={roundName}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${roundName === 'Final' ? 'bg-yellow-100 text-yellow-700' : roundName === '3º Lugar' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                                            {translateRound(roundName)}
                                                        </span>
                                                        <div className="flex-1 h-px bg-slate-100" />
                                                        <span className="text-xs text-slate-400">{matchups.length} {matchups.length === 1 ? t('competitionForm.standings.matchupSingular') : t('competitionForm.standings.matchupPlural')}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {matchups.map((m, i) => (
                                                            <MatchupCard key={i} matchup={m} gStandings={groupStandings} teams={teams} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default CompetitionForm;
