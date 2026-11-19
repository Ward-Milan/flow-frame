/**
 * Shared Form UI Components
 * Centralized Button, Input, TextArea components for consistent styling across modules
 */

import React, { useEffect, useRef } from 'react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: ButtonVariant;
    className?: string;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    className?: string;
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    className?: string;
}

// ─── BUTTON ──────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-pink-600 text-white shadow-[0_0_15px_rgba(219,39,119,0.3)] hover:bg-pink-500 border border-white/10",
    secondary: "bg-[var(--bg-panel)] text-[var(--text-primary)] hover:bg-[var(--bg-element)] border border-[var(--border-color)]",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    success: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]",
    icon: "p-2 hover:bg-white/10 rounded-full text-[var(--text-primary)]"
};

export const Button = React.memo<ButtonProps>(({ 
    children, 
    onClick, 
    variant = 'primary', 
    className = '', 
    ...props 
}) => {
    const base = "px-3 py-1.5 rounded-md text-sm font-black tracking-widest transition-all focus:outline-none active:scale-95 flex items-center gap-2 justify-center";
    return (
        <button 
            onClick={onClick} 
            className={`${base} ${BUTTON_VARIANTS[variant]} ${className}`} 
            {...props}
        >
            {children}
        </button>
    );
});

Button.displayName = 'Button';

// ─── INPUT ───────────────────────────────────────────────────────────────────

export const Input = React.memo<InputProps>(({ label, className = '', ...props }) => (
    <div className="flex flex-col gap-1.5 mb-2 w-full">
        {label && (
            <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-black">
                {label}
            </label>
        )}
        <input
            className={`bg-[var(--bg-secondary-panel)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:glow-pink transition-all placeholder-[var(--text-muted)] ${className}`}
            {...props}
        />
    </div>
));

Input.displayName = 'Input';

// ─── TEXTAREA ────────────────────────────────────────────────────────────────

export const TextArea: React.FC<TextAreaProps> = ({ label, className = '', value, onInput, ...props }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
        onInput?.(e as any);
    };

    return (
        <div className="flex flex-col gap-1.5 mb-4">
            {label && (
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-black">
                    {label}
                </label>
            )}
            <textarea
                ref={textareaRef}
                rows={2}
                value={value}
                className={`bg-[var(--bg-secondary-panel)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:glow-pink transition-all placeholder-[var(--text-muted)] resize-none min-h-[80px] ${className}`}
                onInput={handleInput}
                {...props}
            />
        </div>
    );
};

// ─── IMAGE SELECTOR UTILITY ──────────────────────────────────────────────────

export const selectImage = (onSelect: (base64: string) => void): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (evt.target?.result) {
                onSelect(evt.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
};
