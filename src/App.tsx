import React, { useEffect } from 'react';
import { Header } from './components/Header';
import { StoryboardGallery } from './components/StoryboardGallery';
import { DrawingStudio } from './components/DrawingStudio';
import { AnimaticStudio } from './components/AnimaticStudio';
import { ExportStoryboardModal } from './modules/frame/ExportStoryboardModal';
import { ProjectLauncherModal } from './components/ProjectLauncherModal';
import { useStoryboardStore } from './store/useStoryboardStore';

export function App() {
    const project = useStoryboardStore(s => s.project);
    const viewMode = useStoryboardStore(s => s.viewMode);
    const setViewMode = useStoryboardStore(s => s.setViewMode);
    const isExportModalOpen = useStoryboardStore(s => s.isExportModalOpen);
    const setIsExportModalOpen = useStoryboardStore(s => s.setIsExportModalOpen);
    const undo = useStoryboardStore(s => s.undo);
    const redo = useStoryboardStore(s => s.redo);
    const isPlaying = useStoryboardStore(s => s.isPlaying);
    const setIsPlaying = useStoryboardStore(s => s.setIsPlaying);

    // Optional URL parameter (?demoView=gallery|draw|animatic) to open the demo project directly
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const demoView = params.get('demoView');
        if (demoView === 'gallery' || demoView === 'draw' || demoView === 'animatic') {
            fetch('/demo/crepuscule-horizon-demo.json')
                .then(res => (res.ok ? res.text() : ''))
                .then(text => {
                    if (!text) return;
                    const loaded = useStoryboardStore.getState().importProjectJson(text);
                    if (!loaded) return;
                    useStoryboardStore.getState().setIsLauncherOpen(false);
                    if (demoView === 'draw') {
                        const cards = useStoryboardStore.getState().project.cards;
                        const targetCard = cards[1] || cards[0];
                        if (targetCard) {
                            useStoryboardStore.getState().setActiveCardId(targetCard.id, true);
                        }
                    }
                    useStoryboardStore.getState().setViewMode(demoView);
                })
                .catch(err => console.warn('Failed to load demo project from URL', err));
        }
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // Undo: Cmd+Z or Ctrl+Z
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                if (!isTyping) {
                    e.preventDefault();
                    undo();
                }
                return;
            }

            // Redo: Cmd+Shift+Z or Ctrl+Y
            if (
                ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
                ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
            ) {
                if (!isTyping) {
                    e.preventDefault();
                    redo();
                }
                return;
            }

            // Spacebar: Play/Pause in animatic mode
            if (e.key === ' ' && !isTyping && viewMode === 'animatic') {
                e.preventDefault();
                setIsPlaying(!isPlaying);
                return;
            }

            // Fast space switching: 1 = Galerie, 2 = Dessin, 3 = Animatique
            if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.key === '1') setViewMode('gallery');
                if (e.key === '2') setViewMode('draw');
                if (e.key === '3') setViewMode('animatic');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, setViewMode, viewMode, isPlaying, setIsPlaying]);

    return (
        <div className="theme-frame w-screen h-screen flex flex-col bg-[#121212] text-white overflow-hidden select-none font-sans">
            {/* Top Navigation Bar */}
            <Header />

            {/* Main Application Area (3 Core Spaces) */}
            <main className="flex-1 flex overflow-hidden relative min-h-0 bg-[#121212]">
                {viewMode === 'gallery' && (
                    <StoryboardGallery />
                )}

                {viewMode === 'draw' && (
                    <DrawingStudio />
                )}

                {viewMode === 'animatic' && (
                    <AnimaticStudio />
                )}
            </main>

            {/* Global Export Storyboard Modal */}
            <ExportStoryboardModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                projectName={project.title}
                cards={project.cards}
            />

            {/* Startup Project Launcher & Switcher Modal */}
            <ProjectLauncherModal />
        </div>
    );
}

export default App;
