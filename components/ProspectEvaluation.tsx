
import React from 'react';
import { ProspectScores, EVALUATION_PILLARS, calcOverallScore } from '../services/prospectService';

// ── Star Rating ───────────────────────────────────────────────────────────────

const StarRating: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
            <button
                key={n}
                type="button"
                onClick={() => onChange(n === value ? 0 : n)}
                className={`text-xl leading-none transition-colors select-none ${
                    n <= value ? 'text-amber-400 hover:text-amber-500' : 'text-slate-200 hover:text-amber-200'
                }`}
            >
                ★
            </button>
        ))}
    </div>
);

// ── Score bar ─────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ score: number | null }> = ({ score }) => {
    if (score === null) return <span className="text-xs text-slate-400 font-medium">—</span>;
    const pct = (score / 5) * 100;
    const color = score >= 4.2 ? 'bg-green-500' : score >= 3.0 ? 'bg-amber-400' : score >= 2.0 ? 'bg-orange-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-black text-slate-700 w-7 text-right">{score.toFixed(1)}</span>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
    scores: ProspectScores;
    onChange: (scores: ProspectScores) => void;
    t: (k: string) => string;
}

const ProspectEvaluation: React.FC<Props> = ({ scores, onChange, t }) => {
    const setScore = (pillar: keyof ProspectScores, criterion: string, value: number) => {
        onChange({
            ...scores,
            [pillar]: { ...(scores[pillar] ?? {}), [criterion]: value || undefined },
        });
    };

    const pillarAvg = (pillar: keyof ProspectScores): number | null => {
        const ps = scores[pillar];
        if (!ps) return null;
        const vals = Object.values(ps).filter((v): v is number => typeof v === 'number' && v > 0);
        if (vals.length === 0) return null;
        return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    };

    const overall = calcOverallScore(scores);
    const overallTheme = overall === null
        ? { bg: 'bg-white', border: 'border-slate-200', score: 'text-slate-300', label: 'text-slate-500', sub: 'text-slate-400' }
        : overall >= 4.2
        ? { bg: 'bg-green-50',  border: 'border-green-200',  score: 'text-green-600',  label: 'text-green-700',  sub: 'text-green-500'  }
        : overall >= 3.0
        ? { bg: 'bg-amber-50',  border: 'border-amber-200',  score: 'text-amber-500',  label: 'text-amber-700',  sub: 'text-amber-500'  }
        : overall >= 2.0
        ? { bg: 'bg-orange-50', border: 'border-orange-200', score: 'text-orange-500', label: 'text-orange-700', sub: 'text-orange-500' }
        : { bg: 'bg-red-50',    border: 'border-red-200',    score: 'text-red-500',    label: 'text-red-700',    sub: 'text-red-400'    };

    return (
        <div className="space-y-5">
            {/* Overall score banner */}
            <div className={`${overallTheme.bg} border ${overallTheme.border} rounded-xl p-5 flex items-center justify-between shadow-sm transition-colors duration-300`}>
                <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${overallTheme.label}`}>
                        {t('prospects.eval.overall')}
                    </p>
                    <p className={`text-xs ${overallTheme.sub}`}>{t('prospects.eval.subtitle')}</p>
                    <div className="mt-3 flex gap-3">
                        {EVALUATION_PILLARS.map(p => {
                            const avg = pillarAvg(p.key);
                            return (
                                <div key={p.key} className="text-center">
                                    <p className={`text-[9px] uppercase tracking-wider mb-0.5 ${overallTheme.sub}`}>
                                        {Math.round(p.weight * 100)}%
                                    </p>
                                    <p className={`text-sm font-black ${p.text}`}>
                                        {avg !== null ? avg.toFixed(1) : '—'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {overall !== null ? (
                    <div className="text-right">
                        <p className={`text-6xl font-black leading-none ${overallTheme.score}`}>{overall.toFixed(1)}</p>
                        <p className={`text-xs mt-1 ${overallTheme.sub}`}>/5.0</p>
                    </div>
                ) : (
                    <p className={`text-sm italic ${overallTheme.sub}`}>{t('prospects.eval.noScore')}</p>
                )}
            </div>

            {/* Pillar cards — 2-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {EVALUATION_PILLARS.map(pillar => {
                    const avg = pillarAvg(pillar.key);
                    return (
                        <div key={pillar.key} className={`rounded-xl border p-4 ${pillar.bg} ${pillar.border}`}>
                            {/* Pillar header */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/50">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${pillar.text}`}>{t(pillar.labelKey)}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-white/60 ${pillar.text}`}>
                                        {Math.round(pillar.weight * 100)}%
                                    </span>
                                </div>
                                <span className={`text-base font-black ${avg !== null ? pillar.text : 'text-slate-300'}`}>
                                    {avg !== null ? avg.toFixed(1) : '—'}
                                </span>
                            </div>

                            {/* Criteria rows */}
                            <div className="space-y-2.5">
                                {pillar.criteria.map(c => {
                                    const val = (scores[pillar.key]?.[c.key] as number) || 0;
                                    return (
                                        <div key={c.key} className="flex items-center justify-between gap-3">
                                            <span className="text-xs text-slate-600 min-w-0 flex-1 truncate">
                                                {t(c.labelKey)}
                                            </span>
                                            <StarRating value={val} onChange={v => setScore(pillar.key, c.key, v)} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pillar summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    {t('prospects.eval.pillarAvg')}
                </p>
                <div className="space-y-2.5">
                    {EVALUATION_PILLARS.map(p => (
                        <div key={p.key} className="flex items-center gap-3">
                            <span className={`text-xs font-semibold w-24 shrink-0 ${p.text}`}>{t(p.labelKey)}</span>
                            <ScoreBar score={pillarAvg(p.key)} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProspectEvaluation;
