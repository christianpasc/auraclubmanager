import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, Loader2, Search, X, Save, PlayCircle, Trash2,
  ShieldAlert, User, AlertTriangle,
} from 'lucide-react';
import { videoService, Video as VideoRecord, isMinorFromBirthDate } from '../services/videoService';
import { athleteService, Athlete } from '../services/athleteService';
import { getCurrentTenantIdSync } from '../contexts/TenantContext';
import { useLanguage } from '../contexts/LanguageContext';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

// ── Upload Modal ──────────────────────────────────────────────────────────────
interface UploadModalProps {
  athletes: Athlete[];
  onSave: (v: VideoRecord) => void;
  onClose: () => void;
}
const UploadModal: React.FC<UploadModalProps> = ({ athletes, onSave, onClose }) => {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,         setFile]         = useState<File | null>(null);
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [athleteId,    setAthleteId]    = useState('');
  const [isPrivate,    setIsPrivate]    = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [err,          setErr]          = useState<string | null>(null);

  const selectedAthlete = athletes.find(a => a.id === athleteId);
  const needsConsent = selectedAthlete ? isMinorFromBirthDate(selectedAthlete.birth_date) : false;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
  };

  const submit = async () => {
    if (!file)  { setErr('Selecione um arquivo de vídeo.'); return; }
    if (!title.trim()) { setErr('Título é obrigatório.'); return; }
    if (needsConsent && !consentGiven) {
      setErr('Consentimento do responsável é obrigatório para atletas menores de idade.'); return;
    }
    const tenantId = getCurrentTenantIdSync();
    if (!tenantId) { setErr('Tenant não identificado.'); return; }

    setUploading(true); setErr(null); setProgress(10);
    try {
      const storagePath = await videoService.upload(file, tenantId);
      setProgress(70);
      const record = await videoService.create({
        title: title.trim(),
        description: description.trim() || null,
        storage_path: storagePath,
        athlete_id: athleteId || null,
        is_private: isPrivate,
        consent_given: needsConsent ? consentGiven : true,
      });
      setProgress(100);
      onSave(record);
    } catch (e: any) { setErr(e.message); } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{t('videos.modal.uploadTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
            <Video className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
            {file
              ? <p className="text-sm font-medium text-slate-700">{file.name}</p>
              : <p className="text-sm text-slate-400">{t('videos.selectFile')}</p>
            }
            <p className="text-xs text-slate-400 mt-1">{t('videos.fileTypes')}</p>
            <input ref={fileRef} type="file" accept="video/*" onChange={handleFile} className="hidden"/>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.title')} <span className="text-rose-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('videos.athlete')}</label>
            <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">{t('videos.noAthlete')}</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id!}>
                  {a.full_name}{isMinorFromBirthDate(a.birth_date) ? ` ${t('videos.minor')}` : ''}
                </option>
              ))}
            </select>
          </div>

          {needsConsent && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">{t('videos.lgpd.minorTitle')}</p>
                <p className="text-xs text-amber-600 mt-0.5">{t('videos.lgpd.minorMessage')}</p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)}
                    className="rounded text-indigo-600"/>
                  <span className="text-xs text-amber-800 font-medium">{t('videos.lgpd.consent')}</span>
                </label>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)}
              className="rounded text-indigo-600"/>
            <span className="text-sm text-slate-600">{t('videos.private')}</span>
          </label>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}/>
              </div>
              <p className="text-xs text-slate-500 text-center">{t('common.uploading')}</p>
            </div>
          )}
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50">{t('common.cancel')}</button>
          <button onClick={submit} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Video Card ─────────────────────────────────────────────────────────────────
interface VideoCardProps {
  video: VideoRecord;
  onDelete: () => void;
}
const VideoCard: React.FC<VideoCardProps> = ({ video, onDelete }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMinor  = isMinorFromBirthDate(video.athlete?.birth_date);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
      {/* Thumbnail */}
      <div
        className="relative bg-slate-900 aspect-video flex items-center justify-center cursor-pointer"
        onClick={() => navigate(`/videos/${video.id}`)}>
        {video.thumbnail_path ? (
          <img src={videoService.getPublicUrl(video.thumbnail_path)}
            alt={video.title} className="w-full h-full object-cover opacity-80"/>
        ) : (
          <Video className="w-10 h-10 text-slate-500"/>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <PlayCircle className="w-12 h-12 text-white drop-shadow-lg"/>
        </div>
        {video.is_private && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
            Privado
          </span>
        )}
        {isMinor && !video.consent_given && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3"/> {t('videos.lgpd.noConsent')}
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-semibold text-slate-800 truncate text-sm">{video.title}</p>
        {video.athlete && (
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <User className="w-3 h-3"/>{video.athlete.full_name}
            {isMinor && <span className="text-amber-500">{t('videos.minor')}</span>}
          </p>
        )}
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">{fmtDate(video.created_at)}</p>
          <button onClick={onDelete}
            className="p-1.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const VideoLibrary: React.FC = () => {
  const { t } = useLanguage();
  const [videos,      setVideos]      = useState<VideoRecord[]>([]);
  const [athletes,    setAthletes]    = useState<Athlete[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showUpload,  setShowUpload]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [filterAthlete, setFilterAthlete] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, a] = await Promise.all([videoService.getAll(), athleteService.getAll()]);
      setVideos(v);
      setAthletes(a.filter(x => x.status === 'active'));
      setLoading(false);
    })();
  }, []);

  const saveVideo = (v: VideoRecord) => {
    setVideos(prev => [v, ...prev]);
    setShowUpload(false);
  };

  const deleteVideo = async (id: string, storagePath: string) => {
    if (!window.confirm('Remover este vídeo permanentemente?')) return;
    await videoService.delete(id);
    await videoService.deleteFile(storagePath).catch(() => {});
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const filtered = videos.filter(v => {
    if (filterAthlete && v.athlete_id !== filterAthlete) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('videos.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{videos.length} vídeo{videos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4"/> {t('videos.uploadButton')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('videos.search')}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-56"/>
        </div>
        <select value={filterAthlete} onChange={e => setFilterAthlete(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('videos.allAthletes')}</option>
          {athletes.map(a => <option key={a.id} value={a.id!}>{a.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Video className="w-12 h-12 mb-3 opacity-30"/>
          <p className="font-medium">{videos.length === 0 ? t('videos.empty') : t('common.noResults')}</p>
          {videos.length === 0 && (
            <button onClick={() => setShowUpload(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              {t('videos.uploadFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onDelete={() => deleteVideo(v.id!, v.storage_path)}
            />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          athletes={athletes}
          onSave={saveVideo}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
};

export default VideoLibrary;
