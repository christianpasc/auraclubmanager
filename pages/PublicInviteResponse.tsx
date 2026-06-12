import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, CalendarDays, MapPin } from 'lucide-react';
import { invitationService, Invitation } from '../services/invitationService';

type Phase = 'loading' | 'found' | 'not_found' | 'expired' | 'responded' | 'error';

const PublicInviteResponse: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [finalStatus, setFinalStatus] = useState<'accepted' | 'declined' | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!token) { setPhase('not_found'); return; }
    invitationService.getByToken(token).then(inv => {
      if (!inv) { setPhase('not_found'); return; }
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) { setPhase('expired'); return; }
      if (inv.status !== 'pending') {
        setFinalStatus(inv.status as 'accepted' | 'declined');
        setPhase('responded');
        return;
      }
      setInvitation(inv);
      setPhase('found');
    });
  }, [token]);

  const respond = async (status: 'accepted' | 'declined') => {
    if (!token || responding) return;
    setResponding(true);
    const result = await invitationService.respond(token, status);
    if (result.error) {
      setPhase('error');
    } else {
      setFinalStatus(status);
      setPhase('responded');
    }
    setResponding(false);
  };

  const clubName = invitation?.club_name || 'Clube';

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (phase === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-700 mb-2">Convite não encontrado</h1>
          <p className="text-slate-500">O link pode estar incorreto ou expirado.</p>
        </div>
      </div>
    );
  }

  if (phase === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <CalendarDays className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-700 mb-2">Convite expirado</h1>
          <p className="text-slate-500">O prazo para resposta a este convite já encerrou.</p>
        </div>
      </div>
    );
  }

  if (phase === 'responded') {
    const accepted = finalStatus === 'accepted';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 max-w-sm">
          {accepted
            ? <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            : <XCircle className="w-14 h-14 text-rose-400 mx-auto mb-4" />}
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {accepted ? 'Presença confirmada!' : 'Ausência registrada.'}
          </h1>
          {invitation?.event_title && (
            <p className="text-slate-500">{invitation.event_title}</p>
          )}
          <p className="text-slate-400 mt-4 text-sm">
            {accepted
              ? 'Obrigado! Nos vemos em breve.'
              : 'Tudo bem. Até a próxima!'}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-700 mb-2">Ocorreu um erro</h1>
          <p className="text-slate-500">Não foi possível registrar sua resposta. Tente novamente.</p>
          <button
            onClick={() => setPhase('found')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // phase === 'found'
  const inv = invitation!;
  const eventDate = inv.event_date
    ? new Date(inv.event_date).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-8 py-6 text-white">
          <p className="text-indigo-200 text-sm uppercase tracking-wide font-medium">{clubName}</p>
          <h1 className="text-2xl font-bold mt-1">{inv.event_title || 'Você foi convidado!'}</h1>
          {eventDate && (
            <div className="flex items-center gap-2 mt-2 text-indigo-200 text-sm">
              <CalendarDays className="w-4 h-4" />
              <span className="capitalize">{eventDate}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <p className="text-slate-700 mb-1">
            Olá, <strong>{inv.name}</strong>!
          </p>
          {inv.message && (
            <p className="text-slate-500 mt-2 text-sm italic">"{inv.message}"</p>
          )}
          {inv.expires_at && (
            <p className="text-amber-600 text-xs mt-3">
              Responda até {new Date(inv.expires_at).toLocaleDateString('pt-BR')}.
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => respond('accepted')}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar presença
            </button>
            <button
              onClick={() => respond('declined')}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Não poderei ir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicInviteResponse;
