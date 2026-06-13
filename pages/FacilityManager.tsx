import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Plus, Pencil, Trash2, Loader2, X, Save,
  ChevronLeft, ChevronRight, MapPin, Users, DollarSign,
} from 'lucide-react';
import { facilityService, Facility, Booking, BOOKING_STATUS_LABELS } from '../services/facilityService';
import { useLanguage } from '../contexts/LanguageContext';

// ── Calendar helpers ──────────────────────────────────────────────────────────
const SLOT_H = 56; // px per hour
const DAY_START = 6; // 6:00
const DAY_END = 22; // 22:00
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START);
const COLORS = ['#6366f1','#ec4899','#14b8a6','#f59e0b','#22c55e','#ef4444','#3b82f6','#8b5cf6','#f97316'];
const WEEKDAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function mondayOf(date: Date): Date {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d: Date): string {
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}
function fmtDateInput(d: Date): string { return d.toISOString().slice(0,10); }
function fmtTimeInput(d: Date): string { return fmtTime(d); }
function toISO(date: string, time: string): string { return new Date(`${date}T${time}:00`).toISOString(); }

// ── Booking Modal ─────────────────────────────────────────────────────────────
interface BookingModalProps {
  facilities: Facility[];
  initial: Partial<Booking>;
  onSave: (b: Partial<Booking>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}
const BookingModal: React.FC<BookingModalProps> = ({ facilities, initial, onSave, onDelete, onClose }) => {
  const { t } = useLanguage();
  const startD = initial.start_at ? new Date(initial.start_at) : new Date();
  const endD   = initial.end_at   ? new Date(initial.end_at)   : new Date(startD.getTime() + 3600000);

  const [title,      setTitle]      = useState(initial.title || '');
  const [facilityId, setFacilityId] = useState(initial.facility_id || facilities[0]?.id || '');
  const [date,       setDate]       = useState(fmtDateInput(startD));
  const [startTime,  setStartTime]  = useState(fmtTimeInput(startD));
  const [endTime,    setEndTime]    = useState(fmtTimeInput(endD));
  const [status,     setStatus]     = useState(initial.status || 'confirmed');
  const [notes,      setNotes]      = useState(initial.notes || '');
  const [cost,       setCost]       = useState(initial.cost != null ? String(initial.cost) : '0');
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [err,        setErr]        = useState<string|null>(null);

  const autoCalcCost = (facId: string, sTime: string, eTime: string) => {
    const fac = facilities.find(f => f.id === facId);
    if (!fac?.hourly_rate) return;
    const [sh,sm] = sTime.split(':').map(Number);
    const [eh,em] = eTime.split(':').map(Number);
    const hours = (eh * 60 + em - sh * 60 - sm) / 60;
    if (hours > 0) setCost(String((fac.hourly_rate * hours).toFixed(2)));
  };

  const handleFacility = (id: string) => { setFacilityId(id); autoCalcCost(id, startTime, endTime); };
  const handleStart    = (t: string)  => { setStartTime(t);   autoCalcCost(facilityId, t, endTime); };
  const handleEnd      = (t: string)  => { setEndTime(t);     autoCalcCost(facilityId, startTime, t); };

  const submit = async () => {
    if (!title.trim()) { setErr('Título é obrigatório.'); return; }
    if (!facilityId)   { setErr('Selecione uma instalação.'); return; }
    const start_at = toISO(date, startTime);
    const end_at   = toISO(date, endTime);
    if (end_at <= start_at) { setErr('Horário de término deve ser após o início.'); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({ title: title.trim(), facility_id: facilityId, start_at, end_at,
        status: status as Booking['status'], notes: notes.trim() || null, cost: parseFloat(cost) || 0 });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete || !window.confirm('Remover esta reserva?')) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? t('facility.booking.editTitle') : t('facility.booking.newTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.title')} <span className="text-rose-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Treino Sub-17"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('facility.field')} <span className="text-rose-500">*</span></label>
            <select value={facilityId} onChange={e => handleFacility(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Selecionar...</option>
              {facilities.map(f => <option key={f.id} value={f.id!}>{f.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.start')}</label>
              <input type="time" value={startTime} onChange={e => handleStart(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.end')}</label>
              <input type="time" value={endTime} onChange={e => handleEnd(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {Object.entries(BOOKING_STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('facility.cost')}</label>
              <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <div>
            {onDelete && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-rose-500 hover:text-rose-700 text-sm disabled:opacity-50">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>} Remover
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t('common.cancel')}</button>
            <button onClick={submit} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Facility Modal ────────────────────────────────────────────────────────────
interface FacilityModalProps {
  initial: Partial<Facility>;
  onSave: (f: Partial<Facility>) => Promise<void>;
  onClose: () => void;
}
const FacilityModal: React.FC<FacilityModalProps> = ({ initial, onSave, onClose }) => {
  const { t } = useLanguage();
  const [name,        setName]        = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [location,    setLocation]    = useState(initial.location || '');
  const [capacity,    setCapacity]    = useState(initial.capacity ? String(initial.capacity) : '');
  const [hourlyRate,  setHourlyRate]  = useState(initial.hourly_rate != null ? String(initial.hourly_rate) : '0');
  const [color,       setColor]       = useState(initial.color || COLORS[0]);
  const [isActive,    setIsActive]    = useState(initial.is_active ?? true);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string|null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr(t('errors.nameRequired')); return; }
    setSaving(true); setErr(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        capacity: capacity ? parseInt(capacity) : null,
        hourly_rate: parseFloat(hourlyRate) || 0,
        color,
        is_active: isActive,
      });
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? t('facility.facility.editTitle') : t('facility.facility.newTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} <span className="text-rose-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Campo Principal"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('facility.capacity')}</label>
              <input type="number" min="0" value={capacity} onChange={e => setCapacity(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('facility.hourlyRate')}</label>
              <input type="number" min="0" step="0.01" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('facility.location')}</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Endereço ou sala"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">{t('facility.calendarColor')}</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}/>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsActive(a => !a)}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`}/>
            </button>
            <span className="text-sm text-slate-600">{isActive ? t('facility.active') : t('facility.inactive')}</span>
          </div>
          {err && <p className="text-rose-600 text-xs bg-rose-50 rounded-lg px-3 py-2">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">{t('common.cancel')}</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const FacilityManager: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab]             = useState<'calendar'|'facilities'>('calendar');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [filterFac, setFilterFac] = useState<string>('');

  const [bookingModal,  setBookingModal]  = useState<Partial<Booking>|null>(null);
  const [facilityModal, setFacilityModal] = useState<Partial<Facility>|null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd  = addDays(weekStart, 7);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [facs, books] = await Promise.all([
      facilityService.getFacilities(),
      facilityService.getBookings(
        new Date(weekStart.getTime() - 86400000).toISOString(),
        new Date(weekEnd.getTime() + 86400000).toISOString()
      ),
    ]);
    setFacilities(facs);
    setBookings(books);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reload bookings when week changes (keep facilities)
  const reloadBookings = async () => {
    const books = await facilityService.getBookings(
      new Date(weekStart.getTime() - 86400000).toISOString(),
      new Date(weekEnd.getTime() + 86400000).toISOString()
    );
    setBookings(books);
  };

  // ── Bookings CRUD ──
  const saveBooking = async (data: Partial<Booking>) => {
    if (bookingModal?.id) {
      await facilityService.updateBooking(bookingModal.id, data);
    } else {
      await facilityService.createBooking(data as Omit<Booking, 'id'|'created_at'|'updated_at'|'facility'>);
    }
    await reloadBookings();
    setBookingModal(null);
  };

  const deleteBooking = async () => {
    if (!bookingModal?.id) return;
    await facilityService.deleteBooking(bookingModal.id);
    setBookings(prev => prev.filter(b => b.id !== bookingModal.id));
    setBookingModal(null);
  };

  // ── Facilities CRUD ──
  const saveFacility = async (data: Partial<Facility>) => {
    if (facilityModal?.id) {
      const updated = await facilityService.updateFacility(facilityModal.id, data);
      setFacilities(prev => prev.map(f => f.id === updated.id ? updated : f));
    } else {
      const created = await facilityService.createFacility(data as Omit<Facility,'id'|'created_at'|'updated_at'>);
      setFacilities(prev => [...prev, created]);
    }
    setFacilityModal(null);
  };

  const deleteFacility = async (id: string) => {
    if (!window.confirm('Remover instalação? As reservas vinculadas também serão removidas.')) return;
    await facilityService.deleteFacility(id);
    setFacilities(prev => prev.filter(f => f.id !== id));
    setBookings(prev => prev.filter(b => b.facility_id !== id));
  };

  // ── Calendar helpers ──
  const getBookingsForDay = (day: Date): Booking[] =>
    bookings.filter(b => {
      if (filterFac && b.facility_id !== filterFac) return false;
      if (b.status === 'cancelled') return false;
      return isSameDay(new Date(b.start_at), day);
    });

  const getFacility = (id: string) => facilities.find(f => f.id === id);

  const bookingStyle = (b: Booking): React.CSSProperties => {
    const start = new Date(b.start_at);
    const end   = new Date(b.end_at);
    const top    = (start.getHours() + start.getMinutes() / 60 - DAY_START) * SLOT_H;
    const height = Math.max(((end.getTime() - start.getTime()) / 3600000) * SLOT_H, 20);
    const fac    = getFacility(b.facility_id);
    const color  = fac?.color || '#6366f1';
    return { position: 'absolute', top, left: 2, right: 2, height, backgroundColor: color + '22', borderLeft: `3px solid ${color}`, zIndex: 10 };
  };

  const handleSlotClick = (day: Date, hour: number) => {
    const start = new Date(day); start.setHours(hour, 0, 0, 0);
    const end   = new Date(day); end.setHours(hour + 1, 0, 0, 0);
    setBookingModal({
      facility_id: filterFac || facilities[0]?.id || '',
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      title: '',
      status: 'confirmed',
      cost: 0,
    });
  };

  const today = new Date();
  const fmtWeekLabel = () => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    return `${weekStart.toLocaleDateString('pt-BR', opts)} – ${addDays(weekStart, 6).toLocaleDateString('pt-BR', opts)}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('facility.title')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('facility.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (tab === 'facilities') setFacilityModal({});
              else setBookingModal({
                facility_id: filterFac || facilities[0]?.id || '',
                start_at: new Date().toISOString(),
                end_at: new Date(Date.now() + 3600000).toISOString(),
                title: '',
                status: 'confirmed',
                cost: 0,
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4"/>
            {tab === 'facilities' ? t('facility.newFacility') : t('facility.newBooking')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([['calendar', t('facility.tab.calendar')],['facilities', t('facility.tab.facilities')]] as const).map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {k === 'calendar' ? <CalendarDays className="w-4 h-4"/> : <MapPin className="w-4 h-4"/>}
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500"/></div>
      ) : (
        <>
          {/* ── Calendar Tab ── */}
          {tab === 'calendar' && (
            <div className="space-y-3">
              {/* Calendar controls */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft className="w-4 h-4"/></button>
                  <span className="text-sm font-medium text-slate-700 min-w-[160px] text-center">{fmtWeekLabel()}</span>
                  <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight className="w-4 h-4"/></button>
                  <button onClick={() => setWeekStart(mondayOf(new Date()))} className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 ml-1">
                    {t('facility.today')}
                  </button>
                </div>
                {facilities.length > 0 && (
                  <select value={filterFac} onChange={e => setFilterFac(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
                    <option value="">{t('facility.allFacilities')}</option>
                    {facilities.map(f => <option key={f.id} value={f.id!}>{f.name}</option>)}
                  </select>
                )}
              </div>

              {facilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <CalendarDays className="w-12 h-12 mb-3 opacity-30"/>
                  <p className="font-medium">{t('facility.empty')}</p>
                  <p className="text-sm mt-1">{t('facility.emptyAction')}</p>
                  <button onClick={() => { setTab('facilities'); setFacilityModal({}); }}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    {t('facility.createFirst')}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
                  {/* Day headers */}
                  <div className="flex border-b border-slate-200 sticky top-0 bg-white z-20">
                    <div className="w-14 shrink-0 border-r border-slate-100"/>
                    {weekDays.map(day => {
                      const isToday = isSameDay(day, today);
                      return (
                        <div key={day.toISOString()} className={`flex-1 py-2 text-center border-r border-slate-100 last:border-0 ${isToday ? 'bg-indigo-50' : ''}`}>
                          <p className="text-xs text-slate-400">{WEEKDAYS_PT[day.getDay()]}</p>
                          <p className={`text-base font-bold ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{day.getDate()}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid */}
                  <div className="flex" style={{ minHeight: `${HOURS.length * SLOT_H}px` }}>
                    {/* Time labels */}
                    <div className="w-14 shrink-0 border-r border-slate-100 relative">
                      {HOURS.map(h => (
                        <div key={h} style={{ height: SLOT_H }} className="flex items-start justify-end pr-2 pt-1">
                          <span className="text-[10px] text-slate-300">{h.toString().padStart(2,'0')}:00</span>
                        </div>
                      ))}
                    </div>

                    {/* Day columns */}
                    {weekDays.map(day => {
                      const isToday = isSameDay(day, today);
                      const dayBookings = getBookingsForDay(day);
                      return (
                        <div key={day.toISOString()} className={`flex-1 relative border-r border-slate-100 last:border-0 ${isToday ? 'bg-indigo-50/30' : ''}`}>
                          {/* Hour slots — clickable */}
                          {HOURS.map(h => (
                            <div key={h} style={{ height: SLOT_H }}
                              className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                              onClick={() => handleSlotClick(day, h)}/>
                          ))}

                          {/* Booking blocks */}
                          {dayBookings.map(b => {
                            const fac = getFacility(b.facility_id);
                            return (
                              <div key={b.id}
                                style={bookingStyle(b)}
                                className="rounded-md px-1.5 py-1 cursor-pointer overflow-hidden hover:opacity-80 transition-opacity"
                                onClick={e => { e.stopPropagation(); setBookingModal(b); }}>
                                <p className="text-[11px] font-semibold text-slate-800 truncate leading-tight">{b.title}</p>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {fmtTime(new Date(b.start_at))}–{fmtTime(new Date(b.end_at))}
                                  {!filterFac && fac && <span className="ml-1 opacity-60">· {fac.name}</span>}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Facilities Tab ── */}
          {tab === 'facilities' && (
            facilities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <MapPin className="w-12 h-12 mb-3 opacity-30"/>
                <p className="font-medium">{t('facility.empty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {facilities.map(f => {
                  const fBookings = bookings.filter(b => b.facility_id === f.id && b.status !== 'cancelled');
                  return (
                    <div key={f.id} className={`bg-white rounded-xl border ${f.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'} p-5`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: f.color || '#6366f1' }}/>
                          <p className="font-semibold text-slate-800">{f.name}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setFacilityModal(f)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5"/></button>
                          <button onClick={() => deleteFacility(f.id!)} className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                      {f.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{f.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {f.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{f.location}</span>}
                        {f.capacity && <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{f.capacity} pessoas</span>}
                        {f.hourly_rate ? <span className="flex items-center gap-1"><DollarSign className="w-3 h-3"/>R${f.hourly_rate}/h</span> : null}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
                        {fBookings.length} reserva{fBookings.length !== 1 ? 's' : ''} esta semana
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Modals */}
      {bookingModal !== null && (
        <BookingModal
          facilities={facilities.filter(f => f.is_active)}
          initial={bookingModal}
          onSave={saveBooking}
          onDelete={bookingModal.id ? deleteBooking : undefined}
          onClose={() => setBookingModal(null)}
        />
      )}
      {facilityModal !== null && (
        <FacilityModal
          initial={facilityModal}
          onSave={saveFacility}
          onClose={() => setFacilityModal(null)}
        />
      )}
    </div>
  );
};

export default FacilityManager;
