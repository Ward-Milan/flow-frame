export type DockSlot = 'left' | 'bottom' | 'right';
export type DockPanelId = 'tools' | 'poses' | 'navigation';

export interface DockLayout {
    left: DockPanelId;
    bottom: DockPanelId;
    right: DockPanelId;
}

export interface PanelCollapsedState {
    tools: boolean;
    poses: boolean;
    navigation: boolean;
}

export const PANEL_NAMES: Record<DockPanelId, string> = {
    tools: 'Outils de Dessin',
    poses: 'Poses & Décor',
    navigation: 'Navigation Canevas'
};

export const DEFAULT_DOCK_LAYOUT: DockLayout = {
    left: 'tools',
    bottom: 'poses',
    right: 'navigation'
};

export const DEFAULT_COLLAPSED_STATE: PanelCollapsedState = {
    tools: false,
    poses: false,
    navigation: false
};
