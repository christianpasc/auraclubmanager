
import React, { useState, useRef, useCallback } from 'react';
import { ArrowUpRight, Circle, Brush, Move, Eraser, RotateCcw, Trash2, Save, X, Maximize, Minimize } from 'lucide-react';
import { AnnotationShape, AnnotationShapeType, AnnotationPoint } from '../services/videoService';
import { useLanguage } from '../contexts/LanguageContext';

type Tool = AnnotationShapeType | 'select' | 'erase';

const PRESET_COLORS = [
    { id: 'red',    value: '#ef4444' },
    { id: 'yellow', value: '#facc15' },
    { id: 'blue',   value: '#2563eb' },
    { id: 'white',  value: '#ffffff' },
];

const MIN_FREEHAND_DIST = 0.6; // % units in the 0-100 viewBox — avoids one point per pixel

interface VideoAnnotationOverlayProps {
    initialShapes: AnnotationShape[];
    onSave: (shapes: AnnotationShape[]) => void;
    onClose: () => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}

const translateShape = (s: AnnotationShape, dx: number, dy: number): AnnotationShape => {
    if (s.type === 'arrow') return { ...s, x1: s.x1! + dx, y1: s.y1! + dy, x2: s.x2! + dx, y2: s.y2! + dy };
    if (s.type === 'circle') return { ...s, cx: s.cx! + dx, cy: s.cy! + dy };
    if (s.type === 'freehand') return { ...s, points: (s.points ?? []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
    return s;
};

// Drawing logic adapted from components/TacticalBoardModal.tsx — same SVG
// coordinate-mapping + drag-to-draw pattern, generalized to a 0-100
// percentage viewBox (so it overlays any video frame) and extended with
// circle (mark a player/spot), freehand (free drawing) and select/move tools.
const VideoAnnotationOverlay: React.FC<VideoAnnotationOverlayProps> = ({ initialShapes, onSave, onClose, isFullscreen, onToggleFullscreen }) => {
    const { t } = useLanguage();
    const svgRef = useRef<SVGSVGElement>(null);

    const [shapes, setShapes] = useState<AnnotationShape[]>(initialShapes);
    const [tool, setTool] = useState<Tool>('arrow');
    const [color, setColor] = useState('#ef4444');
    const [drawStart, setDrawStart] = useState<AnnotationPoint | null>(null);
    const [drawLive, setDrawLive] = useState<AnnotationPoint | null>(null);
    const [freehandPoints, setFreehandPoints] = useState<AnnotationPoint[] | null>(null);
    const [history, setHistory] = useState<AnnotationShape[][]>([]);

    // Moving an existing shape
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragAnchor, setDragAnchor] = useState<AnnotationPoint | null>(null);
    const [dragOriginal, setDragOriginal] = useState<AnnotationShape | null>(null);

    const toSvg = useCallback((cx: number, cy: number): AnnotationPoint => {
        const svg = svgRef.current;
        if (!svg) return { x: 50, y: 50 };
        const r = svg.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100)),
            y: Math.max(0, Math.min(100, ((cy - r.top) / r.height) * 100)),
        };
    }, []);

    const snapshot = useCallback(() => {
        setHistory(h => [...h.slice(-14), shapes]);
    }, [shapes]);

    const undo = () => {
        if (history.length === 0) return;
        setShapes(history[history.length - 1]);
        setHistory(h => h.slice(0, -1));
    };

    const dist = (a: AnnotationPoint, b: AnnotationPoint) => Math.hypot(b.x - a.x, b.y - a.y);

    const commitDrag = (start: AnnotationPoint, end: AnnotationPoint) => {
        if (tool === 'arrow' && dist(start, end) > 1) {
            setShapes(s => [...s, { id: `s-${Date.now()}`, type: 'arrow', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color }]);
        } else if (tool === 'circle' && dist(start, end) > 0.5) {
            setShapes(s => [...s, { id: `s-${Date.now()}`, type: 'circle', cx: start.x, cy: start.y, r: dist(start, end), color }]);
        }
    };

    // Starts moving an existing shape — called from the shape's own handler, not the canvas.
    const startMoveShape = (e: React.MouseEvent | React.TouchEvent, shape: AnnotationShape) => {
        if (tool !== 'select') return;
        e.stopPropagation();
        const point = 'touches' in e ? e.touches[0] : e;
        snapshot();
        setDraggingId(shape.id);
        setDragAnchor(toSvg(point.clientX, point.clientY));
        setDragOriginal(shape);
    };

    // ── Mouse ──────────────────────────────────────────────────────
    const onDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (tool === 'select') return; // dragging starts on the shape itself
        const p = toSvg(e.clientX, e.clientY);
        if (tool === 'arrow' || tool === 'circle') {
            snapshot();
            setDrawStart(p); setDrawLive(p);
        } else if (tool === 'freehand') {
            snapshot();
            setFreehandPoints([p]);
        }
    };
    const onMove = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (drawStart) setDrawLive(p);
        if (freehandPoints) {
            const last = freehandPoints[freehandPoints.length - 1];
            if (dist(last, p) >= MIN_FREEHAND_DIST) setFreehandPoints(pts => [...(pts ?? []), p]);
        }
        if (draggingId && dragAnchor && dragOriginal) {
            const dx = p.x - dragAnchor.x, dy = p.y - dragAnchor.y;
            const moved = translateShape(dragOriginal, dx, dy);
            setShapes(s => s.map(sh => sh.id === draggingId ? moved : sh));
        }
    };
    const onUp = (e: React.MouseEvent) => {
        const p = toSvg(e.clientX, e.clientY);
        if (drawStart) { commitDrag(drawStart, p); setDrawStart(null); setDrawLive(null); }
        if (freehandPoints) {
            if (freehandPoints.length > 1) {
                setShapes(s => [...s, { id: `s-${Date.now()}`, type: 'freehand', points: freehandPoints, color }]);
            }
            setFreehandPoints(null);
        }
        if (draggingId) { setDraggingId(null); setDragAnchor(null); setDragOriginal(null); }
    };

    // ── Touch ──────────────────────────────────────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        if (tool === 'select') return;
        const touch = e.touches[0];
        const p = toSvg(touch.clientX, touch.clientY);
        if (tool === 'arrow' || tool === 'circle') {
            snapshot();
            setDrawStart(p); setDrawLive(p);
        } else if (tool === 'freehand') {
            snapshot();
            setFreehandPoints([p]);
        }
    };
    const onTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        const touch = e.touches[0];
        const p = toSvg(touch.clientX, touch.clientY);
        if (drawStart) setDrawLive(p);
        if (freehandPoints) {
            const last = freehandPoints[freehandPoints.length - 1];
            if (dist(last, p) >= MIN_FREEHAND_DIST) setFreehandPoints(pts => [...(pts ?? []), p]);
        }
        if (draggingId && dragAnchor && dragOriginal) {
            const dx = p.x - dragAnchor.x, dy = p.y - dragAnchor.y;
            const moved = translateShape(dragOriginal, dx, dy);
            setShapes(s => s.map(sh => sh.id === draggingId ? moved : sh));
        }
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        const touch = e.changedTouches[0];
        const p = toSvg(touch.clientX, touch.clientY);
        if (drawStart) { commitDrag(drawStart, p); setDrawStart(null); setDrawLive(null); }
        if (freehandPoints) {
            if (freehandPoints.length > 1) {
                setShapes(s => [...s, { id: `s-${Date.now()}`, type: 'freehand', points: freehandPoints, color }]);
            }
            setFreehandPoints(null);
        }
        if (draggingId) { setDraggingId(null); setDragAnchor(null); setDragOriginal(null); }
    };

    const eraseShape = (id: string) => {
        if (tool !== 'erase') return;
        snapshot();
        setShapes(s => s.filter(sh => sh.id !== id));
    };
    const clearAll = () => { snapshot(); setShapes([]); };

    const markerFor = (c: string) => {
        const found = PRESET_COLORS.find(p => p.value === c);
        return found ? `url(#vmk-${found.id})` : 'url(#vmk-custom)';
    };

    const pointsToPath = (pts: AnnotationPoint[]) => pts.map(p => `${p.x},${p.y}`).join(' ');

    const cursor = tool === 'erase' ? 'pointer' : tool === 'select' ? 'default' : 'crosshair';

    const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
        { id: 'select',   icon: Move,         label: t('videos.annotate.move') },
        { id: 'arrow',    icon: ArrowUpRight, label: t('videos.annotate.arrow') },
        { id: 'circle',   icon: Circle,       label: t('videos.annotate.circle') },
        { id: 'freehand', icon: Brush,        label: t('videos.annotate.freehand') },
        { id: 'erase',    icon: Eraser,       label: t('videos.annotate.erase') },
    ];

    return (
        <div className="absolute inset-0 z-20 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-black/70 px-3 py-2 rounded-t-2xl flex-wrap">
                {TOOLS.map(({ id, icon: Icon, label }) => (
                    <button key={id} title={label} onClick={() => setTool(id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${tool === id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}>
                        <Icon className="w-4 h-4" />
                    </button>
                ))}
                <div className="w-px h-5 bg-white/20" />
                {PRESET_COLORS.map(c => (
                    <button key={c.id} title={c.id} onClick={() => { setColor(c.value); if (tool === 'erase' || tool === 'select') setTool('arrow'); }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.value }} />
                ))}
                <div className="w-px h-5 bg-white/20" />
                <button title={t('videos.annotate.undo')} onClick={undo} disabled={history.length === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 disabled:opacity-30">
                    <RotateCcw className="w-4 h-4" />
                </button>
                <button title={t('videos.annotate.clear')} onClick={clearAll}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10">
                    <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex-1" />
                <button onClick={onToggleFullscreen} title={isFullscreen ? t('videos.annotate.exitFullscreen') : t('videos.annotate.fullscreen')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10">
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                <button onClick={onClose} title={t('common.cancel')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10">
                    <X className="w-4 h-4" />
                </button>
                <button onClick={() => onSave(shapes)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">
                    <Save className="w-3.5 h-3.5" /> {t('common.save')}
                </button>
            </div>

            {/* Drawing surface */}
            <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none"
                className="flex-1 w-full h-full"
                style={{ cursor }}
                onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
                <defs>
                    {PRESET_COLORS.map(c => (
                        <marker key={c.id} id={`vmk-${c.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill={c.value} />
                        </marker>
                    ))}
                    <marker id="vmk-custom" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill={color} />
                    </marker>
                </defs>

                {shapes.map(s => {
                    const isMovable = tool === 'select';
                    const interactive = {
                        style: { cursor: tool === 'erase' ? 'pointer' as const : isMovable ? 'grab' as const : 'default' as const },
                        onClick: () => eraseShape(s.id),
                        onMouseDown: (e: React.MouseEvent) => startMoveShape(e, s),
                        onTouchStart: (e: React.TouchEvent) => startMoveShape(e, s),
                    };
                    if (s.type === 'arrow') {
                        return (
                            <line key={s.id} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                                stroke={s.color} strokeWidth={isMovable ? 1.6 : 0.8} markerEnd={markerFor(s.color)} opacity="0.92" {...interactive} />
                        );
                    }
                    if (s.type === 'circle') {
                        return (
                            <circle key={s.id} cx={s.cx} cy={s.cy} r={s.r}
                                stroke={s.color} strokeWidth={isMovable ? 1.6 : 0.8} fill={isMovable ? 'rgba(255,255,255,0.01)' : 'none'} opacity="0.92" {...interactive} />
                        );
                    }
                    if (s.type === 'freehand' && s.points) {
                        return (
                            <polyline key={s.id} points={pointsToPath(s.points)}
                                stroke={s.color} strokeWidth={isMovable ? 1.6 : 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.92" {...interactive} />
                        );
                    }
                    return null;
                })}

                {/* Live previews */}
                {drawStart && drawLive && tool === 'arrow' && (
                    <line x1={drawStart.x} y1={drawStart.y} x2={drawLive.x} y2={drawLive.y}
                        stroke={color} strokeWidth="0.8" strokeDasharray="2 1.5"
                        markerEnd="url(#vmk-custom)" opacity="0.65" style={{ pointerEvents: 'none' }} />
                )}
                {drawStart && drawLive && tool === 'circle' && (
                    <circle cx={drawStart.x} cy={drawStart.y} r={dist(drawStart, drawLive)}
                        stroke={color} strokeWidth="0.8" strokeDasharray="2 1.5" fill="none" opacity="0.65" style={{ pointerEvents: 'none' }} />
                )}
                {freehandPoints && freehandPoints.length > 1 && (
                    <polyline points={pointsToPath(freehandPoints)}
                        stroke={color} strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
                        opacity="0.85" style={{ pointerEvents: 'none' }} />
                )}
            </svg>
        </div>
    );
};

export default VideoAnnotationOverlay;
