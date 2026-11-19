/**
 * UndoRedoService - Module-scoped undo/redo history management
 * 
 * Each module (light, prod, frame, vault, etc.) has its own history stack.
 * History is limited to MAX_HISTORY_SIZE entries per module.
 */

export type ModuleName = 'real' | 'light' | 'prod' | 'frame' | 'vault' | 'storyboard' | 'prepa' | 'tournage' | 'gallery' | 'draw' | 'animatic';

interface HistoryEntry<T = unknown> {
    state: T;
    timestamp: number;
    description?: string;
}

interface ModuleHistory<T = unknown> {
    past: HistoryEntry<T>[];
    present: HistoryEntry<T> | null;
    future: HistoryEntry<T>[];
}

const MAX_HISTORY_SIZE = 50;

class UndoRedoServiceClass {
    private histories: Map<ModuleName, ModuleHistory> = new Map();
    private listeners: Map<ModuleName, Set<() => void>> = new Map();

    constructor() {
        // Initialize empty histories for each module
        const modules: ModuleName[] = ['light', 'prod', 'frame', 'vault', 'storyboard', 'prepa', 'tournage', 'gallery', 'draw', 'animatic'];
        modules.forEach(module => {
            this.histories.set(module, { past: [], present: null, future: [] });
            this.listeners.set(module, new Set());
        });
    }

    /**
     * Record a state transition (from previousState to nextState) for a specific module/page
     * Ensures even the very first action on a page can be undone.
     */
    recordTransition<T>(module: ModuleName, previousState: T, nextState: T, description?: string): void {
        const history = this.histories.get(module);
        if (!history) return;

        if (!history.present) {
            history.present = {
                state: JSON.parse(JSON.stringify(previousState)),
                timestamp: Date.now() - 1,
                description: 'État initial'
            };
        }

        this.pushState(module, nextState, description);
    }

    /**
     * Push a new state to the history for a module
     */
    pushState<T>(module: ModuleName, state: T, description?: string): void {
        const history = this.histories.get(module);
        if (!history) return;

        const entry: HistoryEntry<T> = {
            state: JSON.parse(JSON.stringify(state)), // Deep clone
            timestamp: Date.now(),
            description
        };

        // If we have a present state, move it to past
        if (history.present) {
            history.past.push(history.present);
            // Limit history size
            if (history.past.length > MAX_HISTORY_SIZE) {
                history.past.shift();
            }
        }

        // Set new present
        history.present = entry;
        // Clear future (new action invalidates redo stack)
        history.future = [];

        this.notifyListeners(module);
    }

    /**
     * Undo the last action for a module
     * Returns the previous state or null if nothing to undo
     */
    undo<T>(module: ModuleName): T | null {
        const history = this.histories.get(module);
        if (!history || history.past.length === 0) return null;

        // Move present to future
        if (history.present) {
            history.future.unshift(history.present);
        }

        // Pop from past to present
        const previousEntry = history.past.pop()!;
        history.present = previousEntry;

        this.notifyListeners(module);
        return previousEntry.state as T;
    }

    /**
     * Redo the last undone action for a module
     * Returns the next state or null if nothing to redo
     */
    redo<T>(module: ModuleName): T | null {
        const history = this.histories.get(module);
        if (!history || history.future.length === 0) return null;

        // Move present to past
        if (history.present) {
            history.past.push(history.present);
        }

        // Shift from future to present
        const nextEntry = history.future.shift()!;
        history.present = nextEntry;

        this.notifyListeners(module);
        return nextEntry.state as T;
    }

    /**
     * Check if undo is available for a module
     */
    canUndo(module: ModuleName): boolean {
        const history = this.histories.get(module);
        return history ? history.past.length > 0 : false;
    }

    /**
     * Check if redo is available for a module
     */
    canRedo(module: ModuleName): boolean {
        const history = this.histories.get(module);
        return history ? history.future.length > 0 : false;
    }

    /**
     * Get current state for a module
     */
    getCurrentState<T>(module: ModuleName): T | null {
        const history = this.histories.get(module);
        return history?.present?.state as T || null;
    }

    /**
     * Clear history for a module (e.g., when switching projects)
     */
    clearHistory(module: ModuleName): void {
        const history = this.histories.get(module);
        if (history) {
            history.past = [];
            history.present = null;
            history.future = [];
            this.notifyListeners(module);
        }
    }

    /**
     * Clear all module histories
     */
    clearAllHistories(): void {
        this.histories.forEach((_, module) => {
            this.clearHistory(module);
        });
    }

    /**
     * Subscribe to history changes for a module
     */
    subscribe(module: ModuleName, callback: () => void): () => void {
        const moduleListeners = this.listeners.get(module);
        if (moduleListeners) {
            moduleListeners.add(callback);
        }
        return () => {
            moduleListeners?.delete(callback);
        };
    }

    /**
     * Get history info for UI display
     */
    getHistoryInfo(module: ModuleName): { undoCount: number; redoCount: number; lastAction?: string } {
        const history = this.histories.get(module);
        if (!history) return { undoCount: 0, redoCount: 0 };

        return {
            undoCount: history.past.length,
            redoCount: history.future.length,
            lastAction: history.present?.description
        };
    }

    private notifyListeners(module: ModuleName): void {
        const moduleListeners = this.listeners.get(module);
        moduleListeners?.forEach(callback => callback());
    }
}

// Singleton instance
export const UndoRedoService = new UndoRedoServiceClass();
