import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export type ConfirmOptions = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    alternativeText?: string;
    variant?: ConfirmVariant;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
    onAlternative?: () => void | Promise<void>;
};

type ConfirmContextType = {
    confirm: (options: ConfirmOptions) => Promise<'confirm' | 'cancel' | 'alternative'>;
    // Shorthand for delete confirmations
    confirmDelete: (itemName: string, onConfirm?: () => void | Promise<void>) => Promise<boolean>;
};

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = (): ConfirmContextType => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolveRef, setResolveRef] = useState<((value: 'confirm' | 'cancel' | 'alternative') => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<'confirm' | 'cancel' | 'alternative'> => {
        return new Promise((resolve) => {
            setOptions(opts);
            setResolveRef(() => resolve);
            setIsOpen(true);
        });
    }, []);

    const confirmDelete = useCallback(async (itemName: string, onConfirm?: () => void | Promise<void>): Promise<boolean> => {
        const result = await confirm({
            title: 'Confirmer la suppression',
            message: `Êtes-vous sûr de vouloir supprimer "${itemName}" ? Cette action est irréversible.`,
            confirmText: 'Supprimer',
            cancelText: 'Annuler',
            variant: 'danger',
            onConfirm
        });
        return result === 'confirm';
    }, [confirm]);

    const handleConfirm = async () => {
        if (options?.onConfirm) {
            await options.onConfirm();
        }
        resolveRef?.('confirm');
        setIsOpen(false);
        setOptions(null);
        setResolveRef(null);
    };

    const handleAlternative = async () => {
        if (options?.onAlternative) {
            await options.onAlternative();
        }
        resolveRef?.('alternative');
        setIsOpen(false);
        setOptions(null);
        setResolveRef(null);
    };

    const handleCancel = () => {
        options?.onCancel?.();
        resolveRef?.('cancel');
        setIsOpen(false);
        setOptions(null);
        setResolveRef(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm, confirmDelete }}>
            {children}
            {isOpen && options && (
                <ConfirmModal
                    options={options}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    onAlternative={handleAlternative}
                />
            )}
        </ConfirmContext.Provider>
    );
};

// ─── MODAL COMPONENT ─────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ConfirmVariant, { icon: React.ReactNode; btnClass: string }> = {
    danger: {
        icon: <Trash2 size={24} className="text-red-400" />,
        btnClass: 'bg-red-600 hover:bg-red-500 text-white'
    },
    warning: {
        icon: <AlertTriangle size={24} className="text-yellow-400" />,
        btnClass: 'bg-yellow-600 hover:bg-yellow-500 text-white'
    },
    info: {
        icon: <AlertTriangle size={24} className="text-blue-400" />,
        btnClass: 'bg-blue-600 hover:bg-blue-500 text-white'
    }
};

const ConfirmModal: React.FC<{
    options: ConfirmOptions;
    onConfirm: () => void;
    onCancel: () => void;
    onAlternative: () => void;
}> = ({ options, onConfirm, onCancel, onAlternative }) => {
    const variant = options.variant || 'warning';
    const style = VARIANT_STYLES[variant];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onCancel}
        >
            <div
                className="bg-[var(--bg-secondary-panel)] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-white/5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-500/10' : variant === 'warning' ? 'bg-yellow-500/10' : 'bg-blue-500/10'}`}>
                        {style.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white flex-1">{options.title}</h3>
                    <button
                        onClick={onCancel}
                        className="text-[var(--text-secondary)] hover:text-white transition-colors p-1"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    <p className="text-gray-300 text-sm leading-relaxed">{options.message}</p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-5 border-t border-white/5 bg-black/20">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                        {options.cancelText || 'Annuler'}
                    </button>
                    {options.alternativeText && (
                        <button
                            onClick={onAlternative}
                            className="px-4 py-2 text-sm font-semibold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 transition-all"
                        >
                            {options.alternativeText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${style.btnClass}`}
                    >
                        {options.confirmText || 'Confirmer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmProvider;
