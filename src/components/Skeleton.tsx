/**
 * Skeleton - Composants de chargement animés
 * Remplace les textes "Chargement..." par des placeholders visuels
 */

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'card';
    width?: string | number;
    height?: string | number;
    count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'text',
    width,
    height,
    count = 1
}) => {
    const baseClass = 'animate-pulse bg-gradient-to-r from-[var(--bg-element)] via-[var(--bg-panel)] to-[var(--bg-element)] bg-[length:200%_100%]';

    const variantClasses = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
        card: 'rounded-xl'
    };

    const style: React.CSSProperties = {
        width: width || (variant === 'circular' ? 40 : '100%'),
        height: height || (variant === 'circular' ? 40 : variant === 'text' ? 16 : 100),
        animationDuration: '1.5s',
    };

    if (count > 1) {
        return (
            <div className="space-y-2">
                {Array.from({ length: count }).map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClass} ${variantClasses[variant]} ${className}`}
                        style={{ ...style, width: i === count - 1 ? '60%' : style.width }}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`${baseClass} ${variantClasses[variant]} ${className}`}
            style={style}
        />
    );
};

// Pre-built skeleton patterns
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`p-4 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl ${className}`}>
        <div className="flex items-start gap-3">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
            </div>
        </div>
        <div className="mt-4 space-y-2">
            <Skeleton variant="text" />
            <Skeleton variant="text" width="80%" />
        </div>
    </div>
);

export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({ count = 5, className = '' }) => (
    <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-[var(--bg-panel)] rounded-lg border border-[var(--border-color)]">
                <Skeleton variant="circular" width={32} height={32} />
                <div className="flex-1">
                    <Skeleton variant="text" width={`${70 + Math.random() * 30}%`} />
                </div>
            </div>
        ))}
    </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
    <div className="space-y-2">
        <div className="flex gap-4 p-3 bg-[var(--bg-element)] rounded-lg">
            {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={i} variant="text" width={`${100 / cols}%`} />
            ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 border-b border-[var(--border-color)]">
                {Array.from({ length: cols }).map((_, j) => (
                    <Skeleton key={j} variant="text" width={`${100 / cols}%`} />
                ))}
            </div>
        ))}
    </div>
);

export const SkeletonModule: React.FC = () => (
    <div className="h-full w-full p-6 bg-[var(--bg-app)]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
                <Skeleton variant="text" width={200} height={28} />
                <Skeleton variant="text" width={150} height={14} />
            </div>
            <Skeleton variant="rectangular" width={120} height={36} />
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="p-4 bg-[var(--bg-panel)] rounded-xl border border-[var(--border-color)]">
                    <Skeleton variant="text" width={60} height={32} />
                    <Skeleton variant="text" width={80} height={12} className="mt-2" />
                </div>
            ))}
        </div>
        
        {/* Content */}
        <SkeletonList count={4} />
    </div>
);
