import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Layers, Camera, CheckCircle2, Clock, Volume2, X, Minus, Plus, Copy, Eye, FlipHorizontal2 } from 'lucide-react';
import { useStoryboardStore } from '../store/useStoryboardStore';
import { DrawingCanvas, type DrawingCanvasRef } from '../modules/frame/DrawingCanvas';
import { useToast } from '../shared';
import { 
    DockSlot, 
    DockPanelId, 
    DockLayout, 
    PanelCollapsedState, 
    DEFAULT_DOCK_LAYOUT, 
    DEFAULT_COLLAPSED_STATE 
} from './drawing/types';
import { DrawingDropGhost } from './drawing/DrawingDropGhost';
import { DrawingToolsPanel } from './drawing/DrawingToolsPanel';
import { DrawingPosesPanel } from './drawing/DrawingPosesPanel';
import { DrawingNavPanel } from './drawing/DrawingNavPanel';

export const DrawingStudio: React.FC = () => {
    const project = useStoryboardStore(s => s.project);
    const cards = project.cards;
    const aspectRatio = project.aspectRatio || '16:9';
    const activeCardId = useStoryboardStore(s => s.activeCardId);
    const setViewMode = useStoryboardStore(s => s.setViewMode);
    const updateCard = useStoryboardStore(s => s.updateCard);
    const updateCardSubFrame = useStoryboardStore(s => s.updateCardSubFrame);
    const updateCardBackground = useStoryboardStore(s => s.updateCardBackground);
    const addSubFrameToCard = useStoryboardStore(s => s.addSubFrameToCard);
    const deleteSubFrameFromCard = useStoryboardStore(s => s.deleteSubFrameFromCard);
    const reorderSubFramesInCard = useStoryboardStore(s => s.reorderSubFramesInCard);
    const activeSubFrameIndex = useStoryboardStore(s => s.activeSubFrameIndex);
    const setActiveSubFrameIndex = useStoryboardStore(s => s.setActiveSubFrameIndex);
    const nextCard = useStoryboardStore(s => s.nextCard);
    const prevCard = useStoryboardStore(s => s.prevCard);
    const duplicateCard = useStoryboardStore(s => s.duplicateCard);
    const setActiveCardId = useStoryboardStore(s => s.setActiveCardId);

    // Drawing settings from store
    const brushTool = useStoryboardStore(s => s.brushTool);
    const setBrushTool = useStoryboardStore(s => s.setBrushTool);
    const brushColor = useStoryboardStore(s => s.brushColor);
    const setBrushColor = useStoryboardStore(s => s.setBrushColor);
    const brushSize = useStoryboardStore(s => s.brushSize);
    const setBrushSize = useStoryboardStore(s => s.setBrushSize);
    const brushOpacity = useStoryboardStore(s => s.brushOpacity);
    const setBrushOpacity = useStoryboardStore(s => s.setBrushOpacity);
    const onionSkin = useStoryboardStore(s => s.onionSkin);
    const setOnionSkin = useStoryboardStore(s => s.setOnionSkin);
    const compositionGrid = useStoryboardStore(s => s.compositionGrid);
    const setCompositionGrid = useStoryboardStore(s => s.setCompositionGrid);
    const stylusOnlyMode = useStoryboardStore(s => s.stylusOnlyMode);
    const setStylusOnlyMode = useStoryboardStore(s => s.setStylusOnlyMode);

    const toast = useToast();
    const canvasRef = useRef<DrawingCanvasRef>(null);
    const setCanvasUndoRedoHandler = useStoryboardStore(s => s.setCanvasUndoRedoHandler);

    // Register active canvas undo/redo handler so Cmd+Z and Header buttons act on drawing strokes
    useEffect(() => {
        setCanvasUndoRedoHandler({
            undo: () => {
                canvasRef.current?.undo();
            },
            redo: () => {
                canvasRef.current?.redo();
            }
        });
        return () => {
            setCanvasUndoRedoHandler(null);
        };
    }, [setCanvasUndoRedoHandler]);

    // Local UI states
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [activeLayer, setActiveLayer] = useState<'pose' | 'background'>('pose');
    const [isPreviewingBrushSize, setIsPreviewingBrushSize] = useState(false);

    // ─── MODULAR DOCK LAYOUT & COLLAPSIBLE PANELS ────────────────────────────
    const [dockLayout, setDockLayout] = useState<DockLayout>(() => {
        try {
            const saved = localStorage.getItem('flowframe_drawing_dock_layout');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.left && parsed.bottom && parsed.right) {
                    return parsed;
                }
            }
        } catch {}
        return DEFAULT_DOCK_LAYOUT;
    });

    const [collapsedState, setCollapsedState] = useState<PanelCollapsedState>(() => {
        try {
            const saved = localStorage.getItem('flowframe_drawing_dock_collapsed');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (
                    typeof parsed.tools === 'boolean' && 
                    typeof parsed.poses === 'boolean' && 
                    typeof parsed.navigation === 'boolean'
                ) {
                    return parsed;
                }
            }
        } catch {}
        return DEFAULT_COLLAPSED_STATE;
    });

    const [draggingPanel, setDraggingPanel] = useState<DockPanelId | null>(null);
    const [hoveredSlot, setHoveredSlot] = useState<DockSlot | null>(null);

    // Helpers to control visibility during drag
    const isSourceSlot = (slot: DockSlot) => draggingPanel !== null && dockLayout[slot] === draggingPanel;
    const isTargetSlot = (slot: DockSlot) => draggingPanel !== null && hoveredSlot === slot;
    const isOtherSlot = (slot: DockSlot) => draggingPanel !== null && !isSourceSlot(slot) && !isTargetSlot(slot);

    // ─── NAVIGATION DE LA FEUILLE (Zoom, Déplacement & Rotation 360°) ────────
    const [canvasZoom, setCanvasZoom] = useState<number>(1);
    const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [canvasRotation, setCanvasRotation] = useState<number>(0);
    const [isFlippedH, setIsFlippedH] = useState<boolean>(false);
    const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
    const [isHandMode, setIsHandMode] = useState<boolean>(false);
    const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

    const workspaceRef = useRef<HTMLDivElement>(null);

    // Refs for live gesture tracking (Mac Drag & iPad 2-Finger Pinch/Rotate/Pan)
    const panDragRef = useRef<{
        active: boolean;
        mode: 'pan' | 'rotate';
        startX: number;
        startY: number;
        initialPanX: number;
        initialPanY: number;
        initialRotation: number;
    }>({
        active: false,
        mode: 'pan',
        startX: 0,
        startY: 0,
        initialPanX: 0,
        initialPanY: 0,
        initialRotation: 0
    });

    const touchGestureRef = useRef<{
        active: boolean;
        initialDist: number;
        initialAngle: number;
        initialCenter: { x: number; y: number };
        initialZoom: number;
        initialRotation: number;
        initialPan: { x: number; y: number };
    } | null>(null);

    // Multi-finger Tap Gesture tracking (2-finger tap = Undo, 3-finger tap = Redo on Android Tablet)
    const multiTapRef = useRef<{
        startTime: number;
        maxTouches: number;
        movedTooMuch: boolean;
        startPositions: Map<number, { x: number; y: number }>;
    } | null>(null);
    const [gestureFeedback, setGestureFeedback] = useState<'Annuler' | 'Rétablir' | null>(null);
    const gestureFeedbackTimerRef = useRef<number | null>(null);

    const triggerGestureFeedback = useCallback((label: 'Annuler' | 'Rétablir') => {
        setGestureFeedback(label);
        if (gestureFeedbackTimerRef.current) {
            window.clearTimeout(gestureFeedbackTimerRef.current);
        }
        gestureFeedbackTimerRef.current = window.setTimeout(() => {
            setGestureFeedback(null);
        }, 700);
    }, []);

    const isViewportModified =
        Math.abs(canvasZoom - 1) > 0.01 ||
        Math.abs(canvasPan.x) > 1 ||
        Math.abs(canvasPan.y) > 1 ||
        Math.abs(canvasRotation) > 0.5 ||
        isFlippedH;

    const resetViewport = useCallback(() => {
        setCanvasZoom(1);
        setCanvasPan({ x: 0, y: 0 });
        setCanvasRotation(0);
        setIsFlippedH(false);
    }, []);

    // Spacebar (Hand pan), H (Flip Horizontal), Tab (Focus/Zen Mode) shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setIsSpacePressed(true);
            } else if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
                e.preventDefault();
                setIsFlippedH(prev => !prev);
            } else if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
                e.preventDefault();
                setIsFocusMode(prev => !prev);
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                panDragRef.current.active = false;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // Native non-passive wheel listener for smooth Trackpad Pinch, Wheel Zoom & Alt+Wheel Rotation
    useEffect(() => {
        const el = workspaceRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.altKey) {
                // Alt + Scroll/Trackpad = Smooth Canvas Rotation
                const deltaAngle = e.deltaY * 0.25;
                setCanvasRotation(prev => {
                    let next = prev + deltaAngle;
                    if (next > 180) next -= 360;
                    if (next < -180) next += 360;
                    return Math.round(next * 10) / 10;
                });
            } else {
                // Trackpad Pinch (ctrlKey) or Mouse Wheel Zoom
                const sensitivity = e.ctrlKey ? 0.01 : 0.0018;
                const zoomFactor = Math.exp(-e.deltaY * sensitivity);
                setCanvasZoom(prev => {
                    const next = Math.max(0.35, Math.min(5, prev * zoomFactor));
                    return Math.round(next * 100) / 100;
                });
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, []);

    // Tablet Multi-Touch Handlers (2-Finger Tap Undo, 3-Finger Tap Redo, 2-Finger Pinch + Rotate + Pan)
    const handleWorkspaceTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        // Track multi-finger tap gesture
        if (!multiTapRef.current) {
            const startPositions = new Map<number, { x: number; y: number }>();
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                startPositions.set(t.identifier, { x: t.clientX, y: t.clientY });
            }
            multiTapRef.current = {
                startTime: Date.now(),
                maxTouches: e.touches.length,
                movedTooMuch: false,
                startPositions
            };
        } else {
            const tap = multiTapRef.current;
            tap.maxTouches = Math.max(tap.maxTouches, e.touches.length);
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                if (!tap.startPositions.has(t.identifier)) {
                    tap.startPositions.set(t.identifier, { x: t.clientX, y: t.clientY });
                }
            }
        }

        if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            const dist = Math.max(10, Math.hypot(dx, dy));
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const center = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };

            touchGestureRef.current = {
                active: true,
                initialDist: dist,
                initialAngle: angle,
                initialCenter: center,
                initialZoom: canvasZoom,
                initialRotation: canvasRotation,
                initialPan: { ...canvasPan }
            };
        } else if (e.touches.length >= 3) {
            // 3+ fingers cancels pinch/zoom so 3-finger tap Redo never jitters canvas
            touchGestureRef.current = null;
        }
    };

    const handleWorkspaceTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        // Check finger travel distance for tap vs drag/pinch disambiguation
        if (multiTapRef.current && !multiTapRef.current.movedTooMuch) {
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i];
                const start = multiTapRef.current.startPositions.get(t.identifier);
                if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 22) {
                    multiTapRef.current.movedTooMuch = true;
                    break;
                }
            }
        }

        if (e.touches.length === 2 && touchGestureRef.current?.active) {
            const g = touchGestureRef.current;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t2.clientX - t1.clientX;
            const dy = t2.clientY - t1.clientY;
            const dist = Math.max(10, Math.hypot(dx, dy));
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            const center = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            };

            // Small deadzone so quick 2-finger Undo taps never jitter zoom/pan
            const panTravel = Math.hypot(center.x - g.initialCenter.x, center.y - g.initialCenter.y);
            const distDelta = Math.abs(dist - g.initialDist);
            if (panTravel < 8 && distDelta < 8) return;

            if (multiTapRef.current) {
                multiTapRef.current.movedTooMuch = true;
            }

            // 1. Pinch-to-Zoom
            const scaleRatio = dist / g.initialDist;
            const nextZoom = Math.max(0.35, Math.min(5, g.initialZoom * scaleRatio));
            setCanvasZoom(Math.round(nextZoom * 100) / 100);

            // 2. Two-Finger Free Rotation
            let deltaAngle = angle - g.initialAngle;
            if (deltaAngle > 180) deltaAngle -= 360;
            if (deltaAngle < -180) deltaAngle += 360;

            let nextRot = g.initialRotation + deltaAngle;
            if (nextRot > 180) nextRot -= 360;
            if (nextRot < -180) nextRot += 360;
            if (Math.abs(nextRot) < 2) nextRot = 0;
            setCanvasRotation(Math.round(nextRot * 10) / 10);

            // 3. Two-Finger Pan
            setCanvasPan({
                x: Math.round(g.initialPan.x + (center.x - g.initialCenter.x)),
                y: Math.round(g.initialPan.y + (center.y - g.initialCenter.y))
            });
        }
    };

    const handleWorkspaceTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length < 2) {
            touchGestureRef.current = null;
        }

        // Fire 2-Finger Tap (Undo) or 3-Finger Tap (Redo) once all fingers lift cleanly
        if (e.touches.length === 0 && multiTapRef.current) {
            const tap = multiTapRef.current;
            const elapsed = Date.now() - tap.startTime;
            if (!tap.movedTooMuch && elapsed < 320) {
                if (tap.maxTouches === 2) {
                    canvasRef.current?.undo();
                    triggerGestureFeedback('Annuler');
                } else if (tap.maxTouches === 3) {
                    canvasRef.current?.redo();
                    triggerGestureFeedback('Rétablir');
                }
            }
            multiTapRef.current = null;
        }
    };

    // Mac / Pointer Hand Pan & Alt-Rotate Drag
    const handleWorkspacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isHandMode || isSpacePressed || e.button === 1) {
            e.preventDefault();
            panDragRef.current = {
                active: true,
                mode: e.altKey ? 'rotate' : 'pan',
                startX: e.clientX,
                startY: e.clientY,
                initialPanX: canvasPan.x,
                initialPanY: canvasPan.y,
                initialRotation: canvasRotation
            };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handleWorkspacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!panDragRef.current.active) return;
        const d = panDragRef.current;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;

        if (d.mode === 'rotate' || e.altKey) {
            let nextRot = d.initialRotation + dx * 0.45;
            if (nextRot > 180) nextRot -= 360;
            if (nextRot < -180) nextRot += 360;
            setCanvasRotation(Math.round(nextRot * 10) / 10);
        } else {
            setCanvasPan({
                x: Math.round(d.initialPanX + dx),
                y: Math.round(d.initialPanY + dy)
            });
        }
    };

    const handleWorkspacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (panDragRef.current.active) {
            panDragRef.current.active = false;
            try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
        }
    };

    // ─── DRAG & DROP WITH SWAPPING LOGIC ─────────────────────────────────────
    const findSlotFromCoords = (x: number, y: number): DockSlot | null => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Bottom slot area: bottom 28% of screen
        if (y > h * 0.72) {
            return 'bottom';
        }
        // Left slot area: left 32% of screen
        if (x < w * 0.32) {
            return 'left';
        }
        // Right slot area: right 32% of screen
        if (x > w * 0.68) {
            return 'right';
        }
        return null;
    };

    const handleGripPointerDown = (panelId: DockPanelId, e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const sourceSlot = (Object.keys(dockLayout) as DockSlot[]).find(s => dockLayout[s] === panelId);
        setDraggingPanel(panelId);
        setHoveredSlot(null);

        const onPointerMove = (moveEv: PointerEvent) => {
            const slot = findSlotFromCoords(moveEv.clientX, moveEv.clientY);
            if (slot && slot !== sourceSlot) {
                setHoveredSlot(slot);
            } else {
                setHoveredSlot(null);
            }
        };

        const onPointerUp = (upEv: PointerEvent) => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);

            const targetSlot = findSlotFromCoords(upEv.clientX, upEv.clientY);

            if (targetSlot && sourceSlot && targetSlot !== sourceSlot) {
                setDockLayout(prev => {
                    const occupant = prev[targetSlot];
                    const nextLayout: DockLayout = {
                        ...prev,
                        [sourceSlot]: occupant,
                        [targetSlot]: panelId
                    };
                    try {
                        localStorage.setItem('flowframe_drawing_dock_layout', JSON.stringify(nextLayout));
                    } catch {}
                    return nextLayout;
                });
            }

            setDraggingPanel(null);
            setHoveredSlot(null);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    };

    // Find active card and its index
    const activeCardIndex = cards.findIndex(c => c.id === activeCardId);
    const activeCard = cards[activeCardIndex] || cards[0];

    const { aspectClass, containerMaxClass } = useMemo(() => {
        switch (aspectRatio) {
            case '2.39:1':
                return { aspectClass: 'aspect-[2.39/1]', containerMaxClass: 'max-w-5xl' };
            case '4:3':
                return { aspectClass: 'aspect-[4/3]', containerMaxClass: 'max-w-3xl' };
            case '9:16':
                return { aspectClass: 'aspect-[9/16]', containerMaxClass: 'max-w-sm h-[70vh]' };
            case '16:9':
            default:
                return { aspectClass: 'aspect-video', containerMaxClass: 'max-w-5xl' };
        }
    }, [aspectRatio]);

    // Compute previous pose thumbnail for Onion Skinning
    const prevCardThumbnail = useMemo(() => {
        if (activeLayer === 'background') {
            return activeCard?.subFrames?.[activeSubFrameIndex]?.data || activeCard?.data || undefined;
        }
        if (!onionSkin) return undefined;
        if (activeCard && activeSubFrameIndex > 0) {
            const subFrames = activeCard.subFrames && activeCard.subFrames.length > 0
                ? activeCard.subFrames
                : [{ id: '1', data: activeCard.data || '' }];
            const prevPoseData = subFrames[activeSubFrameIndex - 1]?.data || (activeSubFrameIndex - 1 === 0 ? activeCard.data : '');
            return prevPoseData || undefined;
        }
        return undefined;
    }, [onionSkin, activeCard, activeSubFrameIndex, activeLayer]);

    // Handle canvas save
    const handleSaveDrawing = (dataUrl: string) => {
        if (!activeCard) return;
        if (activeLayer === 'background') {
            updateCardBackground(activeCard.id, dataUrl);
        } else {
            updateCardSubFrame(activeCard.id, activeSubFrameIndex, dataUrl);
        }
    };

    if (!activeCard) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#121212] text-white">
                <p className="mb-3 text-sm text-[#a1a1aa]">Aucun plan sélectionné</p>
                <button
                    onClick={() => setViewMode('gallery')}
                    className="px-4 py-2 bg-[#10B981] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                    Retour à la Galerie
                </button>
            </div>
        );
    }

    const activeSubFrameKey =
        activeLayer === 'background'
            ? 'bg'
            : activeCard.subFrames?.[activeSubFrameIndex]?.id || String(activeSubFrameIndex);

    const currentSubFrameData = activeLayer === 'background'
        ? (activeCard.backgroundData ?? '')
        : activeSubFrameIndex === 0
        ? (activeCard.subFrames?.[0]?.data ?? activeCard.data ?? '')
        : (activeCard.subFrames?.[activeSubFrameIndex]?.data ?? '');

    // ─── RENDER PANEL HELPER ────────────────────────────────────────────────
    const renderPanel = (slot: DockSlot) => {
        const panelId = dockLayout[slot];
        const orientation: 'vertical' | 'horizontal' = slot === 'bottom' ? 'horizontal' : 'vertical';
        const isCollapsed = collapsedState[panelId];

        const toggleCollapse = () => {
            setCollapsedState(prev => {
                const next = { ...prev, [panelId]: !prev[panelId] };
                try {
                    localStorage.setItem('flowframe_drawing_dock_collapsed', JSON.stringify(next));
                } catch {}
                return next;
            });
        };

        const onDragStart = (e: React.PointerEvent) => handleGripPointerDown(panelId, e);

        if (panelId === 'tools') {
            return (
                <DrawingToolsPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                    onDragStart={onDragStart}
                    brushTool={brushTool}
                    setBrushTool={setBrushTool}
                    brushColor={brushColor}
                    setBrushColor={setBrushColor}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                    brushOpacity={brushOpacity}
                    setBrushOpacity={setBrushOpacity}
                    onionSkin={onionSkin}
                    setOnionSkin={setOnionSkin}
                    compositionGrid={compositionGrid}
                    setCompositionGrid={setCompositionGrid}
                    stylusOnlyMode={stylusOnlyMode}
                    setStylusOnlyMode={setStylusOnlyMode}
                    isDetailsOpen={isDetailsOpen}
                    setIsDetailsOpen={setIsDetailsOpen}
                    onResetHandMode={() => setIsHandMode(false)}
                    onBrushSizePreviewChange={setIsPreviewingBrushSize}
                />
            );
        }

        if (panelId === 'poses') {
            return (
                <DrawingPosesPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                    onDragStart={onDragStart}
                    activeCard={activeCard}
                    activeCardIndex={activeCardIndex}
                    totalCards={cards.length}
                    onPrevCard={prevCard}
                    onNextCard={nextCard}
                    activeSubFrameIndex={activeSubFrameIndex}
                    setActiveSubFrameIndex={setActiveSubFrameIndex}
                    activeLayer={activeLayer}
                    setActiveLayer={setActiveLayer}
                    onAddSubFrame={(duplicate) => {
                        addSubFrameToCard(activeCard.id, duplicate);
                        toast.success(duplicate ? 'Pose dupliquée' : 'Nouvelle pose vide ajoutée');
                    }}
                    onDeleteSubFrame={(idx) => {
                        deleteSubFrameFromCard(activeCard.id, idx);
                        toast.info(`Pose ${idx + 1} supprimée`);
                    }}
                    onReorderSubFrames={(fromIdx, toIdx) => {
                        reorderSubFramesInCard(activeCard.id, fromIdx, toIdx);
                    }}
                />
            );
        }

        if (panelId === 'navigation') {
            return (
                <DrawingNavPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                    onDragStart={onDragStart}
                    canvasZoom={canvasZoom}
                    setCanvasZoom={setCanvasZoom}
                    canvasRotation={canvasRotation}
                    setCanvasRotation={setCanvasRotation}
                    isHandMode={isHandMode}
                    setIsHandMode={setIsHandMode}
                    isSpacePressed={isSpacePressed}
                    isViewportModified={isViewportModified}
                    onResetViewport={resetViewport}
                    onUndo={() => canvasRef.current?.undo()}
                    onRedo={() => canvasRef.current?.redo()}
                />
            );
        }

        return null;
    };

    // ─── RENDER GHOST CLONE HELPER (exact shape & dimensions once displaced) ───
    const renderGhostPanel = (panelId: DockPanelId, targetSlot: DockSlot) => {
        const orientation: 'vertical' | 'horizontal' = targetSlot === 'bottom' ? 'horizontal' : 'vertical';
        const isCollapsed = collapsedState[panelId];

        if (panelId === 'tools') {
            return (
                <DrawingToolsPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => {}}
                    onDragStart={() => {}}
                    brushTool={brushTool}
                    setBrushTool={() => {}}
                    brushColor={brushColor}
                    setBrushColor={() => {}}
                    brushSize={brushSize}
                    setBrushSize={() => {}}
                    brushOpacity={brushOpacity}
                    setBrushOpacity={() => {}}
                    onionSkin={onionSkin}
                    setOnionSkin={() => {}}
                    compositionGrid={compositionGrid}
                    setCompositionGrid={() => {}}
                    isDetailsOpen={isDetailsOpen}
                    setIsDetailsOpen={() => {}}
                />
            );
        }

        if (panelId === 'poses') {
            return (
                <DrawingPosesPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => {}}
                    onDragStart={() => {}}
                    activeCard={activeCard}
                    activeCardIndex={activeCardIndex}
                    totalCards={cards.length}
                    onPrevCard={() => {}}
                    onNextCard={() => {}}
                    activeSubFrameIndex={activeSubFrameIndex}
                    setActiveSubFrameIndex={() => {}}
                    activeLayer={activeLayer}
                    setActiveLayer={() => {}}
                    onAddSubFrame={() => {}}
                    onDeleteSubFrame={() => {}}
                />
            );
        }

        if (panelId === 'navigation') {
            return (
                <DrawingNavPanel
                    orientation={orientation}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => {}}
                    onDragStart={() => {}}
                    canvasZoom={canvasZoom}
                    setCanvasZoom={() => {}}
                    canvasRotation={canvasRotation}
                    setCanvasRotation={() => {}}
                    isHandMode={isHandMode}
                    setIsHandMode={() => {}}
                    isSpacePressed={isSpacePressed}
                    isViewportModified={isViewportModified}
                    onResetViewport={() => {}}
                    onUndo={() => {}}
                    onRedo={() => {}}
                />
            );
        }

        return null;
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0D0E11] text-[#EDEDEC] relative overflow-hidden select-none font-sans">
            {/* ── ZONE DE DESSIN PRINCIPALE (Moniteur Viseur Caméra + Zoom & Rotation 360°) ── */}
            <div
                ref={workspaceRef}
                onTouchStart={handleWorkspaceTouchStart}
                onTouchMove={handleWorkspaceTouchMove}
                onTouchEnd={handleWorkspaceTouchEnd}
                onTouchCancel={handleWorkspaceTouchEnd}
                onPointerDown={handleWorkspacePointerDown}
                onPointerMove={handleWorkspacePointerMove}
                onPointerUp={handleWorkspacePointerUp}
                onPointerCancel={handleWorkspacePointerUp}
                style={{ touchAction: 'none' }}
                className={`flex-1 flex flex-col items-center justify-center pt-4 pb-16 px-16 relative overflow-hidden ${
                    isHandMode || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
            >
                <div
                    style={{
                        transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom}) rotate(${canvasRotation}deg)`,
                        transformOrigin: 'center center'
                    }}
                    className={`w-full ${containerMaxClass} flex flex-col rounded-2xl overflow-hidden border border-[#282B37] bg-[#14161B] shadow-[0_30px_80px_rgba(0,0,0,0.8)] will-change-transform`}
                >
                    {/* ── BANDEAU TÉLÉMÉTRIE MONITEUR CAMÉRA (Tactile 1-Tap) ── */}
                    <div
                        onPointerDown={e => e.stopPropagation()}
                        className="h-8 bg-[#14161B] border-b border-[#282B37] px-3 flex items-center justify-between text-[10px] font-mono select-none shrink-0"
                    >
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                            {/* Shot Status Indicator (1-Tap Cycle: Brouillon -> Prêt -> Tourné) */}
                            <button
                                onClick={() => {
                                    const cur = activeCard.info.shotStatus || 'draft';
                                    const next = cur === 'draft' ? 'ready' : cur === 'ready' ? 'shot' : 'draft';
                                    updateCard(activeCard.id, { info: { shotStatus: next } });
                                }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold uppercase transition-colors ${
                                    activeCard.info.shotStatus === 'shot'
                                        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                                        : activeCard.info.shotStatus === 'ready'
                                        ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                                        : 'bg-[#191B22] text-[#9B9A97] border border-[#282B37]'
                                }`}
                                title="Toucher pour changer le statut plateau (Brouillon → Prêt → Tourné)"
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        activeCard.info.shotStatus === 'shot'
                                            ? 'bg-[#10B981]'
                                            : activeCard.info.shotStatus === 'ready'
                                            ? 'bg-[#F59E0B]'
                                            : 'bg-[#9B9A97]'
                                    }`}
                                />
                                <span>
                                    {activeCard.info.shotStatus === 'shot'
                                        ? 'TOURNÉ'
                                        : activeCard.info.shotStatus === 'ready'
                                        ? 'PRÊT'
                                        : 'STBY'}
                                </span>
                            </button>

                            <span className="font-bold text-[#EDEDEC]">
                                S{String(activeCard.info.sequence).padStart(2, '0')}·P{String(activeCard.info.shot).padStart(2, '0')}
                            </span>

                            <span className="text-[#282B37]">|</span>

                            {/* Tappable Optical Telemetry Chips */}
                            <button
                                onClick={() => setIsDetailsOpen(true)}
                                className="px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#F59E0B] font-bold border border-[#282B37] transition-colors"
                                title="Toucher pour modifier la focale et l'optique"
                            >
                                {activeCard.info.focalLength || '35mm'}
                            </button>

                            <button
                                onClick={() => setIsDetailsOpen(true)}
                                className="px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#10B981] font-bold border border-[#282B37] transition-colors"
                                title="Toucher pour modifier la valeur de plan"
                            >
                                {activeCard.info.scale || 'Plan Moyen'}
                            </button>

                            <button
                                onClick={() => setIsDetailsOpen(true)}
                                className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#EDEDEC] border border-[#282B37] transition-colors"
                                title="Toucher pour modifier l'angle et le mouvement"
                            >
                                {activeCard.info.cameraAngle || 'Niveau œil'} · {activeCard.info.movement || 'Fixe'} ({activeCard.info.support || 'Trépied'})
                            </button>

                            <button
                                onClick={() => setIsDetailsOpen(true)}
                                className="hidden md:inline-block px-1.5 py-0.5 rounded bg-[#191B22] hover:bg-[#222530] text-[#9B9A97] border border-[#282B37] transition-colors"
                            >
                                {activeCard.info.locationEffect || 'INT. JOUR'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {isFlippedH && (
                                <button
                                    onClick={() => setIsFlippedH(false)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] hover:bg-[#F59E0B]/30 text-[9px] font-bold border border-[#F59E0B]/40 transition-colors"
                                    title="Miroir horizontal actif — cliquer ou appuyer sur H pour désactiver"
                                >
                                    <FlipHorizontal2 size={10} />
                                    <span>MIROIR H</span>
                                </button>
                            )}
                            {stylusOnlyMode && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                                    STYLET SEUL
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    const newId = duplicateCard(activeCard.id);
                                    setActiveCardId(newId);
                                    toast.success('Plan dupliqué');
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#191B22] hover:bg-[#10B981] text-[#9B9A97] hover:text-white border border-[#282B37] transition-colors font-sans font-bold text-[10px]"
                                title="Dupliquer ce plan en 1 clic (dessin + décor + réglages caméra)"
                            >
                                <Copy size={11} />
                                <span className="hidden sm:inline">Dupliquer</span>
                            </button>
                            <button
                                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#191B22] hover:bg-[#10B981] text-[#9B9A97] hover:text-white border border-[#282B37] transition-colors font-sans font-bold text-[10px]"
                            >
                                <Camera size={11} />
                                <span>Fiche Caméra</span>
                            </button>
                            <span className="text-[#F59E0B] font-bold">
                                {(activeCard.info.duration || 3).toFixed(1)}s
                            </span>
                        </div>
                    </div>

                    {/* ── SURFACE DE LA FEUILLE DE DESSIN ── */}
                    <div className={`w-full ${aspectClass} bg-white relative overflow-hidden`}>
                        <div
                            className="w-full h-full"
                            style={{ transform: isFlippedH ? 'scaleX(-1)' : undefined }}
                        >
                            <DrawingCanvas
                                ref={canvasRef}
                                key={`studio-${activeCard.id}-${activeSubFrameKey}`}
                                layerKey={`studio-${activeCard.id}-${activeSubFrameKey}`}
                                initialData={currentSubFrameData}
                                onSave={handleSaveDrawing}
                                externalTool={brushTool}
                                onSelectTool={setBrushTool}
                                externalColor={brushColor}
                                externalLineWidth={brushSize}
                                externalOpacity={brushOpacity}
                                onionSkinData={prevCardThumbnail}
                                backgroundData={activeLayer === 'pose' ? activeCard.backgroundData : undefined}
                                compositionGrid={compositionGrid}
                                gridColor="#10B981"
                                aspectRatio={aspectRatio}
                                zoom={canvasZoom}
                                rotation={canvasRotation}
                                isPanningMode={isHandMode || isSpacePressed}
                                isPreviewingBrushSize={isPreviewingBrushSize}
                                stylusOnlyMode={stylusOnlyMode}
                                isFlippedH={isFlippedH}
                            />
                        </div>

                        {/* Active Layer Indicator Badge when editing Shared Décor */}
                        {activeLayer === 'background' && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#10B981] text-white text-[11px] font-bold shadow-lg pointer-events-none flex items-center gap-1.5">
                                <Layers size={12} />
                                <span>Édition du Calque Décor (partagé sur toutes les poses de ce plan)</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MULTI-TOUCH GESTURE FEEDBACK HUD (2-Finger Undo / 3-Finger Redo) ── */}
            {gestureFeedback && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-1.5 rounded-full bg-[#14161B]/95 border border-[#10B981]/50 text-[#EDEDEC] text-xs font-mono font-bold tracking-wider shadow-2xl flex items-center gap-2 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>{gestureFeedback === 'Annuler' ? '↩ Annuler (2 doigts)' : '↪ Rétablir (3 doigts)'}</span>
                </div>
            )}

            {/* ── DOCKED MODULAR PANELS (Left, Right, Bottom) ── */}
            {!isFocusMode ? (
                <>
                    {/* Left Slot */}
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 transition-all duration-200 ${
                        isOtherSlot('left')
                            ? 'opacity-0 pointer-events-none'
                            : isSourceSlot('left')
                            ? 'opacity-60 scale-95 ring-2 ring-[#10B981] rounded-2xl pointer-events-auto'
                            : 'opacity-100 pointer-events-auto'
                    }`}>
                        {isTargetSlot('left') && draggingPanel ? (
                            <DrawingDropGhost slot="left">
                                {renderGhostPanel(draggingPanel, 'left')}
                            </DrawingDropGhost>
                        ) : (
                            renderPanel('left')
                        )}
                    </div>

                    {/* Right Slot */}
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 transition-all duration-200 ${
                        isOtherSlot('right')
                            ? 'opacity-0 pointer-events-none'
                            : isSourceSlot('right')
                            ? 'opacity-60 scale-95 ring-2 ring-[#10B981] rounded-2xl pointer-events-auto'
                            : 'opacity-100 pointer-events-auto'
                    }`}>
                        {isTargetSlot('right') && draggingPanel ? (
                            <DrawingDropGhost slot="right">
                                {renderGhostPanel(draggingPanel, 'right')}
                            </DrawingDropGhost>
                        ) : (
                            renderPanel('right')
                        )}
                    </div>

                    {/* Bottom Slot */}
                    <div className={`absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 transition-all duration-200 ${
                        isOtherSlot('bottom')
                            ? 'opacity-0 pointer-events-none'
                            : isSourceSlot('bottom')
                            ? 'opacity-60 scale-95 ring-2 ring-[#10B981] rounded-2xl pointer-events-auto'
                            : 'opacity-100 pointer-events-auto'
                    }`}>
                        {isTargetSlot('bottom') && draggingPanel ? (
                            <DrawingDropGhost slot="bottom">
                                {renderGhostPanel(draggingPanel, 'bottom')}
                            </DrawingDropGhost>
                        ) : (
                            renderPanel('bottom')
                        )}
                    </div>
                </>
            ) : (
                <button
                    onClick={() => setIsFocusMode(false)}
                    className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#18181b]/90 hover:bg-[#10B981] text-[#EDEDEC] hover:text-white border border-white/15 shadow-2xl backdrop-blur-xl text-xs font-bold transition-all active:scale-95"
                    title="Quitter le Mode Focus et réafficher les panneaux (Tab)"
                >
                    <Eye size={14} />
                    <span>Panneaux</span>
                </button>
            )}

            {/* ── FICHE CAMÉRA & MISE EN SCÈNE "1-TAP" (Optimisée Tablette Android & Desktop) ── */}
            {isDetailsOpen && (
                <div className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-[#14161B]/98 backdrop-blur-2xl border-l border-[#282B37] p-4 z-40 shadow-2xl flex flex-col gap-4 overflow-y-auto">
                    {/* Inspector Header */}
                    <div className="flex items-center justify-between border-b border-[#282B37] pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]">
                                <Camera size={15} />
                            </div>
                            <div>
                                <div className="text-[10px] font-mono uppercase font-bold text-[#F59E0B] tracking-wider">
                                    FICHE TECHNIQUE CAMÉRA
                                </div>
                                <div className="text-xs font-bold text-[#EDEDEC]">
                                    Séquence {activeCard.info.sequence} · Plan {activeCard.info.shot}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsDetailsOpen(false)}
                            className="p-1.5 rounded-lg bg-[#191B22] border border-[#282B37] text-[#9B9A97] hover:text-white"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* 1. Statut Plateau & Durée (1-Tap) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider flex items-center gap-1">
                                <CheckCircle2 size={11} className="text-[#10B981]" />
                                Statut Plateau
                            </span>
                            <div className="flex items-center gap-1">
                                {(
                                    [
                                        { id: 'draft', label: 'Brouillon' },
                                        { id: 'ready', label: 'Prêt' },
                                        { id: 'shot', label: 'Tourné ✓' }
                                    ] as const
                                ).map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => updateCard(activeCard.id, { info: { shotStatus: st.id } })}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            (activeCard.info.shotStatus || 'draft') === st.id
                                                ? st.id === 'shot'
                                                    ? 'bg-[#10B981] text-white'
                                                    : st.id === 'ready'
                                                    ? 'bg-[#F59E0B] text-black'
                                                    : 'bg-[#282B37] text-white'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tactile Duration Stepper */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#282B37]">
                            <span className="text-[10px] uppercase font-bold text-[#9B9A97] flex items-center gap-1">
                                <Clock size={11} className="text-[#F59E0B]" />
                                Durée du plan
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() =>
                                        updateCard(activeCard.id, {
                                            info: { duration: Math.max(0.5, Number(((activeCard.info.duration || 3) - 0.5).toFixed(1))) }
                                        })
                                    }
                                    className="w-7 h-7 rounded-lg bg-[#0D0E11] border border-[#282B37] flex items-center justify-center text-white active:scale-95"
                                >
                                    <Minus size={12} />
                                </button>
                                <span className="font-mono text-xs font-bold text-[#F59E0B] min-w-[42px] text-center">
                                    {(activeCard.info.duration || 3).toFixed(1)}s
                                </span>
                                <button
                                    onClick={() =>
                                        updateCard(activeCard.id, {
                                            info: { duration: Number(((activeCard.info.duration || 3) + 0.5).toFixed(1)) }
                                        })
                                    }
                                    className="w-7 h-7 rounded-lg bg-[#0D0E11] border border-[#282B37] flex items-center justify-center text-white active:scale-95"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Focale Optique (1-Tap Chips) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block">
                            Focale Optique (Objectif)
                        </label>
                        <div className="grid grid-cols-6 gap-1">
                            {['18mm', '24mm', '35mm', '50mm', '85mm', '135mm'].map(lens => (
                                <button
                                    key={lens}
                                    onClick={() => updateCard(activeCard.id, { info: { focalLength: lens } })}
                                    className={`py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all ${
                                        (activeCard.info.focalLength || '35mm') === lens
                                            ? 'bg-[#F59E0B] text-black shadow'
                                            : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                    }`}
                                >
                                    {lens}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Valeur de Plan (1-Tap Chips) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block">
                            Valeur de Plan (Échelle)
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                            {[
                                { code: 'TGP', full: 'Très Gros Plan' },
                                { code: 'GP', full: 'Gros Plan' },
                                { code: 'PR', full: 'Plan Rapproché' },
                                { code: 'PA', full: 'Plan Américain' },
                                { code: 'PM', full: 'Plan Moyen' },
                                { code: 'PE', full: "Plan d'Ensemble" }
                            ].map(sc => {
                                const isSelected =
                                    activeCard.info.scale === sc.full || activeCard.info.scale === sc.code;
                                return (
                                    <button
                                        key={sc.code}
                                        onClick={() => updateCard(activeCard.id, { info: { scale: sc.full } })}
                                        className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center ${
                                            isSelected
                                                ? 'bg-[#10B981] text-white shadow'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        <span>{sc.code}</span>
                                        <span className="text-[8px] opacity-80 truncate max-w-full">{sc.full}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. Angle & Support Caméra (1-Tap Chips) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2.5">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block mb-1.5">
                                Angle de Prise de Vue
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {['Niveau œil', 'Plongée', 'Contre-plongée', 'Débullé', 'Zénithal'].map(ang => (
                                    <button
                                        key={ang}
                                        onClick={() => updateCard(activeCard.id, { info: { cameraAngle: ang } })}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            (activeCard.info.cameraAngle || 'Niveau œil') === ang
                                                ? 'bg-[#10B981] text-white'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {ang}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-[#282B37]">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block mb-1.5">
                                Mouvement Caméra
                            </label>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    'Fixe',
                                    'Panoramique H',
                                    'Panoramique V',
                                    'Travelling Avant',
                                    'Travelling Arrière',
                                    'Travelling Latéral',
                                    'Zoom Avant'
                                ].map(mv => (
                                    <button
                                        key={mv}
                                        onClick={() => updateCard(activeCard.id, { info: { movement: mv } })}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            activeCard.info.movement === mv
                                                ? 'bg-sky-500 text-white'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {mv}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-[#282B37]">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block mb-1.5">
                                Support & Machinerie
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                                {['Trépied', 'Épaule', 'Steadicam', 'Rails / Dolly', 'Grue / Drone', 'Poing'].map(sup => (
                                    <button
                                        key={sup}
                                        onClick={() => updateCard(activeCard.id, { info: { support: sup } })}
                                        className={`py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            (activeCard.info.support || 'Trépied') === sup
                                                ? 'bg-[#F59E0B] text-black'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {sup}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 5. Ambiance Lieu & Son (1-Tap Chips) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2.5">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block mb-1.5">
                                Effet & Lieu
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                                {['INT. JOUR', 'INT. NUIT', 'EXT. JOUR', 'EXT. NUIT'].map(loc => (
                                    <button
                                        key={loc}
                                        onClick={() => updateCard(activeCard.id, { info: { locationEffect: loc } })}
                                        className={`py-1 rounded-lg font-mono text-[9px] font-bold transition-all ${
                                            (activeCard.info.locationEffect || 'INT. JOUR') === loc
                                                ? 'bg-[#10B981] text-white'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-[#282B37]">
                            <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider flex items-center gap-1 mb-1.5">
                                <Volume2 size={11} className="text-[#10B981]" />
                                Type de Son
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                                {['Synchrone', 'MOS (Muet)', 'Voix Off'].map(snd => (
                                    <button
                                        key={snd}
                                        onClick={() => updateCard(activeCard.id, { info: { soundType: snd } })}
                                        className={`py-1 rounded-lg text-[10px] font-bold transition-all ${
                                            (activeCard.info.soundType || 'Synchrone') === snd
                                                ? 'bg-[#10B981] text-white'
                                                : 'bg-[#0D0E11] text-[#9B9A97] hover:text-white border border-[#282B37]'
                                        }`}
                                    >
                                        {snd}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 6. Notes d'Action / Dialogues (Clavier optionnel) */}
                    <div className="bg-[#191B22] border border-[#282B37] rounded-xl p-3 space-y-2">
                        <label className="text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider block">
                            Action, Dialogues & Intention Lumière
                        </label>
                        <textarea
                            rows={3}
                            value={activeCard.info.description}
                            onChange={(e) => updateCard(activeCard.id, { info: { description: e.target.value } })}
                            placeholder="Description de l'action, réplique ou note d'éclairage..."
                            className="w-full bg-[#0D0E11] border border-[#282B37] rounded-lg p-2.5 text-xs text-[#EDEDEC] focus:border-[#10B981] outline-none resize-none leading-relaxed"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
