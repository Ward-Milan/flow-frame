import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
    LayoutGrid, 
    PenTool, 
    Film, 
    Plus, 
    Download, 
    Undo2, 
    Redo2, 
    FolderOpen, 
    CheckCircle2,
    RefreshCw,
    X
} from 'lucide-react';
import { useStoryboardStore } from '../store/useStoryboardStore';
import { useToast } from '../shared';
import { FlowFrameLogo } from './FlowFrameLogo';
import {
    APP_VERSION,
    checkForGithubUpdate,
    getConfiguredGithubRepo,
    setConfiguredGithubRepo,
    launchUpdateDownload,
    type UpdateInfo
} from '../core/UpdateService';

export const Header: React.FC = () => {
    const project = useStoryboardStore(s => s.project);
    const viewMode = useStoryboardStore(s => s.viewMode);
    const setViewMode = useStoryboardStore(s => s.setViewMode);
    const setProjectTitle = useStoryboardStore(s => s.setProjectTitle);
    const setAspectRatio = useStoryboardStore(s => s.setAspectRatio);
    const addCard = useStoryboardStore(s => s.addCard);
    const setIsExportModalOpen = useStoryboardStore(s => s.setIsExportModalOpen);
    const setIsLauncherOpen = useStoryboardStore(s => s.setIsLauncherOpen);
    const undo = useStoryboardStore(s => s.undo);
    const redo = useStoryboardStore(s => s.redo);
    const importProjectFile = useStoryboardStore(s => s.importProjectFile);
    
    const toast = useToast();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(project.title);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // GitHub Auto-Update state (Mac DMG + Android APK)
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [githubRepoInput, setGithubRepoInput] = useState(() => getConfiguredGithubRepo());

    // Silent auto-check on app launch when a GitHub repo is configured
    useEffect(() => {
        const repo = getConfiguredGithubRepo();
        if (!repo) return;
        checkForGithubUpdate(repo)
            .then(info => {
                if (info?.available) {
                    setUpdateInfo(info);
                }
            })
            .catch(() => {
                // Offline or unconfigured: fail silently
            });
    }, []);

    const handleManualUpdateCheck = async () => {
        const trimmed = githubRepoInput.trim();
        if (!trimmed || !trimmed.includes('/')) {
            toast.error('Renseigne le dépôt GitHub au format "utilisateur/flow-frame"');
            return;
        }
        setConfiguredGithubRepo(trimmed);
        setIsCheckingUpdate(true);
        try {
            const info = await checkForGithubUpdate(trimmed);
            setUpdateInfo(info);
            if (info?.available) {
                toast.success(`Mise à jour v${info.latestVersion} disponible !`);
            } else {
                toast.success(`FlowFrame Studio v${APP_VERSION} est à jour`);
            }
        } catch {
            toast.error('Impossible de joindre GitHub Releases (vérifie le nom du dépôt ou la connexion)');
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    // Studio telemetry metrics
    const telemetry = useMemo(() => {
        const cards = project.cards;
        const seqSet = new Set(cards.map(c => c.info.sequence || '1'));
        const totalDurationSeconds = cards.reduce((acc, c) => acc + (c.info.duration || 3), 0);
        const shotCompletedCount = cards.filter(c => c.info.shotStatus === 'shot').length;
        const mins = Math.floor(totalDurationSeconds / 60);
        const secs = Math.floor(totalDurationSeconds % 60);
        const frames = Math.floor((totalDurationSeconds % 1) * 24);
        const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
        return {
            sequencesCount: seqSet.size,
            shotsCount: cards.length,
            shotCompletedCount,
            tc
        };
    }, [project.cards]);

    const handleTitleSubmit = () => {
        setIsEditingTitle(false);
        if (tempTitle.trim()) {
            setProjectTitle(tempTitle.trim());
        } else {
            setTempTitle(project.title);
        }
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const res = await importProjectFile(file);
        if (res.ok) {
            toast.success(
                res.fromLight
                    ? `Plan de feu importé : ${res.count} plan(s) créés automatiquement`
                    : `Projet chargé (${res.count} plan(s))`
            );
        } else {
            toast.error('Fichier .flow / .json invalide');
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const cycleAspectRatio = () => {
        const order: Array<'16:9' | '2.39:1' | '4:3' | '9:16'> = ['16:9', '2.39:1', '4:3', '9:16'];
        const current = project.aspectRatio || '16:9';
        const next = order[(order.indexOf(current) + 1) % order.length];
        setAspectRatio(next);
    };

    return (
        <header className="h-13 bg-[#14161B]/95 backdrop-blur-xl border-b border-[#282B37] px-3 sm:px-4 flex items-center justify-between z-40 shrink-0 select-none text-[#EDEDEC]">
            {/* Hidden .flow / .json file input for import */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileImport} 
                accept=".flow,.json" 
                className="hidden" 
            />

            {/* ── LEFT: STUDIO BRAND & PROJECT IDENTITY ── */}
            <div className="flex items-center gap-2.5 min-w-0">
                <button
                    onClick={() => setIsLauncherOpen(true)}
                    className="w-8 h-8 rounded-xl shadow-lg shadow-black/40 flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-transform"
                    title="Accueil & Bibliothèque de Projets"
                >
                    <FlowFrameLogo className="w-8 h-8" />
                </button>

                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs tracking-wide text-[#EDEDEC]">
                            FlowFrame
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-mono font-bold uppercase tracking-wider">
                            STUDIO
                        </span>
                        <button
                            onClick={cycleAspectRatio}
                            className="text-[9px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 px-1.5 py-0.2 rounded border border-[#F59E0B]/30 transition-colors"
                            title="Toucher pour changer le ratio capteur (16:9, 2.39:1 Scope, 4:3, 9:16)"
                        >
                            {project.aspectRatio || '16:9'}
                        </button>
                    </div>

                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={tempTitle}
                            autoFocus
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleTitleSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleTitleSubmit();
                                if (e.key === 'Escape') {
                                    setIsEditingTitle(false);
                                    setTempTitle(project.title);
                                }
                            }}
                            className="text-[11px] text-[#10B981] bg-transparent border-b border-[#10B981] outline-none font-medium px-0 py-0 max-w-[160px]"
                        />
                    ) : (
                        <button
                            onClick={() => {
                                setTempTitle(project.title);
                                setIsEditingTitle(true);
                            }}
                            className="text-[11px] text-[#9B9A97] hover:text-[#EDEDEC] text-left truncate max-w-[160px] sm:max-w-[200px] block transition-colors leading-tight"
                            title="Toucher pour renommer la production"
                        >
                            {project.title}
                        </button>
                    )}
                </div>
            </div>

            {/* ── CENTER: WORKSTATION SPACES + UNDO/REDO ── */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#0D0E11] border border-[#282B37] p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('gallery')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            viewMode === 'gallery'
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                                : 'text-[#9B9A97] hover:text-[#EDEDEC] hover:bg-[#191B22]'
                        }`}
                    >
                        <LayoutGrid size={13} />
                        <span>Découpage</span>
                    </button>

                    <button
                        onClick={() => setViewMode('draw')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            viewMode === 'draw'
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                                : 'text-[#9B9A97] hover:text-[#EDEDEC] hover:bg-[#191B22]'
                        }`}
                    >
                        <PenTool size={13} />
                        <span>Viseur & Dessin</span>
                    </button>

                    <button
                        onClick={() => setViewMode('animatic')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            viewMode === 'animatic'
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                                : 'text-[#9B9A97] hover:text-[#EDEDEC] hover:bg-[#191B22]'
                        }`}
                    >
                        <Film size={13} />
                        <span>Animatique</span>
                    </button>
                </div>

                {/* Touch-Friendly Undo / Redo */}
                <div className="hidden sm:flex items-center bg-[#191B22] border border-[#282B37] rounded-xl p-0.5">
                    <button
                        onClick={undo}
                        className="p-1.5 rounded-lg text-[#9B9A97] hover:text-[#EDEDEC] hover:bg-[#222530] active:scale-95 transition-all"
                        title="Annuler (Cmd+Z)"
                    >
                        <Undo2 size={15} />
                    </button>
                    <button
                        onClick={redo}
                        className="p-1.5 rounded-lg text-[#9B9A97] hover:text-[#EDEDEC] hover:bg-[#222530] active:scale-95 transition-all"
                        title="Rétablir (Cmd+Shift+Z)"
                    >
                        <Redo2 size={15} />
                    </button>
                </div>
            </div>

            {/* ── RIGHT: PRODUCTION TELEMETRY & EXPORT ACTIONS ── */}
            <div className="flex items-center gap-2">
                {/* Production Telemetry Readout */}
                <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#0D0E11] border border-[#282B37] text-[11px] font-mono">
                    <span className="text-[#9B9A97]">
                        SÉQ <strong className="text-[#EDEDEC]">{telemetry.sequencesCount}</strong>
                    </span>
                    <span className="text-[#282B37]">|</span>
                    <span className="text-[#9B9A97]">
                        PLANS <strong className="text-[#10B981]">{telemetry.shotsCount}</strong>
                    </span>
                    {telemetry.shotCompletedCount > 0 && (
                        <>
                            <span className="text-[#282B37]">|</span>
                            <span className="flex items-center gap-1 text-[#10B981]" title="Plans cochés comme tournés">
                                <CheckCircle2 size={11} />
                                <strong>{telemetry.shotCompletedCount}/{telemetry.shotsCount}</strong>
                            </span>
                        </>
                    )}
                    <span className="text-[#282B37]">|</span>
                    <span className="text-[#F59E0B] font-bold" title="Durée totale estimée (24 fps)">
                        {telemetry.tc}
                    </span>
                </div>

                {/* Quick Add Plan */}
                <button
                    onClick={() => {
                        addCard();
                        toast.success('Nouveau plan ajouté au découpage');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#191B22] hover:bg-[#222530] text-[#EDEDEC] font-bold text-xs rounded-xl transition-all active:scale-95 border border-[#282B37]"
                    title="Ajouter un plan"
                >
                    <Plus size={14} className="text-[#10B981]" />
                    <span className="hidden md:inline">Plan</span>
                </button>

                {/* Update Available Badge (when GitHub Release is newer) */}
                {updateInfo?.available && (
                    <button
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/40 font-mono font-bold text-[11px] rounded-xl transition-all active:scale-95"
                        title={`Nouvelle version v${updateInfo.latestVersion} disponible sur GitHub`}
                    >
                        <RefreshCw size={12} />
                        <span>v{updateInfo.latestVersion}</span>
                    </button>
                )}

                {/* Open .flow / .json file directly */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl bg-[#191B22] border border-[#282B37] text-[#9B9A97] hover:text-[#10B981] hover:bg-[#222530] transition-colors"
                    title="Ouvrir un projet (.flow / .json)"
                >
                    <FolderOpen size={14} />
                </button>

                {/* GitHub Update Check Button */}
                <button
                    onClick={() => setIsUpdateModalOpen(true)}
                    className="p-2 rounded-xl bg-[#191B22] border border-[#282B37] text-[#9B9A97] hover:text-[#10B981] hover:bg-[#222530] transition-colors"
                    title={`Mises à jour GitHub (v${APP_VERSION})`}
                >
                    <RefreshCw size={14} />
                </button>

                {/* Export Button (All exports: .flow, PDF, XML, MP4) */}
                <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#10B981]/20 transition-all"
                >
                    <Download size={13} />
                    <span className="hidden sm:inline">Exporter</span>
                </button>
            </div>

            {/* ── GITHUB AUTO-UPDATE MODAL (Mac DMG & Android APK) ── */}
            {isUpdateModalOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setIsUpdateModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-[#14161B] border border-[#282B37] rounded-2xl shadow-2xl overflow-hidden text-[#EDEDEC]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-[#282B37] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw size={16} className="text-[#10B981]" />
                                <div>
                                    <h3 className="text-sm font-bold">Mises à jour GitHub</h3>
                                    <p className="text-[11px] font-mono text-[#9B9A97]">
                                        Version installée : v{APP_VERSION}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsUpdateModalOpen(false)}
                                className="p-1.5 rounded-lg text-[#9B9A97] hover:text-white hover:bg-[#191B22]"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9B9A97] mb-1.5">
                                    Dépôt GitHub (Releases)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={githubRepoInput}
                                        onChange={e => setGithubRepoInput(e.target.value)}
                                        placeholder="ex: mon-compte/flow-frame"
                                        className="flex-1 bg-[#0F1115] border border-[#282B37] focus:border-[#10B981] rounded-xl px-3 py-2 text-xs text-[#EDEDEC] outline-none font-mono"
                                    />
                                    <button
                                        onClick={handleManualUpdateCheck}
                                        disabled={isCheckingUpdate}
                                        className="px-3.5 py-2 bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin' : ''} />
                                        <span>Vérifier</span>
                                    </button>
                                </div>
                                <p className="text-[11px] text-[#6E6E6A] mt-1.5">
                                    Détecte automatiquement l&apos;APK sur tablette Android ou le DMG sur macOS dès qu&apos;une nouvelle Release GitHub est publiée.
                                </p>
                            </div>

                            {updateInfo?.available && (
                                <div className="p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#10B981]">
                                            Nouvelle version v{updateInfo.latestVersion} disponible !
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1115] text-[#F59E0B] uppercase">
                                            {updateInfo.platform === 'android' ? 'Android APK' : 'macOS DMG'}
                                        </span>
                                    </div>
                                    {updateInfo.releaseNotes && (
                                        <p className="text-xs text-[#EDEDEC]/80 line-clamp-4 whitespace-pre-line">
                                            {updateInfo.releaseNotes}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => launchUpdateDownload(updateInfo.downloadUrl)}
                                        className="w-full py-2.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#10B981]/20 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Download size={14} />
                                        <span>
                                            {updateInfo.platform === 'android'
                                                ? 'Télécharger et installer la MAJ (.apk)'
                                                : 'Télécharger la MAJ (.dmg)'}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};
