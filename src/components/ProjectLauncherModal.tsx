import React, { useState, useRef } from 'react';
import {
    Film,
    Plus,
    FolderOpen,
    Clock,
    Layers,
    Trash2,
    Copy,
    Download,
    Upload,
    ArrowRight,
    X,
    Sparkles,
    Check
} from 'lucide-react';
import { useStoryboardStore, type StoryboardProject } from '../store/useStoryboardStore';
import { useToast } from '../shared';
import { FlowFrameLogo } from './FlowFrameLogo';

const ASPECT_RATIOS: Array<{
    id: '16:9' | '2.39:1' | '4:3' | '9:16';
    label: string;
    sublabel: string;
    wClass: string;
    hClass: string;
}> = [
    {
        id: '16:9',
        label: '16:9 Cinéma / TV',
        sublabel: 'Standard streaming, pub et fiction (1.78:1)',
        wClass: 'w-16',
        hClass: 'h-9'
    },
    {
        id: '2.39:1',
        label: '2.39:1 Anamorphique Scope',
        sublabel: 'Grand écran cinéma panoramique',
        wClass: 'w-20',
        hClass: 'h-8'
    },
    {
        id: '4:3',
        label: '4:3 Format Académique',
        sublabel: 'Vintage, époque, clip artistique (1.33:1)',
        wClass: 'w-12',
        hClass: 'h-9'
    },
    {
        id: '9:16',
        label: '9:16 Vertical',
        sublabel: 'Social media, Reels, TikTok & Shorts',
        wClass: 'w-8',
        hClass: 'h-14'
    }
];

export const ProjectLauncherModal: React.FC = () => {
    const isLauncherOpen = useStoryboardStore(s => s.isLauncherOpen);
    const setIsLauncherOpen = useStoryboardStore(s => s.setIsLauncherOpen);
    const savedProjects = useStoryboardStore(s => s.savedProjects);
    const currentProject = useStoryboardStore(s => s.project);
    const createProjectWithConfig = useStoryboardStore(s => s.createProjectWithConfig);
    const openSavedProject = useStoryboardStore(s => s.openSavedProject);
    const deleteSavedProject = useStoryboardStore(s => s.deleteSavedProject);
    const duplicateSavedProject = useStoryboardStore(s => s.duplicateSavedProject);
    const exportProjectJson = useStoryboardStore(s => s.exportProjectJson);
    const importProjectJson = useStoryboardStore(s => s.importProjectJson);

    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal state: 'new' or 'recent'
    const [tab, setTab] = useState<'new' | 'recent'>(
        savedProjects.length > 0 ? 'recent' : 'new'
    );

    // New project form state
    const [title, setTitle] = useState('');
    const [director, setDirector] = useState('');
    const [dop, setDop] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '2.39:1' | '4:3' | '9:16'>('16:9');
    const [initialShotsCount, setInitialShotsCount] = useState<number>(3);
    const [startView, setStartView] = useState<'gallery' | 'draw'>('gallery');
    const [isLoadingDemo, setIsLoadingDemo] = useState(false);

    if (!isLauncherOpen) return null;

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        const projectTitle = title.trim() || 'Nouveau Storyboard';
        createProjectWithConfig({
            title: projectTitle,
            director: director.trim(),
            dop: dop.trim(),
            aspectRatio,
            initialShotsCount,
            startView
        });
        toast.success(`Projet "${projectTitle}" initialisé en ${aspectRatio}`);
    };

    const handleLoadDemoProject = async () => {
        if (isLoadingDemo) return;
        setIsLoadingDemo(true);
        try {
            const res = await fetch('/demo/crepuscule-horizon-demo.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const ok = importProjectJson(text);
            if (ok) {
                setIsLauncherOpen(false);
                toast.success('Projet démo "Crépuscule sur l\'Horizon" chargé');
            } else {
                toast.error('Impossible de charger le projet démo');
            }
        } catch {
            toast.error('Erreur lors du chargement du projet démo');
        } finally {
            setIsLoadingDemo(false);
        }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const ok = importProjectJson(content);
                if (ok) {
                    toast.success('Projet importé avec succès');
                } else {
                    toast.error('Fichier de projet invalide');
                }
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatTimestamp = (timestamp: number) => {
        if (!timestamp) return 'Récemment';
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `Il y a ${diffDays} j`;
        return new Date(timestamp).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
            {/* Hidden file input for project import */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
            />

            <div className="w-full max-w-3xl bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
                {/* ── Top Header Bar ── */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#121214]/80">
                    <div className="flex items-center gap-3">
                        <FlowFrameLogo className="w-10 h-10 shadow-lg shadow-black/50 rounded-xl" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold tracking-tight text-white">
                                    FLOW FRAME
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                    Studio
                                </span>
                            </div>
                            <p className="text-xs text-[#a1a1aa]">
                                Créer un nouveau storyboard ou reprendre un projet
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Quick switch tabs */}
                        <div className="flex items-center bg-[#202024] p-1 rounded-xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => setTab('recent')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    tab === 'recent'
                                        ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                                        : 'text-[#a1a1aa] hover:text-white'
                                }`}
                            >
                                <Clock size={13} />
                                <span>Projets récents ({savedProjects.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('new')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    tab === 'new'
                                        ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                                        : 'text-[#a1a1aa] hover:text-white'
                                }`}
                            >
                                <Plus size={13} />
                                <span>Nouveau projet</span>
                            </button>
                        </div>

                        {/* Close button (if a project is already loaded) */}
                        <button
                            type="button"
                            onClick={() => setIsLauncherOpen(false)}
                            className="p-2 text-[#71717a] hover:text-white rounded-xl hover:bg-white/5 transition-colors ml-1"
                            title="Fermer et continuer le travail"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Content Body ── */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* TAB 1: RECENT PROJECTS */}
                    {tab === 'recent' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
                                    Vos Storyboards sauvegardés
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleLoadDemoProject}
                                        disabled={isLoadingDemo}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202024] hover:bg-[#27272a] disabled:opacity-50 text-xs font-medium text-[#F59E0B] hover:text-[#FBBF24] border border-[#F59E0B]/25 transition-colors"
                                        title="Ouvrir le storyboard de démonstration en 4 plans"
                                    >
                                        <Sparkles size={13} />
                                        <span>Projet Démo (4 plans)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202024] hover:bg-[#27272a] text-xs font-medium text-[#a1a1aa] hover:text-white border border-white/5 transition-colors"
                                    >
                                        <Upload size={13} className="text-[#10B981]" />
                                        <span>Importer (.json)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTab('new')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-xs font-bold text-white shadow-md shadow-[#10B981]/20 transition-all active:scale-95"
                                    >
                                        <Plus size={13} />
                                        <span>Créer un projet</span>
                                    </button>
                                </div>
                            </div>

                            {savedProjects.length === 0 ? (
                                <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#71717a] mb-3">
                                        <FolderOpen size={22} />
                                    </div>
                                    <p className="text-sm font-semibold text-white">Aucun projet enregistré pour le moment</p>
                                    <p className="text-xs text-[#71717a] max-w-sm mt-1 mb-4">
                                        Commencez un nouveau storyboard en choisissant le format cinématique de votre choix.
                                    </p>
                                    <div className="flex items-center gap-2.5 flex-wrap justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setTab('new')}
                                            className="px-4 py-2 rounded-xl bg-[#10B981] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#059669] transition-all shadow-lg shadow-[#10B981]/25"
                                        >
                                            <Plus size={14} />
                                            <span>Créer mon premier storyboard</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleLoadDemoProject}
                                            disabled={isLoadingDemo}
                                            className="px-4 py-2 rounded-xl bg-[#202024] hover:bg-[#27272a] disabled:opacity-50 text-[#F59E0B] text-xs font-bold flex items-center gap-2 border border-[#F59E0B]/30 transition-all"
                                        >
                                            <Sparkles size={14} />
                                            <span>Projet Démo (4 plans)</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {savedProjects.map((p) => {
                                        const isCurrent = p.id === currentProject.id;
                                        const thumb = p.cards?.[0]?.subFrames?.[0]?.data || p.cards?.[0]?.data || p.cards?.[0]?.backgroundData || null;
                                        const shotsCount = p.cards?.length || 0;
                                        const totalDuration = (p.cards || []).reduce((acc, c) => acc + (c.info?.duration || 3), 0);

                                        return (
                                            <div
                                                key={p.id}
                                                className={`group relative rounded-2xl border p-3 flex flex-col justify-between transition-all cursor-pointer ${
                                                    isCurrent
                                                        ? 'bg-gradient-to-b from-[#202024] to-[#18181b] border-[#10B981]/60 ring-1 ring-[#10B981]/40 shadow-xl'
                                                        : 'bg-[#202024]/60 hover:bg-[#202024] border-white/10 hover:border-white/20'
                                                }`}
                                                onClick={() => {
                                                    openSavedProject(p.id);
                                                    toast.success(`Projet "${p.title}" ouvert`);
                                                }}
                                            >
                                                <div className="flex gap-3">
                                                    {/* Thumbnail preview */}
                                                    <div className="w-24 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                                                        {thumb ? (
                                                            <img
                                                                src={thumb}
                                                                alt=""
                                                                className="w-full h-full object-contain bg-white"
                                                            />
                                                        ) : (
                                                            <Film size={20} className="text-stone-600" />
                                                        )}
                                                        <span className="absolute bottom-1 right-1 text-[8px] font-mono px-1 rounded bg-black/75 text-white/90">
                                                            {p.aspectRatio || '16:9'}
                                                        </span>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="text-sm font-bold text-white truncate group-hover:text-[#10B981] transition-colors">
                                                                {p.title}
                                                            </h3>
                                                            {isCurrent && (
                                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#10B981] text-white">
                                                                    Actif
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#a1a1aa]">
                                                            <span className="flex items-center gap-1">
                                                                <Layers size={11} className="text-[#10B981]" />
                                                                {shotsCount} plan{shotsCount > 1 ? 's' : ''}
                                                            </span>
                                                            <span>·</span>
                                                            <span>{Math.round(totalDuration)}s</span>
                                                            <span>·</span>
                                                            <span>{formatTimestamp(p.updatedAt)}</span>
                                                        </div>

                                                        {(p.director || p.dop) && (
                                                            <p className="text-[10px] text-[#71717a] truncate mt-1">
                                                                {[p.director && `Rél: ${p.director}`, p.dop && `DOP: ${p.dop}`]
                                                                    .filter(Boolean)
                                                                    .join(' • ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Hover actions */}
                                                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5">
                                                    <span className="text-[10px] text-[#71717a] flex items-center gap-1 group-hover:text-white transition-colors">
                                                        <span>Cliquer pour ouvrir</span>
                                                        <ArrowRight size={11} />
                                                    </span>

                                                    <div
                                                        className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                duplicateSavedProject(p.id);
                                                                toast.info('Projet dupliqué');
                                                            }}
                                                            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                                                            title="Dupliquer le projet"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                exportProjectJson(p);
                                                                toast.success('Projet exporté');
                                                            }}
                                                            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
                                                            title="Exporter le fichier (.json)"
                                                        >
                                                            <Download size={12} />
                                                        </button>
                                                        {savedProjects.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (confirm(`Supprimer définitivement le projet "${p.title}" ?`)) {
                                                                        deleteSavedProject(p.id);
                                                                        toast.info('Projet supprimé');
                                                                    }
                                                                }}
                                                                className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                                title="Supprimer ce projet"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: NEW PROJECT CREATION FORM */}
                    {tab === 'new' && (
                        <form onSubmit={handleCreateProject} className="space-y-5">
                            {/* Project Title */}
                            <div>
                                <label className="block text-xs font-bold text-white uppercase tracking-wider mb-1.5">
                                    Nom du Projet <span className="text-[#10B981]">*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex : Court-Métrage Épisode 1, Publicité Montre, Clip Musical..."
                                    className="w-full bg-[#202024] border border-white/10 focus:border-[#10B981] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-[#52525b] outline-none transition-all shadow-inner"
                                />
                            </div>

                            {/* Cinema Aspect Ratio Picker */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                                        Format / Ratio d'Image <span className="text-[#10B981]">*</span>
                                    </label>
                                    <span className="text-[11px] text-[#10B981] font-semibold">
                                        {aspectRatio}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {ASPECT_RATIOS.map((item) => {
                                        const isSelected = aspectRatio === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setAspectRatio(item.id)}
                                                className={`p-3.5 rounded-2xl border flex items-center gap-3.5 cursor-pointer transition-all ${
                                                    isSelected
                                                        ? 'bg-[#10B981]/10 border-[#10B981] ring-2 ring-[#10B981]/30 shadow-lg'
                                                        : 'bg-[#202024]/70 border-white/10 hover:border-white/20 hover:bg-[#202024]'
                                                }`}
                                            >
                                                {/* Visual Proportional Box Preview */}
                                                <div className="w-20 h-14 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center shrink-0">
                                                    <div
                                                        className={`${item.wClass} ${item.hClass} rounded-sm border-2 ${
                                                            isSelected
                                                                ? 'border-[#10B981] bg-[#10B981]/25'
                                                                : 'border-white/40 bg-white/5'
                                                        } transition-all`}
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-white truncate">
                                                            {item.label}
                                                        </span>
                                                        {isSelected && (
                                                            <div className="w-4 h-4 rounded-full bg-[#10B981] text-white flex items-center justify-center">
                                                                <Check size={10} strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-[#71717a] mt-0.5 line-clamp-1">
                                                        {item.sublabel}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Optional Team / Metadata */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                                        Réalisateur / Direction (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={director}
                                        onChange={(e) => setDirector(e.target.value)}
                                        placeholder="Ex : Denis Villeneuve"
                                        className="w-full bg-[#202024] border border-white/10 focus:border-[#10B981] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#52525b] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                                        Chef Opérateur / DOP (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={dop}
                                        onChange={(e) => setDop(e.target.value)}
                                        placeholder="Ex : Roger Deakins"
                                        className="w-full bg-[#202024] border border-white/10 focus:border-[#10B981] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#52525b] outline-none"
                                    />
                                </div>
                            </div>

                            {/* Initial Setup Config */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[#a1a1aa] font-medium">
                                        Nombre de plans au départ :
                                    </span>
                                    <div className="flex items-center gap-1 bg-[#202024] p-0.5 rounded-lg border border-white/5">
                                        {[1, 3, 6, 12].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() => setInitialShotsCount(num)}
                                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                                    initialShotsCount === num
                                                        ? 'bg-[#10B981] text-white'
                                                        : 'text-[#71717a] hover:text-white'
                                                }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[#a1a1aa] font-medium">
                                        Ouvrir dans :
                                    </span>
                                    <div className="flex items-center gap-1 bg-[#202024] p-0.5 rounded-lg border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setStartView('gallery')}
                                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                                startView === 'gallery'
                                                    ? 'bg-[#10B981] text-white'
                                                    : 'text-[#71717a] hover:text-white'
                                            }`}
                                        >
                                            Galerie
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStartView('draw')}
                                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                                startView === 'draw'
                                                    ? 'bg-[#10B981] text-white'
                                                    : 'text-[#71717a] hover:text-white'
                                            }`}
                                        >
                                            Dessin direct
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-3 flex items-center justify-end gap-3">
                                {savedProjects.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setTab('recent')}
                                        className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#a1a1aa] hover:text-white transition-colors"
                                    >
                                        Annuler
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="px-6 py-3 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-xl shadow-[#10B981]/25 flex items-center gap-2 active:scale-95 transition-all"
                                >
                                    <Sparkles size={14} />
                                    <span>Créer le Storyboard</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-3 bg-[#121214] border-t border-white/5 flex items-center justify-between text-[11px] text-[#71717a]">
                    <span>Format : {aspectRatio} • Raccourcis : 1 Galerie, 2 Dessin, 3 Animatique</span>
                    {savedProjects.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsLauncherOpen(false)}
                            className="text-[#10B981] hover:underline font-semibold"
                        >
                            Continuer le projet actif ({currentProject.title}) →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
