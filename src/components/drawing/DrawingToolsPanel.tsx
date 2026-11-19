import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronLeft, 
    ChevronDown,
    Pencil,
    Pen,
    Paintbrush,
    Highlighter,
    Sparkles,
    PaintBucket,
    Eraser, 
    Minus, 
    ArrowUpRight, 
    MoveUpRight,
    Square, 
    Circle, 
    Grid, 
    Eye, 
    EyeOff, 
    SlidersHorizontal, 
    GripVertical,
    GripHorizontal,
    Lasso,
    Scan,
    MousePointer2,
    Camera,
    Smartphone
} from 'lucide-react';
import { toolsRegistry } from '../../modules/frame/tools/registry';

// Classic quick color presets
const COLOR_PRESETS = [
    { name: 'Noir Encre', value: '#000000' },
    { name: 'Gris Crayon', value: '#71717a' },
    { name: 'Bleu Esquisse', value: '#3b82f6' },
    { name: 'Vert Émeraude', value: '#10B981' },
    { name: 'Rouge Cinéma', value: '#ef4444' },
    { name: 'Blanc Craie', value: '#ffffff' }
];

const STAGING_TOOLS = new Set(['arrow', 'cameraArrow', 'zoomFrame', 'line', 'rect', 'circle']);

// ─── CURSEUR VERTICAL TAILLE & OPACITÉ ──────────────────────────────────────
interface VerticalSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (val: number) => void;
    onDragStateChange?: (isDragging: boolean) => void;
    label: string;
    unit?: string;
}

const VerticalSlider: React.FC<VerticalSliderProps> = ({
    value,
    min,
    max,
    step = 1,
    onChange,
    onDragStateChange,
    label,
    unit = ''
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

    const updateFromPointer = (clientY: number) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const offsetY = rect.bottom - clientY;
        const ratio = Math.max(0, Math.min(1, offsetY / rect.height));
        let rawVal = min + ratio * (max - min);
        if (step) {
            rawVal = Math.round(rawVal / step) * step;
        }
        onChange(Math.max(min, Math.min(max, rawVal)));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setIsDragging(true);
        onDragStateChange?.(true);
        updateFromPointer(e.clientY);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            updateFromPointer(e.clientY);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            onDragStateChange?.(false);
            try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
        }
    };

    return (
        <div 
            className="flex flex-col items-center relative select-none py-1 group/slider w-11"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {isDragging && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#18181b] text-white text-[10px] font-mono font-bold shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                    {value}{unit}
                </div>
            )}

            <div 
                ref={trackRef}
                className="w-1.5 h-28 bg-white/15 hover:bg-white/20 rounded-full relative cursor-pointer transition-colors"
            >
                <div 
                    className="absolute bottom-0 left-0 right-0 bg-[#10B981] rounded-full"
                    style={{ height: `${percentage}%` }}
                />
                
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md border border-black/20 cursor-grab active:cursor-grabbing transition-transform group-hover/slider:scale-110"
                    style={{ bottom: `calc(${percentage}% - 8px)` }}
                />
            </div>
            
            <span className="text-[9px] font-bold text-[#a1a1aa] mt-2 uppercase tracking-wider text-center">
                {label}
            </span>
            <span className="text-[9px] font-mono text-[#71717a] mt-0.5">
                {value}{unit}
            </span>
        </div>
    );
};

export interface DrawingToolsPanelProps {
    orientation: 'vertical' | 'horizontal';
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onDragStart: (e: React.PointerEvent) => void;
    // Store props
    brushTool: string;
    setBrushTool: (tool: string) => void;
    brushColor: string;
    setBrushColor: (color: string) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushOpacity: number;
    setBrushOpacity: (opacity: number) => void;
    onionSkin: boolean;
    setOnionSkin: (enabled: boolean) => void;
    compositionGrid: 'none' | 'thirds' | 'perspective' | 'safe';
    setCompositionGrid: (grid: 'none' | 'thirds' | 'perspective' | 'safe') => void;
    stylusOnlyMode?: boolean;
    setStylusOnlyMode?: (enabled: boolean) => void;
    isDetailsOpen: boolean;
    setIsDetailsOpen: (open: boolean) => void;
    onResetHandMode?: () => void;
    onBrushSizePreviewChange?: (active: boolean) => void;
}

export const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
    orientation,
    isCollapsed,
    onToggleCollapse,
    onDragStart,
    brushTool,
    setBrushTool,
    brushColor,
    setBrushColor,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    onionSkin,
    setOnionSkin,
    compositionGrid,
    setCompositionGrid,
    stylusOnlyMode = false,
    setStylusOnlyMode,
    isDetailsOpen,
    setIsDetailsOpen,
    onResetHandMode,
    onBrushSizePreviewChange
}) => {
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isBrushSlidersOpen, setIsBrushSlidersOpen] = useState(false);
    // Two distinct modes to avoid tablet clutter: 'draw' (Dessin pur) vs 'staging' (Cadre & Flèches)
    const [toolSection, setToolSection] = useState<'draw' | 'staging'>(() =>
        STAGING_TOOLS.has(brushTool) ? 'staging' : 'draw'
    );

    useEffect(() => {
        if (STAGING_TOOLS.has(brushTool)) {
            setToolSection('staging');
        }
    }, [brushTool]);

    const handleSelectTool = (t: string) => {
        if (onResetHandMode) onResetHandMode();
        if (brushTool === t && t !== 'select') {
            setBrushTool('select');
        } else {
            setBrushTool(t);
        }
    };

    const handleSwitchSection = (sec: 'draw' | 'staging') => {
        setToolSection(sec);
        if (sec === 'staging' && !STAGING_TOOLS.has(brushTool) && brushTool !== 'select') {
            // Switch to neutral select/arrow mode when entering Staging section
            setBrushTool('arrow');
        } else if (sec === 'draw' && STAGING_TOOLS.has(brushTool)) {
            setBrushTool('brush');
        }
    };

    // Tool Icon lookup for collapsed pill
    const CurrentToolIcon = toolsRegistry[brushTool]?.icon || Paintbrush;

    // ── COLLAPSED MINI-PILL ──
    if (isCollapsed) {
        return (
            <div className={`flex items-center gap-1.5 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl ${
                orientation === 'vertical' ? 'flex-col' : 'flex-row'
            }`}>
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#10B981] hover:text-white transition-all flex items-center gap-1"
                    title="Agrandir la boîte à outils"
                >
                    <CurrentToolIcon size={16} />
                    <div 
                        className="w-2.5 h-2.5 rounded-full border border-black/30 shadow-inner"
                        style={{ backgroundColor: brushColor }}
                    />
                </button>

                <div
                    onPointerDown={onDragStart}
                    className="p-1 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10 cursor-grab active:cursor-grabbing transition-colors"
                    title="Glisser pour déplacer / permuter le menu"
                >
                    {orientation === 'vertical' ? <GripHorizontal size={13} /> : <GripVertical size={13} />}
                </div>
            </div>
        );
    }

    // ── VERTICAL LAYOUT (Default Left or Right) ──
    if (orientation === 'vertical') {
        return (
            <div className="flex flex-col items-center gap-1 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl relative select-none">
                {/* Top Header: Collapse button + 2-Mode Switcher (Dessin vs Cadre & Flèches) */}
                <div className="flex flex-col items-center gap-1.5 pb-1.5 border-b border-white/10 w-full">
                    <div className="flex items-center justify-between w-full px-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${
                            toolSection === 'draw' ? 'text-[#10B981]' : 'text-sky-400'
                        }`}>
                            {toolSection === 'draw' ? 'Dessin' : 'Cadrage'}
                        </span>
                        <button
                            onClick={onToggleCollapse}
                            className="text-[#71717a] hover:text-white p-0.5 rounded hover:bg-white/5 transition-colors"
                            title="Réduire le panneau d'outils"
                        >
                            <ChevronLeft size={11} />
                        </button>
                    </div>

                    {/* Segmented Mode Pill: Dessin Pur (Émeraude) vs Cadre & Flèches (Bleu Cinéma) */}
                    <div className="grid grid-cols-2 gap-0.5 bg-[#09090b] p-0.5 rounded-xl border border-white/10 w-full">
                        <button
                            onClick={() => handleSwitchSection('draw')}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                                toolSection === 'draw'
                                    ? 'bg-[#10B981] text-white shadow'
                                    : 'text-[#71717a] hover:text-white'
                            }`}
                            title="Mode Dessin Pur (Pinceaux, Seau, Gomme, Lasso)"
                        >
                            <Paintbrush size={12} />
                        </button>
                        <button
                            onClick={() => handleSwitchSection('staging')}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                                toolSection === 'staging'
                                    ? 'bg-sky-500 text-white shadow'
                                    : 'text-[#71717a] hover:text-white'
                            }`}
                            title="Mode Mise en Scène (Flèches d'action, Cadres caméra, Formes & Grilles)"
                        >
                            <Scan size={12} />
                        </button>
                    </div>
                </div>

                {/* Neutral Mouse Pointer / Selection Tool (Always accessible at top of active section) */}
                <button
                    onClick={() => handleSelectTool('select')}
                    className={`p-2 rounded-xl transition-all mt-0.5 ${
                        brushTool === 'select'
                            ? 'bg-white text-black shadow-md scale-105'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                    }`}
                    title="Outil Souris (Curseur neutre : sélectionner, déplacer et modifier vos flèches & cadres)"
                >
                    <MousePointer2 size={15} />
                </button>

                <div className="w-6 h-px bg-white/10" />

                {/* ── SECTION 1 : DESSIN PUR ── */}
                {toolSection === 'draw' ? (
                    <div className="flex flex-col items-center gap-1 py-0.5">
                        <button
                            onClick={() => handleSelectTool('pencil')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'pencil' || brushTool === 'sketch'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Crayon Fusain (Grain sec poreux)"
                        >
                            <Pencil size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('pen')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'pen'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Stylo Calibré (Trait net et d'épaisseur constante)"
                        >
                            <Pen size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('brush')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'brush'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Plume Calligraphique (Pleins et déliés expressifs)"
                        >
                            <Paintbrush size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('highlighter')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'highlighter' || brushTool === 'marker'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Feutre d'Ombrage (Mèche biseautée en fusion produit)"
                        >
                            <Highlighter size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('airbrush')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'airbrush'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Aérographe (Diffusion radiale vaporeuse)"
                        >
                            <Sparkles size={16} />
                        </button>

                        {/* Seau de peinture avec pastille de la couleur active */}
                        <button
                            onClick={() => handleSelectTool('fill')}
                            className={`p-2 rounded-xl transition-all relative ${
                                brushTool === 'fill'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Seau de Peinture (Cliquer dans une zone fermée pour la remplir avec la couleur active)"
                        >
                            <PaintBucket size={16} />
                            <span
                                className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white/80"
                                style={{ backgroundColor: brushColor }}
                            />
                        </button>

                        <div className="w-5 h-px bg-white/10 my-0.5" />

                        <button
                            onClick={() => handleSelectTool('eraser')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'eraser'
                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Gomme (Effacer les traits)"
                        >
                            <Eraser size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('lasso')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'lasso'
                                    ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Outil Lasso & Transformation (Déplacer, Agrandir, Pivoter, Dupliquer)"
                        >
                            <Lasso size={16} />
                        </button>
                    </div>
                ) : (
                    /* ── SECTION 2 : MISE EN SCÈNE / CADRES & FLÈCHES (Bleu Cinéma) ── */
                    <div className="flex flex-col items-center gap-1 py-0.5">
                        <button
                            onClick={() => handleSelectTool('arrow')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'arrow'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Flèche d'action personnage (Détourée blanc/noir haute visibilité)"
                        >
                            <ArrowUpRight size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('cameraArrow')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'cameraArrow'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Flèche mouvement caméra 3D (Panoramique / Travelling)"
                        >
                            <MoveUpRight size={16} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('zoomFrame')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'zoomFrame'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Cadre Caméra Zoom / Travelling (Gauche→Droite : Zoom Avant, Droite→Gauche : Zoom Arrière)"
                        >
                            <Scan size={16} />
                        </button>

                        <div className="w-5 h-px bg-white/10 my-0.5" />

                        <button
                            onClick={() => handleSelectTool('line')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'line'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Ligne droite / Ligne d'horizon"
                        >
                            <Minus size={15} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('rect')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'rect'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Cadre / Rectangle"
                        >
                            <Square size={15} />
                        </button>

                        <button
                            onClick={() => handleSelectTool('circle')}
                            className={`p-2 rounded-xl transition-all ${
                                brushTool === 'circle'
                                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 scale-105'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title="Cercle"
                        >
                            <Circle size={15} />
                        </button>

                        <button
                            onClick={() =>
                                setCompositionGrid(
                                    compositionGrid === 'none'
                                        ? 'safe'
                                        : compositionGrid === 'safe'
                                        ? 'thirds'
                                        : compositionGrid === 'thirds'
                                        ? 'perspective'
                                        : 'none'
                                )
                            }
                            className={`p-2 rounded-xl transition-all ${
                                compositionGrid !== 'none'
                                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                            }`}
                            title={`Mire Viseur Caméra (${
                                compositionGrid === 'none'
                                    ? 'Aucune'
                                    : compositionGrid === 'safe'
                                    ? 'Safe Zones 90%/80% + Croix centrale'
                                    : compositionGrid === 'thirds'
                                    ? 'Règle des Tiers'
                                    : 'Perspective'
                            })`}
                        >
                            <Grid size={15} />
                        </button>
                    </div>
                )}

                <div className="w-6 h-px bg-white/10" />

                {/* Color Swatch + Popover */}
                <div className="relative py-0.5">
                    <button
                        onClick={() => {
                            setIsColorPickerOpen(!isColorPickerOpen);
                            setIsBrushSlidersOpen(false);
                        }}
                        className="w-7 h-7 rounded-full border-2 border-white/25 shadow-inner transition-transform hover:scale-110 active:scale-95"
                        style={{ backgroundColor: brushColor }}
                        title="Couleur du trait / remplissage"
                    />

                    {isColorPickerOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsColorPickerOpen(false)}
                            />
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 p-2.5 bg-[#18181b]/98 border border-white/15 rounded-2xl shadow-2xl z-50 flex items-center gap-2 whitespace-nowrap backdrop-blur-2xl">
                                {COLOR_PRESETS.map(preset => (
                                    <button
                                        key={preset.value}
                                        onClick={() => {
                                            setBrushColor(preset.value);
                                            setIsColorPickerOpen(false);
                                        }}
                                        className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                                            brushColor === preset.value
                                                ? 'border-white scale-110 ring-2 ring-[#10B981]/50'
                                                : 'border-white/20'
                                        }`}
                                        style={{ backgroundColor: preset.value }}
                                        title={preset.name}
                                    />
                                ))}
                                <div className="h-5 w-px bg-white/10 mx-0.5" />
                                <label
                                    className="w-6 h-6 rounded-full border border-white/20 bg-gradient-to-tr from-pink-500 via-emerald-500 to-amber-500 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform"
                                    title="Couleur personnalisée"
                                >
                                    <input
                                        type="color"
                                        value={brushColor}
                                        onChange={e => setBrushColor(e.target.value)}
                                        className="opacity-0 w-0 h-0"
                                    />
                                </label>
                            </div>
                        </>
                    )}
                </div>

                {/* Brush Size & Opacity Sliders Popover */}
                <div className="relative py-0.5">
                    <button
                        onClick={() => {
                            setIsBrushSlidersOpen(!isBrushSlidersOpen);
                            setIsColorPickerOpen(false);
                        }}
                        className={`p-1.5 rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                            isBrushSlidersOpen
                                ? 'bg-[#10B981]/20 text-[#10B981]'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Réglages d'épaisseur et d'opacité (avec aperçu taille réelle sur la toile)"
                    >
                        <SlidersHorizontal size={14} />
                        <span className="text-[8px] font-mono">{brushSize}px</span>
                    </button>

                    {isBrushSlidersOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsBrushSlidersOpen(false)}
                            />
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 bg-[#18181b]/98 backdrop-blur-2xl border border-white/15 rounded-3xl p-3 shadow-2xl flex items-center gap-4">
                                <VerticalSlider
                                    value={brushSize}
                                    min={1}
                                    max={80}
                                    step={1}
                                    onChange={setBrushSize}
                                    onDragStateChange={onBrushSizePreviewChange}
                                    label="Taille"
                                    unit="px"
                                />
                                <div className="w-px h-32 bg-white/10" />
                                <VerticalSlider
                                    value={Math.round(brushOpacity * 100)}
                                    min={5}
                                    max={100}
                                    step={5}
                                    onChange={val => setBrushOpacity(val / 100)}
                                    onDragStateChange={onBrushSizePreviewChange}
                                    label="Opacité"
                                    unit="%"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Onion Skin, Stylus Palm Rejection & Shot Camera Inspector */}
                <div className="flex flex-col items-center gap-1 pt-0.5 border-t border-white/10 w-full">
                    <button
                        onClick={() => setOnionSkin(!onionSkin)}
                        className={`p-1.5 rounded-lg transition-all ${
                            onionSkin
                                ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                                : 'text-[#71717a] hover:text-white hover:bg-white/5'
                        }`}
                        title="Pelure d'oignon (Afficher la pose précédente en transparence)"
                    >
                        {onionSkin ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {setStylusOnlyMode && (
                        <button
                            onClick={() => setStylusOnlyMode(!stylusOnlyMode)}
                            className={`p-1.5 rounded-lg transition-all ${
                                stylusOnlyMode
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                    : 'text-[#71717a] hover:text-white hover:bg-white/5'
                            }`}
                            title={
                                stylusOnlyMode
                                    ? 'Mode Stylet Tablette ACTIF (Rejet de paume : 1 doigt ignoré, 2 doigts pour zoom/rotation)'
                                    : 'Activer le Mode Stylet / Rejet de paume pour Tablette Android'
                            }
                        >
                            <Smartphone size={14} />
                        </button>
                    )}

                    <button
                        onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                        className={`p-1.5 rounded-lg transition-all ${
                            isDetailsOpen
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                                : 'text-[#71717a] hover:text-white hover:bg-white/5'
                        }`}
                        title="Fiche Caméra & Découpage du plan (Focales, Valeurs, Angles, Supports)"
                    >
                        <Camera size={14} />
                    </button>
                </div>

                {/* Bottom: 6-dot Drag Grip Handle */}
                <div
                    onPointerDown={onDragStart}
                    className="w-full pt-1 mt-0.5 border-t border-white/10 flex items-center justify-center text-[#52525b] hover:text-white cursor-grab active:cursor-grabbing transition-colors py-0.5"
                    title="Glisser pour déplacer ou permuter ce menu"
                >
                    <GripHorizontal size={15} />
                </div>
            </div>
        );
    }

    // ── HORIZONTAL LAYOUT (When docked at Bottom) ──
    return (
        <div className="flex items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-1.5 shadow-2xl relative select-none max-w-[96vw] overflow-x-auto">
            {/* Collapse & Mode Switcher */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-white/10 flex-shrink-0">
                <button
                    onClick={onToggleCollapse}
                    className="text-[#71717a] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                    title="Réduire le panneau d'outils"
                >
                    <ChevronDown size={13} />
                </button>

                <div className="flex items-center gap-0.5 bg-[#09090b] p-0.5 rounded-xl border border-white/10">
                    <button
                        onClick={() => handleSwitchSection('draw')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                            toolSection === 'draw'
                                ? 'bg-[#10B981] text-white shadow'
                                : 'text-[#71717a] hover:text-white'
                        }`}
                    >
                        <Paintbrush size={11} />
                        <span>Dessin</span>
                    </button>
                    <button
                        onClick={() => handleSwitchSection('staging')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                            toolSection === 'staging'
                                ? 'bg-sky-500 text-white shadow'
                                : 'text-[#71717a] hover:text-white'
                        }`}
                    >
                        <Scan size={11} />
                        <span>Cadre</span>
                    </button>
                </div>
            </div>

            {/* Mouse Selection Tool */}
            <button
                onClick={() => handleSelectTool('select')}
                className={`p-1.5 rounded-xl transition-all flex-shrink-0 ${
                    brushTool === 'select'
                        ? 'bg-white text-black shadow scale-105'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                }`}
                title="Outil Souris (Sélectionner, déplacer et modifier vos flèches & cadres)"
            >
                <MousePointer2 size={15} />
            </button>

            <div className="h-5 w-px bg-white/10 flex-shrink-0" />

            {/* Active Mode Tools Row */}
            {toolSection === 'draw' ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => handleSelectTool('pencil')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'pencil' || brushTool === 'sketch'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Crayon Fusain"
                    >
                        <Pencil size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('pen')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'pen'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Stylo Calibré"
                    >
                        <Pen size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('brush')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'brush'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Plume Calligraphique"
                    >
                        <Paintbrush size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('highlighter')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'highlighter' || brushTool === 'marker'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Feutre d'Ombrage"
                    >
                        <Highlighter size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('airbrush')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'airbrush'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Aérographe"
                    >
                        <Sparkles size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('fill')}
                        className={`p-1.5 rounded-xl transition-all relative ${
                            brushTool === 'fill'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Seau de Peinture"
                    >
                        <PaintBucket size={15} />
                        <span
                            className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white/80"
                            style={{ backgroundColor: brushColor }}
                        />
                    </button>

                    <button
                        onClick={() => handleSelectTool('eraser')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'eraser'
                                ? 'bg-rose-500 text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Gomme"
                    >
                        <Eraser size={15} />
                    </button>

                    <button
                        onClick={() => handleSelectTool('lasso')}
                        className={`p-1.5 rounded-xl transition-all ${
                            brushTool === 'lasso'
                                ? 'bg-[#10B981] text-white shadow scale-105'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Outil Lasso & Transformation"
                    >
                        <Lasso size={15} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => handleSelectTool('arrow')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'arrow' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Flèche Action Acteur (Détourée)"
                    >
                        <ArrowUpRight size={14} />
                    </button>
                    <button
                        onClick={() => handleSelectTool('cameraArrow')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'cameraArrow' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Flèche Mouvement Caméra"
                    >
                        <MoveUpRight size={14} />
                    </button>
                    <button
                        onClick={() => handleSelectTool('zoomFrame')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'zoomFrame' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Cadre Caméra (Zoom Avant / Arrière)"
                    >
                        <Scan size={14} />
                    </button>
                    <button
                        onClick={() => handleSelectTool('line')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'line' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Ligne"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={() => handleSelectTool('rect')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'rect' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Rectangle"
                    >
                        <Square size={14} />
                    </button>
                    <button
                        onClick={() => handleSelectTool('circle')}
                        className={`p-1.5 rounded-lg transition-all ${brushTool === 'circle' ? 'bg-sky-500 text-white' : 'text-[#a1a1aa] hover:text-white'}`}
                        title="Cercle"
                    >
                        <Circle size={14} />
                    </button>
                    <button
                        onClick={() =>
                            setCompositionGrid(
                                compositionGrid === 'none'
                                    ? 'safe'
                                    : compositionGrid === 'safe'
                                    ? 'thirds'
                                    : compositionGrid === 'thirds'
                                    ? 'perspective'
                                    : 'none'
                            )
                        }
                        className={`p-1.5 rounded-lg transition-all ${
                            compositionGrid !== 'none'
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'text-[#71717a] hover:text-white'
                        }`}
                        title="Mire Viseur Caméra (Safe Zones / Tiers / Perspective)"
                    >
                        <Grid size={14} />
                    </button>
                </div>
            )}

            <div className="h-5 w-px bg-white/10 flex-shrink-0" />

            {/* Color Swatch */}
            <div className="relative flex-shrink-0">
                <button
                    onClick={() => {
                        setIsColorPickerOpen(!isColorPickerOpen);
                        setIsBrushSlidersOpen(false);
                    }}
                    className="w-6 h-6 rounded-full border-2 border-white/25 shadow-inner transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: brushColor }}
                    title="Palette de couleur"
                />

                {isColorPickerOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsColorPickerOpen(false)} />
                        <div className="absolute bottom-full mb-3 left-0 p-2.5 bg-[#18181b]/98 border border-white/15 rounded-2xl shadow-2xl z-50 flex items-center gap-2 whitespace-nowrap backdrop-blur-2xl">
                            {COLOR_PRESETS.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => {
                                        setBrushColor(preset.value);
                                        setIsColorPickerOpen(false);
                                    }}
                                    className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${
                                        brushColor === preset.value
                                            ? 'border-white scale-110 ring-2 ring-[#10B981]/50'
                                            : 'border-white/20'
                                    }`}
                                    style={{ backgroundColor: preset.value }}
                                    title={preset.name}
                                />
                            ))}
                            <div className="h-5 w-px bg-white/10 mx-0.5" />
                            <label
                                className="w-6 h-6 rounded-full border border-white/20 bg-gradient-to-tr from-pink-500 via-emerald-500 to-amber-500 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform"
                                title="Couleur personnalisée"
                            >
                                <input
                                    type="color"
                                    value={brushColor}
                                    onChange={e => setBrushColor(e.target.value)}
                                    className="opacity-0 w-0 h-0"
                                />
                            </label>
                        </div>
                    </>
                )}
            </div>

            {/* Sliders Trigger */}
            <div className="relative flex-shrink-0">
                <button
                    onClick={() => {
                        setIsBrushSlidersOpen(!isBrushSlidersOpen);
                        setIsColorPickerOpen(false);
                    }}
                    className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                        isBrushSlidersOpen
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                    }`}
                    title="Taille et Opacité"
                >
                    <SlidersHorizontal size={13} />
                    <span className="text-[10px] font-mono">{brushSize}px</span>
                </button>

                {isBrushSlidersOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsBrushSlidersOpen(false)} />
                        <div className="absolute bottom-full mb-3 left-0 z-50 bg-[#18181b]/98 backdrop-blur-2xl border border-white/15 rounded-3xl p-3 shadow-2xl flex items-center gap-4">
                            <VerticalSlider
                                value={brushSize}
                                min={1}
                                max={80}
                                step={1}
                                onChange={setBrushSize}
                                onDragStateChange={onBrushSizePreviewChange}
                                label="Taille"
                                unit="px"
                            />
                            <div className="w-px h-32 bg-white/10" />
                            <VerticalSlider
                                value={Math.round(brushOpacity * 100)}
                                min={5}
                                max={100}
                                step={5}
                                onChange={val => setBrushOpacity(val / 100)}
                                onDragStateChange={onBrushSizePreviewChange}
                                label="Opacité"
                                unit="%"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Overlays (Onion Skin, Stylus Mode & Camera Inspector) */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={() => setOnionSkin(!onionSkin)}
                    className={`p-1.5 rounded-lg transition-all ${
                        onionSkin ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-[#71717a] hover:text-white'
                    }`}
                    title="Pelure d'oignon"
                >
                    {onionSkin ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {setStylusOnlyMode && (
                    <button
                        onClick={() => setStylusOnlyMode(!stylusOnlyMode)}
                        className={`p-1.5 rounded-lg transition-all ${
                            stylusOnlyMode
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'text-[#71717a] hover:text-white'
                        }`}
                        title="Mode Stylet / Rejet de paume Tablette Android"
                    >
                        <Smartphone size={14} />
                    </button>
                )}

                <button
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    className={`p-1.5 rounded-lg transition-all ${
                        isDetailsOpen ? 'bg-[#10B981] text-white' : 'text-[#71717a] hover:text-white'
                    }`}
                    title="Fiche Caméra & Découpage"
                >
                    <Camera size={14} />
                </button>
            </div>

            {/* Right: 6-dot Drag Grip Handle */}
            <div
                onPointerDown={onDragStart}
                className="pl-2 ml-0.5 border-l border-white/10 flex items-center justify-center text-[#52525b] hover:text-white cursor-grab active:cursor-grabbing transition-colors py-1 flex-shrink-0"
                title="Glisser pour déplacer ou permuter ce menu"
            >
                <GripVertical size={15} />
            </div>
        </div>
    );
};
