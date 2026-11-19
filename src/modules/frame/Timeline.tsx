import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
    Plus,
    ZoomIn,
    ZoomOut,
    Film
} from 'lucide-react';
import type { StoryboardCard } from './types';

interface TimelineProps {
    cards: StoryboardCard[];
    activeCardId: string | null;
    onSelectCard: (id: string, poseIndex?: number) => void;
    onUpdateCards: (updatedCards: StoryboardCard[]) => void;
    onCommitCards: (updatedCards: StoryboardCard[]) => void;
    onAddCard: () => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTime: number;
    setCurrentTime: (time: number) => void;

    // Subframe / Pose Selection
    activeSubFrameIndex: number;
    onSelectSubFrameIndex?: (index: number) => void;

    // Double-click to open in Drawing Studio
    onDoubleClickCard?: (id: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
    cards,
    activeCardId,
    onSelectCard,
    onUpdateCards,
    onCommitCards,
    onAddCard,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    activeSubFrameIndex,
    onDoubleClickCard
}) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [placeholderIndex, setPlaceholderIndex] = useState<number>(0);
    const [draggedLeft, setDraggedLeft] = useState<number>(0);

    // Zoom State (Pixels Per Second) - Default 90px/s, Range 30px/s to 260px/s
    const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(90);

    // Keep mutable ref of cards to avoid stale closures in pointer listeners
    const cardsRef = useRef<StoryboardCard[]>(cards);
    useEffect(() => {
        cardsRef.current = cards;
    }, [cards]);

    const totalDuration = useMemo(
        () => cards.reduce((acc, c) => acc + (c.info.duration || 3), 0),
        [cards]
    );
    const playheadPos = currentTime * pixelsPerSecond;

    // Scrubbing / Dragging the Playhead (Touch & Mouse via Pointer Events)
    const handleRulerPointerDown = (e: React.PointerEvent) => {
        if (!timelineRef.current) return;

        const updateTimeFromEvent = (clientX: number) => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const clickX = clientX - rect.left + timelineRef.current.scrollLeft - 16;
            const newTime = Math.max(0, Math.min(clickX / pixelsPerSecond, totalDuration));
            setCurrentTime(newTime);
        };

        e.preventDefault();
        setIsPlaying(false);
        updateTimeFromEvent(e.clientX);

        const onPointerMove = (moveEvt: PointerEvent) => {
            updateTimeFromEvent(moveEvt.clientX);
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    // Resize Individual Pose Duration inside a Plan (Touch & Mouse)
    const handleSubFrameResizePointerDown = (
        e: React.PointerEvent,
        cardId: string,
        subIdx: number
    ) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const initialCards = JSON.parse(JSON.stringify(cardsRef.current)) as StoryboardCard[];
        const targetCardIdx = initialCards.findIndex(c => c.id === cardId);
        if (targetCardIdx === -1) return;

        const initialCard = initialCards[targetCardIdx];
        const initialCardDur = initialCard.info.duration || 3;
        const initialSubs =
            initialCard.subFrames && initialCard.subFrames.length > 0
                ? initialCard.subFrames
                : [{ id: '1', data: initialCard.data || '', duration: initialCardDur }];

        // Normalize initial pose durations so their sum matches initialCardDur
        const rawSum = initialSubs.reduce(
            (acc, f) => acc + (f.duration || initialCardDur / initialSubs.length),
            0
        );
        const normFactor = rawSum > 0 ? initialCardDur / rawSum : 1;
        const normalizedDurations = initialSubs.map(f =>
            Number(((f.duration || initialCardDur / initialSubs.length) * normFactor).toFixed(2))
        );

        const startPoseDur = normalizedDurations[subIdx] || 1;

        const onPointerMove = (moveEvt: PointerEvent) => {
            const deltaX = moveEvt.clientX - startX;
            const deltaT = deltaX / pixelsPerSecond;

            const updatedCards = JSON.parse(JSON.stringify(initialCards)) as StoryboardCard[];
            const card = updatedCards[targetCardIdx];
            if (!card.subFrames || card.subFrames.length === 0) return;

            // Update normalized durations and apply delta to target pose
            card.subFrames.forEach((f, idx) => {
                if (idx === subIdx) {
                    f.duration = Number(Math.max(0.2, startPoseDur + deltaT).toFixed(1));
                } else {
                    f.duration = Number(Math.max(0.2, normalizedDurations[idx]).toFixed(1));
                }
            });

            // Update parent card total duration as exact sum of its poses
            const newTotalDur = card.subFrames.reduce((acc, f) => acc + (f.duration || 0.5), 0);
            card.info.duration = Number(Math.max(0.5, newTotalDur).toFixed(1));

            onUpdateCards(updatedCards);
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            onCommitCards(cardsRef.current);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    // Trim/Resize Logic for Main Cards (Touch & Mouse)
    const handleResizePointerDown = (
        e: React.PointerEvent,
        cardId: string,
        direction: 'left' | 'right'
    ) => {
        const targetCard = cardsRef.current.find(c => c.id === cardId);
        // If resizing the right edge of a multi-pose card, resize its last pose directly
        if (
            direction === 'right' &&
            targetCard?.subFrames &&
            targetCard.subFrames.length > 1
        ) {
            handleSubFrameResizePointerDown(e, cardId, targetCard.subFrames.length - 1);
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const initialCards = JSON.parse(JSON.stringify(cardsRef.current)) as StoryboardCard[];
        const targetIdx = initialCards.findIndex(c => c.id === cardId);
        if (targetIdx === -1) return;

        const onPointerMove = (moveEvt: PointerEvent) => {
            const deltaX = moveEvt.clientX - startX;
            const deltaT = deltaX / pixelsPerSecond;

            const updatedCards = JSON.parse(JSON.stringify(initialCards)) as StoryboardCard[];
            const currentDur = initialCards[targetIdx].info.duration || 3;

            if (direction === 'right') {
                updatedCards[targetIdx].info.duration = Number(
                    Math.max(0.5, currentDur + deltaT).toFixed(1)
                );
            } else {
                updatedCards[targetIdx].info.duration = Number(
                    Math.max(0.5, currentDur - deltaT).toFixed(1)
                );
            }

            // Proportional scale on subframes of the target card when resized from left or single-pose
            const cardToScale = updatedCards[targetIdx];
            const oldCardDur = initialCards[targetIdx].info.duration || 3;
            const newCardDur = cardToScale.info.duration || 3;

            if (cardToScale.subFrames && cardToScale.subFrames.length > 0) {
                const ratio = newCardDur / oldCardDur;
                cardToScale.subFrames.forEach(f => {
                    const oldSubDur =
                        f.duration !== undefined
                            ? f.duration
                            : oldCardDur / cardToScale.subFrames!.length;
                    f.duration = Number(Math.max(0.2, oldSubDur * ratio).toFixed(1));
                });
            }

            onUpdateCards(updatedCards);
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            onCommitCards(cardsRef.current);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    // Drag logic for reordering main cards & selecting card/pose (Touch & Mouse)
    const handleCardPointerDown = (
        e: React.PointerEvent,
        cardId: string,
        clickedPoseIndex?: number
    ) => {
        if ((e.target as HTMLElement).closest('.resize-handle')) {
            return;
        }

        e.preventDefault();
        const startX = e.clientX;
        const initialIdx = cardsRef.current.findIndex(c => c.id === cardId);
        if (initialIdx === -1) return;

        // Always measure the outer card element (even when clicking an inner pose div)
        const cardEl = ((e.currentTarget as HTMLElement).closest('.timeline-card-in-flow') ||
            e.currentTarget) as HTMLElement;
        const trackEl = timelineRef.current;
        if (!trackEl) return;

        const rect = cardEl.getBoundingClientRect();
        const trackRect = trackEl.getBoundingClientRect();
        const startLeft = rect.left - trackRect.left + trackEl.scrollLeft - 16;

        let isDragging = false;
        let lastTargetIdx = initialIdx;

        const onPointerMove = (moveEvt: PointerEvent) => {
            const deltaX = moveEvt.clientX - startX;

            if (!isDragging && Math.abs(deltaX) > 10) {
                isDragging = true;
                setDraggedId(cardId);
                setPlaceholderIndex(initialIdx);
                setDraggedLeft(startLeft);
            }

            if (isDragging) {
                setDraggedLeft(startLeft + deltaX);

                // Exclude both placeholder AND the dragged card itself so index math never shifts on frame 1
                const otherCardNodes = Array.from(
                    trackEl.querySelectorAll(
                        `.timeline-card-in-flow:not([data-is-placeholder="true"]):not([data-card-id="${cardId}"])`
                    )
                );

                let targetIdx = 0;
                for (let i = 0; i < otherCardNodes.length; i++) {
                    const nodeRect = otherCardNodes[i].getBoundingClientRect();
                    const center = nodeRect.left + nodeRect.width / 2;
                    if (moveEvt.clientX > center) {
                        targetIdx = i + 1;
                    }
                }

                if (targetIdx !== lastTargetIdx) {
                    setPlaceholderIndex(targetIdx);
                    lastTargetIdx = targetIdx;

                    const list = cardsRef.current.filter(c => c.id !== cardId);
                    const draggedCard = cardsRef.current.find(c => c.id === cardId);
                    if (draggedCard) {
                        list.splice(targetIdx, 0, draggedCard);
                    }
                    onUpdateCards(list);
                }
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            if (isDragging) {
                setDraggedId(null);
                const list = cardsRef.current.filter(c => c.id !== cardId);
                const draggedCard = cardsRef.current.find(c => c.id === cardId);
                if (draggedCard) {
                    list.splice(lastTargetIdx, 0, draggedCard);
                }
                onCommitCards(list);
            } else {
                // Single atomic call to select the card and exact pose index
                onSelectCard(cardId, clickedPoseIndex ?? 0);
            }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const renderedCards = useMemo(() => {
        if (!draggedId) return cards;
        const list = cards.filter(c => c.id !== draggedId);
        const draggedCard = cards.find(c => c.id === draggedId);
        if (draggedCard) {
            list.splice(placeholderIndex, 0, draggedCard);
        }
        return list;
    }, [cards, draggedId, placeholderIndex]);

    const canvasTrackWidth = Math.max(totalDuration * pixelsPerSecond + 300, 1400);

    return (
        <div className="mx-5 mb-4 relative shrink-0 select-none">
            {/* Compact Zoom Control Slightly Above the Top-Right of the Timeline */}
            <div className="absolute -top-9 right-1 z-30 flex items-center gap-1.5 bg-[#18181b]/95 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-lg">
                <button
                    onClick={() => setPixelsPerSecond(prev => Math.max(30, prev - 15))}
                    className="p-0.5 text-[#a1a1aa] hover:text-white transition-colors"
                    title="Zoom Arrière"
                >
                    <ZoomOut size={12} />
                </button>
                <input
                    type="range"
                    min="30"
                    max="260"
                    value={pixelsPerSecond}
                    onChange={e => setPixelsPerSecond(Number(e.target.value))}
                    className="w-16 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#10B981]"
                />
                <button
                    onClick={() => setPixelsPerSecond(prev => Math.min(260, prev + 15))}
                    className="p-0.5 text-[#a1a1aa] hover:text-white transition-colors"
                    title="Zoom Avant"
                >
                    <ZoomIn size={12} />
                </button>
            </div>

            {/* Timeline Dock Box */}
            <div className="h-36 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                {/* Scrollable Timeline Track Area */}
                <div
                    className="flex-1 relative overflow-x-auto overflow-y-hidden custom-scrollbar"
                    ref={timelineRef}
                    onWheel={e => {
                        if (e.ctrlKey || e.metaKey || e.altKey) {
                            e.preventDefault();
                            setPixelsPerSecond(prev =>
                                Math.max(30, Math.min(260, prev + (e.deltaY < 0 ? 15 : -15)))
                            );
                        }
                    }}
                >
                    {/* ── 1. MINIMALIST TIME RULER ── */}
                    <div
                        className="h-6 border-b border-white/10 relative sticky top-0 bg-[#141417]/95 backdrop-blur-md z-20 cursor-ew-resize touch-none"
                        style={{ width: `${canvasTrackWidth}px` }}
                        onPointerDown={handleRulerPointerDown}
                    >
                        {Array.from({ length: Math.ceil(totalDuration) + 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute top-0 h-full border-l border-white/10"
                                style={{ left: `${i * pixelsPerSecond + 16}px` }}
                            >
                                <span className="text-[9px] text-[#71717a] ml-1.5 mt-1 block font-mono">
                                    {i}s
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* ── 2. SINGLE UNIFIED FILMSTRIP TRACK (Clean White Cards + Proportional Editable Poses) ── */}
                    <div
                        className="relative px-4 flex items-center h-[108px]"
                        style={{ width: `${canvasTrackWidth}px` }}
                    >
                        {renderedCards.map(card => {
                            const duration = card.info.duration || 3;
                            if (duration <= 0) return null;

                            const width = duration * pixelsPerSecond;
                            const isCardDragged = draggedId === card.id;
                            const isSelected = activeCardId === card.id;
                            const subFrames =
                                card.subFrames && card.subFrames.length > 0
                                    ? card.subFrames
                                    : [{ id: '1', data: card.data || '', duration }];
                            const hasAnyDrawing =
                                subFrames.some(f => Boolean(f.data)) ||
                                Boolean(card.data) ||
                                Boolean(card.backgroundData);

                            // Calculate total subframe duration for proportional pose widths
                            const totalSubDuration = subFrames.reduce(
                                (acc, f) => acc + (f.duration || duration / subFrames.length),
                                0
                            );

                            if (isCardDragged) {
                                return (
                                    <div
                                        key={card.id}
                                        className="timeline-card-in-flow h-[84px] rounded-xl mx-[3px] border-2 border-dashed border-[#10B981] bg-[#10B981]/10 flex items-center justify-center text-xs text-[#10B981] font-bold animate-pulse"
                                        style={{
                                            width: `${Math.max(32, width - 6)}px`,
                                            minWidth: `${Math.max(32, width - 6)}px`
                                        }}
                                        data-is-placeholder="true"
                                    >
                                        Déposer
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={card.id}
                                    data-card-id={card.id}
                                    className={`timeline-card-in-flow relative h-[84px] rounded-xl mx-[3px] overflow-hidden group transition-shadow duration-150 select-none touch-none flex ${
                                        isSelected
                                            ? 'ring-2 ring-[#10B981] border-2 border-[#10B981] shadow-lg shadow-[#10B981]/20 z-10'
                                            : 'border border-white/15 hover:border-white/35'
                                    } ${hasAnyDrawing ? 'bg-white' : 'bg-[#202024]'}`}
                                    style={{
                                        width: `${Math.max(32, width - 6)}px`,
                                        minWidth: `${Math.max(32, width - 6)}px`,
                                        cursor: 'grab'
                                    }}
                                    onPointerDown={e => handleCardPointerDown(e, card.id, 0)}
                                    onDoubleClick={() => onDoubleClickCard?.(card.id)}
                                    title={`Plan S${card.info.sequence}·P${card.info.shot} (${duration.toFixed(1)}s) — Double-clic pour dessiner`}
                                >
                                    {/* Render Poses side-by-side with proportional durations and interactive resize dividers */}
                                    {hasAnyDrawing || subFrames.length > 1 ? (
                                        <div className="w-full h-full flex">
                                            {subFrames.map((pose, poseIdx) => {
                                                const isPoseActive =
                                                    isSelected && activeSubFrameIndex === poseIdx;
                                                const rawPoseDur =
                                                    pose.duration || duration / subFrames.length;
                                                const normalizedPoseDur =
                                                    totalSubDuration > 0
                                                        ? (rawPoseDur / totalSubDuration) * duration
                                                        : duration / subFrames.length;
                                                const poseWidthPct =
                                                    totalSubDuration > 0
                                                        ? (rawPoseDur / totalSubDuration) * 100
                                                        : 100 / subFrames.length;
                                                const isNotLastPose =
                                                    poseIdx < subFrames.length - 1;

                                                return (
                                                    <div
                                                        key={pose.id || poseIdx}
                                                        style={{ width: `${poseWidthPct}%` }}
                                                        onPointerDown={e => {
                                                            e.stopPropagation();
                                                            handleCardPointerDown(
                                                                e,
                                                                card.id,
                                                                poseIdx
                                                            );
                                                        }}
                                                        className={`relative h-full flex items-center justify-center bg-white overflow-visible ${
                                                            isNotLastPose
                                                                ? 'border-r border-dashed border-stone-300'
                                                                : ''
                                                        } ${
                                                            isPoseActive && subFrames.length > 1
                                                                ? 'ring-2 ring-inset ring-[#10B981]/70 bg-emerald-50/20'
                                                                : ''
                                                        }`}
                                                    >
                                                        {card.backgroundData && (
                                                            <img
                                                                src={card.backgroundData}
                                                                alt=""
                                                                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none overflow-hidden"
                                                            />
                                                        )}
                                                        {pose.data ? (
                                                            <img
                                                                src={pose.data}
                                                                alt=""
                                                                className="relative w-full h-full object-contain pointer-events-none select-none overflow-hidden mix-blend-multiply"
                                                            />
                                                        ) : !card.backgroundData ? (
                                                            <span className="text-[9px] text-stone-400 font-mono pointer-events-none">
                                                                F{poseIdx + 1}
                                                            </span>
                                                        ) : null}

                                                        {/* Pose Tag + Individual Pose Duration when multiple poses exist */}
                                                        {subFrames.length > 1 && (
                                                            <span
                                                                className={`absolute bottom-1 left-1 text-[8px] font-mono px-1 py-0.2 rounded font-bold pointer-events-none z-10 shadow-sm ${
                                                                    isPoseActive
                                                                        ? 'bg-[#10B981] text-white'
                                                                        : 'bg-stone-800/80 text-white'
                                                                }`}
                                                            >
                                                                F{poseIdx + 1} ·{' '}
                                                                {normalizedPoseDur.toFixed(1)}s
                                                            </span>
                                                        )}

                                                        {/* Interactive Resize Handle between Poses to adjust Pose Duration */}
                                                        {isNotLastPose && (
                                                            <div
                                                                className="resize-handle absolute -right-2 top-0 bottom-0 w-4 cursor-ew-resize z-30 flex items-center justify-center group/pose-handle touch-none"
                                                                onPointerDown={e =>
                                                                    handleSubFrameResizePointerDown(
                                                                        e,
                                                                        card.id,
                                                                        poseIdx
                                                                    )
                                                                }
                                                                title={`Glisser pour modifier la durée de la Pose ${poseIdx + 1} (${normalizedPoseDur.toFixed(1)}s)`}
                                                            >
                                                                <div className="w-1 h-6 rounded-full bg-stone-400/70 group-hover/pose-handle:bg-[#10B981] group-hover/pose-handle:h-8 group-hover/pose-handle:w-1.5 transition-all shadow" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[#52525b] pointer-events-none">
                                            <Film size={16} />
                                        </div>
                                    )}

                                    {/* Clean Top-Left Shot Pill */}
                                    <div className="absolute top-1.5 left-1.5 pointer-events-none z-10">
                                        <span
                                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-sm ${
                                                isSelected
                                                    ? 'bg-[#10B981] text-white'
                                                    : 'bg-[#18181b]/85 text-white backdrop-blur-sm'
                                            }`}
                                        >
                                            S{card.info.sequence}·P{card.info.shot}
                                        </span>
                                    </div>

                                    {/* Clean Bottom-Right Total Duration Pill */}
                                    <div className="absolute bottom-1.5 right-1.5 pointer-events-none z-10">
                                        <span className="text-[9px] text-white font-mono bg-[#18181b]/85 backdrop-blur-sm px-1.5 py-0.5 rounded-md font-semibold">
                                            {duration.toFixed(1)}s
                                        </span>
                                    </div>

                                    {/* Left Touch-Friendly Trim Handle */}
                                    <div
                                        className="resize-handle absolute left-0 top-0 bottom-0 w-3.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-[#10B981]/30 transition-all z-20 flex items-center justify-center touch-none"
                                        onPointerDown={e =>
                                            handleResizePointerDown(e, card.id, 'left')
                                        }
                                    >
                                        <div className="w-1 h-5 bg-[#10B981] rounded-full shadow" />
                                    </div>

                                    {/* Right Touch-Friendly Trim Handle */}
                                    <div
                                        className="resize-handle absolute right-0 top-0 bottom-0 w-3.5 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-[#10B981]/30 transition-all z-20 flex items-center justify-center touch-none"
                                        onPointerDown={e =>
                                            handleResizePointerDown(e, card.id, 'right')
                                        }
                                        title={
                                            subFrames.length > 1
                                                ? `Glisser pour modifier la durée de la Pose ${subFrames.length}`
                                                : 'Glisser pour modifier la durée du plan'
                                        }
                                    >
                                        <div className="w-1 h-5 bg-[#10B981] rounded-full shadow" />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Quick "+ Plan" Button at the end of the track */}
                        <button
                            onClick={onAddCard}
                            className="ml-2 w-12 h-[80px] rounded-xl border-2 border-dashed border-white/15 hover:border-[#10B981] bg-white/[0.02] hover:bg-[#10B981]/10 text-[#71717a] hover:text-[#10B981] flex flex-col items-center justify-center gap-1 transition-all shrink-0 active:scale-95"
                            title="Ajouter un plan"
                        >
                            <Plus size={16} />
                            <span className="text-[8px] font-bold uppercase">Plan</span>
                        </button>

                        {/* Floating dragged card preview */}
                        {draggedId &&
                            (() => {
                                const card = cards.find(c => c.id === draggedId);
                                if (!card) return null;
                                const duration = card.info.duration || 3;
                                const width = duration * pixelsPerSecond;
                                const thumbData = card.subFrames?.[0]?.data || card.data;
                                return (
                                    <div
                                        className={`absolute top-3 h-[84px] rounded-xl border-2 border-[#10B981] shadow-2xl scale-105 z-50 pointer-events-none opacity-95 flex items-center overflow-hidden ${
                                            thumbData ? 'bg-white' : 'bg-[#202024]'
                                        }`}
                                        style={{
                                            width: `${Math.max(32, width - 6)}px`,
                                            left: `${draggedLeft}px`
                                        }}
                                    >
                                        {thumbData && (
                                            <img
                                                src={thumbData}
                                                alt=""
                                                className="w-full h-full object-contain"
                                            />
                                        )}
                                        <div className="absolute top-1.5 left-1.5 z-10">
                                            <span className="text-[9px] font-black text-white bg-[#10B981] px-1.5 py-0.5 rounded-md shadow-sm">
                                                S{card.info.sequence}·P{card.info.shot}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                    </div>

                    {/* ── PLAYHEAD NEEDLE ── */}
                    <div
                        className="absolute top-0 bottom-0 w-[2px] bg-[#10B981] z-30 pointer-events-none shadow-[0_0_10px_#10B981]"
                        style={{ left: `${playheadPos + 16}px` }}
                    >
                        <div className="absolute top-0 -left-[5px] w-3 h-3 bg-[#10B981] rotate-45 rounded-[2px] shadow-md" />
                    </div>
                </div>
            </div>
        </div>
    );
};
