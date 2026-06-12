import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, Pencil, Save, X, Tag, Scissors,
  ShieldAlert, AlertTriangle,
} from 'lucide-react';
import { videoService, Video as VideoRecord, VideoClip, isMinorFromBirthDate } from '../services/videoService';

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ── Clip Modal ─────────────────────────────────────────────────────────────────
interface ClipModalProps {
  initial: Partial<VideoClip>;
  videoId: string;
  currentTime: number;
  duration: number;
  onSave: (c: VideoClip) => void;
  onClose: () => void;
}
const ClipModal: React.FC<ClipModalProps> = ({ initial, videoId, currentTime, duration, onSave, onClose }) => {
  const [title,    setTitle]    = useState(initial.title ?? '');
  const [start,    setStart]    = useState(initial.start_time ?? currentTime);
  const [end,      setEnd]      = useState(initial.end_time ?? Math.min(currentTime + 10, duration));
  const [tagsRaw,  setTagsRaw]  = useState((initial.tags ?? []).join(', '));
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr('Título é obrigatório.'); return; }
    if (start >= end)  { setErr('O início deve ser anterior ao fim.'); return; }
    setSaving(true); setErr(null);
    try {
      let clip: VideoClip;
      if (initial.id) {
        clip = await videoService.updateClip(initial.id, { title: title.trim(), start_time: start, end_time: end });
      } else {
        clip = await videoService.createClip({ video_id: videoId, title: title.trim(), start_time: start, end_time: end });
      }
      const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
      await videoService.saveClipTags(clip.id!, tags);
      onSave({ ...clip, tags });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-indigo-500"/> {initial.id ? 'Editar Clip' : 'Novo Clip'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título <span className="text-rose-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Gol do Marcelo"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Início (seg)</label>
              <input type="number" step="0.1" min={0} max={duration}
                value={start} onChange={e => setStart(parseFloat(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              <p className="text-xs text-slate-400 mt-1">{fmtTime(start)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fim (seg)</label>
              <input type="number" step="0.1" min={0} max={duration}
                value={end} onChange={e => setEnd(parseFloat(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              <p className="text-xs text-slate-400 mt-1">{fmtTime(end)}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (separadas por vírgula)</label>
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
              placeholder="ex: gol, pressão alta, contra-ataque"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const VideoPlayer: React.FC = () => {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const videoRef  = useRef<HTMLVideoElement>(null);

  const [video,       setVideo]       = useState<VideoRecord | null>(null);
  const [clips,       setClips]       = useState<VideoClip[]>([]);
  const [videoUrl,    setVideoUrl]    = useState<string>('');
  const [loading,     setLoading]     = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [clipModal,   setClipModal]   = useState<Partial<VideoClip> | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [v, c, url] = await Promise.all([
          videoService.getById(id),
          videoService.getClips(id),
          videoService.getSignedUrl('').catch(() => ''),
        ]);
        setVideo(v);
        setClips(c);
        // get actual signed url
        const signedUrl = await videoService.getSignedUrl(v.storage_path);
        setVideoUrl(signedUrl);
        // LGPD: log access
        videoService.logAccess(id).catch(() => {});
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const seekTo = (time: number) => {
    if (videoRef.current) { videoRef.current.currentTime = time; videoRef.current.play(); }
  };

  const saveClip = (c: VideoClip) => {
    setClips(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = c; return next; }
      return [...prev, c].sort((a, b) => a.start_time - b.start_time);
    });
    setClipModal(null);
  };

  const deleteClip = async (clipId: string) => {
    if (!window.confirm('Remover este clip?')) return;
    await videoService.deleteClip(clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
  };

  const isMinor = video ? isMinorFromBirthDate(video.athlete?.birth_date) : false;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>;
  }

  if (!video) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Vídeo não encontrado.</p>
        <button onClick={() => navigate('/videos')} className="mt-4 text-sm text-indigo-600 hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/videos')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">{video.title}</h1>
          {video.athlete && (
            <p className="text-sm text-slate-500 flex items-center gap-1">
              {video.athlete.full_name}
              {isMinor && <span className="text-amber-500 text-xs">(menor)</span>}
            </p>
          )}
        </div>
      </div>

      {/* Consent warning */}
      {isMinor && !video.consent_given && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-medium text-amber-800">Consentimento pendente — LGPD</p>
            <p className="text-xs text-amber-600 mt-0.5">Este vídeo envolve um atleta menor de idade sem consentimento registrado.</p>
            <button
              onClick={async () => {
                await videoService.giveConsent(video.id!);
                setVideo(v => v ? { ...v, consent_given: true } : v);
              }}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800 underline hover:no-underline">
              <ShieldAlert className="w-3 h-3"/> Registrar consentimento agora
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Video player */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-black rounded-2xl overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full max-h-[480px]"
              onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            />
          </div>

          {video.description && (
            <p className="text-sm text-slate-500 bg-white rounded-xl border border-slate-100 p-4">{video.description}</p>
          )}

          {/* Timeline / clip markers */}
          {duration > 0 && clips.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Linha do tempo</p>
              <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                {clips.map(c => {
                  const left  = (c.start_time / duration) * 100;
                  const width = ((c.end_time - c.start_time) / duration) * 100;
                  return (
                    <button key={c.id} onClick={() => seekTo(c.start_time)}
                      title={c.title}
                      style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                      className="absolute top-0 bottom-0 bg-indigo-400 hover:bg-indigo-600 opacity-70 hover:opacity-100 transition-opacity rounded"/>
                  );
                })}
                {/* playhead */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}/>
              </div>
            </div>
          )}
        </div>

        {/* Clips panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Clips ({clips.length})</h2>
            <button
              onClick={() => setClipModal({ video_id: id! })}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
              <Plus className="w-3 h-3"/> Novo Clip
            </button>
          </div>

          {clips.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
              <Scissors className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Nenhum clip marcado</p>
              <p className="text-xs mt-1">Selecione um intervalo de tempo no vídeo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clips.map(clip => (
                <div key={clip.id}
                  className="bg-white rounded-xl border border-slate-100 p-3 hover:border-indigo-200 transition-colors cursor-pointer"
                  onClick={() => seekTo(clip.start_time)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{clip.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtTime(clip.start_time)} → {fmtTime(clip.end_time)}
                        <span className="ml-1 text-slate-300">({fmtTime(clip.end_time - clip.start_time)})</span>
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setClipModal(clip); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-indigo-500">
                        <Pencil className="w-3 h-3"/>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteClip(clip.id!); }}
                        className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>
                  {clip.tags && clip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Tag className="w-3 h-3 text-slate-300 mt-0.5 shrink-0"/>
                      {clip.tags.map((t, i) => (
                        <span key={i} className="text-xs text-slate-400">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {clipModal !== null && id && (
        <ClipModal
          initial={clipModal}
          videoId={id}
          currentTime={currentTime}
          duration={duration || 9999}
          onSave={saveClip}
          onClose={() => setClipModal(null)}
        />
      )}
    </div>
  );
};

export default VideoPlayer;
