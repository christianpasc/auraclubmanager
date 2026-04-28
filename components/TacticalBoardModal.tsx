
import React, { useState, useRef, useCallback } from 'react';
import { X, MousePointer, Pencil, Eraser, RotateCcw, Trash2, Save, LogIn, LogOut, ArrowLeftRight } from 'lucide-react';

interface PlayerToken {
    id: string;
    name: string;
    initials: string;
    x: number;
    y: number;
    color: string;
    team: 'A' | 'B';
    isGK: boolean;
}

interface Arrow {
    id: string;
    x1: number; y1: number;
    x2: number; y2: number;
    color: string;
}

export interface TacticalBoardData {
    players: PlayerToken[];
    arrows: Arrow[];
    benched: string[];
}

interface Participant {
    athlete_id?: string;
    athlete?: {
        id: string;
        full_name: string;
        photo_url?: string;
        category?: string;
        position?: string;
    };
}

interface TacticalBoardModalProps {
    activityName: string;
    participants: Participant[];
    initialData?: string;
    onSave: (data: string) => void;
    onClose: () => void;
}

type Tool    = 'select' | 'draw' | 'erase';
type Section = 'A-field' | 'A-bench' | 'B-field' | 'B-bench';

const PRESET_COLORS = [
    { id: 'blue',   value: '#2563EB' },
    { id: 'red',    value: '#ef4444' },
    { id: 'yellow', value: '#facc15' },
    { id: 'orange', value: '#f97316' },
    { id: 'white',  value: '#ffffff' },
];

const TEAM_COLORS = {
    A: { field: '#1d4ed8', gk: '#d97706' },
    B: { field: '#dc2626', gk: '#b45309' },
};

const getPlayerColor = (team: 'A' | 'B', isGK: boolean): string =>
    isGK ? TEAM_COLORS[team].gk : TEAM_COLORS[team].field;

const getDefaultPos = (position: string | undefined, idx: number, total: number) => {
    const p = (position || '').toLowerCase();
    if (p.includes('goleiro') || p === 'gk')               return { x: 6,  y: 34 };
    if (p.includes('lateral direito') || p === 'rb')        return { x: 20, y: 10 };
    if (p.includes('lateral esquerdo') || p === 'lb')       return { x: 20, y: 58 };
    if (p.includes('zagueiro') || p === 'cb' || p === 'zag') return idx % 2 === 0 ? { x: 20, y: 24 } : { x: 20, y: 44 };
    if (p.includes('volante') || p === 'cdm')               return { x: 36, y: 34 };
    if (p.includes('meia') && p.includes('direito'))        return { x: 50, y: 14 };
    if (p.includes('meia') && p.includes('esquerdo'))       return { x: 50, y: 54 };
    if (p.includes('meia') || p === 'cm' || p === 'cam')    return { x: 55, y: 34 };
    if (p.includes('ponta direita') || p === 'rw')          return { x: 70, y: 10 };
    if (p.includes('ponta esquerda') || p === 'lw')         return { x: 70, y: 58 };
    if (p.includes('centroavante') || p === 'st' || p === 'cf') return { x: 80, y: 34 };
    const cols = Math.max(3, Math.ceil(Math.sqrt(total)));
    const col  = idx % cols;
    const row  = Math.floor(idx / cols);
    return { x: 15 + col * (75 / cols), y: 5 + row * (58 / Math.max(1, Math.ceil(total / cols))) };
};

const mkInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

const ToolBtn: React.FC<{
    active: boolean; onClick: () => void; title: string;
    disabled?: boolean; children: React.ReactNode;
}> = ({ active, onClick, title, disabled = false, children }) => (
    <button title={title} onClick={onClick} disabled={disabled}
        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
            active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                   : 'text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed'
        }`}>
        {children}
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────

const TacticalBoardModal: React.FC<TacticalBoardModalProps> = ({
    activityName, participants, initialData, onSave, onClose,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    const buildInitialState = (): TacticalBoardData => {
        if (initialData) {
            try {
                const parsed = JSON.parse(initialData);
                return {
                    benched: [],
                    ...parsed,
                    players: (parsed.players || []).map((pl: any) => ({
                        team: 'A' as 'A' | 'B',
                        isGK: false,
                        ...pl,
                    })),
                };
            } catch {}
        }
        const players: PlayerToken[] = participants.map((p, i) => {
            const name = p.athlete?.full_name || `Jogador ${i + 1}`;
            const pos  = getDefaultPos(p.athlete?.position, i, participants.length);
            const isGK = (p.athlete?.position || '').toLowerCase().includes('goleiro');
            return {
                id: p.athlete_id || `p-${i}`,
                name,
                initials: mkInitials(name),
                x: pos.x, y: pos.y,
                color: getPlayerColor('A', isGK),
                team: 'A',
                isGK,
            };
        });
        return { players, arrows: [], benched: [] };
    };

    const [state, setState]         = useState<TacticalBoardData>(buildInitialState);
    const [tool, setTool]           = useState<Tool>('select');
    const [arrowColor, setArrowColor] = useState('#ef4444');
    const [draggingSvg, setDraggingSvg] = useState<string | null>(null);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [drawLive, setDrawLive]   = useState<{ x: number; y: number } | null>(null);
    const [history, setHistory]     = useState<TacticalBoardData[]>([]);
    // Panel drag-and-drop
    const [panelDragId, setPanelDragId]   = useState<string | null>(null);
    const [dropTarget, setDropTarget]     = useState<Section | null>(null);

    // ── SVG coordinate helper ──────────────────────────────────────
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
        if (history.length === 0) return;
        setState(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
    };

    // ── Team / bench management ────────────────────────────────────
    const moveToSection = (playerId: string, section: Section) => {
        const team     = section.startsWith('A') ? 'A' as const : 'B' as const;
        const isBenched = section.endsWith('bench');
        snapshot();
        setState(s => ({
            ...s,
            players: s.players.map(pl => {
                if (pl.id !== playerId) return pl;
                return { ...pl, team, color: getPlayerColor(team, pl.isGK) };
            }),
            benched: isBenched
                ? [...new Set([...s.benched, playerId])]
                : s.benched.filter(id => id !== playerId),
        }));
    };

    // ── Panel drag-and-drop ────────────────────────────────────────
    const onPanelDragStart = (e: React.DragEvent, id: string) => {
        setPanelDragId(id);
        e.dataTransfer.effectAllowed = 'move';
    };
    const onPanelDragOver = (e: React.DragEvent, section: Section) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(section);
    };
    const onPanelDrop = (e: React.DragEvent, section: Section) => {
        e.preventDefault();
        if (panelDragId) moveToSection(panelDragId, section);
        setPanelDragId(null);
        setDropTarget(null);
    };
    const onPanelDragEnd = () => { setPanelDragId(null); setDropTarget(null); };

    // ── SVG mouse events ───────────────────────────────────────────
    const onSvgDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (tool !== 'draw') return;
        const p = toSvg(e.clientX, e.clientY);
        snapshot();
        setDrawStart(p); setDrawLive(p);
    };
    const onPlayerDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tool !== 'select') return;
        setDraggingSvg(id);
    };
    const onSvgMove = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (draggingSvg) setState(s => ({ ...s, players: s.players.map(pl => pl.id === draggingSvg ? { ...pl, x: p.x, y: p.y } : pl) }));
        if (drawStart) setDrawLive(p);
    };
    const onSvgUp = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (draggingSvg) { setDraggingSvg(null); return; }
        if (drawStart) {
            if (Math.hypot(p.x - drawStart.x, p.y - drawStart.y) > 2)
                setState(s => ({ ...s, arrows: [...s.arrows, { id: `a-${Date.now()}`, x1: drawStart.x, y1: drawStart.y, x2: p.x, y2: p.y, color: arrowColor }] }));
            setDrawStart(null); setDrawLive(null);
        }
    };

    // ── SVG touch events ───────────────────────────────────────────
    const onSvgTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        if (tool !== 'draw') return;
        const t = e.touches[0]; const p = toSvg(t.clientX, t.clientY);
        snapshot(); setDrawStart(p); setDrawLive(p);
    };
    const onPlayerTouchStart = (e: React.TouchEvent, id: string) => {
        e.stopPropagation();
        if (tool !== 'select') return;
        setDraggingSvg(id);
    };
    const onSvgTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0]; const p = toSvg(t.clientX, t.clientY);
        if (draggingSvg) setState(s => ({ ...s, players: s.players.map(pl => pl.id === draggingSvg ? { ...pl, x: p.x, y: p.y } : pl) }));
        if (drawStart) setDrawLive(p);
    };
    const onSvgTouchEnd = (e: React.TouchEvent) => {
        const t = e.changedTouches[0]; const p = toSvg(t.clientX, t.clientY);
        if (draggingSvg) { setDraggingSvg(null); return; }
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
    const clearArrows = () => { snapshot(); setState(s => ({ ...s, arrows: [] })); };

    const markerFor = (c: string) => {
        const found = PRESET_COLORS.find(p => p.value === c);
        return found ? `url(#mk-${found.id})` : `url(#mk-custom)`;
    };

    const svgCursor = tool === 'select' ? (draggingSvg ? 'grabbing' : 'grab') : tool === 'draw' ? 'crosshair' : 'default';

    // ── Derived lists ──────────────────────────────────────────────
    const teamAField  = state.players.filter(pl => pl.team === 'A' && !state.benched.includes(pl.id));
    const teamABench  = state.players.filter(pl => pl.team === 'A' &&  state.benched.includes(pl.id));
    const teamBField  = state.players.filter(pl => pl.team === 'B' && !state.benched.includes(pl.id));
    const teamBBench  = state.players.filter(pl => pl.team === 'B' &&  state.benched.includes(pl.id));
    const onField     = [...teamAField, ...teamBField];

    // ── Player card (panel) ────────────────────────────────────────
    const PlayerCard = ({ pl, section }: { pl: PlayerToken; section: Section }) => {
        const isBenched  = section.endsWith('bench');
        const team       = section.startsWith('A') ? 'A' as const : 'B' as const;
        const otherTeam  = team === 'A' ? 'B' as const : 'A' as const;
        const toggleSection: Section = `${team}-${isBenched ? 'field' : 'bench'}`;
        const switchSection: Section = `${otherTeam}-${isBenched ? 'bench' : 'field'}`;
        return (
            <div
                draggable
                onDragStart={e => onPanelDragStart(e, pl.id)}
                onDragEnd={onPanelDragEnd}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing group select-none transition-opacity
                    ${panelDragId === pl.id ? 'opacity-30' : ''}
                    ${isBenched ? 'bg-slate-800/60 opacity-60 hover:opacity-100' : 'bg-slate-700/50'}`}
            >
                <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: pl.color }}>
                    {pl.initials}
                </div>
                <span className="text-xs text-slate-200 truncate flex-1 leading-none">{pl.name.split(' ')[0]}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); moveToSection(pl.id, toggleSection); }}
                        title={isBenched ? 'Colocar em campo' : 'Mandar pro banco'}
                        className="p-0.5 text-slate-400 hover:text-white transition-colors"
                    >
                        {isBenched ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                    </button>
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); moveToSection(pl.id, switchSection); }}
                        title={`Mover para Time ${otherTeam}`}
                        className="p-0.5 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeftRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    };

    // ── Drop zone (panel section) ──────────────────────────────────
    const DropZone = ({ section, players }: { section: Section; players: PlayerToken[] }) => (
        <div
            onDragOver={e => onPanelDragOver(e, section)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={e => onPanelDrop(e, section)}
            className={`space-y-1 rounded-lg p-1 min-h-[28px] transition-colors
                ${dropTarget === section && panelDragId ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
        >
            {players.map(pl => <PlayerCard key={pl.id} pl={pl} section={section} />)}
            {players.length === 0 && panelDragId && dropTarget !== section && (
                <p className="text-[10px] text-slate-600 text-center py-1">Solte aqui</p>
            )}
        </div>
    );

    // ─────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-2 sm:p-4"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-slate-900 rounded-2xl w-full max-w-5xl flex flex-col overflow-hidden shadow-2xl" style={{ maxHeight: '95vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-600/25 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <ellipse cx="12" cy="12" rx="10" ry="10" />
                                <path d="M12 2 C8 6 8 18 12 22" /><path d="M12 2 C16 6 16 18 12 22" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-tight">Mesa Tática</p>
                            <p className="text-slate-400 text-xs truncate max-w-[200px]">{activityName || 'Atividade'}</p>
                        </div>
                    </div>
                    {/* Team counter pills */}
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/40 rounded-full text-xs font-semibold text-blue-300">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            Time A — {teamAField.length} em campo{teamABench.length > 0 ? ` · ${teamABench.length} banco` : ''}
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/40 rounded-full text-xs font-semibold text-red-300">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                            Time B — {teamBField.length} em campo{teamBBench.length > 0 ? ` · ${teamBBench.length} banco` : ''}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0">

                    {/* Left toolbar */}
                    <div className="flex flex-col items-center gap-2 p-2 border-r border-slate-700 bg-slate-800/60 flex-shrink-0">
                        <ToolBtn active={tool === 'select'} onClick={() => setTool('select')} title="Mover jogadores">
                            <MousePointer className="w-4 h-4" />
                        </ToolBtn>
                        <ToolBtn active={tool === 'draw'} onClick={() => setTool('draw')} title="Desenhar seta">
                            <Pencil className="w-4 h-4" />
                        </ToolBtn>
                        <ToolBtn active={tool === 'erase'} onClick={() => setTool('erase')} title="Apagar seta">
                            <Eraser className="w-4 h-4" />
                        </ToolBtn>
                        <div className="w-7 h-px bg-slate-700 my-1" />
                        {PRESET_COLORS.map(c => (
                            <button key={c.id} title={c.id}
                                onClick={() => { setArrowColor(c.value); setTool('draw'); }}
                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${arrowColor === c.value ? 'border-white scale-110' : 'border-slate-600'}`}
                                style={{ backgroundColor: c.value }}
                            />
                        ))}
                        <div className="w-7 h-px bg-slate-700 my-1" />
                        <ToolBtn active={false} onClick={undo} title="Desfazer" disabled={history.length === 0}>
                            <RotateCcw className="w-4 h-4" />
                        </ToolBtn>
                        <ToolBtn active={false} onClick={clearArrows} title="Limpar setas">
                            <Trash2 className="w-4 h-4" />
                        </ToolBtn>
                    </div>

                    {/* Field */}
                    <div className="flex-1 flex items-center justify-center bg-slate-950 p-2 overflow-hidden">
                        <svg ref={svgRef} viewBox="0 0 105 68"
                            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 'calc(95vh - 144px)', cursor: svgCursor }}
                            onMouseDown={onSvgDown} onMouseMove={onSvgMove} onMouseUp={onSvgUp} onMouseLeave={onSvgUp}
                            onTouchStart={onSvgTouchStart} onTouchMove={onSvgTouchMove} onTouchEnd={onSvgTouchEnd}
                        >
                            <defs>
                                {PRESET_COLORS.map(c => (
                                    <marker key={c.id} id={`mk-${c.id}`} markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                                        <path d="M0,0 L0,5 L5,2.5 z" fill={c.value} />
                                    </marker>
                                ))}
                                <marker id="mk-custom" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                                    <path d="M0,0 L0,5 L5,2.5 z" fill={arrowColor} />
                                </marker>
                            </defs>

                            {/* Stripes */}
                            {[...Array(8)].map((_, i) => (
                                <rect key={i} x={i * 13.125} y="0" width="13.125" height="68"
                                    fill={i % 2 === 0 ? '#16a34a' : '#15803d'} />
                            ))}
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
                            {([[0.4, 0.4], [104.6, 0.4], [0.4, 67.6], [104.6, 67.6]] as [number,number][]).map(([x, y], i) => {
                                const rx = x < 52 ? 1 : -1; const ry = y < 34 ? 1 : -1;
                                return <path key={i} d={`M${x + rx * 2},${y} A2,2 0 0,${x > 52 ? 1 : 0} ${x},${y + ry * 2}`} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.7" />;
                            })}

                            {/* Arrows */}
                            {state.arrows.map(a => (
                                <line key={a.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                                    stroke={a.color} strokeWidth="1.1" markerEnd={markerFor(a.color)}
                                    style={{ cursor: tool === 'erase' ? 'pointer' : 'default' }}
                                    onClick={() => eraseArrow(a.id)} opacity="0.92" />
                            ))}

                            {/* Live arrow */}
                            {drawStart && drawLive && (
                                <line x1={drawStart.x} y1={drawStart.y} x2={drawLive.x} y2={drawLive.y}
                                    stroke={arrowColor} strokeWidth="1.1" strokeDasharray="3 2"
                                    markerEnd="url(#mk-custom)" opacity="0.65"
                                    style={{ pointerEvents: 'none' }} />
                            )}

                            {/* Players on field */}
                            {onField.map(pl => (
                                <g key={pl.id} transform={`translate(${pl.x},${pl.y})`}
                                    style={{ cursor: tool === 'select' ? (draggingSvg === pl.id ? 'grabbing' : 'grab') : 'default' }}
                                    onMouseDown={e => onPlayerDown(e, pl.id)}
                                    onTouchStart={e => onPlayerTouchStart(e, pl.id)}
                                >
                                    <circle r="3.6" fill={pl.color} stroke="white" strokeWidth="0.55" />
                                    <text textAnchor="middle" dominantBaseline="central"
                                        fill="white" fontSize="2.3" fontWeight="bold"
                                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                        {pl.initials}
                                    </text>
                                    <text y="5.8" textAnchor="middle" fill="white" fontSize="2.1" fontWeight="600"
                                        stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" paintOrder="stroke"
                                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                        {pl.name.split(' ')[0]}
                                    </text>
                                </g>
                            ))}
                        </svg>
                    </div>

                    {/* Right panel — two teams */}
                    <div className="w-48 border-l border-slate-700 bg-slate-800/50 flex flex-col flex-shrink-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto">

                            {/* ── TIME A ── */}
                            <div className="border-b border-slate-700/60">
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                                        Time A
                                    </span>
                                    <span className="ml-auto text-[10px] text-blue-400 font-semibold">
                                        {teamAField.length + teamABench.length}
                                    </span>
                                </div>
                                <div className="px-2 pt-2">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">Em Campo</p>
                                    <DropZone section="A-field" players={teamAField} />
                                </div>
                                <div className="px-2 pt-1 pb-2">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">Banco</p>
                                    <DropZone section="A-bench" players={teamABench} />
                                </div>
                            </div>

                            {/* ── TIME B ── */}
                            <div>
                                <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                                    <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                                        Time B
                                    </span>
                                    <span className="ml-auto text-[10px] text-red-400 font-semibold">
                                        {teamBField.length + teamBBench.length}
                                    </span>
                                </div>
                                <div className="px-2 pt-2">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">Em Campo</p>
                                    <DropZone section="B-field" players={teamBField} />
                                </div>
                                <div className="px-2 pt-1 pb-2">
                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">Banco</p>
                                    <DropZone section="B-bench" players={teamBBench} />
                                </div>
                            </div>

                        </div>

                        {/* Panel legend */}
                        <div className="border-t border-slate-700 px-3 py-2 flex-shrink-0">
                            <p className="text-[9px] text-slate-600 leading-tight">
                                Arraste para mover entre times e banco
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
                    <p className="text-xs text-slate-500 hidden sm:block">
                        {tool === 'select' && '↖ Arraste os jogadores para reposicioná-los'}
                        {tool === 'draw'   && '↗ Clique e arraste para desenhar setas'}
                        {tool === 'erase'  && '✕ Clique em uma seta para apagá-la'}
                    </p>
                    <div className="flex items-center gap-3 ml-auto">
                        <button onClick={onClose}
                            className="px-4 py-2 text-slate-300 hover:text-white text-sm font-semibold transition-colors rounded-lg hover:bg-slate-700">
                            Cancelar
                        </button>
                        <button onClick={() => onSave(JSON.stringify(state))}
                            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-green-600/25">
                            <Save className="w-4 h-4" />
                            Salvar Mesa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TacticalBoardModal;
