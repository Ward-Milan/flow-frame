import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    Repeat,
    PenTool,
    ChevronLeft,
    ChevronRight,
    Maximize2,
    Minimize2,
    Music,
    Volume2,
    VolumeX,
    X
} from 'lucide-react';
import { useStoryboardStore } from '../store/useStoryboardStore';
import { Timeline } from '../modules/frame/Timeline';
import { ExportStoryboardModal } from '../modules/frame/ExportStoryboardModal';
import { useToast } from '../shared';

export const AnimaticStudio: React.FC = () => {
    const toast = useToast();
    const project = useStoryboardStore(s => s.project);
    const cards = project.cards;
    const activeCardId = useStoryboardStore(s => s.activeCardId);
    const setActiveCardId = useStoryboardStore(s => s.setActiveCardId);
    const selectCardAndGoTo = useStoryboardStore(s => s.selectCardAndGoTo);
    const updateCard = useStoryboardStore(s => s.updateCard);
    const reorderCards = useStoryboardStore(s => s.reorderCards);
    const addCard = useStoryboardStore(s => s.addCard);

    // Playback state
    const currentTime = useStoryboardStore(s => s.currentTime);
    const setCurrentTime = useStoryboardStore(s => s.setCurrentTime);
    const isPlaying = useStoryboardStore(s => s.isPlaying);
    const setIsPlaying = useStoryboardStore(s => s.setIsPlaying);
    const activeSubFrameIndex = useStoryboardStore(s => s.activeSubFrameIndex);
    const setActiveSubFrameIndex = useStoryboardStore(s => s.setActiveSubFrameIndex);
    const isLooping = useStoryboardStore(s => s.isLooping);
    const setIsLooping = useStoryboardStore(s => s.setIsLooping);
    const simulateCameraMove = useStoryboardStore(s => s.simulateCameraMove);
    const audioTrackUrl = useStoryboardStore(s => s.audioTrackUrl);
    const audioTrackName = useStoryboardStore(s => s.audioTrackName);
    const isAudioMuted = useStoryboardStore(s => s.isAudioMuted);
    const setAudioTrack = useStoryboardStore(s => s.setAudioTrack);
    const setIsAudioMuted = useStoryboardStore(s => s.setIsAudioMuted);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);

    const handleImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
            if (evt.target?.result) {
                setAudioTrack(evt.target.result as string, file.name);
                toast.success(`Piste son importée : ${file.name}`);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
    const [isProjectionMode, setIsProjectionMode] = useState(false);
    const aspectRatio = project.aspectRatio || '16:9';

    const { animaticAspectClass, animaticMaxClass } = useMemo(() => {
        switch (aspectRatio) {
            case '2.39:1':
                return { animaticAspectClass: 'aspect-[2.39/1]', animaticMaxClass: isProjectionMode ? 'max-w-7xl' : 'max-w-5xl' };
            case '4:3':
                return { animaticAspectClass: 'aspect-[4/3]', animaticMaxClass: isProjectionMode ? 'max-w-4xl' : 'max-w-3xl' };
            case '9:16':
                return { animaticAspectClass: 'aspect-[9/16]', animaticMaxClass: 'max-w-sm h-[75vh]' };
            case '16:9':
            default:
                return { animaticAspectClass: 'aspect-video', animaticMaxClass: isProjectionMode ? 'max-w-6xl' : 'max-w-4xl' };
        }
    }, [aspectRatio, isProjectionMode]);

    const totalDuration = useMemo(() => {
        return cards.reduce((acc, c) => acc + (c.info.duration || 3), 0);
    }, [cards]);

    // Refs for 60fps clock loop without teardown
    const isPlayingRef = useRef(isPlaying);
    isPlayingRef.current = isPlaying;
    const isLoopingRef = useRef(isLooping);
    isLoopingRef.current = isLooping;
    const totalDurationRef = useRef(totalDuration);
    totalDurationRef.current = totalDuration;

    // ── ROCK-SOLID 60FPS PLAYBACK ENGINE ──
    useEffect(() => {
        if (!isPlaying) return;

        let animationFrame: number;
        let lastTime = performance.now();

        const tick = (now: number) => {
            if (!isPlayingRef.current) return;
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            setCurrentTime(prev => {
                const next = prev + delta;
                if (next >= totalDurationRef.current) {
                    if (isLoopingRef.current && totalDurationRef.current > 0) {
                        return 0;
                    }
                    setIsPlaying(false);
                    return 0;
                }
                return next;
            });

            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);
        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isPlaying, setCurrentTime, setIsPlaying]);

    // ── SYNCHRONIZE AUDIO TRACK WITH ANIMATIC TIMELINE ──
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !audioTrackUrl) return;

        if (isPlaying) {
            if (Math.abs(audio.currentTime - currentTime) > 0.25) {
                audio.currentTime = currentTime;
            }
            audio.play().catch(() => {});
        } else {
            audio.pause();
        }
    }, [isPlaying, audioTrackUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !audioTrackUrl) return;
        if (Math.abs(audio.currentTime - currentTime) > 0.3) {
            audio.currentTime = currentTime;
        }
    }, [currentTime, audioTrackUrl]);

    // Calculate current visible frame based on currentTime (with normalized pose durations)
    const playbackState = useMemo(() => {
        let accumulatedTime = 0;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cardDuration = card.info.duration || 3;
            const isLast = i === cards.length - 1;

            if (
                currentTime >= accumulatedTime &&
                (currentTime < accumulatedTime + cardDuration ||
                    (isLast && currentTime <= accumulatedTime + cardDuration + 0.05))
            ) {
                const subFrames =
                    card.subFrames && card.subFrames.length > 0
                        ? card.subFrames
                        : [{ id: '1', data: card.data || '', duration: cardDuration }];
                const relativeTime = Math.max(0, currentTime - accumulatedTime);
                const shotProgress = Math.max(0, Math.min(1, relativeTime / cardDuration));

                const rawSubSum = subFrames.reduce(
                    (acc, f) => acc + (f.duration || cardDuration / subFrames.length),
                    0
                );
                const normScale = rawSubSum > 0 ? cardDuration / rawSubSum : 1;

                let subAccum = 0;
                let subIdx = 0;
                for (let j = 0; j < subFrames.length; j++) {
                    const fDur =
                        (subFrames[j].duration || cardDuration / subFrames.length) * normScale;
                    const isLastSub = j === subFrames.length - 1;
                    if (
                        relativeTime >= subAccum &&
                        (relativeTime < subAccum + fDur ||
                            (isLastSub && relativeTime <= subAccum + fDur + 0.05))
                    ) {
                        subIdx = j;
                        break;
                    }
                    subAccum += fDur;
                }

                const frameImg =
                    subIdx === 0
                        ? subFrames[0]?.data || card.data
                        : subFrames[subIdx]?.data || '';

                return {
                    card,
                    subFrameIndex: subIdx,
                    subFrameCount: subFrames.length,
                    imageUrl: frameImg,
                    backgroundUrl: card.backgroundData,
                    shotProgress
                };
            }
            accumulatedTime += cardDuration;
        }

        const fallback = cards.find(c => c.id === activeCardId) || cards[0];
        const fallbackSubs =
            fallback?.subFrames && fallback.subFrames.length > 0
                ? fallback.subFrames
                : [{ id: '1', data: fallback?.data || '' }];
        return {
            card: fallback,
            subFrameIndex: 0,
            subFrameCount: fallbackSubs.length,
            imageUrl: fallbackSubs[0]?.data || fallback?.data,
            backgroundUrl: fallback?.backgroundData,
            shotProgress: 0
        };
    }, [cards, currentTime, activeCardId]);

    // Compute 2D Camera Movement CSS transform during playback
    const cameraMoveStyle = useMemo((): React.CSSProperties => {
        if (!isPlaying || !simulateCameraMove || !playbackState?.card) {
            return {};
        }
        const move = (playbackState.card.info.movement || 'Fixe').toLowerCase();
        const p = playbackState.shotProgress || 0;

        if (move.includes('zoom avant') || move.includes('travelling avant') || move === 'zoom') {
            return { transform: `scale(${1 + p * 0.16})` };
        }
        if (move.includes('zoom arrière') || move.includes('travelling arrière')) {
            return { transform: `scale(${1.16 - p * 0.16})` };
        }
        if (move.includes('pan') || move.includes('latéral') || move === 'trav') {
            return { transform: `scale(1.08) translateX(${(0.5 - p) * 6}%)` };
        }
        if (move.includes('épaule')) {
            const shakeX = Math.sin(p * Math.PI * 8) * 4;
            const shakeY = Math.cos(p * Math.PI * 6) * 3;
            return { transform: `scale(1.04) translate(${shakeX}px, ${shakeY}px)` };
        }
        return {};
    }, [isPlaying, simulateCameraMove, playbackState?.card, playbackState?.shotProgress]);

    // Auto-sync active card and subframe selection from timeline playhead WITHOUT resetting playhead
    useEffect(() => {
        if (playbackState?.card) {
            if (playbackState.card.id !== activeCardId) {
                setActiveCardId(playbackState.card.id, false);
            }
            if (playbackState.subFrameIndex !== activeSubFrameIndex) {
                setActiveSubFrameIndex(playbackState.subFrameIndex);
            }
        }
    }, [playbackState?.card?.id, playbackState?.subFrameIndex]);

    // Atomic Card + Pose Selection with Clamped Playhead Snap (Never spills into the next card)
    const handleSelectCard = (id: string, poseIndex: number = 0) => {
        const cardIdx = cards.findIndex(c => c.id === id);
        if (cardIdx === -1) return;

        const card = cards[cardIdx];
        const cardDuration = card.info.duration || 3;
        const cardStart = cards
            .slice(0, cardIdx)
            .reduce((acc, c) => acc + (c.info.duration || 3), 0);

        const subFrames =
            card.subFrames && card.subFrames.length > 0
                ? card.subFrames
                : [{ id: '1', data: card.data || '', duration: cardDuration }];
        const safePoseIdx = Math.max(0, Math.min(poseIndex, subFrames.length - 1));

        let poseOffset = 0;
        if (safePoseIdx > 0 && subFrames.length > 1) {
            const rawSubSum = subFrames.reduce(
                (acc, f) => acc + (f.duration || cardDuration / subFrames.length),
                0
            );
            const normScale = rawSubSum > 0 ? cardDuration / rawSubSum : 1;
            poseOffset = subFrames
                .slice(0, safePoseIdx)
                .reduce(
                    (acc, f) =>
                        acc + (f.duration || cardDuration / subFrames.length) * normScale,
                    0
                );
        }

        // Strictly clamp targetTime inside [cardStart + 0.005, cardStart + cardDuration - 0.02]
        const rawTarget =
            cardIdx === 0 && safePoseIdx === 0
                ? 0
                : cardStart + poseOffset + 0.01;
        const clampedTarget = Math.min(
            cardStart + Math.max(0.05, cardDuration - 0.02),
            Math.max(cardStart, rawTarget)
        );

        setIsPlaying(false);
        setActiveCardId(id, false);
        setActiveSubFrameIndex(safePoseIdx);
        setCurrentTime(clampedTarget);
    };

    // Keyboard Shortcuts (Space, Arrows, Cmd+F Projection, E Draw)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                (e.target as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            if ((e.metaKey || e.ctrlKey) && e.code === 'KeyF') {
                e.preventDefault();
                setIsProjectionMode(prev => !prev);
                return;
            }
            if (e.code === 'Escape' && isProjectionMode) {
                e.preventDefault();
                setIsProjectionMode(false);
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                setIsPlaying(!isPlaying);
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                setIsPlaying(false);
                if (e.shiftKey) {
                    const currentIdx = cards.findIndex(c => c.id === activeCardId);
                    if (currentIdx > 0) {
                        handleSelectCard(cards[currentIdx - 1].id, 0);
                    }
                } else {
                    setCurrentTime(Math.max(0, currentTime - 0.1));
                }
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                setIsPlaying(false);
                if (e.shiftKey) {
                    const currentIdx = cards.findIndex(c => c.id === activeCardId);
                    if (currentIdx < cards.length - 1) {
                        handleSelectCard(cards[currentIdx + 1].id, 0);
                    }
                } else {
                    setCurrentTime(Math.min(totalDuration, currentTime + 0.1));
                }
            } else if (e.code === 'Home' || e.code === 'Digit0') {
                e.preventDefault();
                setIsPlaying(false);
                setCurrentTime(0);
            } else if (e.code === 'KeyE' && activeCardId) {
                e.preventDefault();
                selectCardAndGoTo(activeCardId, 'draw');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, currentTime, totalDuration, cards, activeCardId, isProjectionMode]);

    // Timecode formatter (MM:SS:FF)
    const formatTimecode = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * 24);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    };

    const activeCard = playbackState?.card || null;
    const activeCardIndex = useMemo(() => {
        return cards.findIndex(c => c.id === activeCard?.id);
    }, [cards, activeCard?.id]);

    return (
        <div className="flex-1 flex flex-col bg-[#0D0E11] text-[#EDEDEC] overflow-hidden select-none relative">
            {/* ── 1. CLEAN CINEMA VIEWER AREA ── */}
            <div
                className={`flex-1 flex flex-col items-center justify-center px-6 ${
                    isProjectionMode ? 'pt-4 pb-4' : 'pt-4 pb-2'
                } relative overflow-hidden min-h-0`}
            >
                {activeCard ? (
                    <div
                        className={`w-full ${animaticMaxClass} ${animaticAspectClass} max-h-full bg-white rounded-2xl overflow-hidden border border-[#282B37] shadow-2xl relative group flex items-center justify-center isolate transition-all duration-200`}
                    >
                        {/* Frame Image + Shared Background Décor with 2D Camera Motion */}
                        {playbackState?.imageUrl || playbackState?.backgroundUrl ? (
                            <div
                                className="w-full h-full relative bg-white transition-transform duration-75 ease-linear"
                                style={cameraMoveStyle}
                            >
                                {playbackState?.imageUrl && (
                                    <img
                                        src={playbackState.imageUrl}
                                        className="w-full h-full object-contain bg-white pointer-events-none"
                                        alt=""
                                    />
                                )}
                                {playbackState?.backgroundUrl && (
                                    <img
                                        src={playbackState.backgroundUrl}
                                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none"
                                        alt="Décor"
                                    />
                                )}
                            </div>
                        ) : (
                            <div
                                onClick={() => selectCardAndGoTo(activeCard.id, 'draw')}
                                className="w-full h-full bg-white flex flex-col items-center justify-center text-stone-400 gap-2 cursor-pointer hover:text-[#10B981] transition-colors"
                            >
                                <PenTool size={26} />
                                <span className="text-xs font-medium">
                                    Cliquer pour dessiner ce plan
                                </span>
                            </div>
                        )}

                        {/* Minimalist Top-Left Badge */}
                        <div className="absolute top-3.5 left-3.5 flex items-center gap-2 bg-[#18181b]/85 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs shadow-lg">
                            <span className="font-black text-[#10B981]">
                                S{activeCard.info.sequence}
                            </span>
                            <span className="text-stone-500">·</span>
                            <span className="font-bold text-white">P{activeCard.info.shot}</span>
                            {playbackState && playbackState.subFrameCount > 1 && (
                                <span className="px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-mono text-[10px] font-bold">
                                    Pose {playbackState.subFrameIndex + 1}/{playbackState.subFrameCount}
                                </span>
                            )}
                        </div>

                        {/* Minimalist Top-Right Timecode */}
                        <div className="absolute top-3.5 right-3.5 bg-[#18181b]/85 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 font-mono text-xs text-[#10B981] shadow-lg font-semibold">
                            {formatTimecode(currentTime)}{' '}
                            <span className="text-stone-500">/</span>{' '}
                            <span className="text-stone-300">
                                {formatTimecode(totalDuration)}
                            </span>
                        </div>

                        {/* Hover Prev / Next Shot Arrows */}
                        <div className="absolute inset-y-0 left-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <button
                                onClick={() => {
                                    if (activeCardIndex > 0) {
                                        handleSelectCard(cards[activeCardIndex - 1].id, 0);
                                    }
                                }}
                                disabled={activeCardIndex <= 0}
                                className="p-2 rounded-full bg-black/65 hover:bg-black/90 text-white backdrop-blur-md border border-white/10 disabled:opacity-20 pointer-events-auto transition-transform active:scale-95"
                                title="Plan précédent"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </div>

                        <div className="absolute inset-y-0 right-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <button
                                onClick={() => {
                                    if (activeCardIndex < cards.length - 1) {
                                        handleSelectCard(cards[activeCardIndex + 1].id, 0);
                                    }
                                }}
                                disabled={activeCardIndex >= cards.length - 1}
                                className="p-2 rounded-full bg-black/65 hover:bg-black/90 text-white backdrop-blur-md border border-white/10 disabled:opacity-20 pointer-events-auto transition-transform active:scale-95"
                                title="Plan suivant"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Clean Subtitle / Action Caption at Bottom of Screen */}
                        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 w-[85%] max-w-lg flex justify-center">
                            {isEditingSubtitle ? (
                                <input
                                    type="text"
                                    autoFocus
                                    value={activeCard.info.description}
                                    placeholder="Ajouter un dialogue ou une note..."
                                    onChange={e =>
                                        updateCard(activeCard.id, {
                                            info: { description: e.target.value }
                                        })
                                    }
                                    onBlur={() => setIsEditingSubtitle(false)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === 'Escape') {
                                            setIsEditingSubtitle(false);
                                        }
                                    }}
                                    className="w-full bg-[#18181b]/95 backdrop-blur-xl text-white text-center text-xs font-medium px-4 py-1.5 rounded-full border border-[#10B981] outline-none shadow-2xl"
                                />
                            ) : activeCard.info.description ? (
                                <div
                                    onClick={() => setIsEditingSubtitle(true)}
                                    className="px-4 py-1 rounded-full bg-[#18181b]/85 backdrop-blur-md text-white text-xs font-medium border border-white/10 shadow-lg cursor-text hover:border-[#10B981]/50 transition-colors text-center truncate max-w-full"
                                    title="Cliquer pour modifier le texte"
                                >
                                    {activeCard.info.description}
                                </div>
                            ) : (
                                <div
                                    onClick={() => setIsEditingSubtitle(true)}
                                    className="px-3.5 py-1 rounded-full bg-black/50 text-white/70 text-[11px] opacity-0 group-hover:opacity-100 cursor-text hover:bg-black/80 hover:text-white transition-all"
                                >
                                    + Ajouter une note ou dialogue
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-stone-500 text-xs">Aucun plan chargé</div>
                )}
            </div>

            {/* ── 2. ULTRA-CLEAN COMPACT FLOATING CONTROL PILL ── */}
            <div className="flex justify-center px-4 py-2 z-30 shrink-0">
                <div className="flex items-center gap-2 bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 rounded-full px-3.5 py-1.5 shadow-xl">
                    {/* Rewind */}
                    <button
                        onClick={() => {
                            setCurrentTime(0);
                            setIsPlaying(false);
                        }}
                        className="p-1.5 text-[#a1a1aa] hover:text-white rounded-full hover:bg-white/5 transition-colors"
                        title="Retour au début"
                    >
                        <SkipBack size={14} />
                    </button>

                    {/* Play / Pause */}
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`px-3.5 py-1 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                            isPlaying
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/30'
                                : 'bg-[#27272a] hover:bg-[#10B981] text-white'
                        }`}
                        title="Lecture / Pause (Espace)"
                    >
                        {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                        <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
                    </button>

                    {/* Loop Toggle */}
                    <button
                        onClick={() => setIsLooping(!isLooping)}
                        className={`p-1.5 rounded-full transition-colors ${
                            isLooping
                                ? 'text-[#10B981] bg-[#10B981]/15'
                                : 'text-[#71717a] hover:text-white'
                        }`}
                        title={isLooping ? 'Lecture en boucle activée' : 'Activer la boucle'}
                    >
                        <Repeat size={13} />
                    </button>

                    <div className="h-3.5 w-px bg-white/10 mx-0.5" />

                    {/* Single Audio Track Controls */}
                    <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                        className="hidden"
                        onChange={handleImportAudio}
                    />
                    {audioTrackUrl && (
                        <audio
                            ref={audioRef}
                            src={audioTrackUrl}
                            muted={isAudioMuted}
                            preload="auto"
                        />
                    )}
                    {!audioTrackUrl ? (
                        <button
                            onClick={() => audioInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white text-[11px] font-semibold transition-colors"
                            title="Importer une piste son (MP3 / WAV) pour caler le rythme de l'animatique"
                        >
                            <Music size={12} className="text-[#10B981]" />
                            <span>+ Piste Son</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-1 bg-[#27272a] border border-white/10 rounded-full px-2.5 py-0.5">
                            <button
                                onClick={() => setIsAudioMuted(!isAudioMuted)}
                                className={`p-1 rounded-full transition-colors ${
                                    isAudioMuted ? 'text-red-400' : 'text-[#10B981]'
                                }`}
                                title={isAudioMuted ? 'Réactiver le son' : 'Couper le son'}
                            >
                                {isAudioMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                            </button>
                            <span
                                onClick={() => audioInputRef.current?.click()}
                                className="text-[10px] font-medium text-white max-w-[110px] truncate cursor-pointer hover:text-[#10B981]"
                                title={`Piste active : ${audioTrackName || 'Audio'} (Cliquer pour remplacer)`}
                            >
                                {audioTrackName || 'Piste Son'}
                            </span>
                            <button
                                onClick={() => {
                                    setAudioTrack(null, null);
                                    toast.info('Piste son retirée');
                                }}
                                className="p-0.5 text-[#71717a] hover:text-red-400 transition-colors"
                                title="Retirer la piste son"
                            >
                                <X size={11} />
                            </button>
                        </div>
                    )}

                    <div className="h-3.5 w-px bg-white/10 mx-0.5" />

                    {/* Fullscreen Projection Toggle */}
                    <button
                        onClick={() => setIsProjectionMode(!isProjectionMode)}
                        className={`p-1.5 rounded-full transition-colors ${
                            isProjectionMode
                                ? 'text-[#10B981] bg-[#10B981]/15'
                                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                        }`}
                        title="Mode Projection Cinéma (Cmd+F)"
                    >
                        {isProjectionMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>

                    {activeCard && (
                        <>
                            <div className="h-3.5 w-px bg-white/10 mx-0.5" />

                            {/* Edit in Drawing Studio Button */}
                            <button
                                onClick={() => selectCardAndGoTo(activeCard.id, 'draw')}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-md shadow-[#10B981]/20 transition-all active:scale-95"
                                title="Ouvrir dans le Studio Dessin (Touche E)"
                            >
                                <PenTool size={12} />
                                <span>Dessiner</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── 3. UNIFIED SINGLE-TRACK TIMELINE DOCK (Hidden in Projection Mode) ── */}
            {!isProjectionMode && (
                <Timeline
                    cards={cards}
                    activeCardId={activeCardId}
                    onSelectCard={handleSelectCard}
                    onUpdateCards={updated => reorderCards(updated)}
                    onCommitCards={updated => reorderCards(updated)}
                    onAddCard={() => {
                        addCard(activeCardId || undefined);
                        toast.success('Nouveau plan ajouté');
                    }}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    currentTime={currentTime}
                    setCurrentTime={setCurrentTime}
                    activeSubFrameIndex={activeSubFrameIndex}
                    onDoubleClickCard={id => selectCardAndGoTo(id, 'draw')}
                />
            )}

            {/* Export Modal */}
            <ExportStoryboardModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                projectName={project.title}
                cards={cards}
            />
        </div>
    );
};
