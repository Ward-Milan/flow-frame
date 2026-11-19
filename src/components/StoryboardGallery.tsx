import React, { useState, useMemo, useRef } from 'react';
import { 
    PenTool, 
    Plus, 
    Trash2, 
    Copy, 
    Clock, 
    Search,
    SlidersHorizontal,
    Play,
    GripVertical,
    LayoutGrid,
    Table2,
    Camera,
    X,
    Layers,
    Minus
} from 'lucide-react';
import { useStoryboardStore } from '../store/useStoryboardStore';
import type { StoryboardCard } from '../modules/frame/types';
import { useToast } from '../shared';

const isValidImageData = (data: string | undefined): data is string => 
    !!data && (
        data.startsWith('data:image/') ||
        data.startsWith('data:application/') ||
        data.startsWith('blob:') ||
        data.startsWith('assets/') ||
        data.startsWith('http')
    );

const LENS_OPTIONS = ['18mm', '24mm', '35mm', '50mm', '85mm', '135mm'];
const SCALE_OPTIONS = [
    'Très Gros Plan',
    'Gros Plan',
    'Plan Rapproché',
    'Plan Américain',
    'Plan Moyen',
    "Plan d'Ensemble"
];
const ANGLE_OPTIONS = ['Niveau œil', 'Plongée', 'Contre-plongée', 'Débullé', 'Zénithal'];
const MOVEMENT_OPTIONS = [
    'Fixe',
    'Panoramique H',
    'Panoramique V',
    'Travelling Avant',
    'Travelling Arrière',
    'Travelling Latéral',
    'Zoom Avant',
    'Caméra Épaule'
];
const SUPPORT_OPTIONS = ['Trépied', 'Épaule', 'Steadicam', 'Rails / Dolly', 'Grue / Drone'];
const LOCATION_OPTIONS = ['INT. JOUR', 'INT. NUIT', 'EXT. JOUR', 'EXT. NUIT'];

export const renumberCardsBySequence = (cardList: StoryboardCard[]): StoryboardCard[] => {
    const sequenceCounts: Record<string, number> = {};
    return cardList.map(card => {
        const seq = card.info.sequence || '1';
        sequenceCounts[seq] = (sequenceCounts[seq] || 1 - 1) + 1;
        return {
            ...card,
            info: {
                ...card.info,
                shot: String(sequenceCounts[seq])
            }
        };
    });
};

// Carte fantôme avec la texture rayée verte et pointillés tournants pour le Drag & Drop des plans
const GalleryCardDropGhost: React.FC<{ targetNumber: number; aspectClass: string }> = ({
    targetNumber
}) => {
    return (
        <div className="flex flex-col rounded-2xl relative overflow-hidden min-h-[270px] pointer-events-none select-none shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-150">
            <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern
                        id="gallery-card-ghost-stripes"
                        width="16"
                        height="16"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                    >
                        <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="16"
                            stroke="#10B981"
                            strokeWidth="5"
                            strokeOpacity="0.25"
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#gallery-card-ghost-stripes)" rx="16" />
                <rect
                    x="2"
                    y="2"
                    width="calc(100% - 4px)"
                    height="calc(100% - 4px)"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeDasharray="10 6"
                    rx="14"
                    className="animate-marching-ants"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="px-3 py-1 rounded-xl bg-[#14161B]/95 border border-[#10B981] text-[#10B981] font-mono text-xs font-bold shadow-xl">
                    Déposer en Plan #{targetNumber}
                </span>
            </div>
        </div>
    );
};

export const StoryboardGallery: React.FC = () => {
    const cards = useStoryboardStore(s => s.project.cards);
    const aspectRatio = useStoryboardStore(s => s.project.aspectRatio || '16:9');
    const updateCard = useStoryboardStore(s => s.updateCard);
    const deleteCard = useStoryboardStore(s => s.deleteCard);
    const duplicateCard = useStoryboardStore(s => s.duplicateCard);
    const addCard = useStoryboardStore(s => s.addCard);
    const reorderCards = useStoryboardStore(s => s.reorderCards);
    const selectCardAndGoTo = useStoryboardStore(s => s.selectCardAndGoTo);
    
    const toast = useToast();
    const [galleryMode, setGalleryMode] = useState<'boards' | 'shotlist'>('boards');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSequence, setSelectedSequence] = useState<string>('all');
    const [editingCardDetailsId, setEditingCardDetailsId] = useState<string | null>(null);

    // Pointer-based Drag and Drop state (Works reliably on Mac, Windows AND Android Tablet Touch/Stylus)
    const gridRef = useRef<HTMLDivElement>(null);
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);

    const galleryAspectClass = useMemo(() => {
        switch (aspectRatio) {
            case '2.39:1':
                return 'aspect-[2.39/1]';
            case '4:3':
                return 'aspect-[4/3]';
            case '9:16':
                return 'aspect-[9/16]';
            case '16:9':
            default:
                return 'aspect-video';
        }
    }, [aspectRatio]);

    const sequences = Array.from(new Set(cards.map(c => c.info.sequence || '1'))).sort(
        (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    const filteredCards = cards.filter(card => {
        const matchesSeq = selectedSequence === 'all' || card.info.sequence === selectedSequence;
        const matchesSearch =
            !searchQuery ||
            card.info.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            `s${card.info.sequence}p${card.info.shot}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.info.scale.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.info.movement.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (card.info.focalLength || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSeq && matchesSearch;
    });

    const activeEditingCard = cards.find(c => c.id === editingCardDetailsId);

    const cycleFieldValue = (cardId: string, field: keyof StoryboardCard['info'], currentVal: string, list: string[]) => {
        const idx = list.indexOf(currentVal);
        const nextVal = list[(idx + 1) % list.length];
        updateCard(cardId, { info: { [field]: nextVal } });
    };

    const cycleShotStatus = (card: StoryboardCard) => {
        const cur = card.info.shotStatus || 'draft';
        const next = cur === 'draft' ? 'ready' : cur === 'ready' ? 'shot' : 'draft';
        updateCard(card.id, { info: { shotStatus: next } });
    };

    // ── POINTER-BASED CARD DRAG & DROP (100% Compatible Souris Mac/Windows + Tactile Tablette Android) ──
    const handleCardDragPointerDown = (cardId: string, e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input, textarea, select')) return;
        e.preventDefault();
        e.stopPropagation();

        const startIdx = filteredCards.findIndex(c => c.id === cardId);
        if (startIdx === -1 || filteredCards.length <= 1) return;

        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let currentTargetIdx = startIdx;

        // Snapshot initial card bounding box centers in the grid
        const cardCenters: { x: number; y: number }[] = [];
        if (gridRef.current) {
            const cardEls = Array.from(
                gridRef.current.querySelectorAll('[data-gallery-card-slot="true"]')
            ) as HTMLElement[];
            cardEls.forEach(el => {
                const r = el.getBoundingClientRect();
                cardCenters.push({
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2
                });
            });
        }

        const onMove = (moveEv: PointerEvent) => {
            const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
            if (!isDragging && dist > 6) {
                isDragging = true;
                setDraggingCardId(cardId);
                setDropTargetIndex(startIdx);
            }

            if (isDragging) {
                setDragPointerPos({ x: moveEv.clientX, y: moveEv.clientY });

                if (cardCenters.length > 0) {
                    let bestIdx = 0;
                    let minDist = Infinity;
                    cardCenters.forEach((center, idx) => {
                        const d = Math.hypot(moveEv.clientX - center.x, moveEv.clientY - center.y);
                        if (d < minDist) {
                            minDist = d;
                            bestIdx = idx;
                        }
                    });
                    currentTargetIdx = bestIdx;
                    setDropTargetIndex(bestIdx);
                }
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);

            if (isDragging) {
                const targetCard = filteredCards[currentTargetIdx];
                setDraggingCardId(null);
                setDropTargetIndex(null);
                setDragPointerPos(null);

                if (targetCard && targetCard.id !== cardId) {
                    const allCards = [...cards];
                    const fromGlobalIdx = allCards.findIndex(c => c.id === cardId);
                    const toGlobalIdx = allCards.findIndex(c => c.id === targetCard.id);
                    if (fromGlobalIdx !== -1 && toGlobalIdx !== -1) {
                        const [moved] = allCards.splice(fromGlobalIdx, 1);
                        allCards.splice(toGlobalIdx, 0, moved);
                        const renumbered = renumberCardsBySequence(allCards);
                        reorderCards(renumbered);
                    }
                }
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    // Build visual sequence of cards with the green textured drop ghost inserted at dropTargetIndex
    type GallerySlot =
        | { kind: 'card'; card: StoryboardCard }
        | { kind: 'ghost'; targetNumber: number };

    const gallerySlots: GallerySlot[] = [];
    if (draggingCardId && dropTargetIndex !== null) {
        const remaining = filteredCards.filter(c => c.id !== draggingCardId);
        const clamped = Math.max(0, Math.min(remaining.length, dropTargetIndex));
        for (let i = 0; i <= remaining.length; i++) {
            if (i === clamped) {
                gallerySlots.push({ kind: 'ghost', targetNumber: i + 1 });
            }
            if (i < remaining.length) {
                gallerySlots.push({ kind: 'card', card: remaining[i] });
            }
        }
    } else {
        filteredCards.forEach(card => {
            gallerySlots.push({ kind: 'card', card });
        });
    }

    const draggedCardObj = draggingCardId ? cards.find(c => c.id === draggingCardId) : null;

    return (
        <div className="flex-1 flex flex-col bg-[#0D0E11] text-[#EDEDEC] overflow-hidden select-none">
            {/* ── WORKSTATION SUB-HEADER (Planches vs Découpage Technique + Filtres Séquences) ── */}
            <div className="py-2.5 px-4 sm:px-6 border-b border-[#282B37] flex flex-wrap items-center justify-between gap-3 bg-[#14161B] flex-shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center bg-[#0D0E11] border border-[#282B37] p-0.5 rounded-xl">
                        <button
                            onClick={() => setGalleryMode('boards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                galleryMode === 'boards'
                                    ? 'bg-[#191B22] text-[#10B981] border border-[#10B981]/30 shadow'
                                    : 'text-[#9B9A97] hover:text-[#EDEDEC]'
                            }`}
                        >
                            <LayoutGrid size={13} />
                            <span>Planches ({filteredCards.length})</span>
                        </button>
                        <button
                            onClick={() => setGalleryMode('shotlist')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                galleryMode === 'shotlist'
                                    ? 'bg-[#191B22] text-[#F59E0B] border border-[#F59E0B]/30 shadow'
                                    : 'text-[#9B9A97] hover:text-[#EDEDEC]'
                            }`}
                        >
                            <Table2 size={13} />
                            <span>Découpage Technique (Shot List)</span>
                        </button>
                    </div>

                    {/* Sequence Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                        <button
                            onClick={() => setSelectedSequence('all')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                selectedSequence === 'all'
                                    ? 'bg-[#10B981] text-white'
                                    : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                            }`}
                        >
                            Toutes les séquences
                        </button>
                        {sequences.map(seq => (
                            <button
                                key={seq}
                                onClick={() => setSelectedSequence(seq)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                                    selectedSequence === seq
                                        ? 'bg-[#10B981] text-white'
                                        : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                }`}
                            >
                                SÉQ {String(seq).padStart(2, '0')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Search Bar */}
                <div className="relative w-48 sm:w-60">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9B9A97]" />
                    <input
                        type="text"
                        placeholder="Filtrer (focale, plan, action)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0D0E11] border border-[#282B37] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#EDEDEC] placeholder-[#9B9A97]/60 focus:border-[#10B981] focus:outline-none transition-colors"
                    />
                </div>
            </div>

            {/* ── MAIN WORKSPACE: BOARDS GRID OR TECHNICAL SHOT LIST TABLE ── */}
            {galleryMode === 'boards' ? (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                    <div
                        ref={gridRef}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 max-w-[2000px] mx-auto"
                    >
                        {gallerySlots.map((slot, sIdx) => {
                            if (slot.kind === 'ghost') {
                                return (
                                    <div key="gallery-card-drop-ghost" data-gallery-card-slot="true">
                                        <GalleryCardDropGhost
                                            targetNumber={slot.targetNumber}
                                            aspectClass={galleryAspectClass}
                                        />
                                    </div>
                                );
                            }

                            const { card } = slot;
                            const thumbnail = card.subFrames?.[0]?.data || card.data;
                            const poseCount = card.subFrames?.length || 1;
                            const duration = card.info.duration || 3;
                            const status = card.info.shotStatus || 'draft';

                            return (
                                <div
                                    key={card.id || sIdx}
                                    data-gallery-card-slot="true"
                                    className={`flex flex-col bg-[#14161B] rounded-2xl border shadow-xl overflow-hidden transition-all duration-150 group/card relative ${
                                        status === 'shot'
                                            ? 'border-[#10B981]/50'
                                            : 'border-[#282B37] hover:border-[#10B981]/50'
                                    }`}
                                >
                                    {/* ── 1. CARD HEADER (Draggable Grip + Seq/Plan + Réglages) ── */}
                                    <div
                                        onPointerDown={e => handleCardDragPointerDown(card.id, e)}
                                        className="flex items-center justify-between px-3 py-2 bg-[#191B22] border-b border-[#282B37] cursor-grab active:cursor-grabbing touch-none"
                                        title="Maintenir et glisser cet en-tête pour déplacer le plan"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <div className="text-[#9B9A97] group-hover/card:text-white p-0.5 rounded">
                                                <GripVertical size={14} />
                                            </div>

                                            <span className="text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-[#10B981] text-white">
                                                S{String(card.info.sequence).padStart(2, '0')}·P{String(card.info.shot).padStart(2, '0')}
                                            </span>

                                            {/* 1-Tap Status Badge (STBY / PRÊT / TOURNÉ) */}
                                            <button
                                                onClick={() => cycleShotStatus(card)}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-colors ${
                                                    status === 'shot'
                                                        ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                                                        : status === 'ready'
                                                        ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                                                        : 'bg-[#0D0E11] text-[#9B9A97] border-[#282B37]'
                                                }`}
                                                title="Toucher pour pointer le statut plateau (STBY → PRÊT → TOURNÉ)"
                                            >
                                                {status === 'shot' ? '✓ TOURNÉ' : status === 'ready' ? 'PRÊT' : 'STBY'}
                                            </button>
                                        </div>

                                        {/* Right: Duration & Quick Actions (Réglages, Dupliquer, Supprimer) */}
                                        <div className="flex items-center gap-1">
                                            <span className="flex items-center gap-0.5 text-[10px] text-[#F59E0B] font-mono font-bold mr-1">
                                                <Clock size={10} />
                                                {duration.toFixed(1)}s
                                            </span>

                                            <button
                                                onClick={() => setEditingCardDetailsId(card.id)}
                                                className="p-1.5 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[#9B9A97] hover:text-white active:scale-95 transition-all"
                                                title="Ouvrir les réglages & la fiche caméra du plan"
                                            >
                                                <SlidersHorizontal size={12} />
                                            </button>

                                            <button
                                                onClick={() => {
                                                    duplicateCard(card.id);
                                                    toast.success('Plan dupliqué');
                                                }}
                                                className="p-1.5 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[#9B9A97] hover:text-white active:scale-95 transition-all"
                                                title="Dupliquer ce plan"
                                            >
                                                <Copy size={12} />
                                            </button>

                                            <button
                                                onClick={() => {
                                                    if (cards.length <= 1) {
                                                        toast.warning('Le projet doit contenir au moins un plan');
                                                        return;
                                                    }
                                                    deleteCard(card.id);
                                                    toast.info('Plan supprimé');
                                                }}
                                                className="p-1.5 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[#9B9A97] hover:text-red-400 active:scale-95 transition-all"
                                                title="Supprimer ce plan"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── 2. VIGNETTE AVEC BOUTON "DESSINER" & RÉGLAGES DIRECTS ── */}
                                    <div
                                        onClick={() => selectCardAndGoTo(card.id, 'draw')}
                                        className={`relative ${galleryAspectClass} w-full bg-white cursor-pointer overflow-hidden group/thumb border-b border-[#282B37] isolate`}
                                    >
                                        {isValidImageData(thumbnail) || isValidImageData(card.backgroundData) ? (
                                            <>
                                                {isValidImageData(thumbnail) && (
                                                    <img 
                                                        src={thumbnail} 
                                                        draggable={false}
                                                        className="w-full h-full object-contain bg-white pointer-events-none" 
                                                        alt={`Plan ${card.info.shot}`} 
                                                    />
                                                )}
                                                {isValidImageData(card.backgroundData) && (
                                                    <img 
                                                        src={card.backgroundData} 
                                                        draggable={false}
                                                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none" 
                                                        alt="Décor" 
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-stone-400 bg-stone-50">
                                                <PenTool size={22} className="text-stone-300" />
                                                <span className="text-[11px] font-semibold text-stone-400">
                                                    Cliquer pour dessiner
                                                </span>
                                            </div>
                                        )}

                                        {/* Hover & Touch Overlay: Bouton "Dessiner" + Bouton "Réglages" */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectCardAndGoTo(card.id, 'draw');
                                                }}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/85 hover:bg-[#10B981] text-white font-bold text-xs shadow-2xl backdrop-blur-md border border-[#10B981]/50 transition-all"
                                            >
                                                <PenTool size={13} />
                                                <span>Dessiner</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingCardDetailsId(card.id);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/85 hover:bg-[#F59E0B] hover:text-black text-white font-bold text-xs shadow-2xl backdrop-blur-md border border-white/20 transition-all"
                                            >
                                                <SlidersHorizontal size={12} />
                                                <span>Réglages</span>
                                            </button>
                                        </div>

                                        {/* Pose Count Badge if > 1 pose */}
                                        {poseCount > 1 && (
                                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-[#14161B]/90 text-[#10B981] border border-[#10B981]/40 font-mono text-[9px] font-bold flex items-center gap-1 shadow">
                                                <Layers size={10} />
                                                <span>{poseCount} poses</span>
                                            </div>
                                        )}

                                        {/* Location Effect Badge */}
                                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#14161B]/85 text-[#EDEDEC] font-mono text-[9px] font-bold border border-white/10">
                                            {card.info.locationEffect || 'INT. JOUR'}
                                        </div>
                                    </div>

                                    {/* ── 3. OPTICAL TELEMETRY BAR (1-Tap Cycle Chips) ── */}
                                    <div className="px-3 py-2 bg-[#0D0E11] border-b border-[#282B37] flex items-center justify-between gap-1 text-[10px] font-mono">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <button
                                                onClick={() =>
                                                    cycleFieldValue(
                                                        card.id,
                                                        'focalLength',
                                                        card.info.focalLength || '35mm',
                                                        LENS_OPTIONS
                                                    )
                                                }
                                                className="px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#F59E0B] font-bold border border-[#282B37]"
                                                title="Toucher pour changer la focale"
                                            >
                                                {card.info.focalLength || '35mm'}
                                            </button>

                                            <button
                                                onClick={() =>
                                                    cycleFieldValue(
                                                        card.id,
                                                        'scale',
                                                        card.info.scale || 'Plan Moyen',
                                                        SCALE_OPTIONS
                                                    )
                                                }
                                                className="px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#10B981] font-bold border border-[#282B37]"
                                                title="Toucher pour changer la valeur de plan"
                                            >
                                                {card.info.scale || 'Plan Moyen'}
                                            </button>

                                            <button
                                                onClick={() =>
                                                    cycleFieldValue(
                                                        card.id,
                                                        'support',
                                                        card.info.support || 'Trépied',
                                                        SUPPORT_OPTIONS
                                                    )
                                                }
                                                className="px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#9B9A97] border border-[#282B37]"
                                                title="Toucher pour changer le support caméra"
                                            >
                                                {card.info.support || 'Trépied'}
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => selectCardAndGoTo(card.id, 'animatic')}
                                            className="px-2 py-0.5 rounded bg-[#191B22] hover:bg-[#10B981] text-[#9B9A97] hover:text-white border border-[#282B37] flex items-center gap-1 transition-colors font-sans font-bold"
                                            title="Ouvrir dans l'Animatique"
                                        >
                                            <Play size={9} />
                                            <span>Caler</span>
                                        </button>
                                    </div>

                                    {/* ── 4. CARD FOOTER (Action & Dialogue) ── */}
                                    <div className="p-2.5 bg-[#14161B] flex flex-col gap-1 flex-1">
                                        <div className="text-[10px] font-semibold text-sky-400 flex items-center justify-between">
                                            <button
                                                onClick={() => setEditingCardDetailsId(card.id)}
                                                className="hover:underline text-left"
                                            >
                                                {card.info.cameraAngle || 'Niveau œil'} · {card.info.movement || 'Fixe'}
                                            </button>
                                            <span className="text-[9px] font-mono text-[#9B9A97]">
                                                {card.info.soundType || 'Synchrone'}
                                            </span>
                                        </div>
                                        <textarea
                                            placeholder="Action, dialogue, intention lumière..."
                                            rows={2}
                                            value={card.info.description}
                                            onChange={(e) => updateCard(card.id, { info: { description: e.target.value } })}
                                            className="w-full bg-transparent border-0 text-[11px] text-[#EDEDEC] placeholder-[#9B9A97]/50 focus:outline-none resize-none leading-relaxed"
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* ── ADD NEW PLAN CARD AT THE END ── */}
                        <button
                            onClick={() => {
                                addCard();
                                toast.success('Nouveau plan ajouté au découpage');
                            }}
                            className="flex flex-col items-center justify-center min-h-[260px] border-2 border-dashed border-[#282B37] hover:border-[#10B981] bg-[#14161B]/50 hover:bg-[#10B981]/5 rounded-2xl p-6 transition-all duration-200 group text-center"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-[#191B22] border border-[#282B37] group-hover:bg-[#10B981] flex items-center justify-center text-[#10B981] group-hover:text-white transition-all shadow-md mb-2.5">
                                <Plus size={24} />
                            </div>
                            <span className="text-xs font-bold text-[#EDEDEC]">
                                + Ajouter le Plan {cards.length + 1}
                            </span>
                            <span className="text-[10px] text-[#9B9A97] mt-0.5 font-mono">
                                Nouveau cadre de découpage
                            </span>
                        </button>
                    </div>
                </div>
            ) : (
                /* ── VUE DÉCOUPAGE TECHNIQUE (TABLEUR SHOT LIST TACTILE POUR TOURNAGE) ── */
                <div className="flex-1 overflow-auto p-4 sm:p-6 min-h-0">
                    <div className="max-w-[1800px] mx-auto bg-[#14161B] border border-[#282B37] rounded-2xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#191B22] border-b border-[#282B37] text-[10px] font-mono uppercase text-[#9B9A97] tracking-wider">
                                    <th className="py-3 px-3">Plateau</th>
                                    <th className="py-3 px-3">Séq·Plan</th>
                                    <th className="py-3 px-3">Cadre</th>
                                    <th className="py-3 px-3">Lieu / Effet</th>
                                    <th className="py-3 px-3">Focale</th>
                                    <th className="py-3 px-3">Valeur</th>
                                    <th className="py-3 px-3">Angle</th>
                                    <th className="py-3 px-3">Mouvement & Support</th>
                                    <th className="py-3 px-3">Son</th>
                                    <th className="py-3 px-3">Durée</th>
                                    <th className="py-3 px-3 min-w-[220px]">Action & Dialogues</th>
                                    <th className="py-3 px-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#282B37] text-xs">
                                {filteredCards.map((card) => {
                                    const thumbnail = card.subFrames?.[0]?.data || card.data;
                                    const status = card.info.shotStatus || 'draft';

                                    return (
                                        <tr
                                            key={card.id}
                                            className={`transition-colors ${
                                                status === 'shot'
                                                    ? 'bg-[#10B981]/5 hover:bg-[#10B981]/10'
                                                    : 'hover:bg-[#191B22]/60'
                                            }`}
                                        >
                                            <td className="py-2.5 px-3">
                                                <button
                                                    onClick={() => cycleShotStatus(card)}
                                                    className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase border transition-all ${
                                                        status === 'shot'
                                                            ? 'bg-[#10B981] text-white border-[#10B981]'
                                                            : status === 'ready'
                                                            ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                                                            : 'bg-[#0D0E11] text-[#9B9A97] border-[#282B37]'
                                                    }`}
                                                >
                                                    {status === 'shot' ? '✓ Tourné' : status === 'ready' ? 'Prêt' : 'À tourner'}
                                                </button>
                                            </td>

                                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded bg-[#191B22] border border-[#282B37] text-[#10B981]">
                                                    S{String(card.info.sequence).padStart(2, '0')}·P{String(card.info.shot).padStart(2, '0')}
                                                </span>
                                            </td>

                                            <td className="py-2 px-3">
                                                <div
                                                    onClick={() => selectCardAndGoTo(card.id, 'draw')}
                                                    className="w-24 h-14 rounded-lg bg-white border border-[#282B37] overflow-hidden cursor-pointer relative flex items-center justify-center"
                                                >
                                                    {isValidImageData(thumbnail) ? (
                                                        <img src={thumbnail} className="w-full h-full object-contain" alt="" />
                                                    ) : (
                                                        <PenTool size={13} className="text-stone-300" />
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <button
                                                    onClick={() =>
                                                        cycleFieldValue(
                                                            card.id,
                                                            'locationEffect',
                                                            card.info.locationEffect || 'INT. JOUR',
                                                            LOCATION_OPTIONS
                                                        )
                                                    }
                                                    className="px-2 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] font-mono text-[10px] font-bold text-[#EDEDEC] hover:border-[#10B981]"
                                                >
                                                    {card.info.locationEffect || 'INT. JOUR'}
                                                </button>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <button
                                                    onClick={() =>
                                                        cycleFieldValue(
                                                            card.id,
                                                            'focalLength',
                                                            card.info.focalLength || '35mm',
                                                            LENS_OPTIONS
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] font-mono text-[11px] font-bold text-[#F59E0B] hover:border-[#F59E0B]"
                                                >
                                                    {card.info.focalLength || '35mm'}
                                                </button>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <button
                                                    onClick={() =>
                                                        cycleFieldValue(
                                                            card.id,
                                                            'scale',
                                                            card.info.scale || 'Plan Moyen',
                                                            SCALE_OPTIONS
                                                        )
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[11px] font-bold text-[#10B981] hover:border-[#10B981] whitespace-nowrap"
                                                >
                                                    {card.info.scale || 'Plan Moyen'}
                                                </button>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <button
                                                    onClick={() =>
                                                        cycleFieldValue(
                                                            card.id,
                                                            'cameraAngle',
                                                            card.info.cameraAngle || 'Niveau œil',
                                                            ANGLE_OPTIONS
                                                        )
                                                    }
                                                    className="px-2 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[11px] text-[#EDEDEC] whitespace-nowrap"
                                                >
                                                    {card.info.cameraAngle || 'Niveau œil'}
                                                </button>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            cycleFieldValue(
                                                                card.id,
                                                                'movement',
                                                                card.info.movement || 'Fixe',
                                                                MOVEMENT_OPTIONS
                                                            )
                                                        }
                                                        className="px-2 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[11px] font-semibold text-sky-400 whitespace-nowrap"
                                                    >
                                                        {card.info.movement || 'Fixe'}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            cycleFieldValue(
                                                                card.id,
                                                                'support',
                                                                card.info.support || 'Trépied',
                                                                SUPPORT_OPTIONS
                                                            )
                                                        }
                                                        className="px-2 py-1 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[10px] font-mono text-[#F59E0B] whitespace-nowrap"
                                                    >
                                                        {card.info.support || 'Trépied'}
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3 font-mono text-[10px] text-[#9B9A97] whitespace-nowrap">
                                                {card.info.soundType || 'Synchrone'}
                                            </td>

                                            <td className="py-2.5 px-3 font-mono font-bold text-[#F59E0B] whitespace-nowrap">
                                                {(card.info.duration || 3).toFixed(1)}s
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <input
                                                    type="text"
                                                    value={card.info.description}
                                                    onChange={(e) =>
                                                        updateCard(card.id, { info: { description: e.target.value } })
                                                    }
                                                    placeholder="Action, dialogue, lumière..."
                                                    className="w-full bg-[#0D0E11] border border-[#282B37] rounded-lg px-2.5 py-1.5 text-xs text-[#EDEDEC] focus:border-[#10B981] outline-none"
                                                />
                                            </td>

                                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => selectCardAndGoTo(card.id, 'draw')}
                                                        className="p-1.5 rounded-lg bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981] hover:text-white transition-colors"
                                                        title="Dessiner"
                                                    >
                                                        <PenTool size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingCardDetailsId(card.id)}
                                                        className="p-1.5 rounded-lg bg-[#0D0E11] border border-[#282B37] text-[#9B9A97] hover:text-white"
                                                        title="Réglages & Fiche Caméra"
                                                    >
                                                        <SlidersHorizontal size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Floating Dragged Card Miniature under Cursor/Finger */}
            {draggedCardObj && dragPointerPos && (
                <div
                    style={{
                        left: dragPointerPos.x,
                        top: dragPointerPos.y
                    }}
                    className="fixed -translate-x-1/2 -translate-y-1/2 w-44 rounded-2xl overflow-hidden border-2 border-[#10B981] bg-[#14161B] shadow-2xl pointer-events-none z-50 opacity-90 scale-105 rotate-2"
                >
                    <div className="px-2.5 py-1 bg-[#191B22] border-b border-[#282B37] flex items-center justify-between text-[10px] font-mono font-bold">
                        <span className="text-[#10B981]">
                            S{draggedCardObj.info.sequence}·P{draggedCardObj.info.shot}
                        </span>
                        <span className="text-[#F59E0B]">{draggedCardObj.info.focalLength || '35mm'}</span>
                    </div>
                    <div className="aspect-video w-full bg-white flex items-center justify-center">
                        {isValidImageData(draggedCardObj.subFrames?.[0]?.data || draggedCardObj.data) ? (
                            <img
                                src={draggedCardObj.subFrames?.[0]?.data || draggedCardObj.data}
                                className="w-full h-full object-contain"
                                alt=""
                            />
                        ) : (
                            <PenTool size={16} className="text-stone-300" />
                        )}
                    </div>
                </div>
            )}

            {/* ── FICHE RÉGLAGES & CAMÉRA "1-TAP" MODAL (Tablette Android & Desktop) ── */}
            {activeEditingCard && (
                <div 
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setEditingCardDetailsId(null)}
                >
                    <div 
                        className="w-full max-w-lg bg-[#14161B] border border-[#282B37] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[#EDEDEC] max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-[#282B37] pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-black px-2.5 py-1 rounded bg-[#10B981] text-white">
                                    S{String(activeEditingCard.info.sequence).padStart(2, '0')}·P{String(activeEditingCard.info.shot).padStart(2, '0')}
                                </span>
                                <span className="text-sm font-bold">
                                    Réglages du Plan & Fiche Caméra
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const id = activeEditingCard.id;
                                        setEditingCardDetailsId(null);
                                        selectCardAndGoTo(id, 'draw');
                                    }}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#10B981] text-white text-xs font-bold"
                                >
                                    <PenTool size={12} />
                                    <span>Dessiner</span>
                                </button>
                                <button 
                                    onClick={() => setEditingCardDetailsId(null)}
                                    className="p-1.5 rounded-lg bg-[#191B22] border border-[#282B37] text-[#9B9A97] hover:text-white"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Séquence, Plan & Durée */}
                        <div className="grid grid-cols-3 gap-3 bg-[#191B22] border border-[#282B37] rounded-xl p-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[#9B9A97] block mb-1">Séquence</label>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { sequence: String(Math.max(1, (parseInt(activeEditingCard.info.sequence, 10) || 1) - 1)) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Minus size={11} />
                                    </button>
                                    <input
                                        type="text"
                                        value={activeEditingCard.info.sequence}
                                        onChange={e => updateCard(activeEditingCard.id, { info: { sequence: e.target.value } })}
                                        className="w-10 bg-transparent font-mono text-xs font-bold text-center outline-none"
                                    />
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { sequence: String((parseInt(activeEditingCard.info.sequence, 10) || 1) + 1) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Plus size={11} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-[#9B9A97] block mb-1">Plan</label>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { shot: String(Math.max(1, (parseInt(activeEditingCard.info.shot, 10) || 1) - 1)) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Minus size={11} />
                                    </button>
                                    <input
                                        type="text"
                                        value={activeEditingCard.info.shot}
                                        onChange={e => updateCard(activeEditingCard.id, { info: { shot: e.target.value } })}
                                        className="w-10 bg-transparent font-mono text-xs font-bold text-center text-[#10B981] outline-none"
                                    />
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { shot: String((parseInt(activeEditingCard.info.shot, 10) || 1) + 1) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Plus size={11} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-[#9B9A97] block mb-1">Durée (s)</label>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { duration: Math.max(0.5, Number(((activeEditingCard.info.duration || 3) - 0.5).toFixed(1))) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Minus size={11} />
                                    </button>
                                    <span className="font-mono text-xs font-bold flex-1 text-center text-[#F59E0B]">
                                        {(activeEditingCard.info.duration || 3).toFixed(1)}s
                                    </span>
                                    <button
                                        onClick={() =>
                                            updateCard(activeEditingCard.id, {
                                                info: { duration: Number(((activeEditingCard.info.duration || 3) + 0.5).toFixed(1)) }
                                            })
                                        }
                                        className="w-7 h-7 rounded bg-[#0D0E11] border border-[#282B37] flex items-center justify-center"
                                    >
                                        <Plus size={11} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Focale Optique (1-Tap) */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97]">Focale Optique</label>
                            <div className="grid grid-cols-6 gap-1.5">
                                {LENS_OPTIONS.map(lens => (
                                    <button
                                        key={lens}
                                        onClick={() => updateCard(activeEditingCard.id, { info: { focalLength: lens } })}
                                        className={`py-2 rounded-xl font-mono text-xs font-bold transition-all ${
                                            (activeEditingCard.info.focalLength || '35mm') === lens
                                                ? 'bg-[#F59E0B] text-black shadow'
                                                : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {lens}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Valeur de Plan (1-Tap) */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97]">Valeur de Plan</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {SCALE_OPTIONS.map(sc => (
                                    <button
                                        key={sc}
                                        onClick={() => updateCard(activeEditingCard.id, { info: { scale: sc } })}
                                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                                            activeEditingCard.info.scale === sc
                                                ? 'bg-[#10B981] text-white shadow'
                                                : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {sc}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Angle & Mouvement & Support (1-Tap) */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97]">Angle, Mouvement & Support</label>
                            <div className="flex flex-wrap gap-1.5">
                                {ANGLE_OPTIONS.map(ang => (
                                    <button
                                        key={ang}
                                        onClick={() => updateCard(activeEditingCard.id, { info: { cameraAngle: ang } })}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                            (activeEditingCard.info.cameraAngle || 'Niveau œil') === ang
                                                ? 'bg-[#10B981] text-white'
                                                : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {ang}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {MOVEMENT_OPTIONS.map(mv => (
                                    <button
                                        key={mv}
                                        onClick={() => updateCard(activeEditingCard.id, { info: { movement: mv } })}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                                            activeEditingCard.info.movement === mv
                                                ? 'bg-sky-500 text-white'
                                                : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {mv}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                {SUPPORT_OPTIONS.map(sup => (
                                    <button
                                        key={sup}
                                        onClick={() => updateCard(activeEditingCard.id, { info: { support: sup } })}
                                        className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                            (activeEditingCard.info.support || 'Trépied') === sup
                                                ? 'bg-[#F59E0B] text-black'
                                                : 'bg-[#191B22] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {sup}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Description / Dialogue */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97]">Action, Dialogue & Notes</label>
                            <textarea
                                rows={3}
                                value={activeEditingCard.info.description}
                                onChange={(e) => updateCard(activeEditingCard.id, { info: { description: e.target.value } })}
                                placeholder="Description de l'action, réplique ou note de mise en scène..."
                                className="w-full bg-[#191B22] border border-[#282B37] rounded-xl p-2.5 text-xs text-[#EDEDEC] focus:border-[#10B981] outline-none resize-none leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
