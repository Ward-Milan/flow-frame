import React, { useState } from 'react';
import { PenTool, Info, Clock, Layers, Sparkles, Plus, Copy, Trash2, ChevronDown, Video, Undo2, Redo2, Image as ImageIcon } from 'lucide-react';
import { toolsRegistry } from './tools/registry';
import type { StoryboardCard } from './types';
import { animationPresets } from './tools/presets';

interface CustomPreset {
    id: string;
    name: string;
    frames: string[];
}

interface RightInspectorPanelProps {
    card: StoryboardCard | null;
    onUpdateCard: (card: StoryboardCard) => void;
    activeTool: string;
    onSelectTool: (toolId: string) => void;
    color: string;
    onChangeColor: (color: string) => void;
    lineWidth: number;
    onChangeLineWidth: (width: number) => void;

    // Canvas actions
    onUndo: () => void;
    onRedo: () => void;
    onClear: () => void;
    onImportImage: () => void;

    // Composition guides
    compositionGrid: 'none' | 'thirds' | 'perspective';
    onChangeCompositionGrid: (grid: 'none' | 'thirds' | 'perspective') => void;
    gridColor: string;
    onChangeGridColor: (color: string) => void;

    // Animation / Interframe Props
    activeSubFrameIndex: number;
    onionSkinEnabled: boolean;
    onChangeOnionSkinEnabled: (enabled: boolean) => void;
    onAddSubFrame: (duplicate: boolean) => void;
    onDeleteSubFrame: (index: number) => void;
    onApplyPreset: (presetFrames: string[]) => void;
    onSaveAsPreset: () => void;
    customPresets: CustomPreset[];
    onDeletePreset: (id: string, e: React.MouseEvent) => void;
}

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
    card,
    onUpdateCard,
    activeTool,
    onSelectTool,
    color,
    onChangeColor,
    lineWidth,
    onChangeLineWidth,

    // Canvas actions
    onUndo,
    onRedo,
    onClear,
    onImportImage,

    // Composition guides
    compositionGrid,
    onChangeCompositionGrid,
    gridColor,
    onChangeGridColor,

    // Animation / Interframe props
    activeSubFrameIndex,
    onionSkinEnabled,
    onChangeOnionSkinEnabled,
    onAddSubFrame,
    onDeleteSubFrame,
    onApplyPreset,
    onSaveAsPreset,
    customPresets,
    onDeletePreset
}) => {
    const [activeTab, setActiveTab] = useState<'info' | 'tools' | 'animation'>('info');
    const [showPresetsMenu, setShowPresetsMenu] = useState(false);

    const handleInfoChange = (field: keyof StoryboardCard['info'], value: any) => {
        if (!card) return;
        onUpdateCard({
            ...card,
            info: {
                ...card.info,
                [field]: value
            }
        });
    };

    const subFramesCount = card?.subFrames?.length || 1;

    return (
        <div className="w-80 h-full bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col flex-shrink-0 z-10 shadow-2xl">
            {/* TABS */}
            <div className="flex border-b border-[var(--border-color)] p-2 gap-1.5 shrink-0">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'info' ? 'bg-[var(--bg-element)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-element)]/50'}`}
                >
                    <Info size={14} />
                    Métadonnées
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'tools' ? 'bg-[var(--bg-element)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-element)]/50'}`}
                >
                    <PenTool size={14} />
                    Outils
                </button>
                <button
                    onClick={() => setActiveTab('animation')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'animation' ? 'bg-[var(--bg-element)] text-[var(--text-primary)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-element)]/50'}`}
                >
                    <Video size={14} />
                    Animation
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'tools' && (
                    <div className="space-y-6">
                        {/* Canvas Actions Toolbar (Undo/Redo/Image/Trash) at the top */}
                        <div>
                            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Actions dessin</h3>
                            <div className="flex gap-1.5 bg-[var(--bg-element)] p-1.5 rounded-xl border border-[var(--border-color)]">
                                <button 
                                    onClick={onUndo}
                                    className="flex-1 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-all flex items-center justify-center active:scale-95"
                                    title="Annuler (Cmd+Z)"
                                >
                                    <Undo2 size={16} />
                                </button>
                                <button 
                                    onClick={onRedo}
                                    className="flex-1 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-all flex items-center justify-center active:scale-95"
                                    title="Rétablir (Cmd+Shift+Z)"
                                >
                                    <Redo2 size={16} />
                                </button>
                                <button 
                                    onClick={onImportImage}
                                    className="flex-1 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-all flex items-center justify-center active:scale-95"
                                    title="Importer Image"
                                >
                                    <ImageIcon size={16} />
                                </button>
                                <button 
                                    onClick={onClear}
                                    className="flex-1 py-2 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center active:scale-95"
                                    title="Tout effacer"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Drawing Tools Grid */}
                        <div>
                            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Outils de dessin</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.values(toolsRegistry).map(tool => {
                                    const Icon = tool.icon;
                                    const isActive = activeTool === tool.id;
                                    return (
                                        <button
                                            key={tool.id}
                                            onClick={() => onSelectTool(tool.id)}
                                            title={tool.name}
                                            className={`p-3 flex items-center justify-center rounded-xl transition-all duration-200 ${isActive ? 'bg-[var(--accent)] text-white shadow-md scale-105' : 'bg-[var(--bg-element)] text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'}`}
                                        >
                                            <Icon size={18} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Composition Grid Guides */}
                        <div>
                            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">Guides de composition</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => onChangeCompositionGrid('none')}
                                    className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition-all ${compositionGrid === 'none' ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm' : 'border-[var(--border-color)] bg-[var(--bg-element)] text-[var(--text-secondary)] hover:text-white'}`}
                                >
                                    Aucun
                                </button>
                                <button
                                    onClick={() => onChangeCompositionGrid('thirds')}
                                    className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition-all ${compositionGrid === 'thirds' ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm' : 'border-[var(--border-color)] bg-[var(--bg-element)] text-[var(--text-secondary)] hover:text-white'}`}
                                >
                                    Tiers
                                </button>
                                <button
                                    onClick={() => onChangeCompositionGrid('perspective')}
                                    className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition-all ${compositionGrid === 'perspective' ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm' : 'border-[var(--border-color)] bg-[var(--bg-element)] text-[var(--text-secondary)] hover:text-white'}`}
                                >
                                    Perspective
                                </button>
                            </div>
                        </div>

                        {/* Grid Color Picker */}
                        {compositionGrid !== 'none' && (
                            <div>
                                <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Couleur des guides</h3>
                                <div className="flex gap-2 bg-[var(--bg-element)] p-3 rounded-xl border border-[var(--border-color)]">
                                    {['#34C759', '#FF3B30', '#007AFF', '#000000', '#ffffff'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => onChangeGridColor(c)}
                                            className={`w-5 h-5 rounded-full border transition-all ${gridColor === c ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-element)] ring-[var(--accent)] scale-110' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: c, borderColor: c === '#ffffff' ? '#ccc' : 'transparent' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTool !== 'eraser' && (
                            <div>
                                <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Couleur</h3>
                                <div className="flex flex-wrap gap-2 bg-[var(--bg-element)] p-3 rounded-xl border border-[var(--border-color)]">
                                    {['#000000', '#ffffff', '#FF4530', '#FF9500', '#FFD60A', '#34C759', '#007AFF', '#AF52DE'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => onChangeColor(c)}
                                            className={`w-6 h-6 rounded-full shadow-sm flex-shrink-0 transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-element)] ring-[var(--accent)] scale-110' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: c, border: c === '#ffffff' ? '1px solid #ccc' : 'none' }}
                                        />
                                    ))}
                                    <label
                                        className="relative w-6 h-6 rounded-full cursor-pointer flex-shrink-0 overflow-hidden shadow-sm hover:scale-110 transition-all ml-auto"
                                        title="Choisir une couleur"
                                        style={{
                                            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                                            outline: color && !['#000000', '#ffffff', '#FF4530', '#FF9500', '#FFD60A', '#34C759', '#007AFF', '#AF52DE'].includes(color) ? '2px solid var(--accent)' : 'none',
                                            outlineOffset: '2px'
                                        }}
                                    >
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => onChangeColor(e.target.value)}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Taille ({lineWidth}px)</h3>
                            <div className="flex items-center gap-3 bg-[var(--bg-element)] p-3 rounded-xl border border-[var(--border-color)]">
                                <div className="rounded-full bg-[var(--text-secondary)]" style={{ width: 4, height: 4 }} />
                                <input
                                    type="range"
                                    min="2"
                                    max="100"
                                    value={lineWidth}
                                    onChange={(e) => onChangeLineWidth(Number(e.target.value))}
                                    className="flex-1 h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                                />
                                <div className="rounded-full bg-[var(--text-secondary)]" style={{ width: 12, height: 12 }} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="space-y-5">
                        {!card ? (
                            <div className="text-center text-[var(--text-secondary)] mt-10">
                                <Info size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Sélectionnez un plan pour modifier ses métadonnées.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Séquence</label>
                                        <input
                                            type="text"
                                            value={card.info.sequence}
                                            onChange={(e) => handleInfoChange('sequence', e.target.value)}
                                            className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                            placeholder="Ex: SEQ 1"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Plan</label>
                                        <input
                                            type="text"
                                            value={card.info.shot}
                                            onChange={(e) => handleInfoChange('shot', e.target.value)}
                                            className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                            placeholder="Ex: 1A"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                                        <Clock size={14} /> Durée (secondes)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={card.info.duration ?? 3}
                                        onChange={(e) => handleInfoChange('duration', Number(e.target.value))}
                                        className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Échelle</label>
                                    <select
                                        value={card.info.scale}
                                        onChange={(e) => handleInfoChange('scale', e.target.value)}
                                        className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                    >
                                        <option value="Large">Plan Large</option>
                                        <option value="Moyen">Plan Moyen</option>
                                        <option value="Gros">Gros Plan</option>
                                        <option value="T.Gros">Très Gros Plan</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Mouvement</label>
                                    <select
                                        value={card.info.movement}
                                        onChange={(e) => handleInfoChange('movement', e.target.value)}
                                        className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                    >
                                        <option value="Fixe">Fixe</option>
                                        <option value="Pan">Panoramique</option>
                                        <option value="Trav">Travelling</option>
                                        <option value="Zoom">Zoom</option>
                                        <option value="Caméra Épaule">Caméra Épaule</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Description de l'action</label>
                                    <textarea
                                        value={card.info.description}
                                        onChange={(e) => handleInfoChange('description', e.target.value)}
                                        rows={5}
                                        className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none custom-scrollbar"
                                        placeholder="Décrivez l'action se déroulant dans ce plan..."
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'animation' && (
                    <div className="space-y-6">
                        {!card ? (
                            <div className="text-center text-[var(--text-secondary)] mt-10">
                                <Video size={32} className="mx-auto mb-3 opacity-50" />
                                <p>Sélectionnez un plan pour gérer ses animations.</p>
                            </div>
                        ) : (
                            <>
                                {/* Onion Skin Toggle */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">Aides au dessin</h3>
                                    <button
                                        onClick={() => onChangeOnionSkinEnabled(!onionSkinEnabled)}
                                        className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all ${
                                            onionSkinEnabled 
                                                ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] shadow-sm' 
                                                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-element)]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Layers size={16} />
                                            <span>Pelure d'oignon</span>
                                        </div>
                                        <span className="text-[10px] font-mono opacity-80">{onionSkinEnabled ? 'ON' : 'OFF'}</span>
                                    </button>
                                </div>

                                {/* Frame Actions */}
                                <div>
                                    <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">Gérer les frames ({subFramesCount} total)</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => onAddSubFrame(false)}
                                            className="p-3 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-element)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                            title="Ajouter une frame vide"
                                        >
                                            <Plus size={16} />
                                            Frame vide
                                        </button>
                                        <button
                                            onClick={() => onAddSubFrame(true)}
                                            className="p-3 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-element)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                            title="Dupliquer la frame active"
                                        >
                                            <Copy size={16} />
                                            Dupliquer
                                        </button>
                                    </div>
                                    
                                    <button
                                        onClick={() => onDeleteSubFrame(activeSubFrameIndex)}
                                        disabled={subFramesCount <= 1}
                                        className="w-full mt-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Supprimer la frame active"
                                    >
                                        <Trash2 size={16} />
                                        Supprimer la frame active
                                    </button>
                                </div>

                                {/* Presets Selector */}
                                <div className="border-t border-[var(--border-color)] pt-5">
                                    <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Presets d'Animation</h3>
                                    
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white bg-[var(--bg-element)] text-xs font-bold flex items-center justify-between transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={16} className="text-yellow-400" />
                                                <span>Presets Système & Perso</span>
                                            </div>
                                            <ChevronDown size={14} />
                                        </button>

                                        {showPresetsMenu && (
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl z-40 p-2 text-sm text-[var(--text-primary)] max-h-80 overflow-y-auto custom-scrollbar">
                                                <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2 py-1">Stickmans Prédéfinis</div>
                                                {animationPresets.map(preset => (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => {
                                                            onApplyPreset(preset.frames);
                                                            setShowPresetsMenu(false);
                                                        }}
                                                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--bg-element)] transition-colors text-xs flex items-center justify-between"
                                                    >
                                                        <span>{preset.name}</span>
                                                        <span className="text-[10px] bg-[var(--bg-element)] px-1 py-0.5 rounded text-[var(--text-secondary)]">{preset.frames.length} f</span>
                                                    </button>
                                                ))}
                                                
                                                {customPresets.length > 0 && (
                                                    <>
                                                        <div className="w-full h-px bg-[var(--border-color)] my-1.5" />
                                                        <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-2 py-1">Mes Presets</div>
                                                        {customPresets.map(preset => (
                                                            <div
                                                                key={preset.id}
                                                                onClick={() => {
                                                                    onApplyPreset(preset.frames);
                                                                    setShowPresetsMenu(false);
                                                                }}
                                                                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--bg-element)] transition-colors text-xs flex items-center justify-between cursor-pointer group/preset"
                                                            >
                                                                <span>{preset.name}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] bg-[var(--bg-element)] px-1 py-0.5 rounded text-[var(--text-secondary)]">{preset.frames.length} f</span>
                                                                    <button
                                                                        onClick={(e) => onDeletePreset(preset.id, e)}
                                                                        className="p-0.5 text-[var(--text-secondary)] hover:text-red-500 rounded transition-opacity"
                                                                    >
                                                                        <Trash2 size={11} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => {
                                            onSaveAsPreset();
                                            setShowPresetsMenu(false);
                                        }}
                                        className="w-full mt-2.5 py-3 bg-[var(--accent)] hover:opacity-90 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                    >
                                        Sauvegarder ce plan en preset
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
