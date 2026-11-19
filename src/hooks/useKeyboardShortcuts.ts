/**
 * useKeyboardShortcuts - Hook pour les raccourcis clavier globaux
 * Gère Cmd/Ctrl+S (sauvegarder), Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo), etc.
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description?: string;
}

interface UseKeyboardShortcutsOptions {
    shortcuts: KeyboardShortcut[];
    enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return;

        // Ignore if typing in an input, textarea, or contenteditable
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // Allow Cmd+S even in inputs
            if (!(e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey))) {
                return;
            }
        }

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const modKey = isMac ? e.metaKey : e.ctrlKey;

        for (const shortcut of shortcuts) {
            const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? modKey : !modKey;
            const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
            const altMatch = shortcut.alt ? e.altKey : !e.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                e.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

// Pre-built common shortcuts
export function useGlobalShortcuts({
    onSave,
    onUndo,
    onRedo,
    onNew,
    onSearch,
}: {
    onSave?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onNew?: () => void;
    onSearch?: () => void;
}) {
    const shortcuts: KeyboardShortcut[] = [];

    if (onSave) {
        shortcuts.push({ key: 's', ctrl: true, action: onSave, description: 'Sauvegarder' });
    }
    if (onUndo) {
        shortcuts.push({ key: 'z', ctrl: true, action: onUndo, description: 'Annuler' });
    }
    if (onRedo) {
        shortcuts.push({ key: 'z', ctrl: true, shift: true, action: onRedo, description: 'Refaire' });
        shortcuts.push({ key: 'y', ctrl: true, action: onRedo, description: 'Refaire' });
    }
    if (onNew) {
        shortcuts.push({ key: 'n', ctrl: true, action: onNew, description: 'Nouveau' });
    }
    if (onSearch) {
        shortcuts.push({ key: 'k', ctrl: true, action: onSearch, description: 'Rechercher' });
        shortcuts.push({ key: 'f', ctrl: true, action: onSearch, description: 'Rechercher' });
    }

    useKeyboardShortcuts({ shortcuts });
}

// Hook to get formatted shortcut string
export function useShortcutLabel(key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
    
    const parts: string[] = [];
    if (modifiers.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
    if (modifiers.alt) parts.push(isMac ? '⌥' : 'Alt');
    if (modifiers.shift) parts.push(isMac ? '⇧' : 'Shift');
    parts.push(key.toUpperCase());
    
    return parts.join(isMac ? '' : '+');
}
