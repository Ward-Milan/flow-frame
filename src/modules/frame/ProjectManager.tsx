import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Trash2, Edit2, Folder, Monitor, Download, Share2, Settings, Moon, Sun } from 'lucide-react';
import { useToast } from '../../shared';
import type { Project } from './types';

interface ProjectManagerProps {
    projects: Project[];
    activeProjectId: string | null;
    onCreateProject: () => void;
    onOpenProject: (id: string) => void;
    onDeleteProject: (e: React.MouseEvent, id: string) => void;
    onRenameProject: (id: string, newTitle: string) => void;
    onExportProject: (id: string) => void;
    onShareProject: (id: string) => void;
    onImportProject: (data: any) => void; // Added for drop zone
    theme: 'dark' | 'light';
    toggleTheme: () => void;
}

export const ProjectManager = ({
    projects,
    activeProjectId,
    onCreateProject,
    onOpenProject,
    onDeleteProject,
    onRenameProject,
    onExportProject,
    onShareProject,
    onImportProject,
    theme,
    toggleTheme
}: ProjectManagerProps) => {
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [showSettings, setShowSettings] = useState(false);

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ id, x: e.clientX, y: e.clientY });
    };

    const touchTimerRef = useRef<number | null>(null);

    const handleTouchContextStart = (e: React.TouchEvent, id: string) => {
        e.stopPropagation();
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        // start a long-press timer (600ms)
        touchTimerRef.current = window.setTimeout(() => {
            setContextMenu({ id, x: touch.clientX, y: touch.clientY });
        }, 600);
    };

    const clearTouchContext = () => {
        if (touchTimerRef.current) {
            window.clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => clearTouchContext();
    }, []);

    const startRenaming = (project: Project) => {
        setRenamingId(project.id);
        setRenameValue(project.title);
        setContextMenu(null);
    };

    const submitRename = () => {
        if (renamingId && renameValue.trim()) {
            onRenameProject(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-element)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent)] selection:text-white" onClick={() => { setContextMenu(null); setShowSettings(false); }}>
            {/* HEADER */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--bg-panel)]">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 font-bold text-lg">
                        <Monitor size={20} className="text-[var(--accent)]" />
                        <span style={{ color: 'var(--text-primary)' }}>Local Database</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] w-64 transition-all text-[var(--text-primary)]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* SIDEBAR (Libraries) */}
                <div className="w-64 bg-[var(--bg-panel)] border-r border-[var(--border-color)] flex flex-col p-4 gap-2">
                    <div className="flex items-center gap-2 p-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded border border-[var(--accent)]/20 cursor-pointer">
                        <Folder size={16} fill="currentColor" />
                        <span className="text-sm font-bold">Projets</span>
                        <span className="ml-auto text-xs opacity-70">{projects.length}</span>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                        {/* SETTINGS BUTTON (Replaces Archives roughly in position) */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                                className="w-full flex items-center gap-2 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-element)] rounded cursor-pointer transition-colors"
                            >
                                <Settings size={16} />
                                <span className="text-sm font-medium">Paramètres</span>
                            </button>

                            {/* SETTINGS POPOVER */}
                            {showSettings && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg shadow-xl p-2 z-50">
                                    <button
                                        onClick={toggleTheme}
                                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-app)] text-[var(--text-primary)] text-sm transition-colors"
                                    >
                                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                                        <span>Mode {theme === 'dark' ? 'Clair' : 'Sombre'}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-[var(--border-color)]">
                            <button onClick={onCreateProject} className="w-full py-2 bg-[var(--bg-element)] hover:bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-primary)] rounded text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                                <Plus size={16} /> Nouveau Projet
                            </button>
                        </div>
                    </div>
                </div>

                {/* PROJECT GRID */}
                <div className="flex-1 bg-[var(--bg-element)] p-8 overflow-y-auto">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8 content-start">

                        {/* NEW PROJECT CARD (Alternative trigger) */}
                        <div
                            onClick={onCreateProject}
                            className="aspect-video border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 cursor-pointer transition-all group"
                        >
                            <Plus size={48} className="mb-2 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm uppercase tracking-wider">Créer un projet</span>
                        </div>

                        {filteredProjects.map(project => (
                            <div
                                key={project.id}
                                onDoubleClick={() => onOpenProject(project.id)}
                                onContextMenu={(e) => handleContextMenu(e, project.id)}
                                onTouchStart={(e) => handleTouchContextStart(e, project.id)}
                                onTouchEnd={clearTouchContext}
                                onTouchMove={clearTouchContext}
                                className="group flex flex-col gap-2 cursor-pointer"
                            >
                                {/* THUMBNAIL */}
                                <div className={`aspect-video bg-[var(--bg-app)] rounded-lg border border-[var(--border-color)] relative overflow-hidden transition-all shadow-lg group-hover:shadow-2xl group-hover:border-[var(--accent)]/50 ${activeProjectId === project.id ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                                    {/* Gradient Thumbnail Placeholder */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--border-color)] to-[var(--bg-panel)] group-hover:brightness-110 transition-all flex items-center justify-center">
                                        {/* If we had a cover image, we would show it here. For now, logo or generic */}
                                        <div className="text-[var(--accent)] font-bold text-4xl opacity-20 select-none">Fs</div>
                                    </div>
                                    <div
                                        className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors cursor-pointer opacity-0 group-hover:opacity-100 bg-black/50"
                                        onClick={() => document.getElementById('import-project')?.click()}
                                        onDragOver={(e: React.DragEvent) => e.preventDefault()}
                                        onDrop={(e: React.DragEvent) => {
                                            e.preventDefault();
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    try {
                                                        const json = JSON.parse(event.target?.result as string);
                                                        onImportProject(json);
                                                    } catch (err) {
                                                        console.error("Failed to parse JSON", err);
                                                        toast.error("Fichier invalide");
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }
                                        }}
                                    >
                                        <Download size={24} className="mb-2" />
                                        <span className="text-sm font-bold">Importer JSON</span>
                                        <input type="file" id="import-project" className="hidden" accept=".json" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (event) => {
                                                    try {
                                                        const json = JSON.parse(event.target?.result as string);
                                                        onImportProject(json);
                                                    } catch (err) {
                                                        console.error("Failed to parse JSON", err);
                                                        toast.error("Fichier invalide");
                                                    }
                                                };
                                                reader.readAsText(file);
                                            }
                                        }} />
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white font-bold text-sm bg-black/80 px-3 py-1 rounded-full border border-white/20">Double-clic pour ouvrir</span>
                                    </div>
                                </div>

                                {/* INFO */}
                                <div className="px-1">
                                    {renamingId === project.id ? (
                                        <input
                                            autoFocus
                                            className="w-full bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--accent)] rounded px-1 text-sm font-bold focus:outline-none"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-[var(--text-primary)] font-bold text-sm truncate pr-2 group-hover:text-[var(--accent)] transition-colors">{project.title}</h3>
                                            <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, project.id); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[var(--text-secondary)] text-[10px] font-mono mt-0.5">
                                        Dernière modif: {new Date(project.lastModified).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="fixed bg-[var(--bg-panel)] border border-[var(--border-color)] rounded shadow-2xl py-1 z-[100] min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent)] flex items-center gap-2 hover:text-white"
                        onClick={() => { onOpenProject(contextMenu.id); setContextMenu(null); }}
                    >
                        <Monitor size={14} /> Ouvrir
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent)] flex items-center gap-2 hover:text-white"
                        onClick={() => {
                            const p = projects.find(proj => proj.id === contextMenu.id);
                            if (p) onExportProject(p.id);
                            setContextMenu(null);
                        }}
                    >
                        <Download size={14} /> Exporter JSON
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent)] flex items-center gap-2 hover:text-white"
                        onClick={() => {
                            const p = projects.find(proj => proj.id === contextMenu.id);
                            if (p) onShareProject(p.id);
                            setContextMenu(null);
                        }}
                    >
                        <Share2 size={14} /> Partager
                    </button>

                    <div className="h-px bg-[var(--border-color)] my-1"></div>

                    <button
                        className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--accent)] flex items-center gap-2 hover:text-white"
                        onClick={() => {
                            const p = projects.find(proj => proj.id === contextMenu.id);
                            if (p) startRenaming(p);
                        }}
                    >
                        <Edit2 size={14} /> Renommer
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/20 flex items-center gap-2"
                        onClick={(e) => {
                            setContextMenu(null);
                            onDeleteProject(e, contextMenu.id);
                        }}
                    >
                        <Trash2 size={14} /> Supprimer
                    </button>
                </div>
            )}
        </div>
    );
};
