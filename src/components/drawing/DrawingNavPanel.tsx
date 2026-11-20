import React from 'react';
import { 
    Undo2, 
    Redo2, 
    Hand, 
    ZoomIn, 
    ZoomOut, 
    RotateCcw, 
    RotateCw, 
    Maximize2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    GripVertical, 
    GripHorizontal,
    FlipHorizontal2,
    EyeOff
} from 'lucide-react';

export interface DrawingNavPanelProps {
    orientation: 'vertical' | 'horizontal';
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onDragStart: (e: React.PointerEvent) => void;
    canvasZoom: number;
    setCanvasZoom: React.Dispatch<React.SetStateAction<number>>;
    canvasRotation: number;
    setCanvasRotation: React.Dispatch<React.SetStateAction<number>>;
    isHandMode: boolean;
    setIsHandMode: (mode: boolean) => void;
    isSpacePressed: boolean;
    isViewportModified: boolean;
    onResetViewport: () => void;
    onUndo: () => void;
    onRedo: () => void;
    isFlippedH?: boolean;
    onToggleFlipH?: () => void;
    onToggleFocusMode?: () => void;
}

export const DrawingNavPanel: React.FC<DrawingNavPanelProps> = ({
    orientation,
    isCollapsed,
    onToggleCollapse,
    onDragStart,
    canvasZoom,
    setCanvasZoom,
    canvasRotation,
    setCanvasRotation,
    isHandMode,
    setIsHandMode,
    isSpacePressed,
    isViewportModified,
    onResetViewport,
    onUndo,
    onRedo,
    isFlippedH = false,
    onToggleFlipH,
    onToggleFocusMode
}) => {
    // ─────────────────────────────────────────────────────────────────────────
    // COLLAPSED VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (isCollapsed) {
        if (orientation === 'vertical') {
            return (
                <div className="flex flex-col items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-2 py-2.5 shadow-2xl select-none">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                        title="Déplier le panneau de navigation"
                    >
                        <ChevronLeft size={14} />
                    </button>

                    <button
                        onClick={onResetViewport}
                        className={`p-1.5 rounded-lg transition-colors ${
                            isViewportModified
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Recentrer le canevas (100% / 0°)"
                    >
                        <Maximize2 size={13} />
                    </button>

                    <span className="text-[9px] font-mono font-bold text-white">
                        {Math.round(canvasZoom * 100)}%
                    </span>

                    <div className="w-4 h-px bg-white/10 my-0.5" />

                    {/* Drag Grip Handle (Bottom) */}
                    <div
                        onPointerDown={onDragStart}
                        className="cursor-grab active:cursor-grabbing p-1 rounded-md text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none"
                        title="Glisser pour déplacer le panneau"
                    >
                        <GripHorizontal size={14} />
                    </div>
                </div>
            );
        }

        // Collapsed Horizontal
        return (
            <div className="flex items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-1.5 shadow-2xl select-none">
                <button
                    onClick={onToggleCollapse}
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                    title="Déplier le panneau de navigation"
                >
                    <ChevronUp size={14} />
                </button>

                <button
                    onClick={onResetViewport}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                        isViewportModified
                            ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                            : 'bg-white/5 text-[#a1a1aa] hover:text-white'
                    }`}
                    title="Recentrer le canevas"
                >
                    <Maximize2 size={11} />
                    <span>Recentrer</span>
                </button>

                <span className="text-[10px] font-mono font-bold text-white px-1">
                    {Math.round(canvasZoom * 100)}%
                </span>

                <div className="h-4 w-px bg-white/10" />

                {/* Drag Grip Handle (Right) */}
                <div
                    onPointerDown={onDragStart}
                    className="cursor-grab active:cursor-grabbing p-1 rounded-md text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none"
                    title="Glisser pour déplacer le panneau"
                >
                    <GripVertical size={14} />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPANDED VERTICAL VIEW (Right or Left slot)
    // ─────────────────────────────────────────────────────────────────────────
    if (orientation === 'vertical') {
        return (
            <div className="flex flex-col items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2.5 shadow-2xl w-14 sm:w-16 select-none">
                {/* Header: Collapse Toggle */}
                <div className="w-full flex items-center justify-center pb-1 border-b border-white/10">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                        title="Réduire le panneau"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Undo / Redo */}
                <div className="flex flex-col items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 w-full">
                    <button
                        onClick={onUndo}
                        className="w-full py-1.5 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                        title="Annuler le dernier trait (Cmd+Z)"
                    >
                        <Undo2 size={13} />
                    </button>
                    <div className="w-4 h-px bg-white/10 my-0.5" />
                    <button
                        onClick={onRedo}
                        className="w-full py-1.5 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                        title="Rétablir le trait (Cmd+Shift+Z)"
                    >
                        <Redo2 size={13} />
                    </button>
                </div>

                <div className="w-full h-px bg-white/10" />

                {/* Hand / Pan Tool Toggle */}
                <button
                    onClick={() => setIsHandMode(!isHandMode)}
                    className={`w-full py-2 rounded-xl flex items-center justify-center transition-all ${
                        isHandMode || isSpacePressed
                            ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                            : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                    }`}
                    title="Outil Main : déplacer la feuille (ou maintenir Espace / 2 doigts sur iPad)"
                >
                    <Hand size={15} />
                </button>

                <div className="w-full h-px bg-white/10" />

                {/* Zoom Controls (Vertical Stack) */}
                <div className="flex flex-col items-center bg-[#202024]/80 rounded-xl p-1 border border-white/5 w-full">
                    <button
                        onClick={() => setCanvasZoom(z => Math.min(5, Math.round((z + 0.15) * 100) / 100))}
                        className="w-full py-1 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                        title="Zoomer"
                    >
                        <ZoomIn size={13} />
                    </button>
                    <button
                        onClick={() => setCanvasZoom(1)}
                        className="text-[9px] font-mono font-bold text-white py-0.5 w-full text-center hover:text-[#10B981] transition-colors"
                        title="Cliquer pour remettre le zoom à 100%"
                    >
                        {Math.round(canvasZoom * 100)}%
                    </button>
                    <button
                        onClick={() => setCanvasZoom(z => Math.max(0.35, Math.round((z - 0.15) * 100) / 100))}
                        className="w-full py-1 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                        title="Dézoomer"
                    >
                        <ZoomOut size={13} />
                    </button>
                </div>

                <div className="w-full h-px bg-white/10" />

                {/* Rotation Controls (Vertical Stack) */}
                <div className="flex flex-col items-center bg-[#202024]/80 rounded-xl p-1 border border-white/5 w-full">
                    <button
                        onClick={() =>
                            setCanvasRotation(r => {
                                let next = Math.round((r + 15) / 15) * 15;
                                if (next > 180) next -= 360;
                                return next;
                            })
                        }
                        className="w-full py-1 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                        title="Pivoter la feuille de +15° (ou Alt+Molette / 2 doigts sur iPad)"
                    >
                        <RotateCw size={13} />
                    </button>
                    <button
                        onClick={() => setCanvasRotation(0)}
                        className={`text-[9px] font-mono font-bold py-0.5 w-full text-center transition-colors ${
                            Math.abs(canvasRotation) > 0.5
                                ? 'text-[#10B981]'
                                : 'text-[#a1a1aa] hover:text-white'
                        }`}
                        title="Angle de rotation (Cliquer pour remettre à 0°)"
                    >
                        {Math.round(canvasRotation)}°
                    </button>
                    <button
                        onClick={() =>
                            setCanvasRotation(r => {
                                let next = Math.round((r - 15) / 15) * 15;
                                if (next <= -180) next += 360;
                                return next;
                            })
                        }
                        className="w-full py-1 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                        title="Pivoter la feuille de -15° (ou Alt+Molette / 2 doigts sur iPad)"
                    >
                        <RotateCcw size={13} />
                    </button>
                </div>

                <div className="w-full h-px bg-white/10" />

                {/* Bouton "Recentrer" */}
                <button
                    onClick={onResetViewport}
                    className={`w-full py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[8px] font-bold transition-all active:scale-95 ${
                        isViewportModified
                            ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 hover:bg-[#059669]'
                            : 'bg-white/5 text-[#a1a1aa] hover:text-white hover:bg-white/10'
                    }`}
                    title="Recentrer le cadre et remettre le zoom (100%) et l'angle (0°) par défaut"
                >
                    <Maximize2 size={13} />
                    <span className="scale-90">Cadre</span>
                </button>

                {/* Miroir Horizontal & Mode Focus */}
                <div className="flex flex-col items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 w-full">
                    {onToggleFlipH && (
                        <button
                            onClick={onToggleFlipH}
                            className={`w-full py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                                isFlippedH
                                    ? 'bg-[#F59E0B] text-black shadow-md shadow-[#F59E0B]/25'
                                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/10'
                            }`}
                            title="Miroir horizontal du canevas (touche H) — vérifiez vos proportions sans modifier le dessin"
                        >
                            <FlipHorizontal2 size={13} />
                        </button>
                    )}
                    {onToggleFlipH && onToggleFocusMode && (
                        <div className="w-4 h-px bg-white/10 my-0.5" />
                    )}
                    {onToggleFocusMode && (
                        <button
                            onClick={onToggleFocusMode}
                            className="w-full py-1.5 flex items-center justify-center rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                            title="Mode Focus / Zen : masquer les panneaux flottants (touche Tab)"
                        >
                            <EyeOff size={13} />
                        </button>
                    )}
                </div>

                <div className="w-full h-px bg-white/10 my-0.5" />

                {/* Drag Grip Handle at Bottom */}
                <div
                    onPointerDown={onDragStart}
                    className="w-full flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-[#52525b] hover:text-white hover:bg-white/5 rounded-lg transition-colors touch-none"
                    title="Glisser pour déplacer le panneau"
                >
                    <GripHorizontal size={16} />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPANDED HORIZONTAL VIEW (Bottom slot)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex items-center gap-2 sm:gap-2.5 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl select-none">
            {/* Collapse Toggle */}
            <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                title="Réduire le panneau"
            >
                <ChevronDown size={14} />
            </button>

            {/* Undo / Redo */}
            <div className="flex items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 flex-shrink-0">
                <button
                    onClick={onUndo}
                    className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                    title="Annuler le dernier trait (Cmd+Z)"
                >
                    <Undo2 size={13} />
                </button>
                <button
                    onClick={onRedo}
                    className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                    title="Rétablir le trait (Cmd+Shift+Z)"
                >
                    <Redo2 size={13} />
                </button>
            </div>

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* Hand / Pan Tool Toggle */}
            <button
                onClick={() => setIsHandMode(!isHandMode)}
                className={`p-1.5 rounded-xl transition-all flex-shrink-0 ${
                    isHandMode || isSpacePressed
                        ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                }`}
                title="Outil Main : déplacer la feuille (ou maintenir Espace / 2 doigts sur iPad)"
            >
                <Hand size={14} />
            </button>

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* Zoom Controls (Row) */}
            <div className="flex items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 flex-shrink-0">
                <button
                    onClick={() => setCanvasZoom(z => Math.max(0.35, Math.round((z - 0.15) * 100) / 100))}
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                    title="Dézoomer"
                >
                    <ZoomOut size={12} />
                </button>
                <button
                    onClick={() => setCanvasZoom(1)}
                    className="text-[10px] font-mono font-bold text-white min-w-[34px] text-center hover:text-[#10B981] transition-colors"
                    title="Cliquer pour remettre le zoom à 100%"
                >
                    {Math.round(canvasZoom * 100)}%
                </button>
                <button
                    onClick={() => setCanvasZoom(z => Math.min(5, Math.round((z + 0.15) * 100) / 100))}
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                    title="Zoomer"
                >
                    <ZoomIn size={12} />
                </button>
            </div>

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* Rotation Controls (Row) */}
            <div className="flex items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 flex-shrink-0">
                <button
                    onClick={() =>
                        setCanvasRotation(r => {
                            let next = Math.round((r - 15) / 15) * 15;
                            if (next <= -180) next += 360;
                            return next;
                        })
                    }
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                    title="Pivoter la feuille de -15° (ou Alt+Molette / 2 doigts sur iPad)"
                >
                    <RotateCcw size={12} />
                </button>
                <button
                    onClick={() => setCanvasRotation(0)}
                    className={`text-[10px] font-mono font-bold min-w-[28px] text-center transition-colors ${
                        Math.abs(canvasRotation) > 0.5
                            ? 'text-[#10B981]'
                            : 'text-[#a1a1aa] hover:text-white'
                    }`}
                    title="Angle de rotation (Cliquer pour remettre à 0°)"
                >
                    {Math.round(canvasRotation)}°
                </button>
                <button
                    onClick={() =>
                        setCanvasRotation(r => {
                            let next = Math.round((r + 15) / 15) * 15;
                            if (next > 180) next -= 360;
                            return next;
                        })
                    }
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
                    title="Pivoter la feuille de +15° (ou Alt+Molette / 2 doigts sur iPad)"
                >
                    <RotateCw size={12} />
                </button>
            </div>

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* Bouton "Recentrer" */}
            <button
                onClick={onResetViewport}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all active:scale-95 flex-shrink-0 ${
                    isViewportModified
                        ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25 hover:bg-[#059669]'
                        : 'bg-white/5 text-[#a1a1aa] hover:text-white hover:bg-white/10'
                }`}
                title="Recentrer le cadre et remettre le zoom (100%) et l'angle (0°) par défaut"
            >
                <Maximize2 size={11} />
                <span>Recentrer</span>
            </button>

            {/* Miroir Horizontal & Mode Focus */}
            {(onToggleFlipH || onToggleFocusMode) && (
                <>
                    <div className="h-6 w-px bg-white/10 flex-shrink-0" />
                    <div className="flex items-center bg-[#202024]/80 rounded-xl p-0.5 border border-white/5 flex-shrink-0">
                        {onToggleFlipH && (
                            <button
                                onClick={onToggleFlipH}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    isFlippedH
                                        ? 'bg-[#F59E0B] text-black shadow-md shadow-[#F59E0B]/25'
                                        : 'text-[#a1a1aa] hover:text-white hover:bg-white/10'
                                }`}
                                title="Miroir horizontal du canevas (touche H)"
                            >
                                <FlipHorizontal2 size={13} />
                            </button>
                        )}
                        {onToggleFocusMode && (
                            <button
                                onClick={onToggleFocusMode}
                                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                                title="Mode Focus / Zen : masquer les panneaux flottants (touche Tab)"
                            >
                                <EyeOff size={13} />
                            </button>
                        )}
                    </div>
                </>
            )}

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* Drag Grip Handle at Far Right */}
            <div
                onPointerDown={onDragStart}
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none flex-shrink-0"
                title="Glisser pour déplacer le panneau"
            >
                <GripVertical size={16} />
            </div>
        </div>
    );
};
