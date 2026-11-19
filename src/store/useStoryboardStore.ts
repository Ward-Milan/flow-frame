import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { StoryboardCard, StoryboardData, CanvasItem, SubFrame } from '../modules/frame/types';
import { UndoRedoService } from '../core/UndoRedoService';

export type ViewMode = 'gallery' | 'draw' | 'animatic';

export interface StoryboardProject {
    id: string;
    title: string;
    director: string;
    dop: string;
    aspectRatio: '16:9' | '2.39:1' | '4:3' | '9:16';
    cards: StoryboardCard[];
    items: CanvasItem[];
    view: { x: number; y: number; zoom: number };
    updatedAt: number;
}

const STORAGE_KEY = 'flowframe_active_project_v1';
const LIBRARY_STORAGE_KEY = 'flowframe_projects_library_v1';

const createDefaultCard = (seq = '1', shot = '1', desc = ''): StoryboardCard => ({
    id: uuidv4(),
    type: 'draw',
    data: '',
    subFrames: [
        { id: uuidv4(), data: '', duration: 3 }
    ],
    info: {
        sequence: seq,
        shot: shot,
        scale: 'Plan Moyen',
        movement: 'Fixe',
        description: desc,
        duration: 3,
        focalLength: '35mm',
        cameraAngle: 'Niveau œil',
        support: 'Trépied',
        locationEffect: 'INT. JOUR',
        soundType: 'Synchrone',
        shotStatus: 'draft'
    }
});

const createInitialProject = (
    title = 'Mon Projet Storyboard',
    aspectRatio: '16:9' | '2.39:1' | '4:3' | '9:16' = '16:9',
    director = '',
    dop = '',
    initialShotsCount = 3
): StoryboardProject => {
    const count = Math.max(1, Math.min(24, initialShotsCount));
    const cards: StoryboardCard[] = Array.from({ length: count }, (_, idx) =>
        createDefaultCard('1', String(idx + 1), '')
    );
    return {
        id: uuidv4(),
        title,
        director,
        dop,
        aspectRatio,
        cards,
        items: [],
        view: { x: 0, y: 0, zoom: 1 },
        updatedAt: Date.now()
    };
};

const loadSavedProjectsLibrary = (): StoryboardProject[] => {
    try {
        const rawLib = localStorage.getItem(LIBRARY_STORAGE_KEY);
        const library: StoryboardProject[] = rawLib ? JSON.parse(rawLib) : [];
        const validLib = Array.isArray(library)
            ? library.filter(p => p && p.id && Array.isArray(p.cards))
            : [];

        // Also migrate single active project if it exists and isn't in library yet
        const rawActive = localStorage.getItem(STORAGE_KEY);
        if (rawActive) {
            const parsedActive = JSON.parse(rawActive);
            if (parsedActive && parsedActive.id && Array.isArray(parsedActive.cards)) {
                const existsIdx = validLib.findIndex(p => p.id === parsedActive.id);
                if (existsIdx === -1) {
                    validLib.unshift(parsedActive);
                } else {
                    validLib[existsIdx] = parsedActive;
                }
            }
        }
        return validLib.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (e) {
        console.warn('Failed to load storyboard projects library', e);
        return [];
    }
};

const persistProjectAndLibrary = (
    project: StoryboardProject,
    currentLibrary: StoryboardProject[]
): StoryboardProject[] => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        const withoutCurrent = currentLibrary.filter(p => p.id !== project.id);
        const nextLibrary = [project, ...withoutCurrent].sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
        );
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(nextLibrary));
        return nextLibrary;
    } catch (e) {
        console.warn('Failed to persist project to localStorage', e);
        return currentLibrary;
    }
};

const saveProjectState = (
    updated: StoryboardProject,
    currentLibrary: StoryboardProject[]
): { project: StoryboardProject; savedProjects: StoryboardProject[] } => {
    const nextLib = persistProjectAndLibrary(updated, currentLibrary);
    return { project: updated, savedProjects: nextLib };
};

const loadInitialProject = (): StoryboardProject => {
    const library = loadSavedProjectsLibrary();
    if (library.length > 0) {
        return library[0];
    }
    return createInitialProject();
};

export type StoryboardCardUpdates = Partial<Omit<StoryboardCard, 'info'>> & {
    info?: Partial<StoryboardCard['info']>;
};

interface StoryboardStoreState {
    project: StoryboardProject;
    savedProjects: StoryboardProject[];
    isLauncherOpen: boolean;
    viewMode: ViewMode;
    activeCardId: string | null;
    isExportModalOpen: boolean;

    // Playback & Timing Engine
    currentTime: number;
    isPlaying: boolean;
    activeSubFrameIndex: number;
    isLooping: boolean;
    simulateCameraMove: boolean;
    showSubtitles: boolean;
    audioTrackUrl: string | null;
    audioTrackName: string | null;
    isAudioMuted: boolean;

    // Drawing Settings
    brushTool: string;
    brushColor: string;
    brushSize: number; // 1 to 100
    brushOpacity: number; // 0 to 1
    onionSkin: boolean;
    compositionGrid: 'none' | 'thirds' | 'perspective' | 'safe';
    stylusOnlyMode: boolean;

    // Actions - Navigation & Views
    setIsLauncherOpen: (open: boolean) => void;
    setViewMode: (mode: ViewMode) => void;
    setActiveCardId: (id: string | null, syncPlayhead?: boolean) => void;
    selectCardAndGoTo: (id: string, mode?: ViewMode) => void;
    nextCard: () => void;
    prevCard: () => void;
    setIsExportModalOpen: (open: boolean) => void;

    // Actions - Timing & Playback
    setCurrentTime: (time: number | ((prev: number) => number)) => void;
    setIsPlaying: (playing: boolean) => void;
    setActiveSubFrameIndex: (index: number) => void;
    setIsLooping: (loop: boolean) => void;
    setSimulateCameraMove: (sim: boolean) => void;
    setShowSubtitles: (show: boolean) => void;
    setAudioTrack: (url: string | null, name?: string | null) => void;
    setIsAudioMuted: (muted: boolean) => void;

    // Actions - Drawing Tools
    setBrushTool: (tool: string) => void;
    setBrushColor: (color: string) => void;
    setBrushSize: (size: number) => void;
    setBrushOpacity: (opacity: number) => void;
    setOnionSkin: (enabled: boolean) => void;
    setCompositionGrid: (grid: 'none' | 'thirds' | 'perspective' | 'safe') => void;
    setStylusOnlyMode: (enabled: boolean) => void;

    // Actions - Project Data
    setProjectTitle: (title: string) => void;
    setAspectRatio: (ratio: '16:9' | '2.39:1' | '4:3' | '9:16') => void;
    updateProjectData: (data: StoryboardData) => void;
    
    // Actions - Card Operations
    addCard: (afterCardId?: string) => string;
    updateCard: (id: string, updates: StoryboardCardUpdates | ((prev: StoryboardCard) => StoryboardCard)) => void;
    updateCardBackground: (cardId: string, dataUrl: string) => void;
    deleteCard: (id: string) => void;
    duplicateCard: (id: string) => string;
    splitCardAtPlayhead: () => boolean;
    reorderCards: (cards: StoryboardCard[]) => void;
    updateCardSubFrame: (cardId: string, subFrameIndex: number, dataUrl: string) => void;
    addSubFrameToCard: (cardId: string, duplicateCurrent?: boolean) => void;
    deleteSubFrameFromCard: (cardId: string, subFrameIndex: number) => void;
    reorderSubFramesInCard: (cardId: string, fromIndex: number, toIndex: number) => void;
    adjustCardDuration: (cardId: string, deltaSeconds: number) => void;

    // Project lifecycle
    newProject: () => void;
    createProjectWithConfig: (config: {
        title: string;
        director?: string;
        dop?: string;
        aspectRatio: '16:9' | '2.39:1' | '4:3' | '9:16';
        initialShotsCount?: number;
        startView?: ViewMode;
    }) => void;
    openSavedProject: (projectId: string) => void;
    deleteSavedProject: (projectId: string) => void;
    duplicateSavedProject: (projectId: string) => void;
    loadProject: (project: StoryboardProject) => void;
    saveToStorage: () => void;
    exportProjectJson: (projectToExport?: StoryboardProject) => void;
    importProjectJson: (jsonString: string) => boolean;

    // Undo / Redo (Scoped to active page: gallery, draw, animatic)
    canvasUndoRedoHandler: { undo: () => void; redo: () => void } | null;
    setCanvasUndoRedoHandler: (handler: { undo: () => void; redo: () => void } | null) => void;
    undo: () => void;
    redo: () => void;
}

export const useStoryboardStore = create<StoryboardStoreState>((set, get) => {
    const initialLibrary = loadSavedProjectsLibrary();
    const initialProject = initialLibrary[0] || createInitialProject();
    const initialCardId = initialProject.cards[0]?.id || null;

    const getHistoryModule = (mode: ViewMode): 'gallery' | 'animatic' =>
        mode === 'animatic' ? 'animatic' : 'gallery';

    return {
        project: initialProject,
        savedProjects: initialLibrary,
        isLauncherOpen: true,
        viewMode: 'gallery',
        activeCardId: initialCardId,
        isExportModalOpen: false,
        canvasUndoRedoHandler: null,
        setCanvasUndoRedoHandler: (handler) => set({ canvasUndoRedoHandler: handler }),

        // Playback
        currentTime: 0,
        isPlaying: false,
        activeSubFrameIndex: 0,
        isLooping: true,
        simulateCameraMove: true,
        showSubtitles: true,
        audioTrackUrl: null,
        audioTrackName: null,
        isAudioMuted: false,

        // Drawing Settings
        brushTool: 'brush',
        brushColor: '#000000', // Drawing stroke color (dark on white paper)
        brushSize: 8,
        brushOpacity: 1.0,
        onionSkin: true,
        compositionGrid: 'none',
        stylusOnlyMode: false,

        setIsLauncherOpen: (open) => set({ isLauncherOpen: open, isPlaying: false }),

        setViewMode: (mode) => set({ viewMode: mode, isLauncherOpen: false }),

        setActiveCardId: (id, syncPlayhead = true) => {
            if (!syncPlayhead) {
                set({ activeCardId: id });
                return;
            }
            const cards = get().project.cards;
            let startTime = 0;
            if (id) {
                for (const c of cards) {
                    if (c.id === id) break;
                    startTime += (c.info.duration || 3);
                }
            }
            set({
                activeCardId: id,
                currentTime: startTime,
                activeSubFrameIndex: 0,
                isPlaying: false
            });
        },

        selectCardAndGoTo: (id, mode = 'draw') => {
            const cards = get().project.cards;
            let startTime = 0;
            for (const c of cards) {
                if (c.id === id) break;
                startTime += (c.info.duration || 3);
            }
            set({
                activeCardId: id,
                currentTime: startTime,
                activeSubFrameIndex: 0,
                isPlaying: false,
                viewMode: mode
            });
        },

        nextCard: () => {
            const state = get();
            const cards = state.project.cards;
            if (cards.length === 0) return;
            const currentIndex = cards.findIndex(c => c.id === state.activeCardId);
            if (currentIndex < cards.length - 1) {
                const nextId = cards[currentIndex + 1].id;
                state.setActiveCardId(nextId, true);
            }
        },

        prevCard: () => {
            const state = get();
            const cards = state.project.cards;
            if (cards.length === 0) return;
            const currentIndex = cards.findIndex(c => c.id === state.activeCardId);
            if (currentIndex > 0) {
                const prevId = cards[currentIndex - 1].id;
                state.setActiveCardId(prevId, true);
            }
        },

        setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),

        setCurrentTime: (time) => set(state => ({
            currentTime: typeof time === 'function' ? time(state.currentTime) : time
        })),
        setIsPlaying: (playing) => set({ isPlaying: playing }),
        setActiveSubFrameIndex: (index) => set({ activeSubFrameIndex: index }),
        setIsLooping: (loop) => set({ isLooping: loop }),
        setSimulateCameraMove: (sim) => set({ simulateCameraMove: sim }),
        setShowSubtitles: (show) => set({ showSubtitles: show }),
        setAudioTrack: (url, name = null) => set({ audioTrackUrl: url, audioTrackName: name }),
        setIsAudioMuted: (muted) => set({ isAudioMuted: muted }),

        setBrushTool: (tool) => set({ brushTool: tool }),
        setBrushColor: (color) => set({ brushColor: color }),
        setBrushSize: (size) => set({ brushSize: size }),
        setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),
        setOnionSkin: (enabled) => set({ onionSkin: enabled }),
        setCompositionGrid: (grid) => set({ compositionGrid: grid }),
        setStylusOnlyMode: (enabled) => set({ stylusOnlyMode: enabled }),

        setProjectTitle: (title) => {
            set((state) => {
                const updated = { ...state.project, title, updatedAt: Date.now() };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        setAspectRatio: (aspectRatio) => {
            set((state) => {
                const updated = { ...state.project, aspectRatio, updatedAt: Date.now() };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        updateProjectData: (data: StoryboardData) => {
            set((state) => {
                const updated: StoryboardProject = {
                    ...state.project,
                    cards: data.cards,
                    items: data.items,
                    view: data.view,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        addCard: (afterCardId) => {
            const id = uuidv4();
            set((state) => {
                const cards = [...state.project.cards];
                let seq = '1';
                let shot = `${cards.length + 1}`;

                if (cards.length > 0) {
                    const lastCard = cards[cards.length - 1];
                    seq = lastCard.info.sequence || '1';
                    shot = `${parseInt(lastCard.info.shot || '0', 10) + 1 || cards.length + 1}`;
                }

                const newCard = createDefaultCard(seq, shot);
                newCard.id = id;

                let nextCards: StoryboardCard[];
                if (afterCardId) {
                    const idx = cards.findIndex(c => c.id === afterCardId);
                    if (idx !== -1) {
                        nextCards = [...cards.slice(0, idx + 1), newCard, ...cards.slice(idx + 1)];
                    } else {
                        nextCards = [...cards, newCard];
                    }
                } else {
                    nextCards = [...cards, newCard];
                }

                UndoRedoService.recordTransition('gallery', state.project.cards, nextCards, 'Ajouter un plan');

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return { ...saveProjectState(updated, state.savedProjects), activeCardId: id };
            });
            return id;
        },

        updateCard: (id, updates) => {
            set((state) => {
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== id) return card;
                    if (typeof updates === 'function') {
                        return updates(card);
                    }
                    return {
                        ...card,
                        ...updates,
                        info: updates.info ? { ...card.info, ...updates.info } : card.info
                    };
                });

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        updateCardSubFrame: (cardId, subFrameIndex, dataUrl) => {
            set((state) => {
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    const subFrames = card.subFrames && card.subFrames.length > 0
                        ? [...card.subFrames]
                        : [{ id: uuidv4(), data: card.data || '', duration: card.info.duration || 3 }];

                    if (subFrameIndex >= 0 && subFrameIndex < subFrames.length) {
                        subFrames[subFrameIndex] = {
                            ...subFrames[subFrameIndex],
                            data: dataUrl
                        };
                    } else if (subFrames.length === 0) {
                        subFrames.push({ id: uuidv4(), data: dataUrl, duration: card.info.duration || 3 });
                    }

                    // Update primary thumbnail with first subframe data
                    const primaryData = subFrameIndex === 0 ? dataUrl : (card.data || dataUrl);

                    return {
                        ...card,
                        data: primaryData,
                        subFrames
                    };
                });

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        addSubFrameToCard: (cardId, duplicateCurrent = false) => {
            set((state) => {
                let nextSubIdx = state.activeSubFrameIndex;
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    const cardDur = card.info.duration || 3;
                    const currentFrames = card.subFrames && card.subFrames.length > 0
                        ? [...card.subFrames]
                        : [{ id: uuidv4(), data: card.data || '', duration: cardDur }];

                    const insertAt = Math.min(state.activeSubFrameIndex + 1, currentFrames.length);
                    const sourceData = duplicateCurrent ? (currentFrames[state.activeSubFrameIndex]?.data || '') : '';
                    currentFrames.splice(insertAt, 0, {
                        id: uuidv4(),
                        data: sourceData,
                        duration: Number((cardDur / (currentFrames.length + 1)).toFixed(2))
                    });

                    // Redistribute duration evenly across subframes
                    const evenDur = Number((cardDur / currentFrames.length).toFixed(2));
                    const balanced = currentFrames.map((f, i) => ({
                        ...f,
                        duration: i === currentFrames.length - 1
                            ? Number(Math.max(0.1, cardDur - evenDur * (currentFrames.length - 1)).toFixed(2))
                            : evenDur
                    }));

                    nextSubIdx = insertAt;
                    return {
                        ...card,
                        subFrames: balanced
                    };
                });

                UndoRedoService.pushState('frame', nextCards, 'Ajouter une pose');
                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return { ...saveProjectState(updated, state.savedProjects), activeSubFrameIndex: nextSubIdx };
            });
        },

        deleteSubFrameFromCard: (cardId, subFrameIndex) => {
            set((state) => {
                let nextSubIdx = state.activeSubFrameIndex;
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    const currentFrames = card.subFrames && card.subFrames.length > 0
                        ? [...card.subFrames]
                        : [{ id: uuidv4(), data: card.data || '', duration: card.info.duration || 3 }];

                    if (currentFrames.length <= 1) return card;

                    currentFrames.splice(subFrameIndex, 1);
                    const cardDur = card.info.duration || 3;
                    const evenDur = Number((cardDur / currentFrames.length).toFixed(2));
                    const balanced = currentFrames.map((f, i) => ({
                        ...f,
                        duration: i === currentFrames.length - 1
                            ? Number(Math.max(0.1, cardDur - evenDur * (currentFrames.length - 1)).toFixed(2))
                            : evenDur
                    }));

                    nextSubIdx = Math.max(0, Math.min(subFrameIndex, balanced.length - 1));
                    return {
                        ...card,
                        data: balanced[0]?.data || card.data,
                        subFrames: balanced
                    };
                });

                UndoRedoService.pushState('frame', nextCards, 'Supprimer une pose');
                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return { ...saveProjectState(updated, state.savedProjects), activeSubFrameIndex: nextSubIdx };
            });
        },

        reorderSubFramesInCard: (cardId, fromIndex, toIndex) => {
            set((state) => {
                if (fromIndex === toIndex) return state;
                let nextSubIdx = state.activeSubFrameIndex;
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    const currentFrames = card.subFrames && card.subFrames.length > 0
                        ? [...card.subFrames]
                        : [{ id: uuidv4(), data: card.data || '', duration: card.info.duration || 3 }];

                    if (
                        fromIndex < 0 ||
                        fromIndex >= currentFrames.length ||
                        toIndex < 0 ||
                        toIndex >= currentFrames.length
                    ) {
                        return card;
                    }

                    const [moved] = currentFrames.splice(fromIndex, 1);
                    currentFrames.splice(toIndex, 0, moved);

                    nextSubIdx = toIndex;
                    return {
                        ...card,
                        data: currentFrames[0]?.data ?? card.data,
                        subFrames: currentFrames
                    };
                });

                UndoRedoService.pushState('frame', nextCards, 'Réorganiser les poses');
                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return {
                    ...saveProjectState(updated, state.savedProjects),
                    activeSubFrameIndex: nextSubIdx
                };
            });
        },

        adjustCardDuration: (cardId, deltaSeconds) => {
            set((state) => {
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    const oldDur = card.info.duration || 3;
                    const newDur = Number(Math.max(0.5, oldDur + deltaSeconds).toFixed(1));
                    const ratio = newDur / oldDur;

                    const scaledSubFrames = card.subFrames?.map(f => ({
                        ...f,
                        duration: Number(Math.max(0.1, (f.duration || (oldDur / (card.subFrames?.length || 1))) * ratio).toFixed(2))
                    }));

                    return {
                        ...card,
                        info: { ...card.info, duration: newDur },
                        subFrames: scaledSubFrames
                    };
                });

                UndoRedoService.recordTransition('animatic', state.project.cards, nextCards, 'Ajuster durée plan');
                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        deleteCard: (id) => {
            set((state) => {
                const nextCards = state.project.cards.filter(c => c.id !== id);
                UndoRedoService.recordTransition('gallery', state.project.cards, nextCards, 'Supprimer un plan');

                let nextActiveId = state.activeCardId;
                if (nextActiveId === id) {
                    nextActiveId = nextCards[0]?.id || null;
                }

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return { ...saveProjectState(updated, state.savedProjects), activeCardId: nextActiveId };
            });
        },

        updateCardBackground: (cardId, dataUrl) => {
            set((state) => {
                const nextCards = state.project.cards.map((card) => {
                    if (card.id !== cardId) return card;
                    return {
                        ...card,
                        backgroundData: dataUrl
                    };
                });

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        duplicateCard: (id) => {
            const newId = uuidv4();
            set((state) => {
                const idx = state.project.cards.findIndex(c => c.id === id);
                if (idx === -1) return state;

                const original = state.project.cards[idx];
                const duplicate: StoryboardCard = {
                    ...JSON.parse(JSON.stringify(original)),
                    id: newId,
                    info: {
                        ...original.info,
                        shot: `${original.info.shot} bis`
                    }
                };

                const rawCards = [
                    ...state.project.cards.slice(0, idx + 1),
                    duplicate,
                    ...state.project.cards.slice(idx + 1)
                ];

                // Renumber P per sequence while preserving S
                const seqCounts: Record<string, number> = {};
                const nextCards = rawCards.map(c => {
                    const seq = c.info.sequence || '1';
                    seqCounts[seq] = (seqCounts[seq] || 0) + 1;
                    return { ...c, info: { ...c.info, shot: String(seqCounts[seq]) } };
                });

                UndoRedoService.recordTransition('gallery', state.project.cards, nextCards, 'Dupliquer un plan');

                const updated: StoryboardProject = {
                    ...state.project,
                    cards: nextCards,
                    updatedAt: Date.now()
                };
                return { ...saveProjectState(updated, state.savedProjects), activeCardId: newId };
            });
            return newId;
        },

        splitCardAtPlayhead: () => {
            const state = get();
            const cards = state.project.cards;
            if (cards.length === 0) return false;

            // Find the card at currentTime or fallback to activeCardId
            let accum = 0;
            let targetIdx = -1;
            let offsetInCard = 0;

            for (let i = 0; i < cards.length; i++) {
                const dur = cards[i].info.duration || 3;
                if (state.currentTime >= accum && state.currentTime < accum + dur) {
                    targetIdx = i;
                    offsetInCard = state.currentTime - accum;
                    break;
                }
                accum += dur;
            }

            if (targetIdx === -1 && state.activeCardId) {
                targetIdx = cards.findIndex(c => c.id === state.activeCardId);
                if (targetIdx !== -1) {
                    offsetInCard = (cards[targetIdx].info.duration || 3) / 2;
                }
            }
            if (targetIdx === -1) return false;

            const targetCard = cards[targetIdx];
            const totalDur = targetCard.info.duration || 3;
            if (totalDur < 0.8) return false;

            // If playhead is too close to the start or end of the card (<0.3s), split evenly in half
            let firstDur = Number(offsetInCard.toFixed(1));
            if (firstDur < 0.4 || totalDur - firstDur < 0.4) {
                firstDur = Number((totalDur / 2).toFixed(1));
            }
            const secondDur = Number(Math.max(0.4, totalDur - firstDur).toFixed(1));

            const newId = uuidv4();
            const firstHalf: StoryboardCard = {
                ...JSON.parse(JSON.stringify(targetCard)),
                info: {
                    ...targetCard.info,
                    duration: firstDur
                }
            };
            const secondHalf: StoryboardCard = {
                ...JSON.parse(JSON.stringify(targetCard)),
                id: newId,
                info: {
                    ...targetCard.info,
                    duration: secondDur
                }
            };

            const rawCards = [
                ...cards.slice(0, targetIdx),
                firstHalf,
                secondHalf,
                ...cards.slice(targetIdx + 1)
            ];

            // Automatically renumber P within each sequence S
            const seqCounts: Record<string, number> = {};
            const nextCards = rawCards.map(c => {
                const seq = c.info.sequence || '1';
                seqCounts[seq] = (seqCounts[seq] || 0) + 1;
                return { ...c, info: { ...c.info, shot: String(seqCounts[seq]) } };
            });

            UndoRedoService.recordTransition('animatic', cards, nextCards, 'Scinder le plan');
            const updated: StoryboardProject = {
                ...state.project,
                cards: nextCards,
                updatedAt: Date.now()
            };
            set({
                ...saveProjectState(updated, state.savedProjects),
                activeCardId: newId
            });
            return true;
        },

        reorderCards: (cards) => {
            set((state) => {
                UndoRedoService.recordTransition('gallery', state.project.cards, cards, 'Réordonner les plans');
                const updated: StoryboardProject = {
                    ...state.project,
                    cards,
                    updatedAt: Date.now()
                };
                return saveProjectState(updated, state.savedProjects);
            });
        },

        newProject: () => {
            const fresh = createInitialProject();
            const nextLib = persistProjectAndLibrary(fresh, get().savedProjects);
            UndoRedoService.clearAllHistories();
            UndoRedoService.pushState('gallery', fresh.cards, 'Nouveau projet');
            UndoRedoService.pushState('animatic', fresh.cards, 'Nouveau projet');
            set({
                project: fresh,
                savedProjects: nextLib,
                activeCardId: fresh.cards[0]?.id || null,
                currentTime: 0,
                isPlaying: false,
                isLauncherOpen: false
            });
        },

        createProjectWithConfig: ({
            title,
            director = '',
            dop = '',
            aspectRatio = '16:9',
            initialShotsCount = 3,
            startView = 'gallery'
        }) => {
            const fresh = createInitialProject(
                title.trim() || 'Sans titre',
                aspectRatio,
                director.trim(),
                dop.trim(),
                initialShotsCount
            );
            const nextLib = persistProjectAndLibrary(fresh, get().savedProjects);
            UndoRedoService.clearAllHistories();
            UndoRedoService.pushState('gallery', fresh.cards, 'Nouveau projet');
            UndoRedoService.pushState('animatic', fresh.cards, 'Nouveau projet');
            set({
                project: fresh,
                savedProjects: nextLib,
                activeCardId: fresh.cards[0]?.id || null,
                currentTime: 0,
                isPlaying: false,
                isLauncherOpen: false,
                viewMode: startView
            });
        },

        openSavedProject: (projectId: string) => {
            const state = get();
            const target = state.savedProjects.find(p => p.id === projectId);
            if (!target) return;
            const updated = { ...target, updatedAt: Date.now() };
            const nextLib = persistProjectAndLibrary(updated, state.savedProjects);
            UndoRedoService.clearAllHistories();
            UndoRedoService.pushState('gallery', updated.cards, 'Charger projet');
            UndoRedoService.pushState('animatic', updated.cards, 'Charger projet');
            set({
                project: updated,
                savedProjects: nextLib,
                activeCardId: updated.cards[0]?.id || null,
                currentTime: 0,
                isPlaying: false,
                isLauncherOpen: false
            });
        },

        deleteSavedProject: (projectId: string) => {
            set((state) => {
                const filteredLib = state.savedProjects.filter(p => p.id !== projectId);
                localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(filteredLib));

                // If currently active project was deleted, load first from library or create fresh
                if (state.project.id === projectId) {
                    const nextActive = filteredLib[0] || createInitialProject();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextActive));
                    return {
                        project: nextActive,
                        savedProjects: filteredLib,
                        activeCardId: nextActive.cards[0]?.id || null,
                        currentTime: 0,
                        isPlaying: false
                    };
                }

                return { savedProjects: filteredLib };
            });
        },

        duplicateSavedProject: (projectId: string) => {
            set((state) => {
                const original = state.savedProjects.find(p => p.id === projectId) || (state.project.id === projectId ? state.project : null);
                if (!original) return state;

                const duplicate: StoryboardProject = {
                    ...JSON.parse(JSON.stringify(original)),
                    id: uuidv4(),
                    title: `${original.title} (Copie)`,
                    updatedAt: Date.now()
                };

                const nextLib = persistProjectAndLibrary(duplicate, state.savedProjects);
                return { savedProjects: nextLib };
            });
        },

        loadProject: (project) => {
            const nextLib = persistProjectAndLibrary(project, get().savedProjects);
            UndoRedoService.clearAllHistories();
            UndoRedoService.pushState('gallery', project.cards, 'Charger projet');
            UndoRedoService.pushState('animatic', project.cards, 'Charger projet');
            set({
                project,
                savedProjects: nextLib,
                activeCardId: project.cards[0]?.id || null,
                currentTime: 0,
                isPlaying: false,
                isLauncherOpen: false
            });
        },

        saveToStorage: () => {
            const current = get().project;
            persistProjectAndLibrary(current, get().savedProjects);
        },

        exportProjectJson: (projectToExport?: StoryboardProject) => {
            const current = projectToExport || get().project;
            const blob = new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sanitized = (current.title || 'storyboard').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            a.download = `${sanitized}_flowframe.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        importProjectJson: (jsonString: string) => {
            try {
                const parsed = JSON.parse(jsonString);
                if (parsed && Array.isArray(parsed.cards)) {
                    const validProject: StoryboardProject = {
                        id: parsed.id || uuidv4(),
                        title: parsed.title || 'Projet importé',
                        director: parsed.director || '',
                        dop: parsed.dop || '',
                        aspectRatio: parsed.aspectRatio || '16:9',
                        cards: parsed.cards,
                        items: parsed.items || [],
                        view: parsed.view || { x: 0, y: 0, zoom: 1 },
                        updatedAt: Date.now()
                    };
                    get().loadProject(validProject);
                    return true;
                }
            } catch (e) {
                console.error('Invalid storyboard project file', e);
            }
            return false;
        },

        undo: () => {
            const state = get();
            // 1. Sur l'onglet Dessin : annulation du coup de pinceau sur le dessin actif
            if (state.viewMode === 'draw') {
                if (state.canvasUndoRedoHandler) {
                    state.canvasUndoRedoHandler.undo();
                }
                return;
            }

            // 2. Sur l'onglet Animatique / Montage : annulation stricte des actions de montage (durée, coupe)
            if (state.viewMode === 'animatic') {
                const previousCards = UndoRedoService.undo<StoryboardCard[]>('animatic');
                if (previousCards) {
                    set((s) => {
                        const updated: StoryboardProject = {
                            ...s.project,
                            cards: previousCards,
                            updatedAt: Date.now()
                        };
                        return saveProjectState(updated, s.savedProjects);
                    });
                }
                return;
            }

            // 3. Sur l'onglet Galerie : annulation stricte des actions de galerie (ajout/suppression/duplication de plan)
            let previousCards = UndoRedoService.undo<StoryboardCard[]>('gallery');
            if (!previousCards) {
                previousCards = UndoRedoService.undo<StoryboardCard[]>('frame');
            }
            if (previousCards) {
                set((s) => {
                    const updated: StoryboardProject = {
                        ...s.project,
                        cards: previousCards,
                        updatedAt: Date.now()
                    };
                    return saveProjectState(updated, s.savedProjects);
                });
            }
        },

        redo: () => {
            const state = get();
            // 1. Sur l'onglet Dessin : rétablissement du trait sur le dessin actif
            if (state.viewMode === 'draw') {
                if (state.canvasUndoRedoHandler) {
                    state.canvasUndoRedoHandler.redo();
                }
                return;
            }

            // 2. Sur l'onglet Animatique / Montage : rétablissement strict des actions de montage
            if (state.viewMode === 'animatic') {
                const nextCards = UndoRedoService.redo<StoryboardCard[]>('animatic');
                if (nextCards) {
                    set((s) => {
                        const updated: StoryboardProject = {
                            ...s.project,
                            cards: nextCards,
                            updatedAt: Date.now()
                        };
                        return saveProjectState(updated, s.savedProjects);
                    });
                }
                return;
            }

            // 3. Sur l'onglet Galerie : rétablissement strict des actions de galerie
            let nextCards = UndoRedoService.redo<StoryboardCard[]>('gallery');
            if (!nextCards) {
                nextCards = UndoRedoService.redo<StoryboardCard[]>('frame');
            }
            if (nextCards) {
                set((s) => {
                    const updated: StoryboardProject = {
                        ...s.project,
                        cards: nextCards,
                        updatedAt: Date.now()
                    };
                    return saveProjectState(updated, s.savedProjects);
                });
            }
        }
    };
});
