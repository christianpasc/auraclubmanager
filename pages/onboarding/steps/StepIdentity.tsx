import React from 'react';
import { Camera, Check } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ColorPalette } from '../../../services/paletteService';

export interface IdentityValues {
    logoFile: File | null;
    logoPreview: string | null;
    paletteId: string | null;
}

interface Props {
    values: IdentityValues;
    onChange: (patch: Partial<IdentityValues>) => void;
    palettes: ColorPalette[];
}

const StepIdentity: React.FC<Props> = ({ values, onChange, palettes }) => {
    const { t } = useLanguage();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        onChange({ logoFile: file, logoPreview: URL.createObjectURL(file) });
    };

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('onboarding.identity.logoLabel')}
                </label>
                <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                        {values.logoPreview ? (
                            <img
                                src={values.logoPreview}
                                alt=""
                                className="w-20 h-20 rounded-2xl border border-slate-200 object-cover"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                <Camera className="w-6 h-6 text-slate-300" />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Camera className="w-5 h-5 text-white" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePick}
                            className="hidden"
                        />
                    </div>
                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                        >
                            {t('onboarding.identity.chooseLogo')}
                        </button>
                        <p className="text-xs text-slate-400 mt-1.5">{t('onboarding.identity.logoHint')}</p>
                    </div>
                </div>
            </div>

            {/* Palette */}
            {palettes.length > 0 && (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {t('onboarding.identity.paletteLabel')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {palettes.map(p => {
                            const selected = values.paletteId === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => onChange({ paletteId: p.id })}
                                    className={`relative flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${
                                        selected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span className="flex -space-x-1 shrink-0">
                                        <span className="w-4 h-4 rounded-full border border-white" style={{ background: p.colors.primary }} />
                                        <span className="w-4 h-4 rounded-full border border-white" style={{ background: p.colors.secondary || p.colors.accent || p.colors.primary }} />
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700 truncate">{p.name}</span>
                                    {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StepIdentity;
