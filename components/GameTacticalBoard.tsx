
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MousePointer, Pencil, Eraser, RotateCcw, Trash2, Plus, X, Maximize2, Minimize2, ArrowLeftRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OurToken {
    id: string;
    name: string;
    initials: string;
    position?: string;
    x: number;
    y: number;
}

interface OpponentToken {
    id: string;
    name: string;
    number: string;
    x: number;
    y: number;
}

interface Arrow {
    id: string;
    x1: number; y1: number;
    x2: number; y2: number;
    color: string;
}

export interface GameTacticalData {
    ourPlayers: OurToken[];
    opponents: OpponentToken[];
    arrows: Arrow[];
}

interface StarterPlayer {
    athlete_id?: string;
    athlete?: {
        id: string;
        full_name: string;
        position?: string;
    };
    position?: string;
    is_starter?: boolean;
}

interface GameTacticalBoardProps {
    starters: StarterPlayer[];
    homeTeamName?: string;
    awayTeamName?: string;
    isHomeGame?: boolean;
    initialData?: string;
    onChange: (data: string) => void;
}

type Tool = 'select' | 'draw' | 'erase';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
    { id: 'white',  value: '#ffffff' },
    { id: 'yellow', value: '#facc15' },
    { id: 'red',    value: '#ef4444' },
    { id: 'blue',   value: '#2563EB' },
    { id: 'orange', value: '#f97316' },
];

const OUR_COLOR = '#1d4ed8';
const OPP_COLOR = '#dc2626';

const mkInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

const getOurDefaultPos = (position: string | undefined, idx: number, total: number) => {
    const p = (position || '').toLowerCase();
    if (p.includes('goleiro') || p === 'gk')                return { x: 6,  y: 34 };
    if (p.includes('lateral direito') || p === 'rb')         return { x: 20, y: 10 };
    if (p.includes('lateral esquerdo') || p === 'lb')        return { x: 20, y: 58 };
    if (p.includes('zagueiro') || p === 'cb' || p === 'zag') return idx % 2 === 0 ? { x: 20, y: 24 } : { x: 20, y: 44 };
    if (p.includes('volante') || p === 'cdm')                return { x: 36, y: 34 };
    if (p.includes('meia') && p.includes('direito'))         return { x: 50, y: 14 };
    if (p.includes('meia') && p.includes('esquerdo'))        return { x: 50, y: 54 };
    if (p.includes('meia') || p === 'cm' || p === 'cam')     return { x: 55, y: 34 };
    if (p.includes('ponta direita') || p === 'rw')           return { x: 70, y: 10 };
    if (p.includes('ponta esquerda') || p === 'lw')          return { x: 70, y: 58 };
    if (p.includes('centroavante') || p === 'st' || p === 'cf') return { x: 80, y: 34 };
    const cols = Math.max(3, Math.ceil(Math.sqrt(total)));
    return { x: 15 + (idx % cols) * (75 / cols), y: 5 + Math.floor(idx / cols) * (58 / Math.max(1, Math.ceil(total / cols))) };
};

const OPPONENT_DEFAULTS = [
    { x: 99, y: 34 },
    { x: 85, y: 12 }, { x: 85, y: 26 }, { x: 85, y: 42 }, { x: 85, y: 56 },
    { x: 74, y: 18 }, { x: 74, y: 34 }, { x: 74, y: 50 },
    { x: 63, y: 18 }, { x: 63, y: 34 }, { x: 63, y: 50 },
];

const mirrorX = (x: number) => 105 - x;

const getOpponentPos = (idx: number, isHome: boolean) => {
    const p = OPPONENT_DEFAULTS[idx] || { x: 70 + (idx % 4) * 8, y: 5 + Math.floor(idx / 4) * 18 };
    return isHome ? p : { x: mirrorX(p.x), y: p.y };
};

// ── Component ─────────────────────────────────────────────────────────────────

const GameTacticalBoard: React.FC<GameTacticalBoardProps> = ({
    starters, homeTeamName, awayTeamName, isHomeGame = true, initialData, onChange,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const buildInitialState = (): GameTacticalData => {
        const buildFresh = (): OurToken[] => starters.map((s, i) => {
            const name = s.athlete?.full_name || `Jogador ${i + 1}`;
            const pos  = s.position || s.athlete?.position;
            const p    = getOurDefaultPos(pos, i, starters.length);
            const x    = isHomeGame ? p.x : mirrorX(p.x);
            return { id: s.athlete_id || `our-${i}`, name, initials: mkInitials(name), position: pos, x, y: p.y };
        });

        if (initialData) {
            try {
                const saved: GameTacticalData = JSON.parse(initialData);
                const savedIds   = new Set(saved.ourPlayers.map(p => p.id));
                const starterIds = new Set(starters.map(s => s.athlete_id).filter(Boolean));

                // Keep only players still marked as starter
                const kept = saved.ourPlayers.filter(p => starterIds.has(p.id));

                // Add new starters not yet on the board
                const newTokens: OurToken[] = starters
                    .filter(s => s.athlete_id && !savedIds.has(s.athlete_id))
                    .map((s, i) => {
                        const name = s.athlete?.full_name || `Jogador ${i + 1}`;
                        const pos  = s.position || s.athlete?.position;
                        const p    = getOurDefaultPos(pos, kept.length + i, starters.length);
                        const x    = isHomeGame ? p.x : mirrorX(p.x);
                        return { id: s.athlete_id!, name, initials: mkInitials(name), position: pos, x, y: p.y };
                    });

                return { ...saved, ourPlayers: [...kept, ...newTokens] };
            } catch {}
        }

        return { ourPlayers: buildFresh(), opponents: [], arrows: [] };
    };

    const [state, setState]         = useState<GameTacticalData>(buildInitialState);
    const [tool, setTool]           = useState<Tool>('select');
    const [arrowColor, setArrowColor] = useState('#ffffff');
    const [dragging, setDragging]   = useState<{ type: 'our' | 'opp'; id: string } | null>(null);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [drawLive, setDrawLive]   = useState<{ x: number; y: number } | null>(null);
    const [history, setHistory]     = useState<GameTacticalData[]>([]);
    // Opponent add form
    const [newOppName, setNewOppName] = useState('');
    const [newOppNum,  setNewOppNum]  = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [sidesFlipped, setSidesFlipped] = useState(false);

    // Auto-save on state change
    useEffect(() => {
        onChange(JSON.stringify(state));
    }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape key exits fullscreen
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const toSvg = useCallback((cx: number, cy: number) => {
        const svg = svgRef.current;
        if (!svg) return { x: 52, y: 34 };
        const r = svg.getBoundingClientRect();
        return {
            x: Math.max(0.5, Math.min(104.5, (cx - r.left) * (105 / r.width))),
            y: Math.max(0.5, Math.min(67.5,  (cy - r.top)  * (68  / r.height))),
        };
    }, []);

    const snapshot = useCallback(() => {
        setHistory(h => [...h.slice(-14), state]);
    }, [state]);

    const undo = () => {
        if (!history.length) return;
        setState(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
    };

    const flipSides = () => {
        snapshot();
        setState(s => ({
            ...s,
            ourPlayers: s.ourPlayers.map(pl => ({ ...pl, x: mirrorX(pl.x) })),
            opponents:  s.opponents.map(op  => ({ ...op, x: mirrorX(op.x) })),
        }));
        setSidesFlipped(f => !f);
    };

    // ── Opponent management ──────────────────────────────────────────
    const addOpponent = () => {
        const name = newOppName.trim() || `Jogador ${state.opponents.length + 1}`;
        const pos  = getOpponentPos(state.opponents.length, isHomeGame);
        snapshot();
        setState(s => ({
            ...s,
            opponents: [...s.opponents, { id: `opp-${Date.now()}`, name, number: newOppNum.trim(), x: pos.x, y: pos.y }],
        }));
        setNewOppName('');
        setNewOppNum('');
    };

    const removeOpponent = (id: string) => {
        snapshot();
        setState(s => ({ ...s, opponents: s.opponents.filter(o => o.id !== id) }));
    };

    // ── SVG events ───────────────────────────────────────────────────
    const onSvgDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (tool !== 'draw') return;
        const p = toSvg(e.clientX, e.clientY);
        snapshot(); setDrawStart(p); setDrawLive(p);
    };

    const onTokenDown = (e: React.MouseEvent, type: 'our' | 'opp', id: string) => {
        e.stopPropagation();
        if (tool !== 'select') return;
        setDragging({ type, id });
    };

    const onSvgMove = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (dragging) {
            setState(s => dragging.type === 'our'
                ? { ...s, ourPlayers: s.ourPlayers.map(pl => pl.id === dragging.id ? { ...pl, x: p.x, y: p.y } : pl) }
                : { ...s, opponents:  s.opponents.map(op => op.id === dragging.id ? { ...op, x: p.x, y: p.y } : op) }
            );
        }
        if (drawStart) setDrawLive(p);
    };

    const onSvgUp = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (dragging) { setDragging(null); return; }
        if (drawStart) {
            if (Math.hypot(p.x - drawStart.x, p.y - drawStart.y) > 2)
                setState(s => ({ ...s, arrows: [...s.arrows, { id: `a-${Date.now()}`, x1: drawStart.x, y1: drawStart.y, x2: p.x, y2: p.y, color: arrowColor }] }));
            setDrawStart(null); setDrawLive(null);
        }
    };

    // Touch events
    const onSvgTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        if (tool !== 'draw') return;
        const t = e.touches[0]; const p = toSvg(t.clientX, t.clientY);
        snapshot(); setDrawStart(p); setDrawLive(p);
    };
    const onTokenTouchStart = (e: React.TouchEvent, type: 'our' | 'opp', id: string) => {
        e.stopPropagation();
        if (tool !== 'select') return;
        setDragging({ type, id });
    };
    const onSvgTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0]; const p = toSvg(t.clientX, t.clientY);
        if (dragging)
            setState(s => dragging.type === 'our'
                ? { ...s, ourPlayers: s.ourPlayers.map(pl => pl.id === dragging.id ? { ...pl, x: p.x, y: p.y } : pl) }
                : { ...s, opponents:  s.opponents.map(op => op.id === dragging.id ? { ...op, x: p.x, y: p.y } : op) }
            );
        if (drawStart) setDrawLive(p);
    };
    const onSvgTouchEnd = (e: React.TouchEvent) => {
        const t = e.changedTouches[0]; const p = toSvg(t.clientX, t.clientY);
        if (dragging) { setDragging(null); return; }
        if (drawStart) {
            if (Math.hypot(p.x - drawStart.x, p.y - drawStart.y) > 2)
                setState(s => ({ ...s, arrows: [...s.arrows, { id: `a-${Date.now()}`, x1: drawStart.x, y1: drawStart.y, x2: p.x, y2: p.y, color: arrowColor }] }));
            setDrawStart(null); setDrawLive(null);
        }
    };

    const eraseArrow = (id: string) => {
        if (tool !== 'erase') return;
        snapshot();
        setState(s => ({ ...s, arrows: s.arrows.filter(a => a.id !== id) }));
    };

    const markerFor = (c: string) => {
        const found = PRESET_COLORS.find(p => p.value === c);
        return found ? `url(#gtb-mk-${found.id})` : `url(#gtb-mk-custom)`;
    };

    const svgCursor = tool === 'select' ? (dragging ? 'grabbing' : 'grab') : tool === 'draw' ? 'crosshair' : 'default';

    const ToolBtn: React.FC<{ active: boolean; onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode }> = ({ active, onClick, title, disabled = false, children }) => (
        <button title={title} onClick={onClick} disabled={disabled}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm ${
                active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30'
            }`}>
            {children}
        </button>
    );

    const wrapperClass = isFullscreen
        ? 'fixed inset-0 z-50 bg-white flex flex-col'
        : 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col';

    return (
        <div className={wrapperClass}>

            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                        {homeTeamName || 'Nosso Time'} — {state.ourPlayers.length} titulares
                    </span>
                    <span className="text-slate-300">vs</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-semibold text-red-700">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                        {awayTeamName || 'Adversário'} — {state.opponents.length} jogadores
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isHomeGame ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isHomeGame ? 'Casa' : 'Fora'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400 hidden sm:block">Arraste os tokens para reposicionar</p>
                    <button
                        onClick={flipSides}
                        title="Inverter lados das equipes"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Inverter lados</span>
                    </button>
                    <button
                        onClick={() => setIsFullscreen(f => !f)}
                        title={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0" style={isFullscreen ? {} : { height: '520px' }}>

                {/* Left toolbar */}
                <div className="flex flex-col items-center gap-2 p-2 border-r border-slate-100 bg-slate-50 flex-shrink-0">
                    <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Mover jogadores">
                        <MousePointer className="w-3.5 h-3.5" />
                    </ToolBtn>
                    <ToolBtn active={tool === 'draw'} onClick={() => setTool('draw')} title="Desenhar seta">
                        <Pencil className="w-3.5 h-3.5" />
                    </ToolBtn>
                    <ToolBtn active={tool === 'erase'} onClick={() => setTool('erase')} title="Apagar seta">
                        <Eraser className="w-3.5 h-3.5" />
                    </ToolBtn>

                    <div className="w-6 h-px bg-slate-200 my-1" />

                    {PRESET_COLORS.map(c => (
                        <button key={c.id} title={`Cor: ${c.id}`}
                            onClick={() => { setArrowColor(c.value); setTool('draw'); }}
                            className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${arrowColor === c.value ? 'border-slate-700 scale-110' : 'border-slate-300'}`}
                            style={{ backgroundColor: c.value }}
                        />
                    ))}

                    <div className="w-6 h-px bg-slate-200 my-1" />

                    <ToolBtn active={false} onClick={undo} title="Desfazer" disabled={!history.length}>
                        <RotateCcw className="w-3.5 h-3.5" />
                    </ToolBtn>
                    <ToolBtn active={false} onClick={() => { snapshot(); setState(s => ({ ...s, arrows: [] })); }} title="Limpar setas">
                        <Trash2 className="w-3.5 h-3.5" />
                    </ToolBtn>
                </div>

                {/* SVG Field */}
                <div className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden">
                    <svg ref={svgRef} viewBox="0 0 105 68"
                        style={{ width: '100%', height: '100%', display: 'block', cursor: svgCursor }}
                        onMouseDown={onSvgDown} onMouseMove={onSvgMove} onMouseUp={onSvgUp} onMouseLeave={onSvgUp}
                        onTouchStart={onSvgTouchStart} onTouchMove={onSvgTouchMove} onTouchEnd={onSvgTouchEnd}
                    >
                        <defs>
                            {PRESET_COLORS.map(c => (
                                <marker key={c.id} id={`gtb-mk-${c.id}`} markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                                    <path d="M0,0 L0,5 L5,2.5 z" fill={c.value} />
                                </marker>
                            ))}
                            <marker id="gtb-mk-custom" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                                <path d="M0,0 L0,5 L5,2.5 z" fill={arrowColor} />
                            </marker>
                        </defs>

                        {/* Stripes */}
                        {[...Array(8)].map((_, i) => <rect key={i} x={i * 13.125} y="0" width="13.125" height="68" fill={i % 2 === 0 ? '#16a34a' : '#15803d'} />)}

                        {/* Field markings */}
                        <rect x="0.4" y="0.4" width="104.2" height="67.2" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <line x1="52.5" y1="0.4" x2="52.5" y2="67.6" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <circle cx="52.5" cy="34" r="0.55" fill="rgba(255,255,255,0.85)" />
                        <rect x="0.4" y="13.85" width="16.5" height="40.3" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <rect x="0.4" y="24.85" width="5.5" height="18.3" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <rect x="-1.6" y="29" width="2" height="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" />
                        <circle cx="11" cy="34" r="0.55" fill="rgba(255,255,255,0.85)" />
                        <path d="M16.5,27.5 A9.15,9.15 0 0,1 16.5,40.5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <rect x="88.1" y="13.85" width="16.5" height="40.3" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <rect x="99.1" y="24.85" width="5.5" height="18.3" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        <rect x="104.6" y="29" width="2" height="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" />
                        <circle cx="94" cy="34" r="0.55" fill="rgba(255,255,255,0.85)" />
                        <path d="M88.5,27.5 A9.15,9.15 0 0,0 88.5,40.5" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.7" />
                        {([[0.4,0.4],[104.6,0.4],[0.4,67.6],[104.6,67.6]] as [number,number][]).map(([x,y],i) => {
                            const rx = x < 52 ? 1 : -1; const ry = y < 34 ? 1 : -1;
                            return <path key={i} d={`M${x+rx*2},${y} A2,2 0 0,${x>52?1:0} ${x},${y+ry*2}`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.7"/>;
                        })}

                        {/* Half labels */}
                        {(() => {
                            const ourOnLeft = isHomeGame !== sidesFlipped;
                            const leftName  = ourOnLeft ? (homeTeamName || 'Nosso Time') : (awayTeamName || 'Adversário');
                            const rightName = ourOnLeft ? (awayTeamName || 'Adversário') : (homeTeamName || 'Nosso Time');
                            return (
                                <>
                                    <text x="26" y="4" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="2.8" fontWeight="700" style={{ pointerEvents: 'none', userSelect: 'none' }}>{leftName}</text>
                                    <text x="79" y="4" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="2.8" fontWeight="700" style={{ pointerEvents: 'none', userSelect: 'none' }}>{rightName}</text>
                                </>
                            );
                        })()}

                        {/* Arrows */}
                        {state.arrows.map(a => (
                            <line key={a.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                                stroke={a.color} strokeWidth="1.1" markerEnd={markerFor(a.color)} opacity="0.9"
                                style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }}
                                onClick={() => eraseArrow(a.id)} />
                        ))}
                        {drawStart && drawLive && (
                            <line x1={drawStart.x} y1={drawStart.y} x2={drawLive.x} y2={drawLive.y}
                                stroke={arrowColor} strokeWidth="1.1" strokeDasharray="3 2"
                                markerEnd="url(#gtb-mk-custom)" opacity="0.6"
                                style={{ pointerEvents: 'none' }} />
                        )}

                        {/* Our players (blue) */}
                        {state.ourPlayers.map(pl => (
                            <g key={pl.id} transform={`translate(${pl.x},${pl.y})`}
                                style={{ cursor: tool === 'select' ? (dragging?.id === pl.id ? 'grabbing' : 'grab') : 'default' }}
                                onMouseDown={e => onTokenDown(e, 'our', pl.id)}
                                onTouchStart={e => onTokenTouchStart(e, 'our', pl.id)}
                            >
                                <circle r="3.6" fill={OUR_COLOR} stroke="white" strokeWidth="0.6" />
                                <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="2.3" fontWeight="bold" style={{ pointerEvents: 'none', userSelect: 'none' }}>{pl.initials}</text>
                                <text y="5.8" textAnchor="middle" fill="white" fontSize="2" fontWeight="600" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" paintOrder="stroke" style={{ pointerEvents: 'none', userSelect: 'none' }}>{pl.name.split(' ')[0]}</text>
                            </g>
                        ))}

                        {/* Opponent players (red) */}
                        {state.opponents.map(op => (
                            <g key={op.id} transform={`translate(${op.x},${op.y})`}
                                style={{ cursor: tool === 'select' ? (dragging?.id === op.id ? 'grabbing' : 'grab') : 'default' }}
                                onMouseDown={e => onTokenDown(e, 'opp', op.id)}
                                onTouchStart={e => onTokenTouchStart(e, 'opp', op.id)}
                            >
                                <circle r="3.6" fill={OPP_COLOR} stroke="white" strokeWidth="0.6" />
                                <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize="2.6" fontWeight="bold" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                    {op.number || mkInitials(op.name)}
                                </text>
                                <text y="5.8" textAnchor="middle" fill="white" fontSize="2" fontWeight="600" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" paintOrder="stroke" style={{ pointerEvents: 'none', userSelect: 'none' }}>{op.name.split(' ')[0]}</text>
                            </g>
                        ))}
                    </svg>
                </div>

                {/* Right panel */}
                <div className="w-52 border-l border-slate-100 flex flex-col flex-shrink-0 overflow-hidden bg-white">

                    {/* Our starters */}
                    <div className="border-b border-slate-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50">
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                                {homeTeamName || 'Nosso Time'}
                            </span>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-1" style={{ maxHeight: '180px' }}>
                            {state.ourPlayers.map(pl => (
                                <div key={pl.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50/60">
                                    <div className="w-5 h-5 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white">{pl.initials}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 font-semibold truncate">{pl.name.split(' ')[0]}</p>
                                        {pl.position && <p className="text-[9px] text-slate-400 truncate">{pl.position}</p>}
                                    </div>
                                </div>
                            ))}
                            {state.ourPlayers.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-3 px-2">Marque jogadores como titular na aba Escalação</p>
                            )}
                        </div>
                    </div>

                    {/* Opponents */}
                    <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-slate-100 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                                {awayTeamName || 'Adversário'}
                            </span>
                        </div>

                        {/* Add form */}
                        <div className="px-2 py-2 border-b border-slate-100 flex-shrink-0 space-y-1.5">
                            <input
                                type="text"
                                value={newOppName}
                                onChange={e => setNewOppName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addOpponent()}
                                placeholder="Nome do jogador"
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
                            />
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={newOppNum}
                                    onChange={e => setNewOppNum(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addOpponent()}
                                    placeholder="Nº"
                                    className="w-14 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none text-center"
                                />
                                <button
                                    onClick={addOpponent}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {/* Opponent list */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {state.opponents.map(op => (
                                <div key={op.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-50/60 group">
                                    <div className="w-5 h-5 rounded-full bg-red-600 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white">
                                        {op.number || mkInitials(op.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-700 font-semibold truncate">{op.name}</p>
                                        {op.number && <p className="text-[9px] text-slate-400">Nº {op.number}</p>}
                                    </div>
                                    <button
                                        onClick={() => removeOpponent(op.id)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {state.opponents.length === 0 && (
                                <p className="text-xs text-slate-400 text-center py-4 px-2 leading-relaxed">
                                    Adicione os jogadores do adversário acima
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameTacticalBoard;
