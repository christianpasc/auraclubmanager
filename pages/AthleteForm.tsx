
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    User, Shirt, Activity, History, Save, ArrowLeft, Loader2,
    Phone, MapPin, Shield, Users, Heart, Camera, X
} from 'lucide-react';
import {
    athleteService, wardrobeService, physiologyService, trainingHistoryService,
    Athlete, AthleteWardrobe, AthletePhysiology, AthleteTrainingHistory
} from '../services/athleteService';
import { storageService } from '../services/storageService';
import { useLanguage } from '../contexts/LanguageContext';
import AthleteHistoryDashboard from '../components/AthleteHistoryDashboard';

type TabType = 'general' | 'wardrobe' | 'history' | 'physiology';

const AthleteForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditing = !!id;
    const { t, language } = useLanguage();

    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [athlete, setAthlete] = useState<Partial<Athlete>>({ full_name: '', status: 'active' });
    const [wardrobe, setWardrobe] = useState<Partial<AthleteWardrobe>>({});
    const [physiology, setPhysiology] = useState<Partial<AthletePhysiology>>({});
    const [trainingHistory, setTrainingHistory] = useState<AthleteTrainingHistory[]>([]);

    const tabs = [
        { id: 'general' as TabType, label: t('athleteForm.tab.general'), icon: User },
        { id: 'wardrobe' as TabType, label: t('athleteForm.tab.wardrobe'), icon: Shirt },
        { id: 'history' as TabType, label: t('athleteForm.tab.history'), icon: History },
        { id: 'physiology' as TabType, label: t('athleteForm.tab.physiology'), icon: Activity },
    ];

    useEffect(() => {
        if (id) loadAthlete(id);
    }, [id]);

    const loadAthlete = async (athleteId: string) => {
        setLoading(true);
        try {
            const [athleteData, wardrobeData, physiologyData, historyData] = await Promise.all([
                athleteService.getById(athleteId),
                wardrobeService.getByAthleteId(athleteId),
                physiologyService.getLatest(athleteId),
                trainingHistoryService.getByAthleteId(athleteId),
            ]);
            setAthlete(athleteData);
            if (wardrobeData) setWardrobe(wardrobeData);
            if (physiologyData) setPhysiology(physiologyData);
            setTrainingHistory(historyData);
        } catch (err) {
            setError(t('athleteForm.error.loading'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (file: File) => {
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const tempId = id || `temp-${Date.now()}`;
            const photoUrl = await storageService.uploadAthletePhoto(file, tempId);
            setAthlete(prev => ({ ...prev, photo_url: photoUrl }));
        } catch (err) {
            setError(t('athleteForm.error.photoUpload'));
            console.error(err);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSave = async () => {
        if (!athlete.full_name?.trim()) {
            setError(t('athleteForm.error.nameRequired'));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            let athleteId = id;
            if (isEditing && id) {
                await athleteService.update(id, athlete);
            } else {
                const created = await athleteService.create(athlete as Athlete);
                athleteId = created.id;
            }
            if (athleteId && Object.keys(wardrobe).length > 0) {
                await wardrobeService.upsert(athleteId, wardrobe);
            }
            if (athleteId && Object.keys(physiology).length > 0) {
                if (physiology.id) {
                    await physiologyService.update(physiology.id, physiology);
                } else {
                    await physiologyService.create(athleteId, physiology);
                }
            }
            navigate('/athletes');
        } catch (err: any) {
            console.error('Error saving athlete:', err);
            console.error('Error message:', err?.message);
            console.error('Error code:', err?.code);
            console.error('Error details:', err?.details);
            setError(`${t('athleteForm.error.saving')}: ${err?.message || 'Erro desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/athletes')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{isEditing ? t('athleteForm.editTitle') : t('athleteForm.newTitle')}</h1>
                        <p className="text-sm text-slate-500">{isEditing ? t('athleteForm.editSubtitle') : t('athleteForm.newSubtitle')}</p>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {t('common.save')}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="border-b border-slate-200">
                    <nav className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'text-primary border-primary bg-primary/5' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'general' && <GeneralTab t={t} athlete={athlete} setAthlete={setAthlete} onPhotoUpload={handlePhotoUpload} uploadingPhoto={uploadingPhoto} />}
                    {activeTab === 'wardrobe' && <WardrobeTab t={t} wardrobe={wardrobe} setWardrobe={setWardrobe} />}
                    {activeTab === 'history' && id && <AthleteHistoryDashboard athleteId={id} t={t} language={language} />}
                    {activeTab === 'physiology' && <PhysiologyTab t={t} physiology={physiology} setPhysiology={setPhysiology} />}
                </div>
            </div>
        </div>
    );
};

// General Tab
const GeneralTab: React.FC<{
    t: (key: string) => string;
    athlete: Partial<Athlete>;
    setAthlete: React.Dispatch<React.SetStateAction<Partial<Athlete>>>;
    onPhotoUpload: (file: File) => void;
    uploadingPhoto: boolean;
}> = ({ t, athlete, setAthlete, onPhotoUpload, uploadingPhoto }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const updateField = (field: keyof Athlete, value: any) => setAthlete(prev => ({ ...prev, [field]: value }));
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onPhotoUpload(file);
    };

    return (
        <div className="space-y-8">
            {/* Photo and Personal Info */}
            <div className="flex items-start gap-8">
                <div className="flex-shrink-0">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">{t('athleteForm.photo')}</label>
                    <div className="relative">
                        {athlete.photo_url ? (
                            <div className="relative w-32 h-32">
                                <img src={athlete.photo_url} alt="Foto" className="w-32 h-32 rounded-xl object-cover border-2 border-slate-200" />
                                <button type="button" onClick={() => setAthlete(prev => ({ ...prev, photo_url: undefined }))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                                {uploadingPhoto ? <Loader2 className="w-8 h-8 animate-spin" /> : <><Camera className="w-8 h-8 mb-2" /><span className="text-xs font-medium">{t('athleteForm.addPhoto')}</span></>}
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </div>
                    {athlete.photo_url && <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs text-primary hover:text-primary-dark font-medium">{t('athleteForm.changePhoto')}</button>}
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-primary" />{t('athleteForm.section.personal')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.fullName')} *</label>
                            <input type="text" value={athlete.full_name || ''} onChange={(e) => updateField('full_name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Nome completo do atleta" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.birthDate')}</label>
                            <input type="date" value={athlete.birth_date || ''} onChange={(e) => updateField('birth_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.cpf')}</label>
                            <input type="text" value={athlete.cpf || ''} onChange={(e) => updateField('cpf', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="000.000.000-00" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.rg')}</label>
                            <input type="text" value={athlete.rg || ''} onChange={(e) => updateField('rg', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.email')}</label>
                            <input type="email" value={athlete.email || ''} onChange={(e) => updateField('email', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="atleta@email.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.phone')}</label>
                            <input type="tel" value={athlete.phone || ''} onChange={(e) => updateField('phone', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="(00) 00000-0000" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Address */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" />{t('athleteForm.section.address')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.address')}</label>
                        <input type="text" value={athlete.address || ''} onChange={(e) => updateField('address', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.city')}</label>
                        <input type="text" value={athlete.city || ''} onChange={(e) => updateField('city', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.state')}</label>
                        <input type="text" value={athlete.state || ''} onChange={(e) => updateField('state', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.zipCode')}</label>
                        <input type="text" value={athlete.zip_code || ''} onChange={(e) => updateField('zip_code', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="00000-000" />
                    </div>
                </div>
            </div>

            {/* Sports Info */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />{t('athleteForm.section.sports')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.category')}</label>
                        <select value={athlete.category || ''} onChange={(e) => updateField('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('trainingForm.field.select')}</option>
                            {['Sub-7','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-20'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="Profissional">{t('athlete.category.professional')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.position')}</label>
                        <select value={athlete.position || ''} onChange={(e) => updateField('position', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('trainingForm.field.select')}</option>
                            {[
                                { value: 'Goleiro',         key: 'athlete.position.goalkeeper' },
                                { value: 'Zagueiro',        key: 'athlete.position.centerBack' },
                                { value: 'Lateral Direito', key: 'athlete.position.rightBack' },
                                { value: 'Lateral Esquerdo',key: 'athlete.position.leftBack' },
                                { value: 'Volante',         key: 'athlete.position.defensiveMid' },
                                { value: 'Meio-Campo',      key: 'athlete.position.midfielder' },
                                { value: 'Meia Atacante',   key: 'athlete.position.attackingMid' },
                                { value: 'Ponta Direita',   key: 'athlete.position.rightWing' },
                                { value: 'Ponta Esquerda',  key: 'athlete.position.leftWing' },
                                { value: 'Centroavante',    key: 'athlete.position.striker' },
                            ].map(p => <option key={p.value} value={p.value}>{t(p.key)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.dominantFoot')}</label>
                        <select value={athlete.dominant_foot || ''} onChange={(e) => updateField('dominant_foot', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('trainingForm.field.select')}</option><option value="Direito">{t('athleteForm.foot.right')}</option><option value="Esquerdo">{t('athleteForm.foot.left')}</option><option value="Ambidestro">{t('athleteForm.foot.both')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.jerseyNumber')}</label>
                        <input type="number" value={athlete.jersey_number || ''} onChange={(e) => updateField('jersey_number', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" min="1" max="99" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('trainingForm.field.status')}</label>
                        <select value={athlete.status || 'active'} onChange={(e) => updateField('status', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="active">{t('athletes.status.active')}</option><option value="inactive">{t('athletes.status.inactive')}</option><option value="injured">{t('athletes.status.injured')}</option><option value="suspended">{t('athletes.status.suspended')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.joinDate')}</label>
                        <input type="date" value={athlete.join_date || ''} onChange={(e) => updateField('join_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                </div>
            </div>

            {/* Emergency Contact */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-primary" />{t('athleteForm.section.emergency')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.emergencyName')}</label>
                        <input type="text" value={athlete.emergency_contact_name || ''} onChange={(e) => updateField('emergency_contact_name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.emergencyPhone')}</label>
                        <input type="tel" value={athlete.emergency_contact_phone || ''} onChange={(e) => updateField('emergency_contact_phone', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.relationship')}</label>
                        <input type="text" value={athlete.emergency_contact_relationship || ''} onChange={(e) => updateField('emergency_contact_relationship', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('athleteForm.field.relationship')} />
                    </div>
                </div>
            </div>

            {/* Guardian */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary" />{t('athleteForm.section.guardian')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.guardianName')}</label>
                        <input type="text" value={athlete.guardian_name || ''} onChange={(e) => updateField('guardian_name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.guardianCpf')}</label>
                        <input type="text" value={athlete.guardian_cpf || ''} onChange={(e) => updateField('guardian_cpf', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.guardianPhone')}</label>
                        <input type="tel" value={athlete.guardian_phone || ''} onChange={(e) => updateField('guardian_phone', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.field.guardianEmail')}</label>
                        <input type="email" value={athlete.guardian_email || ''} onChange={(e) => updateField('guardian_email', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Wardrobe Tab
const WardrobeTab: React.FC<{ t: (key: string) => string; wardrobe: Partial<AthleteWardrobe>; setWardrobe: React.Dispatch<React.SetStateAction<Partial<AthleteWardrobe>>> }> = ({ t, wardrobe, setWardrobe }) => {
    const updateField = (field: keyof AthleteWardrobe, value: any) => setWardrobe(prev => ({ ...prev, [field]: value }));
    const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const shoeSizes = Array.from({ length: 15 }, (_, i) => (34 + i).toString());

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Shirt className="w-5 h-5 text-primary" />{t('athleteForm.wardrobe.sizes')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.wardrobe.shirt')}</label>
                        <select value={wardrobe.shirt_size || ''} onChange={(e) => updateField('shirt_size', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value=""></option>
                            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.wardrobe.shorts')}</label>
                        <select value={wardrobe.shorts_size || ''} onChange={(e) => updateField('shorts_size', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value=""></option>
                            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.wardrobe.cleats')}</label>
                        <select value={wardrobe.shoe_size || ''} onChange={(e) => updateField('shoe_size', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value=""></option>
                            {shoeSizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.wardrobe.uniformNumber')}</label>
                        <input type="number" value={wardrobe.uniform_number || ''} onChange={(e) => updateField('uniform_number', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" min="1" max="99" />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">{t('athleteForm.wardrobe.delivered')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={wardrobe.has_uniform || false} onChange={(e) => updateField('has_uniform', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" />
                            <span className="font-semibold text-slate-700">{t('athleteForm.wardrobe.uniform')}</span>
                        </label>
                        {wardrobe.has_uniform && (
                            <div className="mt-3">
                                <label className="block text-xs text-slate-500 mb-1">{t('athleteForm.wardrobe.deliveryDate')}</label>
                                <input type="date" value={wardrobe.uniform_delivered_at || ''} onChange={(e) => updateField('uniform_delivered_at', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm" />
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={wardrobe.has_training_kit || false} onChange={(e) => updateField('has_training_kit', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" />
                            <span className="font-semibold text-slate-700">{t('athleteForm.wardrobe.trainingKit')}</span>
                        </label>
                        {wardrobe.has_training_kit && (
                            <div className="mt-3">
                                <label className="block text-xs text-slate-500 mb-1">{t('athleteForm.wardrobe.deliveryDate')}</label>
                                <input type="date" value={wardrobe.training_kit_delivered_at || ''} onChange={(e) => updateField('training_kit_delivered_at', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm" />
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={wardrobe.has_bag || false} onChange={(e) => updateField('has_bag', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" />
                            <span className="font-semibold text-slate-700">{t('athleteForm.wardrobe.bag')}</span>
                        </label>
                        {wardrobe.has_bag && (
                            <div className="mt-3">
                                <label className="block text-xs text-slate-500 mb-1">{t('athleteForm.wardrobe.deliveryDate')}</label>
                                <input type="date" value={wardrobe.bag_delivered_at || ''} onChange={(e) => updateField('bag_delivered_at', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.wardrobe.notes')}</label>
                <textarea value={wardrobe.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder={t('athleteForm.wardrobe.notes')} />
            </div>
        </div>
    );
};

// History Tab
const HistoryTab: React.FC<{ t: (key: string) => string; history: AthleteTrainingHistory[] }> = ({ t, history }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-primary" />{t('athleteForm.history.title')}</h3>
            {history.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">{t('athleteForm.history.none')}</p>
                    <p className="text-sm">{t('athleteForm.history.desc')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {history.map((item) => (
                        <div key={item.id} className="bg-slate-50 p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.event_type === 'game' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                    {item.event_type === 'game' ? '⚽' : '🏃'}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">{item.event_name || (item.event_type === 'game' ? t('athleteForm.history.game') : t('athleteForm.history.training'))}</p>
                                    <p className="text-sm text-slate-500">{new Date(item.event_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            {item.performance_rating && (
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">{t('athleteForm.history.rating')}</p>
                                    <p className="font-bold text-primary">{item.performance_rating}/10</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Physiology Tab
const PhysiologyTab: React.FC<{ t: (key: string) => string; physiology: Partial<AthletePhysiology>; setPhysiology: React.Dispatch<React.SetStateAction<Partial<AthletePhysiology>>> }> = ({ t, physiology, setPhysiology }) => {
    const updateField = (field: keyof AthletePhysiology, value: any) => setPhysiology(prev => ({ ...prev, [field]: value }));

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />{t('athleteForm.physiology.measurements')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.date')}</label>
                        <input type="date" value={physiology.measurement_date || ''} onChange={(e) => updateField('measurement_date', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.height')}</label>
                        <input type="number" step="0.1" value={physiology.height_cm || ''} onChange={(e) => updateField('height_cm', parseFloat(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="175.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.weight')}</label>
                        <input type="number" step="0.1" value={physiology.weight_kg || ''} onChange={(e) => updateField('weight_kg', parseFloat(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="70.5" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.bodyFat')}</label>
                        <input type="number" step="0.1" value={physiology.body_fat_percentage || ''} onChange={(e) => updateField('body_fat_percentage', parseFloat(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.bmi')}</label>
                        <input type="number" step="0.1" value={physiology.bmi || ''} onChange={(e) => updateField('bmi', parseFloat(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-primary" />{t('athleteForm.physiology.cardiovascular')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.restingHR')}</label>
                        <input type="number" value={physiology.resting_heart_rate || ''} onChange={(e) => updateField('resting_heart_rate', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.maxHR')}</label>
                        <input type="number" value={physiology.max_heart_rate || ''} onChange={(e) => updateField('max_heart_rate', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.systolic')}</label>
                        <input type="number" value={physiology.blood_pressure_systolic || ''} onChange={(e) => updateField('blood_pressure_systolic', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.diastolic')}</label>
                        <input type="number" value={physiology.blood_pressure_diastolic || ''} onChange={(e) => updateField('blood_pressure_diastolic', parseInt(e.target.value) || undefined)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">{t('athleteForm.physiology.medicalInfo')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.bloodType')}</label>
                        <select value={physiology.blood_type || ''} onChange={(e) => updateField('blood_type', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                            <option value="">{t('trainingForm.field.select')}</option>
                            <option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.allergies')}</label>
                        <input type="text" value={physiology.allergies || ''} onChange={(e) => updateField('allergies', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder={t('athleteForm.physiology.allergiesPlaceholder')} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.injuries')}</label>
                        <textarea value={physiology.injuries || ''} onChange={(e) => updateField('injuries', e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder={t('athleteForm.physiology.injuriesPlaceholder')} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('athleteForm.physiology.medicalNotes')}</label>
                        <textarea value={physiology.medical_notes || ''} onChange={(e) => updateField('medical_notes', e.target.value)} rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" placeholder={t('athleteForm.physiology.medicalNotesPlaceholder')} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AthleteForm;
