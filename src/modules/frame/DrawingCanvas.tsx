import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    forwardRef,
    useImperativeHandle
} from 'react';
import { Copy, FlipHorizontal, Trash2, Check, RotateCw, ArrowLeftRight } from 'lucide-react';
import {
    toolsRegistry,
    renderStoryboardShape,
    hitTestStoryboardShape,
    type StoryboardShape,
    type StoryboardShapeType
} from './tools/registry';
import type { ToolContext, StrokePoint } from './tools/types';

export interface DrawingCanvasRef {
    undo: () => void;
    redo: () => void;
    clear: () => void;
    importImage: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

interface LassoSelectionState {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    flipX: boolean;
    cutoutCanvas: HTMLCanvasElement;
    baseCanvas: HTMLCanvasElement;
}

interface CanvasHistoryEntry {
    bitmapDataUrl: string;
    shapes: StoryboardShape[];
}

// Persistent in-memory cache of separated [bitmap + vector shapes] per pose/layer
const layerVectorStore = new Map<
    string,
    {
        bitmapDataUrl: string;
        shapes: StoryboardShape[];
        compositeDataUrl: string;
    }
>();

const VECTOR_SHAPE_TOOLS = new Set<string>([
    'line',
    'arrow',
    'cameraArrow',
    'zoomFrame',
    'rect',
    'circle'
]);

export const DrawingCanvas = forwardRef<
    DrawingCanvasRef,
    {
        onSave: (data: string) => void;
        initialData?: string;
        layerKey?: string;
        onMaximize?: () => void;
        onClose?: () => void;
        externalTool?: string;
        onSelectTool?: (tool: string) => void;
        externalColor?: string;
        externalLineWidth?: number;
        externalOpacity?: number;
        onionSkinData?: string;
        backgroundData?: string;
        compositionGrid?: 'none' | 'thirds' | 'perspective' | 'safe';
        gridColor?: string;
        aspectRatio?: '16:9' | '2.39:1' | '4:3' | '9:16';
        zoom?: number;
        rotation?: number;
        isPanningMode?: boolean;
        isPreviewingBrushSize?: boolean;
        stylusOnlyMode?: boolean;
    }
>(
    (
        {
            onSave,
            initialData,
            layerKey = 'default-layer',
            externalTool,
            externalColor,
            externalLineWidth,
            externalOpacity = 1.0,
            onionSkinData,
            backgroundData,
            compositionGrid = 'none',
            gridColor = '#10B981',
            aspectRatio = '16:9',
            zoom = 1,
            rotation = 0,
            isPanningMode = false,
            isPreviewingBrushSize = false,
            stylusOnlyMode = false
        },
        ref
    ) => {
        // Visible display canvas (renders bitmapCanvas + vector shapes)
        const displayCanvasRef = useRef<HTMLCanvasElement>(null);
        // Underlying freehand bitmap layer canvas (brushes, pencil, fill, eraser, lasso)
        const bitmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
        const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
        const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
        const [isDrawing, setIsDrawing] = useState(false);

        // ── Editable Vector Shapes (Arrows, Camera Frames, Lines, Rects, Circles) ─
        const [shapes, setShapes] = useState<StoryboardShape[]>([]);
        const shapesRef = useRef<StoryboardShape[]>([]);
        shapesRef.current = shapes;

        const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
        const selectedShapeIdRef = useRef<string | null>(null);
        selectedShapeIdRef.current = selectedShapeId;

        const [, setDraftShape] = useState<StoryboardShape | null>(null);
        const draftShapeRef = useRef<StoryboardShape | null>(null);

        // ── Lasso & Free Transformation State ───────────────────────────────────
        const [lassoPath, setLassoPath] = useState<{ x: number; y: number }[]>([]);
        const lassoPathRef = useRef<{ x: number; y: number }[]>([]);
        const [lassoSelection, setLassoSelection] = useState<LassoSelectionState | null>(null);
        const lassoSelectionRef = useRef<LassoSelectionState | null>(null);
        lassoSelectionRef.current = lassoSelection;

        const { canvasWidth, canvasHeight } = useMemo(() => {
            switch (aspectRatio) {
                case '2.39:1':
                    return { canvasWidth: 1920, canvasHeight: 804 };
                case '4:3':
                    return { canvasWidth: 1440, canvasHeight: 1080 };
                case '9:16':
                    return { canvasWidth: 1080, canvasHeight: 1920 };
                case '16:9':
                default:
                    return { canvasWidth: 1920, canvasHeight: 1080 };
            }
        }, [aspectRatio]);

        const tool = externalTool || 'brush';
        const color = externalColor || '#000000';
        const lineWidth = externalLineWidth || 8;
        const opacity = Math.max(0.05, Math.min(1, externalOpacity));

        const lastPos = useRef({ x: 0, y: 0 });
        const pointsRef = useRef<StrokePoint[]>([]);
        const activePointersRef = useRef<Set<number>>(new Set());
        const strokeStartedAtRef = useRef<number>(0);

        // ── Undo / Redo history ──────────────────────────────────────────────────
        const historyRef = useRef<CanvasHistoryEntry[]>([]);
        const historyIndexRef = useRef<number>(-1);

        // Render bitmapCanvas + vector shapes onto the visible displayCanvas
        const renderDisplayComposite = useCallback(
            (
                currentShapes: StoryboardShape[] = shapesRef.current,
                previewShape: StoryboardShape | null = null
            ) => {
                const display = displayCanvasRef.current;
                const bitmap = bitmapCanvasRef.current;
                if (!display || !bitmap) return;
                const dCtx = display.getContext('2d');
                if (!dCtx) return;

                dCtx.save();
                dCtx.globalAlpha = 1.0;
                dCtx.globalCompositeOperation = 'source-over';
                dCtx.clearRect(0, 0, display.width, display.height);
                dCtx.drawImage(bitmap, 0, 0);

                for (const s of currentShapes) {
                    renderStoryboardShape(dCtx, s);
                }
                if (previewShape) {
                    renderStoryboardShape(dCtx, previewShape);
                }
                dCtx.restore();
            },
            []
        );

        const saveSnapshot = useCallback(
            (customShapes?: StoryboardShape[]) => {
                const display = displayCanvasRef.current;
                const bitmap = bitmapCanvasRef.current;
                if (!display || !bitmap) return;

                const activeShapes = customShapes !== undefined ? customShapes : shapesRef.current;
                renderDisplayComposite(activeShapes, null);

                const bitmapDataUrl = bitmap.toDataURL();
                const compositeDataUrl = display.toDataURL();

                const entry: CanvasHistoryEntry = {
                    bitmapDataUrl,
                    shapes: activeShapes.map(s => ({ ...s }))
                };

                historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
                historyRef.current.push(entry);

                if (historyRef.current.length > 50) {
                    historyRef.current.shift();
                } else {
                    historyIndexRef.current++;
                }

                layerVectorStore.set(layerKey, {
                    bitmapDataUrl,
                    shapes: entry.shapes,
                    compositeDataUrl
                });

                onSave(compositeDataUrl);
            },
            [layerKey, onSave, renderDisplayComposite]
        );

        // Update selected shape style live when user changes color, size or opacity in toolbar
        const prevStyleRef = useRef({ color, lineWidth, opacity });
        useEffect(() => {
            const styleChanged =
                prevStyleRef.current.color !== color ||
                prevStyleRef.current.lineWidth !== lineWidth ||
                prevStyleRef.current.opacity !== opacity;
            prevStyleRef.current = { color, lineWidth, opacity };

            if (!styleChanged || !selectedShapeId) return;
            const exists = shapesRef.current.some(s => s.id === selectedShapeId);
            if (!exists) return;

            const updated = shapesRef.current.map(s =>
                s.id === selectedShapeId ? { ...s, color, lineWidth, opacity } : s
            );
            setShapes(updated);
            shapesRef.current = updated;
            saveSnapshot(updated);
        }, [color, lineWidth, opacity, selectedShapeId, saveSnapshot]);

        // Composite floating lasso selection onto bitmap canvas + display canvas
        const renderLassoComposite = useCallback(
            (sel: LassoSelectionState) => {
                const bitmap = bitmapCanvasRef.current;
                if (!bitmap) return;
                const ctx = bitmap.getContext('2d');
                if (!ctx) return;

                ctx.save();
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
                ctx.clearRect(0, 0, bitmap.width, bitmap.height);
                ctx.drawImage(sel.baseCanvas, 0, 0);

                const cx = sel.x + sel.width / 2;
                const cy = sel.y + sel.height / 2;
                ctx.translate(cx, cy);
                ctx.rotate((sel.rotation * Math.PI) / 180);
                ctx.scale(sel.flipX ? -1 : 1, 1);
                ctx.drawImage(sel.cutoutCanvas, -sel.width / 2, -sel.height / 2, sel.width, sel.height);
                ctx.restore();

                renderDisplayComposite(shapesRef.current, null);
            },
            [renderDisplayComposite]
        );

        const commitLassoSelection = useCallback(() => {
            const sel = lassoSelectionRef.current;
            if (!sel) return;
            renderLassoComposite(sel);
            setLassoSelection(null);
            lassoSelectionRef.current = null;
            saveSnapshot();
        }, [renderLassoComposite, saveSnapshot]);

        const deleteLassoSelection = useCallback(() => {
            const sel = lassoSelectionRef.current;
            if (!sel) return;
            const bitmap = bitmapCanvasRef.current;
            if (bitmap) {
                const ctx = bitmap.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, bitmap.width, bitmap.height);
                    ctx.drawImage(sel.baseCanvas, 0, 0);
                }
            }
            setLassoSelection(null);
            lassoSelectionRef.current = null;
            saveSnapshot();
        }, [saveSnapshot]);

        const duplicateLassoSelection = useCallback(() => {
            const sel = lassoSelectionRef.current;
            if (!sel) return;
            const bCtx = sel.baseCanvas.getContext('2d');
            if (bCtx) {
                bCtx.save();
                const cx = sel.x + sel.width / 2;
                const cy = sel.y + sel.height / 2;
                bCtx.translate(cx, cy);
                bCtx.rotate((sel.rotation * Math.PI) / 180);
                bCtx.scale(sel.flipX ? -1 : 1, 1);
                bCtx.drawImage(sel.cutoutCanvas, -sel.width / 2, -sel.height / 2, sel.width, sel.height);
                bCtx.restore();
            }

            const nextSel: LassoSelectionState = {
                ...sel,
                x: Math.min(canvasWidth - sel.width / 2, sel.x + 36),
                y: Math.min(canvasHeight - sel.height / 2, sel.y + 36)
            };
            setLassoSelection(nextSel);
            lassoSelectionRef.current = nextSel;
            renderLassoComposite(nextSel);
        }, [canvasWidth, canvasHeight, renderLassoComposite]);

        const flipLassoSelection = useCallback(() => {
            const sel = lassoSelectionRef.current;
            if (!sel) return;
            const nextSel: LassoSelectionState = {
                ...sel,
                flipX: !sel.flipX
            };
            setLassoSelection(nextSel);
            lassoSelectionRef.current = nextSel;
            renderLassoComposite(nextSel);
        }, [renderLassoComposite]);

        // Auto-commit lasso selection if user switches away from lasso tool
        useEffect(() => {
            if (tool !== 'lasso' && lassoSelectionRef.current) {
                commitLassoSelection();
            }
            if (tool !== 'select' && !VECTOR_SHAPE_TOOLS.has(tool)) {
                setSelectedShapeId(null);
            }
        }, [tool, commitLassoSelection]);

        // Actions for Selected Vector Shape (Delete, Duplicate, Reverse Direction)
        const deleteSelectedShape = useCallback(() => {
            const targetId = selectedShapeIdRef.current;
            if (!targetId) return;
            const next = shapesRef.current.filter(s => s.id !== targetId);
            setShapes(next);
            shapesRef.current = next;
            setSelectedShapeId(null);
            selectedShapeIdRef.current = null;
            saveSnapshot(next);
        }, [saveSnapshot]);

        const duplicateSelectedShape = useCallback(() => {
            const targetId = selectedShapeIdRef.current;
            if (!targetId) return;
            const target = shapesRef.current.find(s => s.id === targetId);
            if (!target) return;
            const clone: StoryboardShape = {
                ...target,
                id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                x1: target.x1 + 45,
                y1: target.y1 + 45,
                x2: target.x2 + 45,
                y2: target.y2 + 45
            };
            const next = [...shapesRef.current, clone];
            setShapes(next);
            shapesRef.current = next;
            setSelectedShapeId(clone.id);
            selectedShapeIdRef.current = clone.id;
            saveSnapshot(next);
        }, [saveSnapshot]);

        const reverseSelectedShapeDirection = useCallback(() => {
            const targetId = selectedShapeIdRef.current;
            if (!targetId) return;
            const next = shapesRef.current.map(s =>
                s.id === targetId
                    ? { ...s, x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 }
                    : s
            );
            setShapes(next);
            shapesRef.current = next;
            saveSnapshot(next);
        }, [saveSnapshot]);

        // Keyboard shortcuts for active lasso selection or selected vector shape
        useEffect(() => {
            if (!lassoSelection && !selectedShapeId) return;
            const onKeyDown = (e: KeyboardEvent) => {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    if (lassoSelectionRef.current) commitLassoSelection();
                    if (selectedShapeIdRef.current) setSelectedShapeId(null);
                } else if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    if (lassoSelectionRef.current) deleteLassoSelection();
                    else if (selectedShapeIdRef.current) deleteSelectedShape();
                }
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
        }, [
            lassoSelection,
            selectedShapeId,
            commitLassoSelection,
            deleteLassoSelection,
            deleteSelectedShape
        ]);

        const restoreHistoryEntry = useCallback(
            (entry: CanvasHistoryEntry) => {
                const bitmap = bitmapCanvasRef.current;
                const display = displayCanvasRef.current;
                if (!bitmap || !display) return;
                const bCtx = bitmap.getContext('2d');
                if (!bCtx) return;

                const img = new Image();
                img.onload = () => {
                    bCtx.clearRect(0, 0, bitmap.width, bitmap.height);
                    bCtx.drawImage(img, 0, 0);
                    if (offscreenCanvasRef.current) {
                        const offCtx = offscreenCanvasRef.current.getContext('2d');
                        if (offCtx) {
                            offCtx.clearRect(0, 0, bitmap.width, bitmap.height);
                            offCtx.drawImage(img, 0, 0);
                        }
                    }
                    const restoredShapes = entry.shapes.map(s => ({ ...s }));
                    setShapes(restoredShapes);
                    shapesRef.current = restoredShapes;
                    setSelectedShapeId(null);
                    selectedShapeIdRef.current = null;
                    renderDisplayComposite(restoredShapes, null);

                    const compositeDataUrl = display.toDataURL();
                    layerVectorStore.set(layerKey, {
                        bitmapDataUrl: entry.bitmapDataUrl,
                        shapes: restoredShapes,
                        compositeDataUrl
                    });
                    onSave(compositeDataUrl);
                };
                img.src = entry.bitmapDataUrl;
            },
            [layerKey, onSave, renderDisplayComposite]
        );

        const undo = useCallback(() => {
            if (lassoSelectionRef.current) {
                commitLassoSelection();
            }
            if (historyIndexRef.current <= 0) return;
            historyIndexRef.current--;
            const entry = historyRef.current[historyIndexRef.current];
            if (entry) restoreHistoryEntry(entry);
        }, [commitLassoSelection, restoreHistoryEntry]);

        const redo = useCallback(() => {
            if (historyIndexRef.current >= historyRef.current.length - 1) return;
            historyIndexRef.current++;
            const entry = historyRef.current[historyIndexRef.current];
            if (entry) restoreHistoryEntry(entry);
        }, [restoreHistoryEntry]);

        const clearCanvas = useCallback(() => {
            const bitmap = bitmapCanvasRef.current;
            if (!bitmap) return;
            const ctx = bitmap.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, bitmap.width, bitmap.height);
            setShapes([]);
            shapesRef.current = [];
            setSelectedShapeId(null);
            selectedShapeIdRef.current = null;
            saveSnapshot([]);
        }, [saveSnapshot]);

        const handleUpload = useCallback(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = evt => {
                    if (evt.target?.result) {
                        const img = new Image();
                        img.onload = () => {
                            const bitmap = bitmapCanvasRef.current;
                            if (!bitmap) return;
                            const ctx = bitmap.getContext('2d');
                            if (!ctx) return;
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, bitmap.width, bitmap.height);
                            ctx.drawImage(img, 0, 0, bitmap.width, bitmap.height);
                            saveSnapshot();
                        };
                        img.src = evt.target.result as string;
                    }
                };
                reader.readAsDataURL(file);
            };
            input.click();
        }, [saveSnapshot]);

        const [, forceUpdate] = useState(0);

        const undoAndUpdate = useCallback(() => {
            undo();
            forceUpdate(n => n + 1);
        }, [undo]);
        const redoAndUpdate = useCallback(() => {
            redo();
            forceUpdate(n => n + 1);
        }, [redo]);

        useImperativeHandle(
            ref,
            () => ({
                undo: undoAndUpdate,
                redo: redoAndUpdate,
                clear: () => {
                    clearCanvas();
                    forceUpdate(n => n + 1);
                },
                importImage: () => {
                    handleUpload();
                    forceUpdate(n => n + 1);
                },
                canUndo: () => historyIndexRef.current > 0,
                canRedo: () => historyIndexRef.current < historyRef.current.length - 1
            }),
            [undoAndUpdate, redoAndUpdate, clearCanvas, handleUpload]
        );

        // ── Canvas, Bitmap Layer & Wet Stroke Buffer Init ────────────────────────
        useEffect(() => {
            const display = displayCanvasRef.current;
            if (!display) return;

            if (!bitmapCanvasRef.current) {
                bitmapCanvasRef.current = document.createElement('canvas');
            }
            const bitmap = bitmapCanvasRef.current;
            bitmap.width = canvasWidth;
            bitmap.height = canvasHeight;

            if (!strokeCanvasRef.current) {
                strokeCanvasRef.current = document.createElement('canvas');
            }
            strokeCanvasRef.current.width = canvasWidth;
            strokeCanvasRef.current.height = canvasHeight;

            const bCtx = bitmap.getContext('2d');
            if (!bCtx) return;
            bCtx.lineCap = 'round';
            bCtx.lineJoin = 'round';

            const cached = layerVectorStore.get(layerKey);

            const finishInit = (initialShapes: StoryboardShape[]) => {
                setShapes(initialShapes);
                shapesRef.current = initialShapes;
                renderDisplayComposite(initialShapes, null);
                const bmpUrl = bitmap.toDataURL();
                historyRef.current = [{ bitmapDataUrl: bmpUrl, shapes: initialShapes.map(s => ({ ...s })) }];
                historyIndexRef.current = 0;
                forceUpdate(n => n + 1);
            };

            if (cached && (!initialData || cached.compositeDataUrl === initialData)) {
                const img = new Image();
                img.onload = () => {
                    bCtx.fillStyle = '#FFFFFF';
                    bCtx.fillRect(0, 0, canvasWidth, canvasHeight);
                    bCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
                    finishInit(cached.shapes);
                };
                img.src = cached.bitmapDataUrl;
            } else if (!initialData) {
                bCtx.fillStyle = '#FFFFFF';
                bCtx.fillRect(0, 0, canvasWidth, canvasHeight);
                finishInit([]);
            } else {
                const img = new Image();
                img.onload = () => {
                    bCtx.fillStyle = '#FFFFFF';
                    bCtx.fillRect(0, 0, canvasWidth, canvasHeight);
                    bCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
                    finishInit([]);
                };
                img.src = initialData;
            }
        }, [canvasWidth, canvasHeight, layerKey]);

        // Capture bitmap canvas pixels into offscreen buffer before a freehand stroke begins
        const captureOffscreen = useCallback(() => {
            const bitmap = bitmapCanvasRef.current;
            if (!bitmap) return;
            if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement('canvas');
            }
            const offscreen = offscreenCanvasRef.current;
            offscreen.width = bitmap.width;
            offscreen.height = bitmap.height;
            const offCtx = offscreen.getContext('2d');
            if (offCtx) {
                offCtx.drawImage(bitmap, 0, 0);
            }

            if (!strokeCanvasRef.current) {
                strokeCanvasRef.current = document.createElement('canvas');
            }
            strokeCanvasRef.current.width = bitmap.width;
            strokeCanvasRef.current.height = bitmap.height;
            const sCtx = strokeCanvasRef.current.getContext('2d');
            if (sCtx) {
                sCtx.clearRect(0, 0, bitmap.width, bitmap.height);
            }
        }, []);

        // Composite the wet stroke buffer onto the bitmap canvas, then refresh display canvas
        const compositeStrokeCanvas = useCallback(
            (alphaMultiplier = 1.0, blendMode: GlobalCompositeOperation = 'source-over') => {
                const bitmap = bitmapCanvasRef.current;
                const offscreen = offscreenCanvasRef.current;
                const strokeCanvas = strokeCanvasRef.current;
                if (!bitmap || !offscreen || !strokeCanvas) return;

                const ctx = bitmap.getContext('2d');
                if (!ctx) return;

                ctx.save();
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(offscreen, 0, 0);

                ctx.globalAlpha = Math.max(0.02, Math.min(1.0, alphaMultiplier));
                ctx.globalCompositeOperation = blendMode;
                ctx.drawImage(strokeCanvas, 0, 0);
                ctx.restore();

                renderDisplayComposite(shapesRef.current, null);
            },
            [renderDisplayComposite]
        );

        // ── Rotation-Aware & Zoom-Aware Exact Coordinate Mapping ─────────────────
        const getCanvasCoords = useCallback(
            (
                e: React.PointerEvent | React.MouseEvent | React.TouchEvent | PointerEvent | MouseEvent
            ): StrokePoint => {
                const canvas = displayCanvasRef.current;
                if (!canvas) {
                    return { x: 0, y: 0, pressure: 0.5, time: Date.now() };
                }

                const rect = canvas.getBoundingClientRect();
                let clientX = 0;
                let clientY = 0;
                let pressure = 0.5;

                if ('touches' in e && e.touches.length > 0) {
                    clientX = e.touches[0].clientX;
                    clientY = e.touches[0].clientY;
                    const touch = e.touches[0] as Touch & { force?: number };
                    if (typeof touch.force === 'number' && touch.force > 0) {
                        pressure = touch.force;
                    }
                } else if ('changedTouches' in e && e.changedTouches.length > 0) {
                    clientX = e.changedTouches[0].clientX;
                    clientY = e.changedTouches[0].clientY;
                } else {
                    const pe = e as React.PointerEvent;
                    clientX = pe.clientX;
                    clientY = pe.clientY;
                    if (typeof pe.pressure === 'number' && pe.pressure > 0 && pe.pointerType === 'pen') {
                        pressure = pe.pressure;
                    }
                }

                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const dx = clientX - centerX;
                const dy = clientY - centerY;

                const rad = (-rotation * Math.PI) / 180;
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);
                const unrotX = dx * cosA - dy * sinA;
                const unrotY = dx * sinA + dy * cosA;

                const cssW = (canvas.offsetWidth || rect.width) * zoom;
                const cssH = (canvas.offsetHeight || rect.height) * zoom;

                const normX = unrotX / Math.max(1, cssW) + 0.5;
                const normY = unrotY / Math.max(1, cssH) + 0.5;

                return {
                    x: normX * canvas.width,
                    y: normY * canvas.height,
                    pressure: Math.max(0.1, Math.min(1.0, pressure)),
                    time: performance.now()
                };
            },
            [rotation, zoom]
        );

        // ── Interactive Dragging of Selected Vector Shape (Move / Endpoints / Corners) ──
        const startShapeManipulation = (
            shape: StoryboardShape,
            handle: 'move' | 'start' | 'end' | 'nw' | 'ne' | 'se' | 'sw',
            e: React.PointerEvent | React.MouseEvent
        ) => {
            e.preventDefault();
            e.stopPropagation();

            setSelectedShapeId(shape.id);
            selectedShapeIdRef.current = shape.id;

            const startPt = getCanvasCoords(e);
            const initial = { ...shape };
            let didMove = false;

            const onMove = (moveEv: PointerEvent) => {
                const pt = getCanvasCoords(moveEv);
                const dx = pt.x - startPt.x;
                const dy = pt.y - startPt.y;
                if (Math.hypot(dx, dy) > 2) {
                    didMove = true;
                }

                const updatedShape: StoryboardShape = { ...initial };

                if (handle === 'move') {
                    updatedShape.x1 = initial.x1 + dx;
                    updatedShape.y1 = initial.y1 + dy;
                    updatedShape.x2 = initial.x2 + dx;
                    updatedShape.y2 = initial.y2 + dy;
                } else if (handle === 'start') {
                    updatedShape.x1 = initial.x1 + dx;
                    updatedShape.y1 = initial.y1 + dy;
                } else if (handle === 'end') {
                    updatedShape.x2 = initial.x2 + dx;
                    updatedShape.y2 = initial.y2 + dy;
                } else if (handle === 'nw') {
                    if (initial.x1 <= initial.x2) updatedShape.x1 = initial.x1 + dx;
                    else updatedShape.x2 = initial.x2 + dx;
                    if (initial.y1 <= initial.y2) updatedShape.y1 = initial.y1 + dy;
                    else updatedShape.y2 = initial.y2 + dy;
                } else if (handle === 'ne') {
                    if (initial.x1 > initial.x2) updatedShape.x1 = initial.x1 + dx;
                    else updatedShape.x2 = initial.x2 + dx;
                    if (initial.y1 <= initial.y2) updatedShape.y1 = initial.y1 + dy;
                    else updatedShape.y2 = initial.y2 + dy;
                } else if (handle === 'se') {
                    if (initial.x1 > initial.x2) updatedShape.x1 = initial.x1 + dx;
                    else updatedShape.x2 = initial.x2 + dx;
                    if (initial.y1 > initial.y2) updatedShape.y1 = initial.y1 + dy;
                    else updatedShape.y2 = initial.y2 + dy;
                } else if (handle === 'sw') {
                    if (initial.x1 <= initial.x2) updatedShape.x1 = initial.x1 + dx;
                    else updatedShape.x2 = initial.x2 + dx;
                    if (initial.y1 > initial.y2) updatedShape.y1 = initial.y1 + dy;
                    else updatedShape.y2 = initial.y2 + dy;
                }

                const nextList = shapesRef.current.map(s => (s.id === shape.id ? updatedShape : s));
                setShapes(nextList);
                shapesRef.current = nextList;
                renderDisplayComposite(nextList, null);
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                if (didMove) {
                    saveSnapshot(shapesRef.current);
                }
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        };

        // ── Lasso Gizmo Drag Handler (Move / Resize / Rotate) ────────────────────
        const startGizmoTransform = (
            mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rotate',
            e: React.PointerEvent
        ) => {
            e.preventDefault();
            e.stopPropagation();
            const initialSel = lassoSelectionRef.current;
            if (!initialSel) return;

            const startPt = getCanvasCoords(e);
            const centerX = initialSel.x + initialSel.width / 2;
            const centerY = initialSel.y + initialSel.height / 2;
            const startAngle = Math.atan2(startPt.y - centerY, startPt.x - centerX) * (180 / Math.PI);

            const onMove = (moveEv: PointerEvent) => {
                const pt = getCanvasCoords(moveEv);
                const dx = pt.x - startPt.x;
                const dy = pt.y - startPt.y;

                const next: LassoSelectionState = { ...initialSel };

                if (mode === 'move') {
                    next.x = initialSel.x + dx;
                    next.y = initialSel.y + dy;
                } else if (mode === 'rotate') {
                    const curAngle = Math.atan2(pt.y - centerY, pt.x - centerX) * (180 / Math.PI);
                    let nextRot = initialSel.rotation + (curAngle - startAngle);
                    if (Math.abs(nextRot) < 3) nextRot = 0;
                    next.rotation = Math.round(nextRot * 10) / 10;
                } else if (mode === 'se') {
                    next.width = Math.max(20, initialSel.width + dx);
                    next.height = Math.max(20, initialSel.height + dy);
                } else if (mode === 'nw') {
                    const nw = Math.max(20, initialSel.width - dx);
                    const nh = Math.max(20, initialSel.height - dy);
                    next.x = initialSel.x + (initialSel.width - nw);
                    next.y = initialSel.y + (initialSel.height - nh);
                    next.width = nw;
                    next.height = nh;
                } else if (mode === 'ne') {
                    const nw = Math.max(20, initialSel.width + dx);
                    const nh = Math.max(20, initialSel.height - dy);
                    next.y = initialSel.y + (initialSel.height - nh);
                    next.width = nw;
                    next.height = nh;
                } else if (mode === 'sw') {
                    const nw = Math.max(20, initialSel.width - dx);
                    const nh = Math.max(20, initialSel.height + dy);
                    next.x = initialSel.x + (initialSel.width - nw);
                    next.width = nw;
                    next.height = nh;
                }

                setLassoSelection(next);
                lassoSelectionRef.current = next;
                renderLassoComposite(next);
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        };

        const strokeStartPos = useRef({ x: 0, y: 0 });
        const lineSnapTimerRef = useRef<number | null>(null);
        const isLineSnappedRef = useRef(false);

        const drawSnappedStraightLine = (targetX: number, targetY: number) => {
            const bitmap = bitmapCanvasRef.current;
            const offscreen = offscreenCanvasRef.current;
            if (!bitmap || !offscreen) return;
            const ctx = bitmap.getContext('2d');
            if (!ctx) return;

            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(offscreen, 0, 0);

            if (tool === 'pencil' || tool === 'sketch') ctx.globalAlpha = 0.85 * opacity;
            else if (tool === 'highlighter' || tool === 'marker') {
                ctx.globalAlpha = 0.32 * opacity;
                ctx.globalCompositeOperation = 'multiply';
            } else {
                ctx.globalAlpha = opacity;
            }

            ctx.strokeStyle = color;
            ctx.lineWidth =
                tool === 'brush'
                    ? lineWidth * 1.25
                    : tool === 'highlighter' || tool === 'marker'
                    ? lineWidth * 2.6
                    : lineWidth;
            ctx.lineCap = tool === 'highlighter' || tool === 'marker' ? 'square' : 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(strokeStartPos.current.x, strokeStartPos.current.y);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            ctx.restore();

            renderDisplayComposite(shapesRef.current, null);
        };

        const toolContext: ToolContext = {
            canvasRef: bitmapCanvasRef as React.RefObject<HTMLCanvasElement>,
            strokeCanvasRef,
            lastPos,
            pointsRef,
            color,
            lineWidth,
            opacity,
            saveSnapshot: () => saveSnapshot(),
            offscreenRef: offscreenCanvasRef,
            getCoords: getCanvasCoords,
            compositeStrokeCanvas
        };

        const isFreehandTool =
            tool === 'sketch' ||
            tool === 'pencil' ||
            tool === 'pen' ||
            tool === 'brush' ||
            tool === 'highlighter' ||
            tool === 'marker';

        const cancelActiveStroke = useCallback(() => {
            if (lineSnapTimerRef.current) {
                window.clearTimeout(lineSnapTimerRef.current);
                lineSnapTimerRef.current = null;
            }
            isLineSnappedRef.current = false;
            setIsDrawing(false);
            lassoPathRef.current = [];
            setLassoPath([]);
            draftShapeRef.current = null;
            setDraftShape(null);

            const bitmap = bitmapCanvasRef.current;
            const offscreen = offscreenCanvasRef.current;
            if (bitmap && offscreen) {
                const ctx = bitmap.getContext('2d');
                if (ctx) {
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(offscreen, 0, 0);
                }
            }
            renderDisplayComposite(shapesRef.current, null);
        }, [renderDisplayComposite]);

        // ── Smart Flood Fill (Seau de Peinture) respecting bitmap + vector shapes + porous pencil ──
        const executeSmartFloodFill = useCallback(
            (rawX: number, rawY: number) => {
                const display = displayCanvasRef.current;
                const bitmap = bitmapCanvasRef.current;
                if (!display || !bitmap) return;

                renderDisplayComposite(shapesRef.current, null);

                const dCtx = display.getContext('2d');
                const bCtx = bitmap.getContext('2d');
                if (!dCtx || !bCtx) return;

                const width = display.width;
                const height = display.height;
                const startX = Math.floor(rawX);
                const startY = Math.floor(rawY);
                if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

                const cleanHex = color.replace('#', '');
                const fullHex =
                    cleanHex.length === 3
                        ? cleanHex
                              .split('')
                              .map(c => c + c)
                              .join('')
                        : cleanHex;
                const num = parseInt(fullHex, 16) || 0;
                const fillR = (num >> 16) & 255;
                const fillG = (num >> 8) & 255;
                const fillB = num & 255;

                // Read visible composite (includes both freehand strokes and vector shapes)
                const refData = dCtx.getImageData(0, 0, width, height).data;
                const bmpImageData = bCtx.getImageData(0, 0, width, height);
                const bmpData = bmpImageData.data;

                const startIdx = (startY * width + startX) * 4;
                const targetR = refData[startIdx];
                const targetG = refData[startIdx + 1];
                const targetB = refData[startIdx + 2];

                // If clicking on a pixel that already has the exact same color, nothing to change
                if (
                    Math.abs(targetR - fillR) < 4 &&
                    Math.abs(targetG - fillG) < 4 &&
                    Math.abs(targetB - fillB) < 4
                ) {
                    return;
                }

                const totalPixels = width * height;
                const tolerance = 52;

                // 1. Build passable mask (1 = matches target zone color, 0 = boundary stroke)
                const passable = new Uint8Array(totalPixels);
                for (let i = 0; i < totalPixels; i++) {
                    const idx = i * 4;
                    if (
                        Math.abs(refData[idx] - targetR) <= tolerance &&
                        Math.abs(refData[idx + 1] - targetG) <= tolerance &&
                        Math.abs(refData[idx + 2] - targetB) <= tolerance
                    ) {
                        passable[i] = 1;
                    }
                }

                // 2. Close 1px micro-gaps in porous charcoal/pencil strokes so fill doesn't leak
                const closedPassable = new Uint8Array(passable);
                for (let y = 1; y < height - 1; y++) {
                    const row = y * width;
                    for (let x = 1; x < width - 1; x++) {
                        const p = row + x;
                        if (passable[p] === 0) {
                            const idx = p * 4;
                            const contrast =
                                Math.abs(refData[idx] - targetR) +
                                Math.abs(refData[idx + 1] - targetG) +
                                Math.abs(refData[idx + 2] - targetB);
                            if (contrast > 90) {
                                closedPassable[p - 1] = 0;
                                closedPassable[p + 1] = 0;
                                closedPassable[p - width] = 0;
                                closedPassable[p + width] = 0;
                            }
                        }
                    }
                }
                // Ensure the clicked starting point itself is always open
                closedPassable[startY * width + startX] = 1;

                // 3. Fast Scanline Flood Fill on closedPassable
                const filled = new Uint8Array(totalPixels);
                const stack: number[] = [startX, startY];

                while (stack.length > 0) {
                    const cy = stack.pop()!;
                    const cx = stack.pop()!;
                    let lx = cx;

                    while (lx >= 0 && !filled[cy * width + lx] && closedPassable[cy * width + lx]) {
                        lx--;
                    }
                    lx++;

                    let rx = cx;
                    while (
                        rx < width &&
                        !filled[cy * width + rx] &&
                        closedPassable[cy * width + rx]
                    ) {
                        rx++;
                    }
                    rx--;

                    let spanAbove = false;
                    let spanBelow = false;

                    for (let ix = lx; ix <= rx; ix++) {
                        const pos = cy * width + ix;
                        filled[pos] = 1;

                        if (cy > 0) {
                            const abovePos = (cy - 1) * width + ix;
                            const aboveMatch = !filled[abovePos] && closedPassable[abovePos] === 1;
                            if (!spanAbove && aboveMatch) {
                                stack.push(ix, cy - 1);
                                spanAbove = true;
                            } else if (spanAbove && !aboveMatch) {
                                spanAbove = false;
                            }
                        }

                        if (cy < height - 1) {
                            const belowPos = (cy + 1) * width + ix;
                            const belowMatch = !filled[belowPos] && closedPassable[belowPos] === 1;
                            if (!spanBelow && belowMatch) {
                                stack.push(ix, cy + 1);
                                spanBelow = true;
                            } else if (spanBelow && !belowMatch) {
                                spanBelow = false;
                            }
                        }
                    }
                }

                // 4. Expand filled zone by 1px into anti-aliased fringe so no white halo remains
                const finalFill = new Uint8Array(filled);
                for (let y = 1; y < height - 1; y++) {
                    const row = y * width;
                    for (let x = 1; x < width - 1; x++) {
                        const p = row + x;
                        if (filled[p] === 1) {
                            if (passable[p - 1] === 1) finalFill[p - 1] = 1;
                            if (passable[p + 1] === 1) finalFill[p + 1] = 1;
                            if (passable[p - width] === 1) finalFill[p - width] = 1;
                            if (passable[p + width] === 1) finalFill[p + width] = 1;
                        }
                    }
                }

                // 5. Apply fill color onto bitmapCanvas
                for (let i = 0; i < totalPixels; i++) {
                    if (finalFill[i] === 1) {
                        const pIdx = i * 4;
                        bmpData[pIdx] = Math.round(bmpData[pIdx] * (1 - opacity) + fillR * opacity);
                        bmpData[pIdx + 1] = Math.round(
                            bmpData[pIdx + 1] * (1 - opacity) + fillG * opacity
                        );
                        bmpData[pIdx + 2] = Math.round(
                            bmpData[pIdx + 2] * (1 - opacity) + fillB * opacity
                        );
                        bmpData[pIdx + 3] = 255;
                    }
                }

                bCtx.putImageData(bmpImageData, 0, 0);
                saveSnapshot();
                forceUpdate(n => n + 1);
            },
            [color, opacity, renderDisplayComposite, saveSnapshot]
        );

        const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (isPanningMode || e.button === 1 || e.button === 2) {
                return;
            }

            // Android Tablet Stylus / Palm Rejection Mode: ignore single-finger touch strokes
            if (stylusOnlyMode && e.pointerType === 'touch') {
                return;
            }

            activePointersRef.current.add(e.pointerId);

            if (activePointersRef.current.size > 1) {
                if (isDrawing && performance.now() - strokeStartedAtRef.current < 180) {
                    cancelActiveStroke();
                }
                return;
            }

            const startPt = getCanvasCoords(e);

            // ── 1. OUTIL SOURIS (Sélection & Déplacement des flèches / cadres) ──
            if (tool === 'select') {
                for (let i = shapesRef.current.length - 1; i >= 0; i--) {
                    const s = shapesRef.current[i];
                    if (hitTestStoryboardShape(s, startPt.x, startPt.y)) {
                        startShapeManipulation(s, 'move', e);
                        return;
                    }
                }
                setSelectedShapeId(null);
                selectedShapeIdRef.current = null;
                return;
            }

            // If a floating lasso selection is active and user clicks outside it, commit first
            if (lassoSelectionRef.current) {
                commitLassoSelection();
            }

            // ── 2. SEAU DE PEINTURE (Remplissage immédiat de la zone cliquée) ──
            if (tool === 'fill') {
                executeSmartFloodFill(startPt.x, startPt.y);
                return;
            }

            // ── 2. CREATION OU SÉLECTION D'UNE FLÈCHE / CADRE VECTORIEL ──
            if (VECTOR_SHAPE_TOOLS.has(tool)) {
                // If user clicks directly on an already existing shape, select & move it instead of drawing over it
                for (let i = shapesRef.current.length - 1; i >= 0; i--) {
                    const s = shapesRef.current[i];
                    if (hitTestStoryboardShape(s, startPt.x, startPt.y)) {
                        startShapeManipulation(s, 'move', e);
                        return;
                    }
                }

                try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                setIsDrawing(true);
                strokeStartedAtRef.current = performance.now();
                const newDraft: StoryboardShape = {
                    id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: tool as StoryboardShapeType,
                    x1: startPt.x,
                    y1: startPt.y,
                    x2: startPt.x,
                    y2: startPt.y,
                    color,
                    lineWidth,
                    opacity
                };
                draftShapeRef.current = newDraft;
                setDraftShape(newDraft);
                setSelectedShapeId(null);
                selectedShapeIdRef.current = null;
                return;
            }

            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}

            setIsDrawing(true);
            strokeStartedAtRef.current = performance.now();
            isLineSnappedRef.current = false;
            if (lineSnapTimerRef.current) {
                window.clearTimeout(lineSnapTimerRef.current);
                lineSnapTimerRef.current = null;
            }

            strokeStartPos.current = { x: startPt.x, y: startPt.y };

            if (tool === 'lasso') {
                const initialPath = [{ x: startPt.x, y: startPt.y }];
                lassoPathRef.current = initialPath;
                setLassoPath(initialPath);
                return;
            }

            captureOffscreen();

            const activeTool = toolsRegistry[tool];
            if (activeTool?.onPointerDown) {
                activeTool.onPointerDown(e, toolContext);
            }
        };

        const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (isPanningMode || activePointersRef.current.size > 1) {
                if (activePointersRef.current.size > 1 && isDrawing) {
                    cancelActiveStroke();
                }
                return;
            }
            if (!isDrawing) return;

            const currentCoords = getCanvasCoords(e);

            // Synchronous ref check so vector shapes NEVER fall through to freehand drawing
            if (VECTOR_SHAPE_TOOLS.has(tool)) {
                if (draftShapeRef.current) {
                    const updatedDraft: StoryboardShape = {
                        ...draftShapeRef.current,
                        x2: currentCoords.x,
                        y2: currentCoords.y
                    };
                    draftShapeRef.current = updatedDraft;
                    setDraftShape(updatedDraft);
                    renderDisplayComposite(shapesRef.current, updatedDraft);
                }
                return;
            }

            if (tool === 'lasso') {
                const nextPath = [...lassoPathRef.current, { x: currentCoords.x, y: currentCoords.y }];
                lassoPathRef.current = nextPath;
                setLassoPath(nextPath);
                return;
            }

            if (isLineSnappedRef.current) {
                drawSnappedStraightLine(currentCoords.x, currentCoords.y);
                lastPos.current = { x: currentCoords.x, y: currentCoords.y };
                return;
            }

            const activeTool = toolsRegistry[tool];
            if (activeTool?.onPointerMove) {
                activeTool.onPointerMove(e, toolContext);
            }

            if (isFreehandTool) {
                if (lineSnapTimerRef.current) {
                    window.clearTimeout(lineSnapTimerRef.current);
                }
                const dist = Math.hypot(
                    currentCoords.x - strokeStartPos.current.x,
                    currentCoords.y - strokeStartPos.current.y
                );
                if (dist > 35) {
                    lineSnapTimerRef.current = window.setTimeout(() => {
                        isLineSnappedRef.current = true;
                        drawSnappedStraightLine(currentCoords.x, currentCoords.y);
                    }, 420);
                }
            }
        };

        const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
            activePointersRef.current.delete(e.pointerId);
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}

            if (!isDrawing) return;
            setIsDrawing(false);

            // Commit newly drawn vector shape using synchronous draftShapeRef
            if (VECTOR_SHAPE_TOOLS.has(tool)) {
                const finishedDraft = draftShapeRef.current;
                draftShapeRef.current = null;
                setDraftShape(null);

                if (finishedDraft) {
                    const dist = Math.hypot(
                        finishedDraft.x2 - finishedDraft.x1,
                        finishedDraft.y2 - finishedDraft.y1
                    );
                    if (dist >= 10) {
                        const nextShapes = [...shapesRef.current, finishedDraft];
                        setShapes(nextShapes);
                        shapesRef.current = nextShapes;
                        setSelectedShapeId(finishedDraft.id);
                        selectedShapeIdRef.current = finishedDraft.id;
                        saveSnapshot(nextShapes);
                    } else {
                        renderDisplayComposite(shapesRef.current, null);
                    }
                }
                return;
            }

            if (tool === 'lasso') {
                const path = lassoPathRef.current;
                lassoPathRef.current = [];
                setLassoPath([]);
                const bitmap = bitmapCanvasRef.current;
                if (!bitmap || path.length < 3) return;

                let minX = bitmap.width;
                let minY = bitmap.height;
                let maxX = 0;
                let maxY = 0;
                for (const pt of path) {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y > maxY) maxY = pt.y;
                }
                minX = Math.max(0, Math.floor(minX));
                minY = Math.max(0, Math.floor(minY));
                maxX = Math.min(bitmap.width, Math.ceil(maxX));
                maxY = Math.min(bitmap.height, Math.ceil(maxY));

                const w = maxX - minX;
                const h = maxY - minY;
                if (w < 10 || h < 10) return;

                const cutoutCanvas = document.createElement('canvas');
                cutoutCanvas.width = w;
                cutoutCanvas.height = h;
                const cCtx = cutoutCanvas.getContext('2d');
                if (!cCtx) return;

                cCtx.save();
                cCtx.beginPath();
                path.forEach((pt, idx) => {
                    if (idx === 0) cCtx.moveTo(pt.x - minX, pt.y - minY);
                    else cCtx.lineTo(pt.x - minX, pt.y - minY);
                });
                cCtx.closePath();
                cCtx.clip();
                cCtx.drawImage(bitmap, -minX, -minY);
                cCtx.restore();

                const imgData = cCtx.getImageData(0, 0, w, h);
                const d = imgData.data;
                for (let i = 0; i < d.length; i += 4) {
                    if (d[i] > 248 && d[i + 1] > 248 && d[i + 2] > 248) {
                        d[i + 3] = 0;
                    }
                }
                cCtx.putImageData(imgData, 0, 0);

                const baseCanvas = document.createElement('canvas');
                baseCanvas.width = bitmap.width;
                baseCanvas.height = bitmap.height;
                const bCtx = baseCanvas.getContext('2d');
                if (!bCtx) return;
                bCtx.drawImage(bitmap, 0, 0);
                bCtx.save();
                bCtx.beginPath();
                path.forEach((pt, idx) => {
                    if (idx === 0) bCtx.moveTo(pt.x, pt.y);
                    else bCtx.lineTo(pt.x, pt.y);
                });
                bCtx.closePath();
                bCtx.fillStyle = '#FFFFFF';
                bCtx.fill();
                bCtx.restore();

                const nextSel: LassoSelectionState = {
                    x: minX,
                    y: minY,
                    width: w,
                    height: h,
                    rotation: 0,
                    flipX: false,
                    cutoutCanvas,
                    baseCanvas
                };
                setLassoSelection(nextSel);
                lassoSelectionRef.current = nextSel;
                renderLassoComposite(nextSel);
                return;
            }

            if (lineSnapTimerRef.current) {
                window.clearTimeout(lineSnapTimerRef.current);
                lineSnapTimerRef.current = null;
            }

            if (isLineSnappedRef.current) {
                isLineSnappedRef.current = false;
                saveSnapshot();
                forceUpdate(n => n + 1);
                return;
            }

            const activeTool = toolsRegistry[tool];
            if (activeTool?.onPointerUp) {
                activeTool.onPointerUp(e, toolContext);
            } else {
                saveSnapshot();
            }
            forceUpdate(n => n + 1);
        };

        const selectedShape = useMemo(
            () => shapes.find(s => s.id === selectedShapeId) || null,
            [shapes, selectedShapeId]
        );

        const isLinearShape =
            selectedShape?.type === 'arrow' ||
            selectedShape?.type === 'cameraArrow' ||
            selectedShape?.type === 'line';

        // Interactive SVG hit targets active when using Mouse tool or any Vector Shape tool
        const canInteractWithShapes = tool === 'select' || VECTOR_SHAPE_TOOLS.has(tool);

        // Compute exact real stroke radius in canvas coordinates for the center live preview
        const realStrokeRadius = useMemo(() => {
            let diameter = lineWidth;
            if (tool === 'pencil' || tool === 'sketch') diameter = lineWidth * 1.4;
            else if (tool === 'brush') diameter = lineWidth * 1.3;
            else if (tool === 'highlighter' || tool === 'marker') diameter = lineWidth * 3.2;
            else if (tool === 'airbrush') diameter = lineWidth * 6.5;
            else if (tool === 'eraser') diameter = lineWidth * 1.6;
            return Math.max(2, diameter / 2);
        }, [tool, lineWidth]);

        return (
            <div className="relative w-full h-full group isolate bg-[#18181b]">
                <canvas
                    ref={displayCanvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className={`w-full h-full touch-none bg-white z-[1] transition-opacity duration-150 ${
                        isPreviewingBrushSize ? 'opacity-35' : 'opacity-100'
                    } ${
                        isPanningMode
                            ? 'cursor-grab active:cursor-grabbing'
                            : tool === 'select'
                            ? 'cursor-default'
                            : 'cursor-crosshair'
                    }`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />

                {/* ── LIVE REAL-SIZE BRUSH STROKE PREVIEW AT CENTER OF CANVAS ── */}
                {isPreviewingBrushSize && (
                    <div className="absolute inset-0 pointer-events-none z-[30] flex items-center justify-center">
                        <svg
                            className="w-full h-full absolute inset-0 overflow-visible"
                            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <defs>
                                <pattern
                                    id="brush-size-stripe-pattern"
                                    width="14"
                                    height="14"
                                    patternTransform="rotate(45 0 0)"
                                    patternUnits="userSpaceOnUse"
                                >
                                    <line
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="14"
                                        stroke="#10B981"
                                        strokeWidth="5"
                                        strokeOpacity={Math.max(0.28, opacity * 0.55)}
                                    />
                                </pattern>
                            </defs>

                            {/* Outer guide ring when brush size is very fine (< 14px radius) so it's immediately visible */}
                            {realStrokeRadius < 14 && (
                                <circle
                                    cx={canvasWidth / 2}
                                    cy={canvasHeight / 2}
                                    r={realStrokeRadius + 18}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth={1.8}
                                    strokeOpacity={0.5}
                                    strokeDasharray="6 5"
                                    className="animate-marching-ants"
                                />
                            )}

                            {/* Real-size circle filled with the menu's diagonal green stripes */}
                            <circle
                                cx={canvasWidth / 2}
                                cy={canvasHeight / 2}
                                r={realStrokeRadius}
                                fill="url(#brush-size-stripe-pattern)"
                            />

                            {/* Animated rotating green dashed border matching exact stroke diameter */}
                            <circle
                                cx={canvasWidth / 2}
                                cy={canvasHeight / 2}
                                r={realStrokeRadius}
                                fill="none"
                                stroke="#10B981"
                                strokeWidth={2.5}
                                strokeDasharray="9 5"
                                className="animate-marching-ants"
                            />
                        </svg>

                        {/* Size & Opacity Badge below center preview */}
                        <div className="mt-28 px-3 py-1 rounded-full bg-[#18181b]/95 border border-[#10B981] text-white text-xs font-mono font-bold shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center gap-2">
                            <span className="text-[#10B981]">{lineWidth} px</span>
                            <span className="text-white/30">•</span>
                            <span className="text-[#a1a1aa]">{Math.round(opacity * 100)}%</span>
                        </div>
                    </div>
                )}

                {/* ── DIRECT CLICKABLE SVG HIT TARGETS FOR ALL PLACED ARROWS & FRAMES ── */}
                {canInteractWithShapes && !isDrawing && shapes.length > 0 && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-[12]"
                        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                        preserveAspectRatio="none"
                    >
                        {shapes.map(s => {
                            if (s.type === 'arrow' || s.type === 'cameraArrow' || s.type === 'line') {
                                return (
                                    <line
                                        key={`hit-${s.id}`}
                                        x1={s.x1}
                                        y1={s.y1}
                                        x2={s.x2}
                                        y2={s.y2}
                                        stroke="transparent"
                                        strokeWidth={Math.max(42, s.lineWidth * 3)}
                                        strokeLinecap="round"
                                        className="cursor-move pointer-events-auto"
                                        onPointerDown={e => startShapeManipulation(s, 'move', e)}
                                    />
                                );
                            }
                            if (s.type === 'zoomFrame' || s.type === 'rect') {
                                const left = Math.min(s.x1, s.x2);
                                const top = Math.min(s.y1, s.y2);
                                const w = Math.max(20, Math.abs(s.x2 - s.x1));
                                const h = Math.max(20, Math.abs(s.y2 - s.y1));
                                return (
                                    <rect
                                        key={`hit-${s.id}`}
                                        x={left}
                                        y={top}
                                        width={w}
                                        height={h}
                                        fill="transparent"
                                        stroke="transparent"
                                        strokeWidth={36}
                                        className="cursor-move pointer-events-auto"
                                        onPointerDown={e => startShapeManipulation(s, 'move', e)}
                                    />
                                );
                            }
                            if (s.type === 'circle') {
                                const r = Math.max(20, Math.hypot(s.x2 - s.x1, s.y2 - s.y1));
                                return (
                                    <circle
                                        key={`hit-${s.id}`}
                                        cx={s.x1}
                                        cy={s.y1}
                                        r={r}
                                        fill="transparent"
                                        stroke="transparent"
                                        strokeWidth={36}
                                        className="cursor-move pointer-events-auto"
                                        onPointerDown={e => startShapeManipulation(s, 'move', e)}
                                    />
                                );
                            }
                            return null;
                        })}
                    </svg>
                )}

                {/* ── INTERACTIVE GIZMO FOR SELECTED ARROW / CAMERA FRAME / SHAPE ── */}
                {selectedShape && (
                    <div className="absolute inset-0 pointer-events-none z-[16]">
                        {isLinearShape ? (
                            <>
                                {/* Dashed Selection Guide Line */}
                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                                    preserveAspectRatio="none"
                                >
                                    <line
                                        x1={selectedShape.x1}
                                        y1={selectedShape.y1}
                                        x2={selectedShape.x2}
                                        y2={selectedShape.y2}
                                        stroke="#10B981"
                                        strokeWidth={3}
                                        strokeDasharray="10 6"
                                    />
                                </svg>

                                {/* Start Endpoint Handle (Tail) */}
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'start', e)}
                                    style={{
                                        left: `${(selectedShape.x1 / canvasWidth) * 100}%`,
                                        top: `${(selectedShape.y1 / canvasHeight) * 100}%`
                                    }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#10B981] shadow-lg cursor-grab active:cursor-grabbing pointer-events-auto hover:scale-125 transition-transform"
                                    title="Glisser pour déplacer le point de départ"
                                />

                                {/* Center Move Handle (Drag entire arrow) */}
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'move', e)}
                                    style={{
                                        left: `${((selectedShape.x1 + selectedShape.x2) / 2 / canvasWidth) * 100}%`,
                                        top: `${((selectedShape.y1 + selectedShape.y2) / 2 / canvasHeight) * 100}%`
                                    }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-[#10B981] text-white border-2 border-white shadow-xl cursor-move pointer-events-auto hover:scale-110 transition-transform"
                                    title="Glisser pour déplacer toute la flèche"
                                />

                                {/* End Endpoint Handle (Arrow Tip) */}
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'end', e)}
                                    style={{
                                        left: `${(selectedShape.x2 / canvasWidth) * 100}%`,
                                        top: `${(selectedShape.y2 / canvasHeight) * 100}%`
                                    }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#10B981] border-2 border-white shadow-lg cursor-grab active:cursor-grabbing pointer-events-auto hover:scale-125 transition-transform"
                                    title="Glisser pour orienter la pointe de la flèche"
                                />

                                {/* Floating Action Pill for Arrow (clamped inside canvas so never clipped) */}
                                <div
                                    onPointerDown={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    style={{
                                        left: `${Math.max(
                                            15,
                                            Math.min(
                                                85,
                                                ((selectedShape.x1 + selectedShape.x2) / 2 / canvasWidth) * 100
                                            )
                                        )}%`,
                                        top: `${Math.max(
                                            8,
                                            Math.min(
                                                84,
                                                (Math.max(selectedShape.y1, selectedShape.y2) / canvasHeight) * 100 + 4
                                            )
                                        )}%`
                                    }}
                                    className="absolute -translate-x-1/2 flex items-center gap-1.5 bg-[#18181b] border border-[#10B981]/50 rounded-xl px-2.5 py-1.5 shadow-2xl pointer-events-auto whitespace-nowrap"
                                >
                                    <button
                                        type="button"
                                        onClick={reverseSelectedShapeDirection}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white hover:bg-white/10 transition-colors"
                                        title="Inverser le sens de la flèche"
                                    >
                                        <ArrowLeftRight size={12} className="text-[#10B981]" />
                                        <span>Inverser</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={duplicateSelectedShape}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white hover:bg-white/10 transition-colors"
                                        title="Dupliquer la flèche"
                                    >
                                        <Copy size={12} className="text-[#10B981]" />
                                        <span>Dupliquer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deleteSelectedShape}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white text-[11px] font-bold transition-colors"
                                        title="Supprimer la flèche (Suppr / Retour arrière)"
                                    >
                                        <Trash2 size={12} />
                                        <span>Supprimer</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Bounding Box Gizmo for Camera Frame (zoomFrame), Rectangle, or Circle */
                            <div
                                onPointerDown={e => startShapeManipulation(selectedShape, 'move', e)}
                                style={{
                                    left: `${(Math.min(selectedShape.x1, selectedShape.x2) / canvasWidth) * 100}%`,
                                    top: `${(Math.min(selectedShape.y1, selectedShape.y2) / canvasHeight) * 100}%`,
                                    width: `${(Math.abs(selectedShape.x2 - selectedShape.x1) / canvasWidth) * 100}%`,
                                    height: `${(Math.abs(selectedShape.y2 - selectedShape.y1) / canvasHeight) * 100}%`
                                }}
                                className="absolute border-2 border-dashed border-[#10B981] bg-[#10B981]/5 cursor-move pointer-events-auto"
                            >
                                {/* 4 Corner Handles */}
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'nw', e)}
                                    className="absolute -top-2.5 -left-2.5 w-4 h-4 rounded-sm bg-white border-2 border-[#10B981] cursor-nwse-resize shadow-md"
                                />
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'ne', e)}
                                    className="absolute -top-2.5 -right-2.5 w-4 h-4 rounded-sm bg-white border-2 border-[#10B981] cursor-nesw-resize shadow-md"
                                />
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'sw', e)}
                                    className="absolute -bottom-2.5 -left-2.5 w-4 h-4 rounded-sm bg-white border-2 border-[#10B981] cursor-nesw-resize shadow-md"
                                />
                                <div
                                    onPointerDown={e => startShapeManipulation(selectedShape, 'se', e)}
                                    className="absolute -bottom-2.5 -right-2.5 w-4 h-4 rounded-sm bg-white border-2 border-[#10B981] cursor-nwse-resize shadow-md"
                                />

                                {/* Floating Action Pill for Camera Frame / Box (placed inside/near top if close to bottom) */}
                                <div
                                    onPointerDown={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                    }}
                                    className={`absolute left-1/2 -translate-x-1/2 ${
                                        Math.max(selectedShape.y1, selectedShape.y2) > canvasHeight * 0.8
                                            ? 'top-2'
                                            : '-bottom-11'
                                    } flex items-center gap-1.5 bg-[#18181b] border border-[#10B981]/50 rounded-xl px-2.5 py-1.5 shadow-2xl whitespace-nowrap z-20`}
                                >
                                    {selectedShape.type === 'zoomFrame' && (
                                        <button
                                            type="button"
                                            onClick={reverseSelectedShapeDirection}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white hover:bg-white/10 transition-colors"
                                            title="Basculer Zoom Avant ↔ Zoom Arrière"
                                        >
                                            <ArrowLeftRight size={12} className="text-[#10B981]" />
                                            <span>
                                                {selectedShape.x2 >= selectedShape.x1
                                                    ? 'Zoom Avant ↔ Arrière'
                                                    : 'Zoom Arrière ↔ Avant'}
                                            </span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={duplicateSelectedShape}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-white hover:bg-white/10 transition-colors"
                                        title="Dupliquer le cadre"
                                    >
                                        <Copy size={12} className="text-[#10B981]" />
                                        <span>Dupliquer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deleteSelectedShape}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white text-[11px] font-bold transition-colors"
                                        title="Supprimer le cadre (Suppr)"
                                    >
                                        <Trash2 size={12} />
                                        <span>Supprimer</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Live Freehand Lasso Path Overlay */}
                {lassoPath.length > 1 && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none z-[10]"
                        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                        preserveAspectRatio="none"
                    >
                        <polygon
                            points={lassoPath.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="rgba(16, 185, 129, 0.12)"
                            stroke="#10B981"
                            strokeWidth={3}
                            strokeDasharray="10 6"
                            className="animate-marching-ants"
                        />
                    </svg>
                )}

                {/* Interactive Floating Lasso Selection Gizmo & Toolbar */}
                {lassoSelection && (
                    <div
                        style={{
                            left: `${(lassoSelection.x / canvasWidth) * 100}%`,
                            top: `${(lassoSelection.y / canvasHeight) * 100}%`,
                            width: `${(lassoSelection.width / canvasWidth) * 100}%`,
                            height: `${(lassoSelection.height / canvasHeight) * 100}%`,
                            transform: `rotate(${lassoSelection.rotation}deg)`
                        }}
                        className="absolute z-[15] border-2 border-dashed border-[#10B981] bg-[#10B981]/5 shadow-[0_0_20px_rgba(16,185,129,0.2)] cursor-move select-none"
                        onPointerDown={e => startGizmoTransform('move', e)}
                    >
                        {/* Top Rotation Handle */}
                        <div
                            onPointerDown={e => startGizmoTransform('rotate', e)}
                            className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                            title="Pivoter la sélection"
                        >
                            <RotateCw size={11} />
                        </div>
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-[#10B981] pointer-events-none" />

                        {/* 4 Corner Resize Handles */}
                        <div
                            onPointerDown={e => startGizmoTransform('nw', e)}
                            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-sm bg-white border-2 border-[#10B981] cursor-nwse-resize shadow"
                        />
                        <div
                            onPointerDown={e => startGizmoTransform('ne', e)}
                            className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm bg-white border-2 border-[#10B981] cursor-nesw-resize shadow"
                        />
                        <div
                            onPointerDown={e => startGizmoTransform('sw', e)}
                            className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-sm bg-white border-2 border-[#10B981] cursor-nesw-resize shadow"
                        />
                        <div
                            onPointerDown={e => startGizmoTransform('se', e)}
                            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm bg-white border-2 border-[#10B981] cursor-nwse-resize shadow"
                        />

                        {/* Floating Quick Action Pill */}
                        <div
                            onPointerDown={e => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                            className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#18181b]/95 backdrop-blur-md border border-white/15 rounded-xl px-2 py-1 shadow-2xl whitespace-nowrap"
                        >
                            <button
                                type="button"
                                onClick={duplicateLassoSelection}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-white hover:bg-white/10 transition-colors"
                                title="Dupliquer la sélection"
                            >
                                <Copy size={11} className="text-[#10B981]" />
                                <span>Dupliquer</span>
                            </button>
                            <button
                                type="button"
                                onClick={flipLassoSelection}
                                className="p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                                title="Miroir horizontal"
                            >
                                <FlipHorizontal size={12} />
                            </button>
                            <button
                                type="button"
                                onClick={deleteLassoSelection}
                                className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                title="Supprimer la zone sélectionnée (Suppr)"
                            >
                                <Trash2 size={12} />
                            </button>
                            <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                            <button
                                type="button"
                                onClick={commitLassoSelection}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-[10px] font-bold transition-colors"
                                title="Valider la transformation (Entrée)"
                            >
                                <Check size={11} />
                                <span>Valider</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Shared Plan Background / Décor Layer */}
                {backgroundData && (
                    <img
                        src={backgroundData}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-[2] mix-blend-multiply"
                        alt="Calque Décor"
                    />
                )}

                {/* Onion Skin Overlay (Previous pose of the same shot only) */}
                {onionSkinData && (
                    <img
                        src={onionSkinData}
                        className="absolute inset-0 w-full h-full object-contain opacity-35 pointer-events-none select-none z-[2] mix-blend-multiply"
                        alt="Onion Skin"
                    />
                )}

                {/* Composition Grid Thirds Overlay */}
                {compositionGrid === 'thirds' && (
                    <div
                        className="absolute inset-0 w-full h-full pointer-events-none select-none z-[3] grid grid-cols-3 grid-rows-3 opacity-40 border"
                        style={{ borderColor: gridColor }}
                    >
                        <div className="border-r border-b" style={{ borderColor: gridColor }} />
                        <div className="border-r border-b" style={{ borderColor: gridColor }} />
                        <div className="border-b" style={{ borderColor: gridColor }} />
                        <div className="border-r border-b" style={{ borderColor: gridColor }} />
                        <div className="border-r border-b" style={{ borderColor: gridColor }} />
                        <div className="border-b" style={{ borderColor: gridColor }} />
                        <div className="border-r" style={{ borderColor: gridColor }} />
                        <div className="border-r" style={{ borderColor: gridColor }} />
                        <div className="" />
                    </div>
                )}

                {/* Composition Grid Perspective Overlay */}
                {compositionGrid === 'perspective' && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none select-none z-[3] opacity-40"
                        viewBox="0 0 1920 1080"
                        fill="none"
                    >
                        <line
                            x1="0"
                            y1="540"
                            x2="1920"
                            y2="540"
                            stroke={gridColor}
                            strokeWidth={1.5}
                            strokeDasharray="6 6"
                        />
                        <line x1="960" y1="540" x2="0" y2="0" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="480" y2="0" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="960" y2="0" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="1440" y2="0" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="1920" y2="0" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="0" y2="1080" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="480" y2="1080" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="960" y2="1080" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="1440" y2="1080" stroke={gridColor} strokeWidth={1} />
                        <line x1="960" y1="540" x2="1920" y2="1080" stroke={gridColor} strokeWidth={1} />
                    </svg>
                )}

                {/* Cinema Safe Zones (Action Safe 90% + Title Safe 80% + Optical Crosshair) */}
                {compositionGrid === 'safe' && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none select-none z-[3] opacity-55"
                        viewBox="0 0 1000 1000"
                        preserveAspectRatio="none"
                        fill="none"
                    >
                        {/* Action Safe 90% */}
                        <rect
                            x="50"
                            y="50"
                            width="900"
                            height="900"
                            stroke={gridColor}
                            strokeWidth="2"
                            strokeDasharray="10 6"
                        />
                        {/* Title Safe 80% */}
                        <rect
                            x="100"
                            y="100"
                            width="800"
                            height="800"
                            stroke={gridColor}
                            strokeWidth="1.5"
                            strokeOpacity="0.65"
                        />
                        {/* Center Crosshair */}
                        <line x1="485" y1="500" x2="515" y2="500" stroke={gridColor} strokeWidth="2.5" />
                        <line x1="500" y1="480" x2="500" y2="520" stroke={gridColor} strokeWidth="2.5" />
                    </svg>
                )}
            </div>
        );
    }
);

DrawingCanvas.displayName = 'DrawingCanvas';
