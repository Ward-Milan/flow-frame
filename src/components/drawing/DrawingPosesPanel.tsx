import React, { useState, useRef } from 'react';
import { 
    Layers, 
    Plus, 
    Copy, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ChevronDown, 
    ChevronUp,
    GripVertical, 
    GripHorizontal
} from 'lucide-react';
import type { StoryboardCard, SubFrame } from '../../modules/frame/types';

export interface DrawingPosesPanelProps {
    orientation: 'vertical' | 'horizontal';
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onDragStart: (e: React.PointerEvent) => void;
    activeCard: StoryboardCard;
    activeCardIndex: number;
    totalCards: number;
    onPrevCard: () => void;
    onNextCard: () => void;
    activeSubFrameIndex: number;
    setActiveSubFrameIndex: (idx: number) => void;
    activeLayer: 'pose' | 'background';
    setActiveLayer: (layer: 'pose' | 'background') => void;
    onAddSubFrame: (duplicateCurrent?: boolean) => void;
    onDeleteSubFrame: (idx: number) => void;
    onReorderSubFrames?: (fromIndex: number, toIndex: number) => void;
}

// Vignette fantôme avec la texture rayée verte et les pointillés tournants
const PoseDropGhostThumbnail: React.FC<{ orientation: 'vertical' | 'horizontal'; targetNumber: number }> = ({
    orientation,
    targetNumber
}) => {
    const sizeClass =
        orientation === 'vertical'
            ? 'w-full h-11 rounded-lg'
            : 'w-16 h-10 rounded-xl';

    return (
        <div
            className={`${sizeClass} relative flex-shrink-0 overflow-hidden pointer-events-none select-none shadow-[0_0_18px_rgba(16,185,129,0.35)] transition-all duration-150`}
        >
            <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern
                        id={`pose-ghost-stripes-${orientation}`}
                        width="10"
                        height="10"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                    >
                        <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="10"
                            stroke="#10B981"
                            strokeWidth="3.5"
                            strokeOpacity="0.28"
                        />
                    </pattern>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill={`url(#pose-ghost-stripes-${orientation})`}
                    rx={orientation === 'vertical' ? 8 : 12}
                />
                <rect
                    x="1.5"
                    y="1.5"
                    width="calc(100% - 3px)"
                    height="calc(100% - 3px)"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    rx={orientation === 'vertical' ? 7 : 10}
                    className="animate-marching-ants"
                />
            </svg>
            <span className="absolute bottom-0.5 left-1 text-[7px] px-1 rounded font-bold bg-[#10B981] text-white leading-tight">
                {targetNumber}
            </span>
        </div>
    );
};

export const DrawingPosesPanel: React.FC<DrawingPosesPanelProps> = ({
    orientation,
    isCollapsed,
    onToggleCollapse,
    onDragStart,
    activeCard,
    activeCardIndex,
    totalCards,
    onPrevCard,
    onNextCard,
    activeSubFrameIndex,
    setActiveSubFrameIndex,
    activeLayer,
    setActiveLayer,
    onAddSubFrame,
    onDeleteSubFrame,
    onReorderSubFrames
}) => {
    const poses: SubFrame[] = activeCard.subFrames || [{ id: '1', data: activeCard.data }];
    const totalPoses = poses.length;

    const stripRef = useRef<HTMLDivElement>(null);
    const [draggingPoseIdx, setDraggingPoseIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);

    const handlePosePointerDown = (idx: number, e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let currentTargetIdx = idx;

        // Capture initial slot centers before any DOM reorder shift
        const slotCenters: { x: number; y: number }[] = [];
        if (stripRef.current) {
            const children = Array.from(stripRef.current.children) as HTMLElement[];
            children.forEach(el => {
                const r = el.getBoundingClientRect();
                slotCenters.push({
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2
                });
            });
        }

        const onMove = (moveEv: PointerEvent) => {
            const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
            if (!isDragging && dist > 5 && totalPoses > 1) {
                isDragging = true;
                setDraggingPoseIdx(idx);
                setDropTargetIdx(idx);
            }

            if (isDragging) {
                setDragPointerPos({ x: moveEv.clientX, y: moveEv.clientY });

                if (slotCenters.length > 0) {
                    let bestIdx = 0;
                    let minDistance = Infinity;
                    slotCenters.forEach((center, cIdx) => {
                        const d =
                            orientation === 'horizontal'
                                ? Math.abs(moveEv.clientX - center.x)
                                : Math.abs(moveEv.clientY - center.y);
                        if (d < minDistance) {
                            minDistance = d;
                            bestIdx = cIdx;
                        }
                    });
                    currentTargetIdx = bestIdx;
                    setDropTargetIdx(bestIdx);
                }
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);

            if (!isDragging) {
                setActiveLayer('pose');
                setActiveSubFrameIndex(idx);
            } else {
                if (currentTargetIdx !== idx && onReorderSubFrames) {
                    onReorderSubFrames(idx, currentTargetIdx);
                }
                setDraggingPoseIdx(null);
                setDropTargetIdx(null);
                setDragPointerPos(null);
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    // Build visual sequence with shifted poses and the green textured ghost thumbnail at dropTargetIdx
    type RenderSlot =
        | { kind: 'pose'; sub: SubFrame; origIdx: number; displayNumber: number }
        | { kind: 'ghost'; targetNumber: number };

    const renderSlots: RenderSlot[] = [];
    if (draggingPoseIdx !== null && dropTargetIdx !== null) {
        const remaining = poses
            .map((sub, origIdx) => ({ sub, origIdx }))
            .filter(item => item.origIdx !== draggingPoseIdx);

        const clampedTarget = Math.max(0, Math.min(remaining.length, dropTargetIdx));
        let counter = 1;
        for (let i = 0; i <= remaining.length; i++) {
            if (i === clampedTarget) {
                renderSlots.push({ kind: 'ghost', targetNumber: counter++ });
            }
            if (i < remaining.length) {
                renderSlots.push({
                    kind: 'pose',
                    sub: remaining[i].sub,
                    origIdx: remaining[i].origIdx,
                    displayNumber: counter++
                });
            }
        }
    } else {
        poses.forEach((sub, origIdx) => {
            renderSlots.push({
                kind: 'pose',
                sub,
                origIdx,
                displayNumber: origIdx + 1
            });
        });
    }

    const draggedPoseData = draggingPoseIdx !== null ? poses[draggingPoseIdx] : null;

    // ─────────────────────────────────────────────────────────────────────────
    // COLLAPSED VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (isCollapsed) {
        if (orientation === 'vertical') {
            return (
                <div className="flex flex-col items-center gap-1.5 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-1.5 py-2 shadow-2xl select-none">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                        title="Déplier Plans & Poses"
                    >
                        <ChevronRight size={13} />
                    </button>

                    <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md uppercase">
                        P{activeCard.info.shot}
                    </span>

                    <span className="text-[9px] text-[#10B981] font-mono font-bold">
                        {activeLayer === 'background' ? 'DÉC' : `${activeSubFrameIndex + 1}/${totalPoses}`}
                    </span>

                    <div
                        onPointerDown={onDragStart}
                        className="cursor-grab active:cursor-grabbing p-1 rounded-md text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none"
                        title="Glisser pour déplacer le panneau"
                    >
                        <GripHorizontal size={13} />
                    </div>
                </div>
            );
        }

        // Collapsed Horizontal
        return (
            <div className="flex items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-2.5 py-1.5 shadow-2xl select-none">
                <button
                    onClick={onToggleCollapse}
                    className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                    title="Déplier Plans & Poses"
                >
                    <ChevronUp size={13} />
                </button>

                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-1.5 py-0.5">
                    <button
                        onClick={onPrevCard}
                        disabled={activeCardIndex <= 0}
                        className="text-amber-300 hover:text-white disabled:opacity-25"
                    >
                        <ChevronLeft size={11} />
                    </button>
                    <span className="text-[10px] font-black text-amber-400 uppercase px-0.5">
                        P{activeCard.info.shot}
                    </span>
                    <button
                        onClick={onNextCard}
                        disabled={activeCardIndex >= totalCards - 1}
                        className="text-amber-300 hover:text-white disabled:opacity-25"
                    >
                        <ChevronRight size={11} />
                    </button>
                </div>

                <span className="text-[10px] font-mono font-bold text-[#10B981]">
                    {activeLayer === 'background' ? 'Décor' : `Pose ${activeSubFrameIndex + 1}/${totalPoses}`}
                </span>

                <div
                    onPointerDown={onDragStart}
                    className="cursor-grab active:cursor-grabbing p-1 rounded-md text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none"
                    title="Glisser pour déplacer le panneau"
                >
                    <GripVertical size={13} />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPANDED VERTICAL VIEW (Left or Right slot)
    // ─────────────────────────────────────────────────────────────────────────
    if (orientation === 'vertical') {
        return (
            <div className="flex flex-col items-center bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl w-24 max-h-[85vh] select-none">
                {/* 1. COMPACT PLAN SWITCHER (Ambre) */}
                <div className="w-full flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-1 py-1 mb-1.5">
                    <button
                        onClick={onPrevCard}
                        disabled={activeCardIndex <= 0}
                        className="p-0.5 rounded text-amber-300 hover:text-white hover:bg-amber-500/20 disabled:opacity-25 transition-colors"
                        title="Plan précédent"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <div className="flex flex-col items-center leading-none">
                        <span className="text-[10px] font-black text-amber-400 uppercase">
                            Plan {activeCard.info.shot}
                        </span>
                        <span className="text-[8px] font-mono text-amber-200/70 mt-0.5">
                            {activeCardIndex + 1}/{totalCards}
                        </span>
                    </div>
                    <button
                        onClick={onNextCard}
                        disabled={activeCardIndex >= totalCards - 1}
                        className="p-0.5 rounded text-amber-300 hover:text-white hover:bg-amber-500/20 disabled:opacity-25 transition-colors"
                        title="Plan suivant"
                    >
                        <ChevronRight size={12} />
                    </button>
                </div>

                {/* Shared Background Décor Layer (Compact) */}
                <button
                    onClick={() => setActiveLayer(activeLayer === 'background' ? 'pose' : 'background')}
                    className={`w-full h-9 rounded-lg overflow-hidden border-2 transition-all relative bg-white flex items-center justify-center mb-1.5 flex-shrink-0 ${
                        activeLayer === 'background'
                            ? 'border-[#10B981] ring-2 ring-[#10B981]/30 shadow-md'
                            : 'border-white/15 opacity-75 hover:opacity-100'
                    }`}
                    title="Calque Décor fixe (partagé sous toutes les poses de ce plan)"
                >
                    {activeCard.backgroundData ? (
                        <img src={activeCard.backgroundData} className="w-full h-full object-contain bg-white" alt="Décor" />
                    ) : (
                        <div className="w-full h-full bg-stone-50 flex items-center justify-center gap-1 text-[8px] font-bold text-stone-400">
                            <Layers size={10} />
                            <span>Décor</span>
                        </div>
                    )}
                    <span
                        className={`absolute bottom-0.5 left-1 text-[6px] px-1 rounded font-bold uppercase ${
                            activeLayer === 'background' ? 'bg-[#10B981] text-white' : 'bg-black/70 text-white'
                        }`}
                    >
                        Décor
                    </span>
                </button>

                <div className="w-full h-px bg-white/10 mb-1.5" />

                {/* Vertical Scrollable Poses Strip with Drag-and-Drop Reordering */}
                <div
                    ref={stripRef}
                    className="flex flex-col items-center gap-1.5 overflow-y-auto w-full max-h-[50vh] py-0.5 px-0.5 scrollbar-thin"
                >
                    {renderSlots.map((slot, sIdx) => {
                        if (slot.kind === 'ghost') {
                            return (
                                <PoseDropGhostThumbnail
                                    key="pose-drop-ghost"
                                    orientation="vertical"
                                    targetNumber={slot.targetNumber}
                                />
                            );
                        }

                        const { sub, origIdx, displayNumber } = slot;
                        const isActivePose = activeLayer === 'pose' && activeSubFrameIndex === origIdx;
                        return (
                            <div
                                key={sub.id || sIdx}
                                onPointerDown={e => handlePosePointerDown(origIdx, e)}
                                className={`group/pose w-full h-11 rounded-lg overflow-hidden border-2 transition-all duration-150 relative flex-shrink-0 bg-white cursor-grab active:cursor-grabbing touch-none ${
                                    isActivePose
                                        ? 'border-[#10B981] ring-2 ring-[#10B981]/30 shadow-md'
                                        : 'border-white/15 opacity-75 hover:opacity-100'
                                }`}
                                title={`Pose ${displayNumber} (Cliquer pour ouvrir, glisser pour réorganiser)`}
                            >
                                {sub.data ? (
                                    <img src={sub.data} className="w-full h-full object-contain bg-white pointer-events-none" alt="" />
                                ) : (
                                    <div className="w-full h-full bg-white flex items-center justify-center text-[8px] font-medium text-stone-300 pointer-events-none">
                                        —
                                    </div>
                                )}

                                <span
                                    className={`absolute bottom-0.5 left-1 text-[7px] px-1 rounded font-bold leading-tight pointer-events-none ${
                                        isActivePose ? 'bg-[#10B981] text-white' : 'bg-black/75 text-white'
                                    }`}
                                >
                                    {displayNumber}
                                </span>

                                {totalPoses > 1 && (
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            onDeleteSubFrame(origIdx);
                                        }}
                                        className={`absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 text-white/80 hover:text-red-400 transition-opacity ${
                                            isActivePose ? 'opacity-100' : 'opacity-0 group-hover/pose:opacity-100'
                                        }`}
                                        title="Supprimer cette pose"
                                    >
                                        <X size={9} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Compact Side-by-Side Icon Buttons: [+] [Dupliquer] */}
                <div className="w-full grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-white/10">
                    <button
                        onClick={() => onAddSubFrame(false)}
                        className="flex items-center justify-center py-1.5 rounded-lg bg-[#27272a] hover:bg-[#10B981] text-white transition-all active:scale-95"
                        title="Ajouter une nouvelle pose vierge"
                    >
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => onAddSubFrame(true)}
                        className="flex items-center justify-center py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-white transition-all active:scale-95"
                        title="Dupliquer la pose actuelle"
                    >
                        <Copy size={12} />
                    </button>
                </div>

                {/* Footer: Collapse + Grip Handle */}
                <div className="w-full flex items-center justify-between pt-1 mt-1 border-t border-white/10">
                    <button
                        onClick={onToggleCollapse}
                        className="p-0.5 rounded text-[#71717a] hover:text-white transition-colors"
                        title="Réduire le panneau"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <div
                        onPointerDown={onDragStart}
                        className="flex-1 flex items-center justify-center py-0.5 cursor-grab active:cursor-grabbing text-[#52525b] hover:text-white transition-colors touch-none"
                        title="Glisser pour déplacer le panneau"
                    >
                        <GripHorizontal size={14} />
                    </div>
                </div>

                {/* Floating Dragged Pose Miniature under Cursor */}
                {draggedPoseData && dragPointerPos && (
                    <div
                        style={{
                            left: dragPointerPos.x,
                            top: dragPointerPos.y
                        }}
                        className="fixed -translate-x-1/2 -translate-y-1/2 w-20 h-12 rounded-xl overflow-hidden border-2 border-[#10B981] bg-white shadow-2xl pointer-events-none z-50 opacity-85 scale-105 rotate-2"
                    >
                        {draggedPoseData.data ? (
                            <img src={draggedPoseData.data} className="w-full h-full object-contain bg-white" alt="" />
                        ) : (
                            <div className="w-full h-full bg-white flex items-center justify-center text-[8px] font-bold text-stone-400">
                                —
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPANDED HORIZONTAL VIEW (Bottom slot — Ultra-compact & wide pose strip)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl px-2.5 py-1.5 shadow-2xl max-w-[94vw] select-none">
            {/* Collapse Toggle */}
            <button
                onClick={onToggleCollapse}
                className="p-1 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                title="Réduire le panneau"
            >
                <ChevronDown size={13} />
            </button>

            {/* ── 1. COMPACT PLAN SWITCHER (Ambre : < Plan P1 >) ── */}
            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded-xl px-1.5 py-1 h-10 flex-shrink-0">
                <button
                    onClick={onPrevCard}
                    disabled={activeCardIndex <= 0}
                    className="p-1 rounded-lg text-amber-300 hover:text-white hover:bg-amber-500/20 disabled:opacity-25 transition-colors"
                    title="Plan précédent"
                >
                    <ChevronLeft size={13} />
                </button>

                <div className="flex flex-col items-center px-1 leading-none">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-tight whitespace-nowrap">
                        Plan {activeCard.info.shot}
                    </span>
                    <span className="text-[8px] font-mono text-amber-200/70 mt-0.5 whitespace-nowrap">
                        S{activeCard.info.sequence} • {activeCardIndex + 1}/{totalCards}
                    </span>
                </div>

                <button
                    onClick={onNextCard}
                    disabled={activeCardIndex >= totalCards - 1}
                    className="p-1 rounded-lg text-amber-300 hover:text-white hover:bg-amber-500/20 disabled:opacity-25 transition-colors"
                    title="Plan suivant"
                >
                    <ChevronRight size={13} />
                </button>
            </div>

            <div className="h-6 w-px bg-white/10 flex-shrink-0" />

            {/* ── 2. CALQUE DÉCOR FIXE (Compact Thumbnail) ── */}
            <button
                onClick={() => setActiveLayer(activeLayer === 'background' ? 'pose' : 'background')}
                className={`w-14 h-10 rounded-xl overflow-hidden border-2 transition-all relative flex-shrink-0 bg-white flex items-center justify-center ${
                    activeLayer === 'background'
                        ? 'border-[#10B981] ring-2 ring-[#10B981]/30 shadow-md'
                        : 'border-white/15 opacity-75 hover:opacity-100'
                }`}
                title="Calque Décor fixe (partagé sous toutes les poses de ce plan)"
            >
                {activeCard.backgroundData ? (
                    <img src={activeCard.backgroundData} className="w-full h-full object-contain bg-white" alt="Décor" />
                ) : (
                    <div className="w-full h-full bg-stone-50 flex flex-col items-center justify-center text-[7px] font-bold text-stone-400">
                        <Layers size={10} className="mb-0.5 text-stone-400" />
                        <span>Décor</span>
                    </div>
                )}
                <span
                    className={`absolute bottom-0.5 left-1 text-[6px] px-1 rounded font-bold uppercase ${
                        activeLayer === 'background' ? 'bg-[#10B981] text-white' : 'bg-black/75 text-white'
                    }`}
                >
                    Décor
                </span>
            </button>

            {/* ── 3. WIDE POSES STRIP WITH DRAG-AND-DROP REORDERING ── */}
            <div
                ref={stripRef}
                className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-[52vw] sm:max-w-[58vw] md:max-w-[560px] scrollbar-thin"
            >
                {renderSlots.map((slot, sIdx) => {
                    if (slot.kind === 'ghost') {
                        return (
                            <PoseDropGhostThumbnail
                                key="pose-drop-ghost"
                                orientation="horizontal"
                                targetNumber={slot.targetNumber}
                            />
                        );
                    }

                    const { sub, origIdx, displayNumber } = slot;
                    const isActivePose = activeLayer === 'pose' && activeSubFrameIndex === origIdx;
                    return (
                        <div
                            key={sub.id || sIdx}
                            onPointerDown={e => handlePosePointerDown(origIdx, e)}
                            className={`group/pose w-16 h-10 rounded-xl overflow-hidden border-2 transition-all duration-150 relative flex-shrink-0 bg-white cursor-grab active:cursor-grabbing touch-none ${
                                isActivePose
                                    ? 'border-[#10B981] ring-2 ring-[#10B981]/30 shadow-md'
                                    : 'border-white/15 opacity-75 hover:opacity-100'
                            }`}
                            title={`Pose ${displayNumber} (Cliquer pour ouvrir, glisser pour réorganiser)`}
                        >
                            {sub.data ? (
                                <img src={sub.data} className="w-full h-full object-contain bg-white pointer-events-none" alt="" />
                            ) : (
                                <div className="w-full h-full bg-white flex items-center justify-center text-[8px] font-medium text-stone-300 pointer-events-none">
                                    —
                                </div>
                            )}

                            {/* Compact Pose Number Badge */}
                            <span
                                className={`absolute bottom-0.5 left-1 text-[7px] px-1 rounded font-bold leading-tight pointer-events-none ${
                                    isActivePose ? 'bg-[#10B981] text-white' : 'bg-black/75 text-white'
                                }`}
                            >
                                {displayNumber}
                            </span>

                            {/* Delete Pose Button */}
                            {totalPoses > 1 && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onDeleteSubFrame(origIdx);
                                    }}
                                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/75 text-white/70 hover:text-red-400 opacity-0 group-hover/pose:opacity-100 transition-opacity"
                                    title="Supprimer cette pose"
                                >
                                    <X size={9} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── 4. ULTRA-COMPACT STACKED ACTION BUTTONS ([+] & [Dupliquer] without bulky text) ── */}
            <div className="flex flex-col gap-1 h-10 justify-between pl-1.5 border-l border-white/10 flex-shrink-0">
                <button
                    onClick={() => onAddSubFrame(false)}
                    className="w-7 h-[18px] rounded-md bg-[#27272a] hover:bg-[#10B981] text-white flex items-center justify-center transition-all active:scale-95"
                    title="Ajouter une nouvelle pose vierge (+ Pose)"
                >
                    <Plus size={12} />
                </button>

                <button
                    onClick={() => onAddSubFrame(true)}
                    className="w-7 h-[18px] rounded-md bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-white flex items-center justify-center transition-all active:scale-95"
                    title="Dupliquer la pose actuelle"
                >
                    <Copy size={10} />
                </button>
            </div>

            {/* Drag Grip Handle at Far Right */}
            <div
                onPointerDown={onDragStart}
                className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-[#52525b] hover:text-white hover:bg-white/5 transition-colors touch-none flex-shrink-0"
                title="Glisser pour déplacer le panneau"
            >
                <GripVertical size={15} />
            </div>

            {/* Floating Dragged Pose Miniature under Cursor */}
            {draggedPoseData && dragPointerPos && (
                <div
                    style={{
                        left: dragPointerPos.x,
                        top: dragPointerPos.y
                    }}
                    className="fixed -translate-x-1/2 -translate-y-1/2 w-16 h-10 rounded-xl overflow-hidden border-2 border-[#10B981] bg-white shadow-2xl pointer-events-none z-50 opacity-85 scale-105 rotate-2"
                >
                    {draggedPoseData.data ? (
                        <img src={draggedPoseData.data} className="w-full h-full object-contain bg-white" alt="" />
                    ) : (
                        <div className="w-full h-full bg-white flex items-center justify-center text-[8px] font-bold text-stone-400">
                            —
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
