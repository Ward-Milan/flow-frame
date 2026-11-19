import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface StrokePoint {
    x: number;
    y: number;
    pressure: number;
    time: number;
}

export interface ToolContext {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    strokeCanvasRef: React.RefObject<HTMLCanvasElement | null>;
    lastPos: React.MutableRefObject<{ x: number; y: number }>;
    pointsRef: React.MutableRefObject<StrokePoint[]>;
    color: string;
    lineWidth: number;
    opacity: number;
    saveSnapshot: () => void;
    offscreenRef?: React.MutableRefObject<HTMLCanvasElement | null>;
    getCoords: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => StrokePoint;
    compositeStrokeCanvas: (alphaMultiplier?: number, blendMode?: GlobalCompositeOperation) => void;
}

export interface ToolDefinition {
    id: string;
    name: string;
    category?: 'sketch' | 'ink' | 'paint' | 'shape';
    description?: string;
    icon: LucideIcon | React.ComponentType<{ size?: number | string; className?: string }>;
    cursor: string;
    onPointerDown: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, context: ToolContext) => void;
    onPointerMove: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, context: ToolContext) => void;
    onPointerUp: (e: React.PointerEvent | React.MouseEvent | React.TouchEvent, context: ToolContext) => void;
}
