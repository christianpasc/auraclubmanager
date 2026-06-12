import { supabase } from '../lib/supabase';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';

interface GameInfo {
  id: string;
  home_team?: string;
  away_team?: string;
  game_date?: string | null;
  game_time?: string | null;
}

interface AthletePlayer {
  athlete_id: string;
  is_starter: boolean;
  position?: string | null;
}

function isMinor(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return new Date(birthDate) > cutoff;
}

export async function notifyLineup(game: GameInfo, players: AthletePlayer[]): Promise<void> {
  const tenantId = getCurrentTenantIdSync();
  if (!tenantId || players.length === 0) return;

  const athleteIds = players.map(p => p.athlete_id).filter(Boolean);
  if (athleteIds.length === 0) return;

  // 1. Fetch athlete records: user_id and birth_date
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, user_id, birth_date, full_name')
    .in('id', athleteIds);

  if (!athletes) return;

  const matchLabel = game.home_team && game.away_team
    ? `${game.home_team} × ${game.away_team}`
    : 'Jogo';
  const dateLabel = game.game_date
    ? new Date(game.game_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const notifications: {
    tenant_id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    channels: Record<string, boolean>;
    reference_type: string;
    reference_id: string;
  }[] = [];

  const minorAthleteIds: string[] = [];

  // 2. Notify athletes with linked accounts
  for (const athlete of athletes) {
    const player = players.find(p => p.athlete_id === athlete.id);
    if (!player) continue;

    if (isMinor(athlete.birth_date)) {
      minorAthleteIds.push(athlete.id);
    }

    if (athlete.user_id) {
      const role = player.is_starter ? 'titular' : 'banco de reservas';
      notifications.push({
        tenant_id: tenantId,
        user_id: athlete.user_id,
        type: 'game_lineup',
        title: `Você foi convocado: ${matchLabel}`,
        body: `Você está na escalação como ${role}${player.position ? ` (${player.position})` : ''}${dateLabel ? `. Data: ${dateLabel}` : ''}.`,
        channels: { email: true, push: false },
        reference_type: 'game',
        reference_id: game.id,
      });
    }
  }

  // 3. Notify guardians of minor athletes
  if (minorAthleteIds.length > 0) {
    const { data: links } = await supabase
      .from('athlete_guardians')
      .select('athlete_id, guardian:guardians(id, user_id, full_name, email)')
      .in('athlete_id', minorAthleteIds);

    if (links) {
      for (const link of links) {
        const guardian = link.guardian as any;
        if (!guardian || !guardian.user_id) continue;

        const athlete = athletes.find(a => a.id === link.athlete_id);
        const athleteName = athlete?.full_name || 'seu atleta';

        notifications.push({
          tenant_id: tenantId,
          user_id: guardian.user_id,
          type: 'game_lineup',
          title: `${athleteName} foi convocado: ${matchLabel}`,
          body: `${athleteName} está na escalação${dateLabel ? `. Data: ${dateLabel}` : ''}.`,
          channels: { email: true, push: false },
          reference_type: 'game',
          reference_id: game.id,
        });
      }
    }
  }

  if (notifications.length === 0) return;

  // 4. Insert notifications
  const { data: inserted } = await supabase
    .from('notifications')
    .insert(notifications)
    .select('id');

  // 5. Fire-and-forget: dispatch emails via edge function (best effort)
  if (inserted && inserted.length > 0) {
    supabase.functions
      .invoke('send-lineup-notifications', {
        body: {
          notificationIds: inserted.map((n: any) => n.id),
          gameInfo: { matchLabel, dateLabel },
          athleteIds,
          tenantId,
        },
      })
      .catch(() => {
        // Email dispatch is best-effort — notification records are already saved
      });
  }
}
