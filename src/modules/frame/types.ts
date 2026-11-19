
export type UserProfile = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    isGuest: boolean;
    createdAt: number;
};

export type Note = {
    id: string;
    title: string;
    content: string;
    images: string[];
    lastModified: number;
};

export type SubFrame = {
    id: string;
    data: string; // base64 drawing data
    duration?: number; // duration in seconds of this subframe
};

export type StoryboardCard = {
    id: string;
    type: 'draw' | 'image';
    data: string;
    backgroundData?: string; // Shared background layer (Décor) across all poses of this shot
    subFrames?: SubFrame[]; // Array of subframes for micro-animations
    info: {
        sequence: string;
        shot: string;
        scale: string;
        movement: string;
        description: string;
        dialogue?: string;
        sfx?: string;
        duration?: number; // Duration in seconds for timeline
        // Studio Technical Shot List Metadata
        focalLength?: string; // '18mm' | '24mm' | '35mm' | '50mm' | '85mm' | '135mm'
        cameraAngle?: string; // 'Niveau œil' | 'Plongée' | 'Contre-plongée' | 'Débullé' | 'Zénithal'
        support?: string; // 'Trépied' | 'Épaule' | 'Steadicam' | 'Rails' | 'Grue/Drone'
        locationEffect?: string; // 'INT. JOUR' | 'INT. NUIT' | 'EXT. JOUR' | 'EXT. NUIT'
        soundType?: string; // 'Synchrone' | 'MOS (Muet)' | 'Voix Off'
        lightingNotes?: string;
        shotStatus?: 'draft' | 'ready' | 'shot';
    };
};

export type CanvasItemBase = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    zIndex: number;
};

export type StoryboardCanvasItem = CanvasItemBase & {
    type: 'card';
    cardId: string;
};

export type TextItem = CanvasItemBase & {
    type: 'text';
    content: string;
    fontSize: number;
    color: string;
};

export type ArrowItem = CanvasItemBase & {
    type: 'arrow';
    startItemId: string;
    endItemId: string;
    color: string;
};

export type CanvasItem = StoryboardCanvasItem | TextItem | ArrowItem;

export type StoryboardData = {
    cards: StoryboardCard[];
    items: CanvasItem[];
    view: { x: number; y: number; zoom: number };
};

export type GearItem = {
    id: string;
    name: string;
    category: 'Camera' | 'Lumière' | 'Son' | 'Machinerie' | 'Déco';
    source: 'Interne' | 'Location';
    cost: number;
};

export type ScheduleBlock = {
    id: string;
    start: string;
    end: string;
    who: string;
    where: string;
    activity: string;
};

export type ScheduleDay = {
    id: string;
    dayName: string;
    blocks: ScheduleBlock[];
};

export type LegalItem = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    usageType: 'Commercial' | 'Non-commercial' | 'Interne' | 'Pédagogique';
    status: 'En attente' | 'Signé' | 'Refusé';
    date: string;
    signature: string;
    notes: string;
    documentId?: string; // Ajout pour lier à un document spécifique si besoin
};

export type CopyrightCession = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    contributionType: 'Vidéo' | 'Voix' | 'Musique' | 'Texte' | 'Autre';
    contributionDescription: string;
    duration: string;      // e.g. "5 ans", "Illimitée"
    territory: 'France' | 'Europe' | 'Monde entier' | string;
    compensation: string;  // e.g. "Gratuit", "500€"
    status: 'En attente' | 'Signé' | 'Refusé';
    date: string;
    signature: string;
    notes: string;
};

export type LocationRelease = {
    id: string;
    ownerFirstName: string;
    ownerLastName: string;
    ownerEmail: string;
    ownerPhone: string;
    locationAddress: string;
    locationName: string;   // e.g. "Appartement", "Bureau", "Entrepôt"
    shootDateStart: string;
    shootDateEnd: string;
    authorizedHours: string; // e.g. "08:00 - 20:00"
    conditions: string;
    status: 'En attente' | 'Signé' | 'Refusé';
    signature: string;
    notes: string;
};

export type FreeShot = {
    id: string;
    name: string;
    number: number;
    createdAt: number;
};

export type Take = {
    id: string;
    shotId: string | null; // null for free mode takes
    freeShotId?: string | null; // Reference to FreeShot in free mode
    number: number;
    duration: number; // Duration in seconds (manual entry)
    status: 'good' | 'bad';
    soundPb: boolean;
    imagePb: boolean;
    notes?: string;
    timestamp: number;
};

export type Protagonist = {
    id: string;
    name: string;
    role: string;
    description: string;
};

export type MoodboardItem = {
    id: string;
    url: string;
    caption: string;
};

export type RealizationItem = {
    id: string;
    date: string;
    description: string;
};

export type DirectorNote = {
    presentation: string;
    realizationList: RealizationItem[];
};

export type Sequence = {
    id: string;
    name: string;
    duration: string;
    description: string;
};

export type PlanningItem = {
    id: string;
    date: string;
    action: string;
    comment: string;
};

export type Expense = {
    id: string;
    type: string;
    description: string;
    price: number;
};

export type Funding = {
    id: string;
    source: string;
    description: string;
    status: 'En demande' | 'Approuvé' | 'Rejeté' | 'Payé';
    amount: number;
};

// ─── LIGHTING SCENE ──────────────────────────────────────────────────────────
// Re-export from canonical source
export type SceneObject = any;
export type Drawing = any;
export type Measurement = any;
export type LightSceneData = any;
export type FixtureProperties = any;
export type PropProperties = any;
export type GelInfo = any;

// ─── VAULT (Document Manager) ────────────────────────────────────────────────

export type VaultDocumentType = 'pdf' | 'image' | 'xml' | 'other';

export type VaultDocument = {
    id: string;
    name: string;
    type: VaultDocumentType;
    mimeType: string;
    size: number;
    folderId: string; // Parent folder ID
    pathInZip: string; // "vault/uuid_name.ext"
    tags: string[];
    createdAt: number;
    updatedAt: number;
    blobUrl?: string; // Runtime only
    thumbnailUrl?: string; // Runtime only for images
    source: 'import' | 'generated' | 'uploaded'; // Where it came from
    sourceModule?: 'frame' | 'light' | 'prod'; // Which module generated it
};

export type VaultFolder = {
    id: string;
    name: string;
    parentId: string | null; // null = root folder
    isSystem: boolean; // true for predefined folders
    color?: string; // Optional folder color
    createdAt: number;
};

export type VaultData = {
    folders: VaultFolder[];
    documents: VaultDocument[];
};

// Legacy DocumentMetadata (for backward compat - will migrate to VaultDocument)
export type DocumentMetadata = {
    id: string; // UUID
    originalName: string;
    category: 'legal' | 'contract' | 'travel' | 'script';
    pathInZip: string; // "documents/uuid_name.pdf"
    uploadDate: number;
    fileSize: number;
    mimeType: string;
    blobUrl?: string; // Runtime only
};

export type CallSheetCrewMember = {
    id: string;
    name: string;
    role: string;
    callTime: string;
    phone: string;
};

export type CallSheetCastMember = {
    id: string;
    name: string;
    role: string;
    callTime: string;
    makeup: string;
};

export type ImageRelease = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    email?: string;
    phone?: string;
    address?: string;
    usageType: 'Commercial' | 'Non-commercial' | 'Interne' | 'Pédagogique';
    status: 'En attente' | 'Signé' | 'Refusé';
    date?: string;
    signature?: string;
    notes?: string;
};

export type ProductionDossier = {
    id: string;
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    documents: DocumentMetadata[]; // attachments
    imageReleases: ImageRelease[];
    crewList: CallSheetCrewMember[];
    castList: CallSheetCastMember[];
    scheduleSummary?: string;
    notes?: string;
};

export type DevDossier = {
    id: string;
    title: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    status: 'Brouillon' | 'En révision' | 'Validé' | 'Archivé';
    documents: DocumentMetadata[];
    legalReleases: LegalItem[];
    notes: string;
    tags: string[];
};

export type CallSheet = {
    id: string;
    label: string; // e.g. "Jour 1 - Extérieur Forêt"
    shootingDate: string;
    location: string;
    director: string;
    producer: string;
    callTime: string;
    shootStart: string;
    lunchBreak: string;
    wrapTime: string;
    crew: CallSheetCrewMember[];
    cast: CallSheetCastMember[];
    notes: string;
    safetyHospital: string;
    safetyRisks: string;
};

export type LightPlotDocument = {
    id: string;
    title: string;
    lastModified: number;
    data: LightSceneData;
};

export type StoryboardDocument = {
    id: string;
    title: string;
    lastModified: number;
    data: StoryboardData;
};

export type ProjectDesktopCard = {
    id: string;
    documentId?: string;
    cardType: 'light_plot' | 'storyboard' | 'note' | 'document' | 'todo' | 'color_swatch' | 'link' | 'board' | 'column' | 'shot_tracker';
    title: string;
    subtitle?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    color?: string;
    parentId?: string;
    drawData?: string;
    noteContent?: string;
    docContent?: any;
    colorContent?: string;
    todoContent?: { id: string; text: string; done: boolean }[];
    linkContent?: { url: string; image?: string; description?: string };
    boardContent?: { boardId: string };
    columnContent?: { cardIds: string[] };
};

export type ProjectData = {
    vault: VaultData;
    brainstorm: {
        notes: Note[];
    };
    development: {
        coverImage: string;
        a_accroche: {
            title: string;
            author: string;
            logline: string;
            treatment: string;
            image?: string;
        };
        b_intentions: {
            personal: string;
            personalImage?: string;
            context: string;
            contextImage?: string;
            realization: string;
            realizationImage?: string;
            sound: string;
            soundImage?: string;
        };
        director: DirectorNote;
        c_narration: {
            protagonists: Protagonist[];
            sequencer: Sequence[];
        };
        planning: PlanningItem[];
        finance: {
            expenses: Expense[];
            funding: Funding[];
        };
        moodboard: {
            images: MoodboardItem[];
        };
        devDossiers: DevDossier[];
        productionFolders?: { id: string; title: string; development: any }[];
    };
    light: {
        fixtures: any[];
        patch: any;
        positions: any[];
    };
    lightScene?: LightSceneData;
    lightPlots?: LightPlotDocument[];
    storyboard: StoryboardData;
    storyboards?: StoryboardDocument[];
    desktopCards?: ProjectDesktopCard[];
    desktopConnections?: { id: string; fromId: string; toId: string }[];
    prepa: {
        gear: GearItem[];
        schedule: ScheduleDay[];
        legal: LegalItem[];
        copyrightCessions: CopyrightCession[];
        locationReleases: LocationRelease[];
        callSheets: CallSheet[];
        dossiers: ProductionDossier[];
    };
    tournage: {
        currentCardId: string | null;
        takes: Take[];
        trackingMode: 'storyboard' | 'free';
        freeShots: FreeShot[];
    };
    settings?: {
        director: string;
        accentColor: string;
        projectType?: 'project' | 'light_plot' | 'storyboard';
        autoSaveEnabled?: boolean;
        autoSaveInterval?: 1 | 3 | 5 | 10;
    };
};

export interface ProjectManifest {
    projectName: string;
    author: string;
    appVersion: string;
    createdAt: number;
    lastModified: number;
    thumbnail?: string;
}

export type BlobURLMap = Map<string, string>;

export type Project = {
    id: string;
    title: string;
    lastModified: number;
    data: ProjectData;
};
