import React from 'react';

interface FlowFrameLogoProps {
    className?: string;
}

export const FlowFrameLogo: React.FC<FlowFrameLogoProps> = ({ className = 'w-8 h-8' }) => {
    return (
        <svg
            viewBox="0 0 1024 1024"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="ff-logo-bg" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#14161B" />
                    <stop offset="100%" stopColor="#0F1115" />
                </linearGradient>
                <linearGradient id="ff-logo-green" x1="166" y1="562" x2="824" y2="466" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#34D399" />
                    <stop offset="50%" stopColor="#2DD498" />
                    <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
            </defs>

            {/* Squircle Background Matching FlowFrame App Theme (#14161B -> #0F1115 + #282B37 rim) */}
            <rect width="1024" height="1024" rx="228" fill="url(#ff-logo-bg)" />
            <rect x="18" y="18" width="988" height="988" rx="212" stroke="#282B37" strokeWidth="16" />

            {/* 4 White Viewfinder Corner Brackets */}
            <g fill="#F1F2F0">
                <path d="M 132 326 V 238 A 90 90 0 0 1 222 148 H 340 A 12 12 0 0 1 352 160 V 204 A 12 12 0 0 1 340 216 H 230 A 30 30 0 0 0 200 246 V 326 A 12 12 0 0 1 188 338 H 144 A 12 12 0 0 1 132 326 Z" />
                <path d="M 892 326 V 238 A 90 90 0 0 0 802 148 H 684 A 12 12 0 0 0 672 160 V 204 A 12 12 0 0 0 684 216 H 794 A 30 30 0 0 1 824 246 V 326 A 12 12 0 0 0 836 338 H 880 A 12 12 0 0 0 892 326 Z" />
                <path d="M 132 698 V 786 A 90 90 0 0 0 222 876 H 340 A 12 12 0 0 0 352 864 V 820 A 12 12 0 0 0 340 808 H 230 A 30 30 0 0 1 200 778 V 698 A 12 12 0 0 0 188 686 H 144 A 12 12 0 0 0 132 698 Z" />
                <path d="M 892 698 V 786 A 90 90 0 0 1 802 876 H 684 A 12 12 0 0 1 672 864 V 820 A 12 12 0 0 1 684 808 H 794 A 30 30 0 0 0 824 778 V 698 A 12 12 0 0 1 836 686 H 880 A 12 12 0 0 1 892 698 Z" />
            </g>

            {/* Central Emerald Tilted S-Curve + 3 Keyframe Nodes */}
            <path
                d="M 166 562
                   C 295 405, 545 292, 602 340
                   C 644 375, 550 458, 492 516
                   C 434 574, 344 655, 386 690
                   C 443 738, 695 622, 822 466"
                stroke="url(#ff-logo-green)"
                strokeWidth="56"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="166" cy="562" r="42" fill="#34D399" />
            <circle cx="492" cy="516" r="46" fill="#2DD498" />
            <circle cx="822" cy="466" r="38" fill="#10B981" />
        </svg>
    );
};
