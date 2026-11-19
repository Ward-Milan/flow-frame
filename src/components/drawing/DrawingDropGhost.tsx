import React from 'react';
import type { DockSlot } from './types';

interface DrawingDropGhostProps {
    slot: DockSlot;
    children: React.ReactNode;
}

export const DrawingDropGhost: React.FC<DrawingDropGhostProps> = ({
    slot,
    children
}) => {
    return (
        <div className="relative pointer-events-none select-none transition-all duration-150">
            {/* Invisible clone of the displaced menu to enforce the EXACT pixel dimensions & shape */}
            <div className="invisible pointer-events-none opacity-0 select-none" aria-hidden="true">
                {children}
            </div>

            {/* Absolute SVG overlay fitting the exact bounding box */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(16,185,129,0.35)]">
                <svg
                    className="w-full h-full absolute inset-0 rounded-2xl overflow-hidden"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern
                            id={`stripe-pattern-${slot}`}
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

                    {/* Diagonal striped translucent fill */}
                    <rect
                        width="100%"
                        height="100%"
                        fill={`url(#stripe-pattern-${slot})`}
                        rx="16"
                    />

                    {/* Animated green dashed border with marching ants */}
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
            </div>
        </div>
    );
};
