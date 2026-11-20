import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import type { StoryboardCard } from '../modules/frame/types';
import type { StoryboardProject } from '../store/useStoryboardStore';

export interface FlowManifestShot {
    uid: string;
    shot: string;
    title: string;
    focalLength: string;
    scale: string;
    movement: string;
    status: 'draft' | 'ready' | 'shot';
    notes: string;
    lightingSummary: string;
    soundNotes: string;
    takeCount: number;
    flowFrameCardId?: string;
    flowLightSetupId?: string;
    flowTrackShotId?: string;
    flowPatchSceneId?: string;
    assets?: {
        storyboardPng?: string;
        lightPlotPng?: string;
    };
}

export interface FlowManifestSequence {
    sequence: string;
    locationName: string;
    locationEffect: string;
    shots: FlowManifestShot[];
}

export interface FlowSuiteManifest {
    format: 'flowsuite';
    version: '1.0.0';
    updatedAt: number;
    updatedBy: 'flowlight' | 'flowframe' | 'flowtrack' | 'flowpatch';
    meta: {
        id: string;
        title: string;
        director: string;
        dop: string;
        gaffer: string;
        soundMixer: string;
        producer: string;
        date: string;
        aspectRatio: '16:9' | '2.39:1' | '4:3' | '9:16';
        whiteBalanceKelvin: number;
    };
    modules: {
        flowframe: boolean;
        flowlight: boolean;
        flowtrack: boolean;
        flowpatch: boolean;
    };
    sequences: FlowManifestSequence[];
}

// Preserved foreign module files from the last opened .flow archive (FlowLight, FlowTrack, FlowPatch)
const preservedForeignFiles = new Map<string, Uint8Array>();

function dataUrlToUint8Array(dataUrl?: string): Uint8Array | null {
    if (!dataUrl) return null;
    const idx = dataUrl.indexOf(',');
    if (idx === -1) return null;
    try {
        const bin = atob(dataUrl.slice(idx + 1));
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    } catch {
        return null;
    }
}

function createCardFromManifestShot(
    seq: FlowManifestSequence,
    sh: FlowManifestShot
): StoryboardCard {
    const id = sh.flowFrameCardId || sh.uid || uuidv4();
    const descParts = [sh.title, sh.notes].filter(p => p && p.trim().length > 0);
    return {
        id,
        type: 'draw',
        data: '',
        subFrames: [{ id: uuidv4(), data: '', duration: 3 }],
        info: {
            sequence: seq.sequence || '1',
            shot: sh.shot || '1',
            scale: sh.scale || 'Plan Moyen',
            movement: sh.movement || 'Fixe',
            description: descParts.join(' — '),
            duration: 3,
            focalLength: sh.focalLength || '35mm',
            cameraAngle: 'Niveau œil',
            support: 'Trépied',
            locationEffect: seq.locationEffect || 'INT. JOUR',
            soundType: 'Synchrone',
            lightingNotes: sh.lightingSummary || '',
            shotStatus: sh.status || 'draft'
        }
    };
}

/**
 * Exports a FlowFrame StoryboardProject as a universal `.flow` ZIP container.
 * Embeds manifest.json, shared/crew.json, modules/flowframe.json, PNG assets per card,
 * AND preserves any existing FlowLight / FlowTrack / FlowPatch modules untouched.
 */
export async function exportFlowFramePackageBlob(project: StoryboardProject): Promise<Blob> {
    const zip = new JSZip();

    // 1. Re-attach preserved foreign modules & assets (FlowLight, FlowTrack, FlowPatch, shared/floorplans.json)
    for (const [path, bytes] of preservedForeignFiles.entries()) {
        zip.file(path, bytes);
    }

    // 2. Build universal manifest.json grouped by sequence
    const seqOrder = Array.from(new Set(project.cards.map(c => String(c.info?.sequence || '1'))));
    const sequences: FlowManifestSequence[] = seqOrder.map(seq => {
        const seqCards = project.cards.filter(c => String(c.info?.sequence || '1') === seq);
        const firstInfo = seqCards[0]?.info;
        return {
            sequence: seq,
            locationName: `Décor Séquence ${seq}`,
            locationEffect: firstInfo?.locationEffect || 'INT. JOUR',
            shots: seqCards.map((card, idx) => ({
                uid: card.id,
                shot: String(card.info?.shot || idx + 1),
                title:
                    card.info?.description?.trim().slice(0, 64) ||
                    `S${seq.padStart(2, '0')}·P${String(card.info?.shot || idx + 1).padStart(2, '0')}`,
                focalLength: card.info?.focalLength || '35mm',
                scale: card.info?.scale || 'Plan Moyen',
                movement: card.info?.movement || 'Fixe',
                status: card.info?.shotStatus || 'draft',
                notes: card.info?.description || '',
                lightingSummary: card.info?.lightingNotes || '',
                soundNotes: card.info?.sfx || card.info?.dialogue || '',
                takeCount: 0,
                flowFrameCardId: card.id,
                assets: {
                    storyboardPng: `assets/flowframe/${card.id}.png`
                }
            }))
        };
    });

    const manifest: FlowSuiteManifest = {
        format: 'flowsuite',
        version: '1.0.0',
        updatedAt: Date.now(),
        updatedBy: 'flowframe',
        meta: {
            id: project.id,
            title: project.title,
            director: project.director || '',
            dop: project.dop || '',
            gaffer: '',
            soundMixer: '',
            producer: '',
            date: new Date().toLocaleDateString('fr-FR'),
            aspectRatio: project.aspectRatio || '16:9',
            whiteBalanceKelvin: 5600
        },
        modules: {
            flowframe: true,
            flowlight: preservedForeignFiles.has('modules/flowlight.json'),
            flowtrack: preservedForeignFiles.has('modules/flowtrack.json'),
            flowpatch: preservedForeignFiles.has('modules/flowpatch.json')
        },
        sequences
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Only write shared/crew.json if not already richer from another module
    if (!preservedForeignFiles.has('shared/crew.json')) {
        zip.file(
            'shared/crew.json',
            JSON.stringify(
                {
                    director: project.director || '',
                    dop: project.dop || '',
                    gaffer: '',
                    soundMixer: '',
                    producer: ''
                },
                null,
                2
            )
        );
    }

    // 3. FlowFrame full module data
    zip.file('modules/flowframe.json', JSON.stringify(project, null, 2));

    // 4. Write storyboard card PNGs into assets/flowframe/<cardId>.png for FlowLight Monitor
    for (const card of project.cards) {
        const src = card.subFrames?.[0]?.data || card.data || card.backgroundData;
        const bytes = dataUrlToUint8Array(src);
        if (bytes) {
            zip.file(`assets/flowframe/${card.id}.png`, bytes);
        }
    }

    return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

export interface FlowFrameImportResult {
    project: StoryboardProject;
    sourceKind: 'flow_package' | 'flowframe_json';
    createdFromFlowLight: boolean;
}

/**
 * Smart universal importer for FlowFrame:
 * Opens `.flow` (ZIP container from FlowLight / FlowFrame / FlowTrack / FlowPatch)
 * OR legacy `.json` FlowFrame files.
 */
export async function importAnyFlowFileInFrame(file: File): Promise<FlowFrameImportResult> {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

    if (!isZip) {
        preservedForeignFiles.clear();
        const text = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.cards)) {
            return {
                project: {
                    id: parsed.id || uuidv4(),
                    title: parsed.title || 'Projet importé',
                    director: parsed.director || '',
                    dop: parsed.dop || '',
                    aspectRatio: parsed.aspectRatio || '16:9',
                    cards: parsed.cards,
                    items: parsed.items || [],
                    view: parsed.view || { x: 0, y: 0, zoom: 1 },
                    updatedAt: Date.now()
                },
                sourceKind: 'flowframe_json',
                createdFromFlowLight: false
            };
        }
        throw new Error('Fichier JSON FlowFrame invalide.');
    }

    const zip = await JSZip.loadAsync(buf);

    // Preserve all foreign module files (FlowLight, FlowTrack, FlowPatch, shared/floorplans.json, etc.)
    preservedForeignFiles.clear();
    for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const isOwnedByFlowFrame =
            path === 'manifest.json' ||
            path === 'modules/flowframe.json' ||
            path.startsWith('assets/flowframe/');
        if (!isOwnedByFlowFrame) {
            preservedForeignFiles.set(path, await entry.async('uint8array'));
        }
    }

    const manifestFile = zip.file('manifest.json');
    const manifest: FlowSuiteManifest | null = manifestFile
        ? JSON.parse(await manifestFile.async('string'))
        : null;

    // Case A: modules/flowframe.json already exists -> load it and merge any new shots from manifest
    const ffFile = zip.file('modules/flowframe.json');
    if (ffFile) {
        const parsed = JSON.parse(await ffFile.async('string'));
        const cards: StoryboardCard[] = Array.isArray(parsed.cards) ? [...parsed.cards] : [];

        if (manifest && Array.isArray(manifest.sequences)) {
            for (const seq of manifest.sequences) {
                for (const sh of seq.shots) {
                    const match = cards.find(
                        c =>
                            (sh.flowFrameCardId && c.id === sh.flowFrameCardId) ||
                            (String(c.info.sequence) === String(seq.sequence) &&
                                String(c.info.shot) === String(sh.shot))
                    );
                    if (match) {
                        if (sh.lightingSummary && !match.info.lightingNotes) {
                            match.info.lightingNotes = sh.lightingSummary;
                        }
                        if (sh.focalLength && !match.info.focalLength) {
                            match.info.focalLength = sh.focalLength;
                        }
                    } else {
                        cards.push(createCardFromManifestShot(seq, sh));
                    }
                }
            }
        }

        return {
            project: {
                id: parsed.id || manifest?.meta?.id || uuidv4(),
                title: parsed.title || manifest?.meta?.title || 'Projet Flow Suite',
                director: parsed.director || manifest?.meta?.director || '',
                dop: parsed.dop || manifest?.meta?.dop || '',
                aspectRatio: parsed.aspectRatio || manifest?.meta?.aspectRatio || '16:9',
                cards,
                items: parsed.items || [],
                view: parsed.view || { x: 0, y: 0, zoom: 1 },
                updatedAt: Date.now()
            },
            sourceKind: 'flow_package',
            createdFromFlowLight: false
        };
    }

    // Case B: Created in FlowLight (or FlowTrack/FlowPatch) -> auto-generate sequences & shots ready to draw!
    if (manifest && Array.isArray(manifest.sequences) && manifest.sequences.length > 0) {
        const cards: StoryboardCard[] = [];
        for (const seq of manifest.sequences) {
            for (const sh of seq.shots) {
                cards.push(createCardFromManifestShot(seq, sh));
            }
        }

        return {
            project: {
                id: manifest.meta.id || uuidv4(),
                title: manifest.meta.title || 'Projet FlowLight',
                director: manifest.meta.director || '',
                dop: manifest.meta.dop || '',
                aspectRatio: manifest.meta.aspectRatio || '16:9',
                cards,
                items: [],
                view: { x: 0, y: 0, zoom: 1 },
                updatedAt: Date.now()
            },
            sourceKind: 'flow_package',
            createdFromFlowLight: true
        };
    }

    throw new Error('Archive .flow invalide ou sans séquences.');
}
