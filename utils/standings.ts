export interface StandingRow {
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

export interface GameLike {
  status?: string;
  home_score?: number | null;
  away_score?: number | null;
  home_team?: string;
  away_team?: string;
}

export function computeStandings(teamNames: string[], games: GameLike[]): StandingRow[] {
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
