/**
 * AboutModal - Modal "À propos" avec informations sur l'application
 */

import { X, Github, Mail, Heart, ExternalLink, Sparkles } from 'lucide-react';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors z-10"
                >
                    <X size={18} />
                </button>

                {/* Header with logo */}
                <div className="relative pt-8 pb-4 px-6 text-center bg-gradient-to-b from-amber-500/10 to-transparent">
                    {/* Logo */}
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-[#111] rounded-2xl border border-[var(--border-color)] shadow-lg">
                            <img src="/logo.png" alt="Flow Frame" className="w-16 h-16 object-contain" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-black text-[var(--text-primary)]">
                        Flow Frame
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-1">
                        Production Toolkit
                    </p>
                    <p className="mt-1 text-sm text-amber-500 font-bold">
                        Version 1.0.1
                    </p>
                </div>

                {/* Content */}
                <div className="pb-6 px-6 text-center">
                    {/* Description */}
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        Une suite d'outils tout-en-un pour la préproduction et production audiovisuelle. Gérez vos projets, planifiez vos tournages, créez vos plans de feu.
                    </p>

                    {/* Features list */}
                    <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-[var(--bg-element)] text-[var(--text-secondary)]">
                            🎬 Réal (Brainstorm, Dev)
                        </div>
                        <div className="p-2 rounded-lg bg-[var(--bg-element)] text-[var(--text-secondary)]">
                            🎀 Prod (Matériel, Légal, Planning)
                        </div>
                        <div className="p-2 rounded-lg bg-[var(--bg-element)] text-[var(--text-secondary)]">
                            💡 Plans de feu
                        </div>
                        <div className="p-2 rounded-lg bg-[var(--bg-element)] text-[var(--text-secondary)]">
                            📁 Coffre documents
                        </div>
                    </div>

                    {/* Tech stack */}
                    <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                            Construit avec
                        </p>
                        <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-[var(--text-secondary)]">
                            <span className="px-2 py-1 rounded bg-[var(--bg-element)]">React</span>
                            <span className="px-2 py-1 rounded bg-[var(--bg-element)]">TypeScript</span>
                            <span className="px-2 py-1 rounded bg-[var(--bg-element)]">Tauri</span>
                            <span className="px-2 py-1 rounded bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles size={10} className="text-purple-400" />
                                Assistance IA
                            </span>
                        </div>
                    </div>

                    {/* Credits */}
                    <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                        <p className="text-sm text-[var(--text-secondary)] flex items-center justify-center gap-1">
                            Fait par un créateur <Heart size={14} className="text-red-400" fill="currentColor" /> pour les créateurs
                        </p>
                    </div>

                    {/* Links */}
                    <div className="mt-4 flex items-center justify-center gap-4">
                        <button className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-element)] transition-colors">
                            <Github size={18} />
                        </button>
                        <button className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-element)] transition-colors">
                            <Mail size={18} />
                        </button>
                        <button className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-element)] transition-colors">
                            <ExternalLink size={18} />
                        </button>
                    </div>

                    {/* Copyright */}
                    <p className="mt-6 text-[10px] text-[var(--text-secondary)]/50">
                        © {new Date().getFullYear()} Flow Frame. Tous droits réservés.
                    </p>
                </div>
            </div>
        </div>
    );
}
