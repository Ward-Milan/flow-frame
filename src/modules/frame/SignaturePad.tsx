
import { useState, useRef } from 'react';

export const SignaturePad = ({ onSave }: { onSave: (data: string) => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDraw = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    }
    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const rect = canvas?.getBoundingClientRect();
        if (ctx && rect) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            ctx.lineTo(clientX - rect.left, clientY - rect.top);
            ctx.stroke();
        }
    }
    const stopDraw = () => {
        setIsDrawing(false);
        if (canvasRef.current) onSave(canvasRef.current.toDataURL());
    }

    return (
        <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="w-full h-32 bg-white border border-[var(--border-color)] rounded cursor-crosshair"
            onMouseDown={startDraw}
            onTouchStart={startDraw}
            onMouseMove={draw}
            onTouchMove={draw}
            onMouseUp={stopDraw}
            onTouchEnd={stopDraw}
            onMouseLeave={stopDraw}
        />
    )
};
