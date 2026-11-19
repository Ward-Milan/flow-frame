import {
    Pen,
    Pencil,
    Paintbrush,
    PaintBucket,
    Highlighter,
    Sparkles,
    Eraser,
    Minus,
    Square,
    Circle,
    ArrowUpRight,
    MoveUpRight,
    Lasso,
    Scan,
    MousePointer2
} from 'lucide-react';
import type { ToolDefinition, ToolContext, StrokePoint } from './types';

export type StoryboardShapeType = 'line' | 'arrow' | 'cameraArrow' | 'zoomFrame' | 'rect' | 'circle';

export interface StoryboardShape {
    id: string;
    type: StoryboardShapeType;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    lineWidth: number;
    opacity: number;
}

// ── Helper: Parse Hex Color to RGB ──────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    const full =
        clean.length === 3
            ? clean
                  .split('')
                  .map(c => c + c)
                  .join('')
            : clean;
    const num = parseInt(full, 16) || 0;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

// ── Helper: Clear & Prepare Wet Stroke Buffer ───────────────────────────────
const resetStrokeBuffer = (strokeCanvas: HTMLCanvasElement | null) => {
    if (!strokeCanvas) return null;
    const sCtx = strokeCanvas.getContext('2d');
    if (!sCtx) return null;
    sCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    return sCtx;
};

// ── 1. MOTEUR CRAYON FUSAIN / GRAPHITE (Grain sec poreux sur papier) ────────
// Pas de ligne continue lisse : uniquement une constellation dense de micro-grains
// de tailles et d'opacités variées pour un vrai rendu crayeux / fusain.
const drawCharcoalPencilSegment = (
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    baseWidth: number,
    color: string
) => {
    const [r, g, b] = hexToRgb(color);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const stepSize = Math.max(0.9, baseWidth * 0.14);
    const steps = Math.max(1, Math.ceil(dist / stepSize));

    const grainCount = Math.max(7, Math.min(24, Math.round(baseWidth * 1.6)));
    const spreadRadius = Math.max(1.8, baseWidth * 0.72);

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = p0.x + dx * t;
        const cy = p0.y + dy * t;

        for (let k = 0; k < grainCount; k++) {
            const s1 = Math.sin((cx + k * 19.1) * 12.9898 + (cy + k * 37.3) * 78.233) * 43758.5453;
            const rand1 = s1 - Math.floor(s1);
            const s2 = Math.sin((cx + k * 53.7) * 93.989 + (cy + k * 11.9) * 47.233) * 29183.123;
            const rand2 = s2 - Math.floor(s2);
            const s3 = Math.sin((cx + k * 71.3) * 41.123 + (cy + k * 23.5) * 19.876) * 17382.912;
            const rand3 = s3 - Math.floor(s3);

            // Distribution concentrée au centre et plus éparse sur les bords (effet mine sèche)
            const angle = rand1 * Math.PI * 2;
            const radialDist = Math.pow(rand2, 0.75) * spreadRadius;
            const gx = cx + Math.cos(angle) * radialDist;
            const gy = cy + Math.sin(angle) * radialDist;

            const falloff = 1 - radialDist / (spreadRadius * 1.15);
            const grainAlpha = Math.max(0.08, Math.min(0.65, falloff * (0.18 + rand3 * 0.45)));
            const grainRadius = Math.max(0.45, Math.min(1.6, baseWidth * (0.06 + rand1 * 0.11)));

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${grainAlpha})`;
            ctx.beginPath();
            ctx.arc(gx, gy, grainRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

// ── 2. MOTEUR STYLO CALIBRÉ (Courbe spline constante et tubulaire) ──────────
const renderConstantSplineOnBuffer = (
    sCtx: CanvasRenderingContext2D,
    points: StrokePoint[],
    color: string,
    baseWidth: number
) => {
    sCtx.clearRect(0, 0, sCtx.canvas.width, sCtx.canvas.height);
    if (points.length === 0) return;

    sCtx.strokeStyle = color;
    sCtx.fillStyle = color;
    sCtx.lineWidth = baseWidth;
    sCtx.lineCap = 'round';
    sCtx.lineJoin = 'round';

    if (points.length === 1) {
        sCtx.beginPath();
        sCtx.arc(points[0].x, points[0].y, baseWidth / 2, 0, Math.PI * 2);
        sCtx.fill();
        return;
    }

    sCtx.beginPath();
    sCtx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) * 0.5;
        const midY = (points[i].y + points[i + 1].y) * 0.5;
        sCtx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }

    const last = points[points.length - 1];
    sCtx.lineTo(last.x, last.y);
    sCtx.stroke();
};

// ── 3. MOTEUR PLUME CALLIGRAPHIQUE (Pleins & Déliés directionnels + Effilage) ─
// Contrairement au Stylo Calibré rond, la Plume Calligraphique utilise une pointe
// elliptique inclinée à -38° dont l'épaisseur varie fortement selon l'angle du geste
// et la vitesse, créant de vrais pleins et déliés expressifs même à la souris.
const drawCalligraphicRibbonSegment = (
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    baseWidth: number,
    color: string,
    strokeLengthIndex: number
) => {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 1.2));

    // Angle fixe de la plume calligraphique (-38°)
    const nibAngle = -Math.PI / 4.7;
    const dt = Math.max(1, p1.time - p0.time);
    const speed = dist / dt;
    // Effilage au démarrage des premiers points + réaction à la vitesse et pression
    const entryTaper = Math.min(1, (strokeLengthIndex + 1) / 5);
    const speedScale = Math.max(0.45, Math.min(1.25, 1.15 - speed * 0.18));
    const pressureScale = 0.55 + p1.pressure * 0.75;

    const majorRadius = Math.max(1.8, baseWidth * 1.15 * entryTaper * speedScale * pressureScale);
    const minorRadius = Math.max(0.5, majorRadius * 0.18);

    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p0.x + dx * t;
        const y = p0.y + dy * t;

        ctx.beginPath();
        ctx.ellipse(x, y, majorRadius, minorRadius, nibAngle, 0, Math.PI * 2);
        ctx.fill();
    }
};

// ── 4. MOTEUR FEUTRE PLAT D'OMBRAGE (Mèche large biseautée) ─────────────────
const drawFlatMarkerSegment = (
    ctx: CanvasRenderingContext2D,
    p0: StrokePoint,
    p1: StrokePoint,
    width: number,
    color: string
) => {
    const nibAngle = -Math.PI / 5.5;
    const halfW = Math.max(6, width * 1.6);
    const halfThickness = Math.max(2, width * 0.24);

    const dx = Math.cos(nibAngle) * halfW;
    const dy = Math.sin(nibAngle) * halfW;
    const nx = -Math.sin(nibAngle) * halfThickness;
    const ny = Math.cos(nibAngle) * halfThickness;

    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const steps = Math.max(1, Math.ceil(dist / 2));

    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = p0.x + (p1.x - p0.x) * t;
        const cy = p0.y + (p1.y - p0.y) * t;

        ctx.beginPath();
        ctx.moveTo(cx - dx - nx, cy - dy - ny);
        ctx.lineTo(cx + dx - nx, cy + dy - ny);
        ctx.lineTo(cx + dx + nx, cy + dy + ny);
        ctx.lineTo(cx - dx + nx, cy - dy + ny);
        ctx.closePath();
        ctx.fill();
    }
};

// ── Flèche d'action personnage / sujet (Détourée blanc + contour contrasté) ──
const drawActionArrow = (
    ctx: CanvasRenderingContext2D,
    fromx: number,
    fromy: number,
    tox: number,
    toy: number,
    lineWidth: number,
    color: string
) => {
    const angle = Math.atan2(toy - fromy, tox - fromx);
    const headlen = Math.max(22, lineWidth * 3.2);
    const bodyWidth = Math.max(6, lineWidth * 1.35);

    const endx = tox - headlen * 0.78 * Math.cos(angle);
    const endy = toy - headlen * 0.78 * Math.sin(angle);

    // 1. Halo externe blanc (pour lisibilité sur traits noirs) + contour noir
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Halo blanc externe
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = bodyWidth + 8;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(endx, endy);
    ctx.stroke();

    // Contour sombre du corps
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = bodyWidth + 3;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(endx, endy);
    ctx.stroke();

    // Pointe de flèche (contour sombre + halo)
    const p1x = tox;
    const p1y = toy;
    const p2x = tox - headlen * Math.cos(angle - Math.PI / 5.5);
    const p2y = toy - headlen * Math.sin(angle - Math.PI / 5.5);
    const p3x = tox - headlen * Math.cos(angle + Math.PI / 5.5);
    const p3y = toy - headlen * Math.sin(angle + Math.PI / 5.5);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3.5;
    ctx.fillStyle = color === '#000000' ? '#FFFFFF' : color;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Remplissage intérieur du corps
    ctx.strokeStyle = color === '#000000' ? '#FFFFFF' : color;
    ctx.lineWidth = bodyWidth - 1;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(endx, endy);
    ctx.stroke();
    ctx.restore();
};

// ── Cadre Caméra de Zoom / Travelling (Coins viseur + flèches directionnelles) ──
const drawCameraZoomFrame = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineWidth: number,
    color: string
) => {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 16 || h < 16) return;

    // Si glissé de gauche à droite => Zoom Avant (flèches vers l'intérieur)
    // Si glissé de droite à gauche => Zoom Arrière (flèches vers l'extérieur)
    const isZoomIn = x2 >= x1;
    const strokeCol = color === '#000000' ? '#10B981' : color;
    const lw = Math.max(2.5, lineWidth * 0.45);

    ctx.save();
    // Rectangle pointillé fin du cadre caméra
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = lw;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(left, top, w, h);
    ctx.setLineDash([]);

    // Équerres épaisses aux 4 coins (viseur cinéma)
    const cornerLen = Math.min(w, h) * 0.2;
    ctx.lineWidth = lw * 1.8;
    ctx.lineCap = 'square';

    // Haut-Gauche
    ctx.beginPath();
    ctx.moveTo(left, top + cornerLen);
    ctx.lineTo(left, top);
    ctx.lineTo(left + cornerLen, top);
    ctx.stroke();
    // Haut-Droite
    ctx.beginPath();
    ctx.moveTo(left + w - cornerLen, top);
    ctx.lineTo(left + w, top);
    ctx.lineTo(left + w, top + cornerLen);
    ctx.stroke();
    // Bas-Gauche
    ctx.beginPath();
    ctx.moveTo(left, top + h - cornerLen);
    ctx.lineTo(left, top + h);
    ctx.lineTo(left + cornerLen, top + h);
    ctx.stroke();
    // Bas-Droite
    ctx.beginPath();
    ctx.moveTo(left + w - cornerLen, top + h);
    ctx.lineTo(left + w, top + h);
    ctx.lineTo(left + w, top + h - cornerLen);
    ctx.stroke();

    // Mire centrale discrète (+)
    const cx = left + w / 2;
    const cy = top + h / 2;
    ctx.lineWidth = Math.max(1.5, lw * 0.7);
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // 4 Flèches diagonales aux coins indiquant le Zoom In ou Zoom Out
    const arrowLen = Math.min(55, Math.max(24, Math.min(w, h) * 0.22));
    const corners = [
        { x: left, y: top, dx: -1, dy: -1 },
        { x: left + w, y: top, dx: 1, dy: -1 },
        { x: left, y: top + h, dx: -1, dy: 1 },
        { x: left + w, y: top + h, dx: 1, dy: 1 }
    ];

    corners.forEach(c => {
        const ox = c.x + c.dx * (arrowLen * 0.85);
        const oy = c.y + c.dy * (arrowLen * 0.85);
        if (isZoomIn) {
            // De l'extérieur vers le coin du cadre
            drawActionArrow(ctx, ox, oy, c.x, c.y, Math.max(3, lw * 0.9), strokeCol);
        } else {
            // Du coin du cadre vers l'extérieur
            drawActionArrow(ctx, c.x, c.y, ox, oy, Math.max(3, lw * 0.9), strokeCol);
        }
    });

    ctx.restore();
};

// ── Flèche 3D mouvement caméra (Double trait cinéma) ───────────────────────
const drawCameraArrow = (
    ctx: CanvasRenderingContext2D,
    fromx: number,
    fromy: number,
    tox: number,
    toy: number,
    lineWidth: number,
    color: string
) => {
    const angle = Math.atan2(toy - fromy, tox - fromx);
    const headlen = Math.max(24, lineWidth * 3.6);

    const outerEndx = tox - headlen * 0.8 * Math.cos(angle);
    const outerEndy = toy - headlen * 0.8 * Math.sin(angle);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(outerEndx, outerEndy);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(
        tox - headlen * Math.cos(angle - Math.PI / 5),
        toy - headlen * Math.sin(angle - Math.PI / 5)
    );
    ctx.lineTo(
        tox - headlen * Math.cos(angle + Math.PI / 5),
        toy - headlen * Math.sin(angle + Math.PI / 5)
    );
    ctx.closePath();
    ctx.fill();

    const innerHeadLen = headlen - lineWidth * 0.5;
    const innerEndx = tox - innerHeadLen * 0.8 * Math.cos(angle);
    const innerEndy = toy - innerHeadLen * 0.8 * Math.sin(angle);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = lineWidth * 0.8;

    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(innerEndx, innerEndy);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    const innerHeadOffset = lineWidth * 0.3;
    ctx.beginPath();
    ctx.moveTo(
        tox - innerHeadOffset * Math.cos(angle),
        toy - innerHeadOffset * Math.sin(angle)
    );
    ctx.lineTo(
        tox - innerHeadLen * Math.cos(angle - Math.PI / 5.2),
        toy - innerHeadLen * Math.sin(angle - Math.PI / 5.2)
    );
    ctx.lineTo(
        tox - innerHeadLen * Math.cos(angle + Math.PI / 5.2),
        toy - innerHeadLen * Math.sin(angle + Math.PI / 5.2)
    );
    ctx.closePath();
    ctx.fill();
};

// ═════════════════════════════════════════════════════════════════════════════
// DÉFINITION DES OUTILS FLOW FRAME (Chacun avec un rendu visuel unique)
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. CRAYON FUSAIN / ESQUISSE (Texture sèche granuleuse) ──────────────────
export const pencilTool: ToolDefinition = {
    id: 'pencil',
    name: 'Crayon Fusain',
    category: 'sketch',
    description: 'Mine sèche à grain papier poreux pour le croquis et les esquisses',
    icon: Pencil,
    cursor: 'crosshair',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, color, lineWidth, compositeStrokeCanvas, opacity }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        drawCharcoalPencilSegment(sCtx, pt, pt, Math.max(2.5, lineWidth * 1.15), color);
        compositeStrokeCanvas(0.85 * opacity);
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, color, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const pt = getCoords(e);
        const prev = pointsRef.current[pointsRef.current.length - 1] || {
            ...lastPos.current,
            pressure: 0.5,
            time: Date.now()
        };
        pointsRef.current.push(pt);

        const dynamicW = Math.max(2.2, lineWidth * 1.15 * (0.65 + pt.pressure * 0.55));
        drawCharcoalPencilSegment(sCtx, prev, pt, dynamicW, color);
        lastPos.current = { x: pt.x, y: pt.y };

        compositeStrokeCanvas(0.85 * opacity);
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 2. STYLO CALIBRÉ (Trait d'encre rond, lisse et d'épaisseur fixe) ────────
export const penTool: ToolDefinition = {
    id: 'pen',
    name: 'Stylo Calibré',
    category: 'ink',
    description: 'Trait d\'encre tubulaire ultra-net à épaisseur constante',
    icon: Pen,
    cursor: 'crosshair',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, color, lineWidth, opacity, compositeStrokeCanvas }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        renderConstantSplineOnBuffer(sCtx, pointsRef.current, color, lineWidth);
        compositeStrokeCanvas(opacity);
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, color, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const rawPt = getCoords(e);
        const prev = pointsRef.current[pointsRef.current.length - 1];

        const smoothedPt: StrokePoint = prev
            ? {
                  x: prev.x * 0.28 + rawPt.x * 0.72,
                  y: prev.y * 0.28 + rawPt.y * 0.72,
                  pressure: rawPt.pressure,
                  time: rawPt.time
              }
            : rawPt;

        pointsRef.current.push(smoothedPt);
        lastPos.current = { x: smoothedPt.x, y: smoothedPt.y };

        renderConstantSplineOnBuffer(sCtx, pointsRef.current, color, lineWidth);
        compositeStrokeCanvas(opacity);
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 3. PLUME CALLIGRAPHIQUE (Pleins et déliés expressifs) ───────────────────
export const brushTool: ToolDefinition = {
    id: 'brush',
    name: 'Plume Calligraphique',
    category: 'ink',
    description: 'Plume d\'encrage biseautée créant de vrais pleins et déliés selon l\'angle du trait',
    icon: Paintbrush,
    cursor: 'crosshair',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, color, lineWidth, opacity, compositeStrokeCanvas }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        drawCalligraphicRibbonSegment(sCtx, pt, pt, lineWidth, color, 0);
        compositeStrokeCanvas(opacity);
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, color, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const rawPt = getCoords(e);
        const prev = pointsRef.current[pointsRef.current.length - 1] || {
            ...lastPos.current,
            pressure: 0.5,
            time: Date.now()
        };

        const pt: StrokePoint = {
            x: prev.x * 0.25 + rawPt.x * 0.75,
            y: prev.y * 0.25 + rawPt.y * 0.75,
            pressure: prev.pressure * 0.35 + rawPt.pressure * 0.65,
            time: rawPt.time
        };

        pointsRef.current.push(pt);
        drawCalligraphicRibbonSegment(sCtx, prev, pt, lineWidth, color, pointsRef.current.length);
        lastPos.current = { x: pt.x, y: pt.y };

        compositeStrokeCanvas(opacity);
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 4. FEUTRE D'OMBRAGE (Aplat biseauté uniforme en produit) ────────────────
export const highlighterTool: ToolDefinition = {
    id: 'highlighter',
    name: 'Feutre d\'Ombrage',
    category: 'paint',
    description: 'Mèche large biseautée posant les valeurs d\'ombre sans masquer l\'encrage',
    icon: Highlighter,
    cursor: 'crosshair',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, color, lineWidth, opacity, compositeStrokeCanvas }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        drawFlatMarkerSegment(sCtx, pt, pt, lineWidth * 1.8, color);
        compositeStrokeCanvas(0.32 * opacity, 'multiply');
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, color, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const pt = getCoords(e);
        const prev = pointsRef.current[pointsRef.current.length - 1] || {
            ...lastPos.current,
            pressure: 0.5,
            time: Date.now()
        };
        pointsRef.current.push(pt);

        drawFlatMarkerSegment(sCtx, prev, pt, lineWidth * 1.8, color);
        lastPos.current = { x: pt.x, y: pt.y };

        compositeStrokeCanvas(0.32 * opacity, 'multiply');
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 5. AÉROGRAPHE (Diffusion vaporeuse pour lumière & atmosphère) ───────────
export const airbrushTool: ToolDefinition = {
    id: 'airbrush',
    name: 'Aérographe',
    category: 'paint',
    description: 'Diffusion radiale douce pour dégradés, halos lumineux et profondeur',
    icon: Sparkles,
    cursor: 'crosshair',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, color, lineWidth, opacity, compositeStrokeCanvas }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        const radius = Math.max(14, lineWidth * 3.5);
        const [r, g, b] = hexToRgb(color);
        const grad = sCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        sCtx.fill();

        compositeStrokeCanvas(opacity);
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, color, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const pt = getCoords(e);
        const prev = pointsRef.current[pointsRef.current.length - 1] || {
            ...lastPos.current,
            pressure: 0.5,
            time: Date.now()
        };
        pointsRef.current.push(pt);

        const radius = Math.max(14, lineWidth * 3.5 * (0.7 + pt.pressure * 0.5));
        const [r, g, b] = hexToRgb(color);
        const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        const step = Math.max(3, radius * 0.2);
        const steps = Math.max(1, Math.ceil(dist / step));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const cx = prev.x + (pt.x - prev.x) * t;
            const cy = prev.y + (pt.y - prev.y) * t;
            const grad = sCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.16)`);
            grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.06)`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            sCtx.fillStyle = grad;
            sCtx.beginPath();
            sCtx.arc(cx, cy, radius, 0, Math.PI * 2);
            sCtx.fill();
        }

        lastPos.current = { x: pt.x, y: pt.y };
        compositeStrokeCanvas(opacity);
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 6. GOMME ───────────────────────────────────────────────────────────────
export const eraserTool: ToolDefinition = {
    id: 'eraser',
    name: 'Gomme',
    category: 'ink',
    description: 'Gomme douce avec contrôle de taille et d\'opacité',
    icon: Eraser,
    cursor: 'cell',
    onPointerDown: (e, { strokeCanvasRef, lastPos, pointsRef, getCoords, lineWidth, opacity, compositeStrokeCanvas }) => {
        const sCtx = resetStrokeBuffer(strokeCanvasRef.current);
        if (!sCtx) return;
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
        pointsRef.current = [pt];

        renderConstantSplineOnBuffer(sCtx, pointsRef.current, '#FFFFFF', lineWidth * 1.6);
        compositeStrokeCanvas(opacity);
    },
    onPointerMove: (e, { strokeCanvasRef, lastPos, pointsRef, lineWidth, opacity, getCoords, compositeStrokeCanvas }) => {
        const sCtx = strokeCanvasRef.current?.getContext('2d');
        if (!sCtx) return;

        const pt = getCoords(e);
        pointsRef.current.push(pt);
        lastPos.current = { x: pt.x, y: pt.y };

        renderConstantSplineOnBuffer(sCtx, pointsRef.current, '#FFFFFF', lineWidth * 1.6);
        compositeStrokeCanvas(opacity);
    },
    onPointerUp: (_e, { strokeCanvasRef, saveSnapshot }) => {
        resetStrokeBuffer(strokeCanvasRef.current);
        saveSnapshot();
    }
};

// ── 7. LIGNE DROITE ────────────────────────────────────────────────────────
export const lineTool: ToolDefinition = {
    id: 'line',
    name: 'Ligne Droite',
    category: 'shape',
    icon: Minus,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 8. RECTANGLE / CADRE ───────────────────────────────────────────────────
export const rectTool: ToolDefinition = {
    id: 'rect',
    name: 'Cadre Rectangle',
    category: 'shape',
    icon: Square,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.strokeRect(
            lastPos.current.x,
            lastPos.current.y,
            x - lastPos.current.x,
            y - lastPos.current.y
        );
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 9. CERCLE ──────────────────────────────────────────────────────────────
export const circleTool: ToolDefinition = {
    id: 'circle',
    name: 'Cercle',
    category: 'shape',
    icon: Circle,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        const radius = Math.hypot(x - lastPos.current.x, y - lastPos.current.y);
        ctx.beginPath();
        ctx.arc(lastPos.current.x, lastPos.current.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 10. FLÈCHE ACTION SUJET ────────────────────────────────────────────────
export const actionArrowTool: ToolDefinition = {
    id: 'arrow',
    name: 'Flèche Action Sujet',
    category: 'shape',
    icon: ArrowUpRight,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);
        ctx.globalAlpha = opacity;
        drawActionArrow(ctx, lastPos.current.x, lastPos.current.y, x, y, lineWidth, color);
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 11. FLÈCHE MOUVEMENT CAMÉRA ────────────────────────────────────────────
export const cameraArrowTool: ToolDefinition = {
    id: 'cameraArrow',
    name: 'Flèche Mouvement Caméra',
    category: 'shape',
    icon: MoveUpRight,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);
        ctx.globalAlpha = opacity;
        drawCameraArrow(ctx, lastPos.current.x, lastPos.current.y, x, y, lineWidth, color);
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 12. POT DE PEINTURE (Remplissage de zone fermée) ───────────────────────
export const fillTool: ToolDefinition = {
    id: 'fill',
    name: 'Pot de Peinture',
    category: 'paint',
    description: 'Remplit instantanément une zone fermée en un clic',
    icon: PaintBucket,
    cursor: 'crosshair',
    onPointerDown: (e, { canvasRef, color, opacity, saveSnapshot, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        const startX = Math.floor(x);
        const startY = Math.floor(y);
        const width = canvas.width;
        const height = canvas.height;
        if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const [fillR, fillG, fillB] = hexToRgb(color);

        const startIdx = (startY * width + startX) * 4;
        const targetR = data[startIdx];
        const targetG = data[startIdx + 1];
        const targetB = data[startIdx + 2];
        const targetA = data[startIdx + 3];

        if (
            Math.abs(targetR - fillR) < 5 &&
            Math.abs(targetG - fillG) < 5 &&
            Math.abs(targetB - fillB) < 5 &&
            targetA > 240
        ) {
            return;
        }

        const tolerance = 46;
        const matchesTarget = (idx: number) => {
            return (
                Math.abs(data[idx] - targetR) <= tolerance &&
                Math.abs(data[idx + 1] - targetG) <= tolerance &&
                Math.abs(data[idx + 2] - targetB) <= tolerance &&
                Math.abs(data[idx + 3] - targetA) <= tolerance
            );
        };

        const blendPixel = (pIdx: number) => {
            data[pIdx] = Math.round(data[pIdx] * (1 - opacity) + fillR * opacity);
            data[pIdx + 1] = Math.round(data[pIdx + 1] * (1 - opacity) + fillG * opacity);
            data[pIdx + 2] = Math.round(data[pIdx + 2] * (1 - opacity) + fillB * opacity);
            data[pIdx + 3] = 255;
        };

        const visited = new Uint8Array(width * height);
        const stack: number[] = [startX, startY];

        while (stack.length > 0) {
            const cy = stack.pop()!;
            const cx = stack.pop()!;
            let lx = cx;

            while (lx >= 0 && !visited[cy * width + lx] && matchesTarget((cy * width + lx) * 4)) {
                lx--;
            }
            lx++;

            let rx = cx;
            while (rx < width && !visited[cy * width + rx] && matchesTarget((cy * width + rx) * 4)) {
                rx++;
            }
            rx--;

            let spanAbove = false;
            let spanBelow = false;

            for (let ix = lx; ix <= rx; ix++) {
                const pIdx = (cy * width + ix) * 4;
                blendPixel(pIdx);
                visited[cy * width + ix] = 1;

                if (cy > 0) {
                    const aboveMatch =
                        !visited[(cy - 1) * width + ix] &&
                        matchesTarget(((cy - 1) * width + ix) * 4);
                    if (!spanAbove && aboveMatch) {
                        stack.push(ix, cy - 1);
                        spanAbove = true;
                    } else if (spanAbove && !aboveMatch) {
                        spanAbove = false;
                    }
                }

                if (cy < height - 1) {
                    const belowMatch =
                        !visited[(cy + 1) * width + ix] &&
                        matchesTarget(((cy + 1) * width + ix) * 4);
                    if (!spanBelow && belowMatch) {
                        stack.push(ix, cy + 1);
                        spanBelow = true;
                    } else if (spanBelow && !belowMatch) {
                        spanBelow = false;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        saveSnapshot();
    },
    onPointerMove: () => {},
    onPointerUp: () => {}
};

// ── 13. CADRE CAMÉRA (Zoom Avant / Arrière & Recadrage) ────────────────────
export const zoomFrameTool: ToolDefinition = {
    id: 'zoomFrame',
    name: 'Cadre Caméra (Zoom / Trav)',
    category: 'shape',
    description: 'Glisser gauche→droite pour un Zoom Avant, ou droite→gauche pour un Zoom Arrière',
    icon: Scan,
    cursor: 'crosshair',
    onPointerDown: (e, { lastPos, getCoords }) => {
        const pt = getCoords(e);
        lastPos.current = { x: pt.x, y: pt.y };
    },
    onPointerMove: (e, { canvasRef, lastPos, color, lineWidth, opacity, offscreenRef, getCoords }) => {
        const canvas = canvasRef.current;
        if (!canvas || !offscreenRef?.current) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offscreenRef.current, 0, 0);
        ctx.globalAlpha = opacity;
        drawCameraZoomFrame(ctx, lastPos.current.x, lastPos.current.y, x, y, lineWidth, color);
        ctx.globalAlpha = 1.0;
    },
    onPointerUp: (_e, { saveSnapshot }) => {
        saveSnapshot();
    }
};

// ── 14. LASSO & TRANSFORMATION LIBRE ───────────────────────────────────────
export const lassoTool: ToolDefinition = {
    id: 'lasso',
    name: 'Lasso & Transformation',
    category: 'shape',
    description: 'Entourer une zone du dessin pour la déplacer, la redimensionner, la pivoter ou la dupliquer',
    icon: Lasso,
    cursor: 'crosshair',
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {}
};

// ── 15. OUTIL SOURIS (Curseur neutre & Modification des flèches / cadres) ──
export const selectTool: ToolDefinition = {
    id: 'select',
    name: 'Outil Souris (Sélection)',
    category: 'shape',
    description: 'Curseur neutre permettant de sélectionner, déplacer et modifier vos flèches et cadres d\'action',
    icon: MousePointer2,
    cursor: 'default',
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {}
};

// ── Rendu vectoriel d'une forme / flèche / cadre sur le canevas ────────────
export const renderStoryboardShape = (ctx: CanvasRenderingContext2D, s: StoryboardShape) => {
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (s.type) {
        case 'line':
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
            break;
        case 'arrow':
            drawActionArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.lineWidth, s.color);
            break;
        case 'cameraArrow':
            drawCameraArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.lineWidth, s.color);
            break;
        case 'zoomFrame':
            drawCameraZoomFrame(ctx, s.x1, s.y1, s.x2, s.y2, s.lineWidth, s.color);
            break;
        case 'rect':
            ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
            break;
        case 'circle': {
            const radius = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
            ctx.beginPath();
            ctx.arc(s.x1, s.y1, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
    }
    ctx.restore();
};

// ── Hit-test précis pour cliquer sur une flèche, une ligne ou un cadre ─────
const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
};

export const hitTestStoryboardShape = (s: StoryboardShape, px: number, py: number): boolean => {
    const hitTolerance = Math.max(24, s.lineWidth * 2.2);

    if (s.type === 'line' || s.type === 'arrow' || s.type === 'cameraArrow') {
        return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) <= hitTolerance;
    }

    if (s.type === 'zoomFrame' || s.type === 'rect') {
        const left = Math.min(s.x1, s.x2) - hitTolerance;
        const right = Math.max(s.x1, s.x2) + hitTolerance;
        const top = Math.min(s.y1, s.y2) - hitTolerance;
        const bottom = Math.max(s.y1, s.y2) + hitTolerance;
        // On peut cliquer à l'intérieur ou sur les bords du cadre
        return px >= left && px <= right && py >= top && py <= bottom;
    }

    if (s.type === 'circle') {
        const radius = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        const dist = Math.hypot(px - s.x1, py - s.y1);
        return Math.abs(dist - radius) <= hitTolerance || dist <= radius;
    }

    return false;
};

export const toolsRegistry: Record<string, ToolDefinition> = {
    select: selectTool,
    lasso: lassoTool,
    pencil: pencilTool,
    sketch: pencilTool, // alias rétro-compatible
    pen: penTool,
    brush: brushTool,
    highlighter: highlighterTool,
    marker: highlighterTool,
    airbrush: airbrushTool,
    fill: fillTool,
    eraser: eraserTool,
    line: lineTool,
    rect: rectTool,
    circle: circleTool,
    arrow: actionArrowTool,
    cameraArrow: cameraArrowTool,
    zoomFrame: zoomFrameTool
};
