import { useState } from 'react';
import { X, Download, Film, Loader2, Video, FileText, Clapperboard, Music, Scissors, Image as ImageIcon, LayoutGrid, Package, CheckCircle2 } from 'lucide-react';
import type { StoryboardCard } from './types';
import { useStoryboardStore } from '../../store/useStoryboardStore';
import { useToast } from '../../shared';
import JSZip from 'jszip';
import { StoryboardPDFExporter } from './services/StoryboardPDFExporter';
import { exportFlowFramePackageBlob } from '../../core/FlowPackageService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
    cards: StoryboardCard[];
}

type ExportMode = 'flow' | 'xml' | 'zip' | 'pdf';

interface TimelineClipStep {
    clipId: string;
    fileName: string;
    shotLabel: string;
    sequence: string;
    shot: string;
    poseIndex: number;
    durationSeconds: number;
    durationFrames: number;
    startFrame: number;
    endFrame: number;
    poseData: string;
    backgroundData?: string;
}

// Helper: Composite shared backgroundData (Décor) + pose drawing onto a single canvas PNG
const renderCompositeShotPng = (
    poseData: string,
    backgroundData: string | undefined,
    width: number,
    height: number
): Promise<{ dataUrl: string; base64: string }> => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve({ dataUrl: '', base64: '' });
            return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const loadImage = (src?: string): Promise<HTMLImageElement | null> => {
            if (!src) return Promise.resolve(null);
            return new Promise((res) => {
                const img = new Image();
                img.onload = () => res(img);
                img.onerror = () => res(null);
                img.src = src;
            });
        };

        Promise.all([loadImage(backgroundData), loadImage(poseData)]).then(([bgImg, poseImg]) => {
            if (bgImg) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(bgImg, 0, 0, width, height);
                ctx.restore();
            }
            if (poseImg) {
                ctx.save();
                // Multiply blend so white background of pose layer doesn't hide shared Décor
                ctx.globalCompositeOperation = bgImg ? 'multiply' : 'source-over';
                ctx.drawImage(poseImg, 0, 0, width, height);
                ctx.restore();
            }
            const dataUrl = canvas.toDataURL('image/png');
            const commaIdx = dataUrl.indexOf(',');
            const base64 = commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : '';
            resolve({ dataUrl, base64 });
        });
    });
};

// Build standard XMEML v5 (Premiere Pro / DaVinci Resolve / Final Cut 7 / Vegas)
const buildXmemlTimeline = (
    projectTitle: string,
    clips: TimelineClipStep[],
    frameRate: number,
    width: number,
    height: number,
    audioFileName?: string | null
): string => {
    const totalFrames = clips.reduce((acc, c) => acc + c.durationFrames, 0);
    const esc = (str: string) =>
        (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const videoClipItems = clips
        .map(
            (c, idx) => `
                    <clipitem id="clipitem-v-${idx + 1}">
                        <name>${esc(c.fileName)}</name>
                        <enabled>TRUE</enabled>
                        <duration>${c.durationFrames}</duration>
                        <rate>
                            <timebase>${frameRate}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <start>${c.startFrame}</start>
                        <end>${c.endFrame}</end>
                        <in>0</in>
                        <out>${c.durationFrames}</out>
                        <file id="file-v-${idx + 1}">
                            <name>${esc(c.fileName)}</name>
                            <pathurl>./plans/${esc(c.fileName)}</pathurl>
                            <rate>
                                <timebase>${frameRate}</timebase>
                                <ntsc>FALSE</ntsc>
                            </rate>
                            <duration>${c.durationFrames}</duration>
                            <media>
                                <video>
                                    <samplecharacteristics>
                                        <width>${width}</width>
                                        <height>${height}</height>
                                    </samplecharacteristics>
                                </video>
                            </media>
                        </file>
                    </clipitem>`
        )
        .join('\n');

    const audioTrackXml = audioFileName
        ? `
            <audio>
                <track>
                    <clipitem id="clipitem-audio-1">
                        <name>${esc(audioFileName)}</name>
                        <enabled>TRUE</enabled>
                        <duration>${totalFrames}</duration>
                        <rate>
                            <timebase>${frameRate}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <start>0</start>
                        <end>${totalFrames}</end>
                        <in>0</in>
                        <out>${totalFrames}</out>
                        <file id="file-audio-1">
                            <name>${esc(audioFileName)}</name>
                            <pathurl>./audio/${esc(audioFileName)}</pathurl>
                            <media>
                                <audio>
                                    <channelcount>2</channelcount>
                                </audio>
                            </media>
                        </file>
                    </clipitem>
                </track>
            </audio>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
    <sequence id="sequence-1">
        <name>${esc(projectTitle)} — Storyboard Montage</name>
        <duration>${totalFrames}</duration>
        <rate>
            <timebase>${frameRate}</timebase>
            <ntsc>FALSE</ntsc>
        </rate>
        <timecode>
            <rate>
                <timebase>${frameRate}</timebase>
                <ntsc>FALSE</ntsc>
            </rate>
            <string>00:00:00:00</string>
            <frame>0</frame>
            <displayformat>NDF</displayformat>
        </timecode>
        <media>
            <video>
                <format>
                    <samplecharacteristics>
                        <rate>
                            <timebase>${frameRate}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <width>${width}</width>
                        <height>${height}</height>
                        <pixelaspectratio>square</pixelaspectratio>
                    </samplecharacteristics>
                </format>
                <track>${videoClipItems}
                </track>
            </video>${audioTrackXml}
        </media>
    </sequence>
</xmeml>`;
};

// Build FCPXML v1.9 (Final Cut Pro / DaVinci Resolve)
const buildFcpxmlTimeline = (
    projectTitle: string,
    clips: TimelineClipStep[],
    frameRate: number,
    width: number,
    height: number,
    audioFileName?: string | null
): string => {
    const totalFrames = clips.reduce((acc, c) => acc + c.durationFrames, 0);
    const esc = (str: string) =>
        (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const assetDefs = clips
        .map(
            (c, idx) =>
                `        <asset id="r${idx + 2}" name="${esc(c.fileName)}" src="./plans/${esc(
                    c.fileName
                )}" start="0s" duration="${c.durationFrames}/${frameRate}s" hasVideo="1" format="r1" />`
        )
        .join('\n');

    const audioAssetDef = audioFileName
        ? `\n        <asset id="raudio1" name="${esc(audioFileName)}" src="./audio/${esc(
              audioFileName
          )}" start="0s" duration="${totalFrames}/${frameRate}s" hasAudio="1" />`
        : '';

    const spineVideos = clips
        .map((c, idx) => {
            const audioLane =
                idx === 0 && audioFileName
                    ? `\n                            <audio name="${esc(
                          audioFileName
                      )}" ref="raudio1" lane="-1" offset="0s" duration="${totalFrames}/${frameRate}s" />`
                    : '';
            return `                        <video name="${esc(c.shotLabel)}" ref="r${
                idx + 2
            }" offset="${c.startFrame}/${frameRate}s" duration="${
                c.durationFrames
            }/${frameRate}s" start="0s">${audioLane}</video>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    <resources>
        <format id="r1" name="FFVideoFormat${height}p${frameRate}" frameDuration="1/${frameRate}s" width="${width}" height="${height}" />
${assetDefs}${audioAssetDef}
    </resources>
    <library>
        <event name="${esc(projectTitle)}">
            <project name="${esc(projectTitle)} — Animatique">
                <sequence format="r1" duration="${totalFrames}/${frameRate}s" tcStart="0s" tcFormat="NDF">
                    <spine>
${spineVideos}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>`;
};

const renderAnimaticVideo = (
    cards: StoryboardCard[],
    options: { frameRate: number; width: number; height: number },
    onProgress: (progress: number) => void,
    onFrame: (dataUrl: string) => void
): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = options.width;
        canvas.height = options.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Impossible de créer le contexte 2D'));
            return;
        }

        interface FrameStep {
            imageData: string;
            durationFrames: number;
        }

        const steps: FrameStep[] = [];
        for (const card of cards) {
            const cardDuration = card.info.duration || 3;
            const subFrames =
                card.subFrames && card.subFrames.length > 0
                    ? card.subFrames
                    : [{ id: 'default', data: card.data || '' }];

            const defaultDur = cardDuration / subFrames.length;
            for (const f of subFrames) {
                const dur = f.duration !== undefined ? f.duration : defaultDur;
                const composited = await renderCompositeShotPng(
                    f.data || card.data || '',
                    card.backgroundData,
                    options.width,
                    options.height
                );
                steps.push({
                    imageData: composited.dataUrl,
                    durationFrames: Math.max(1, Math.round(dur * options.frameRate))
                });
            }
        }

        const totalFrames = steps.reduce((sum, s) => sum + s.durationFrames, 0);
        let currentFrameIndex = 0;
        let currentStepIndex = 0;
        let framesInCurrentStep = 0;

        const stream = canvas.captureStream(options.frameRate);

        let mimeType = 'video/mp4;codecs=h264';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=h264';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm';
                }
            }
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            resolve(blob);
        };

        mediaRecorder.start();

        const frameInterval = 1000 / options.frameRate;

        const drawNextFrame = () => {
            if (currentStepIndex >= steps.length) {
                mediaRecorder.stop();
                return;
            }

            const step = steps[currentStepIndex];

            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                currentFrameIndex++;
                onProgress(Math.round((currentFrameIndex / totalFrames) * 90));
                onFrame(step.imageData);

                framesInCurrentStep++;
                if (framesInCurrentStep >= step.durationFrames) {
                    currentStepIndex++;
                    framesInCurrentStep = 0;
                }

                setTimeout(drawNextFrame, frameInterval);
            };

            img.onerror = () => {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                currentFrameIndex++;
                onProgress(Math.round((currentFrameIndex / totalFrames) * 90));

                currentStepIndex++;
                framesInCurrentStep = 0;
                setTimeout(drawNextFrame, frameInterval);
            };

            if (!step.imageData) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                currentFrameIndex++;
                onProgress(Math.round((currentFrameIndex / totalFrames) * 90));

                framesInCurrentStep++;
                if (framesInCurrentStep >= step.durationFrames) {
                    currentStepIndex++;
                    framesInCurrentStep = 0;
                }
                setTimeout(drawNextFrame, frameInterval);
            } else {
                img.src = step.imageData;
            }
        };

        drawNextFrame();
    });
};

export function ExportStoryboardModal({ isOpen, onClose, projectName, cards }: Props) {
    const toast = useToast();
    const audioTrackUrl = useStoryboardStore((s) => s.audioTrackUrl);
    const audioTrackName = useStoryboardStore((s) => s.audioTrackName);

    const [exportMode, setExportMode] = useState<ExportMode>('xml');

    // Config States
    const [frameRate, setFrameRate] = useState<number>(24);
    const [resolution, setResolution] = useState<'1080' | '4k'>('1080');

    // PDF Metadata States
    const [projectTitle, setProjectTitle] = useState<string>(projectName);
    const [director, setDirector] = useState<string>('');
    const [dop, setDop] = useState<string>('');

    // Progress States
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [currentFramePreview, setCurrentFramePreview] = useState<string>('');

    if (!isOpen) return null;

    const width = resolution === '4k' ? 3840 : 1920;
    const height = resolution === '4k' ? 2160 : 1080;

    const resolveDataUrlToBase64 = (dataUrl: string): { ext: string; base64: string } | null => {
        if (!dataUrl || !dataUrl.startsWith('data:')) return null;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return null;
        const header = dataUrl.substring(0, commaIndex);
        const base64 = dataUrl.substring(commaIndex + 1);
        if (header.includes('audio/mpeg') || header.includes('audio/mp3')) {
            return { ext: 'mp3', base64 };
        }
        if (header.includes('audio/wav')) {
            return { ext: 'wav', base64 };
        }
        return { ext: 'mp3', base64 };
    };

    const triggerBrowserDownload = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadAudioMp3Only = async () => {
        if (!audioTrackUrl) {
            toast.error("Aucune piste son n'est chargée dans l'animatique");
            return;
        }
        try {
            const res = await fetch(audioTrackUrl);
            const blob = await res.blob();
            const safeName =
                audioTrackName && audioTrackName.endsWith('.mp3')
                    ? audioTrackName
                    : `${projectTitle.replace(/[^a-zA-Z0-9-_]/g, '_')}_piste_son.mp3`;
            triggerBrowserDownload(blob, safeName);
            toast.success(`Piste audio exportée : ${safeName}`);
        } catch {
            toast.error("Impossible d'exporter la piste audio");
        }
    };

    const saveZipOrFile = async (blob: Blob, defaultFilename: string, ext: string, label: string) => {
        const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
        if (isTauri) {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { invoke } = await import('@tauri-apps/api/core');

            const path = await save({
                defaultPath: defaultFilename,
                filters: [{ name: label, extensions: [ext] }]
            });

            if (!path) return;
            const finalPath = path.toLowerCase().endsWith(`.${ext.toLowerCase()}`)
                ? path
                : `${path}.${ext}`;
            const buffer = await blob.arrayBuffer();
            await invoke('write_binary_file', {
                path: finalPath,
                data: Array.from(new Uint8Array(buffer))
            });
            toast.success(`${label} enregistré`);
            return;
        }

        triggerBrowserDownload(blob, defaultFilename);
        toast.success(`${label} téléchargé : ${defaultFilename}`);
    };

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(0);
        try {
            if (exportMode === 'flow') {
                // --- 0. UNIVERSAL FLOW SUITE PACKAGE (.flow ZIP) ---
                const currentProject = useStoryboardStore.getState().project;
                const flowBlob = await exportFlowFramePackageBlob(currentProject);
                const filename = `${(projectTitle || currentProject.title || 'projet').replace(/[^a-zA-Z0-9-_]/g, '_')}.flow`;
                await saveZipOrFile(flowBlob, filename, 'flow', 'Projet Flow Suite (.flow)');
            } else if (exportMode === 'pdf') {
                // --- 1. PDF EXPORT (Storyboard Contact Sheet) ---
                const credits: string[] = [];
                if (director) credits.push(`Réal: ${director}`);
                if (dop) credits.push(`DOP: ${dop}`);

                const pdfBlob = await StoryboardPDFExporter.generateStoryboardPDF(cards, {
                    projectTitle,
                    projectDate: new Date().toLocaleDateString('fr-FR'),
                    credits
                });

                const filename = `${projectTitle.replace(/[^a-zA-Z0-9-_]/g, '_')}_planche_storyboard.pdf`;
                await saveZipOrFile(pdfBlob, filename, 'pdf', 'Planche PDF');
            } else if (exportMode === 'xml') {
                // --- 2. PACK MONTAGE XML (XML Timeline + Plans Indépendants + Piste Son MP3) ---
                const zip = new JSZip();
                const plansFolder = zip.folder('plans');
                const audioFolder = zip.folder('audio');

                const clipSteps: TimelineClipStep[] = [];
                let currentFrameCursor = 0;
                let globalIndex = 1;

                const totalSubFramesCount = cards.reduce(
                    (acc, c) => acc + (c.subFrames && c.subFrames.length > 0 ? c.subFrames.length : 1),
                    0
                );

                for (const card of cards) {
                    const cardDuration = card.info.duration || 3;
                    const subFrames =
                        card.subFrames && card.subFrames.length > 0
                            ? card.subFrames
                            : [{ id: '1', data: card.data || '', duration: cardDuration }];

                    const rawSum = subFrames.reduce(
                        (acc, f) => acc + (f.duration || cardDuration / subFrames.length),
                        0
                    );
                    const normScale = rawSum > 0 ? cardDuration / rawSum : 1;

                    for (let idx = 0; idx < subFrames.length; idx++) {
                        const sub = subFrames[idx];
                        const durSec = (sub.duration || cardDuration / subFrames.length) * normScale;
                        const durFrames = Math.max(1, Math.round(durSec * frameRate));
                        const startFrame = currentFrameCursor;
                        const endFrame = startFrame + durFrames;
                        currentFrameCursor = endFrame;

                        const numStr = String(globalIndex).padStart(3, '0');
                        const fileName = `${numStr}_S${card.info.sequence}_P${card.info.shot}_Pose${idx + 1}.png`;
                        const poseImgData = idx === 0 ? sub.data || card.data || '' : sub.data || '';

                        const composited = await renderCompositeShotPng(
                            poseImgData,
                            card.backgroundData,
                            width,
                            height
                        );

                        if (composited.base64 && plansFolder) {
                            plansFolder.file(fileName, composited.base64, { base64: true });
                            setCurrentFramePreview(composited.dataUrl);
                        }

                        clipSteps.push({
                            clipId: `clip-${globalIndex}`,
                            fileName,
                            shotLabel: `S${card.info.sequence} P${card.info.shot} (Pose ${idx + 1})`,
                            sequence: card.info.sequence,
                            shot: card.info.shot,
                            poseIndex: idx + 1,
                            durationSeconds: durSec,
                            durationFrames: durFrames,
                            startFrame,
                            endFrame,
                            poseData: poseImgData,
                            backgroundData: card.backgroundData
                        });

                        setProgress(Math.round((globalIndex / Math.max(1, totalSubFramesCount)) * 85));
                        globalIndex++;
                    }
                }

                // Include audio track if present
                let exportedAudioFileName: string | null = null;
                if (audioTrackUrl && audioFolder) {
                    const parsedAudio = resolveDataUrlToBase64(audioTrackUrl);
                    if (parsedAudio) {
                        exportedAudioFileName =
                            audioTrackName && /\.(mp3|wav|m4a|ogg)$/i.test(audioTrackName)
                                ? audioTrackName.replace(/[^a-zA-Z0-9._-]/g, '_')
                                : `piste_son.${parsedAudio.ext}`;
                        audioFolder.file(exportedAudioFileName, parsedAudio.base64, { base64: true });
                    }
                }

                // Generate both XMEML (Premiere / DaVinci / Vegas) and FCPXML (Final Cut / DaVinci)
                const xmemlContent = buildXmemlTimeline(
                    projectTitle,
                    clipSteps,
                    frameRate,
                    width,
                    height,
                    exportedAudioFileName
                );
                const fcpxmlContent = buildFcpxmlTimeline(
                    projectTitle,
                    clipSteps,
                    frameRate,
                    width,
                    height,
                    exportedAudioFileName
                );

                zip.file('sequence_montage_premiere_davinci.xml', xmemlContent);
                zip.file('sequence_final_cut.fcpxml', fcpxmlContent);

                setProgress(95);
                const finalZipBlob = await zip.generateAsync({ type: 'blob' });
                const finalFilename = `${projectTitle.replace(/[^a-zA-Z0-9-_]/g, '_')}_pack_montage_XML.zip`;
                setProgress(100);

                await saveZipOrFile(finalZipBlob, finalFilename, 'zip', 'Pack Montage XML');
            } else {
                // --- 3. PACK VIDÉO MP4 + PLANS INDÉPENDANTS + AUDIO MP3 ---
                const videoBlob = await renderAnimaticVideo(
                    cards,
                    { frameRate, width, height },
                    setProgress,
                    setCurrentFramePreview
                );

                setProgress(92);

                const zip = new JSZip();
                const plansFolder = zip.folder('plans');
                zip.file('animatique.mp4', videoBlob);

                let absoluteIndex = 1;
                for (const card of cards) {
                    const subFrames =
                        card.subFrames && card.subFrames.length > 0
                            ? card.subFrames
                            : [{ id: 'default', data: card.data || '' }];

                    for (const [idx, frame] of subFrames.entries()) {
                        const fileIndexStr = String(absoluteIndex++).padStart(3, '0');
                        const clipName = `${fileIndexStr}_S${card.info.sequence}_P${card.info.shot}_Pose${idx + 1}.png`;
                        const poseImgData = idx === 0 ? frame.data || card.data || '' : frame.data || '';

                        const composited = await renderCompositeShotPng(
                            poseImgData,
                            card.backgroundData,
                            width,
                            height
                        );
                        if (composited.base64 && plansFolder) {
                            plansFolder.file(clipName, composited.base64, { base64: true });
                        }
                    }
                }

                if (audioTrackUrl) {
                    const parsedAudio = resolveDataUrlToBase64(audioTrackUrl);
                    if (parsedAudio) {
                        const audioName =
                            audioTrackName && /\.(mp3|wav)$/i.test(audioTrackName)
                                ? audioTrackName
                                : `piste_son.${parsedAudio.ext}`;
                        zip.file(audioName, parsedAudio.base64, { base64: true });
                    }
                }

                setProgress(97);
                const finalZipBlob = await zip.generateAsync({ type: 'blob' });
                const finalFilename = `${projectTitle.replace(/[^a-zA-Z0-9-_]/g, '_')}_pack_video_mp4.zip`;
                setProgress(100);

                await saveZipOrFile(finalZipBlob, finalFilename, 'zip', 'Pack Vidéo MP4');
            }

            onClose();
        } catch (err: any) {
            toast.error(err.message || "Erreur lors de l'exportation");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-[600px] flex flex-col overflow-hidden text-[var(--text-primary)]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                        <Film size={20} className="text-[var(--accent)]" />
                        <h2 className="text-lg font-bold">Exporter le Storyboard & Animatique</h2>
                    </div>
                    {!isExporting && (
                        <button
                            onClick={onClose}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {isExporting ? (
                    /* Progress Render State */
                    <div className="p-10 flex flex-col items-center justify-center gap-6">
                        {exportMode !== 'pdf' && currentFramePreview ? (
                            <div className="w-64 aspect-video rounded-xl overflow-hidden border border-[var(--border-color)] shadow-md bg-white relative">
                                <img
                                    src={currentFramePreview}
                                    className="w-full h-full object-contain"
                                    alt="Render preview"
                                />
                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                    <Loader2 size={24} className="animate-spin text-white drop-shadow" />
                                </div>
                            </div>
                        ) : (
                            <Loader2 size={40} className="animate-spin text-[var(--accent)]" />
                        )}
                        <div className="w-full text-center">
                            <div className="text-sm font-black mb-1.5">
                                {exportMode === 'flow'
                                    ? 'Création du projet Flow Suite (.flow)...'
                                    : exportMode === 'pdf'
                                    ? 'Génération de la planche PDF...'
                                    : exportMode === 'xml'
                                    ? 'Génération du Pack Montage XML + Plans Indépendants...'
                                    : 'Génération du Pack Vidéo MP4 + Plans...'}
                            </div>
                            {exportMode !== 'pdf' && exportMode !== 'flow' && (
                                <div className="text-xs text-[var(--text-secondary)] font-mono">
                                    {progress}% complété
                                </div>
                            )}
                        </div>
                        {exportMode !== 'pdf' && exportMode !== 'flow' && (
                            <div className="w-full bg-[var(--bg-element)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                                <div
                                    className="bg-[var(--accent)] h-full transition-all duration-150"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    /* Configuration Panel */
                    <>
                        {/* 4 Mode Tabs (Flow Suite .flow, PDF Sheet, XML Pack, Video MP4 Pack) */}
                        <div className="grid grid-cols-4 border-b border-[var(--border-color)] p-1 bg-[var(--bg-element)]/30 gap-1">
                            <button
                                onClick={() => setExportMode('flow')}
                                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
                                    exportMode === 'flow'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--bg-panel)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Package size={14} />
                                Projet .flow
                            </button>
                            <button
                                onClick={() => setExportMode('pdf')}
                                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
                                    exportMode === 'pdf'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--bg-panel)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <FileText size={14} />
                                Planche PDF
                            </button>
                            <button
                                onClick={() => setExportMode('xml')}
                                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
                                    exportMode === 'xml'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--bg-panel)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Clapperboard size={14} />
                                Montage XML
                            </button>
                            <button
                                onClick={() => setExportMode('zip')}
                                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
                                    exportMode === 'zip'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)] bg-[var(--bg-panel)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Video size={14} />
                                Vidéo MP4
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[55vh]">
                            {/* Info Box */}
                            {exportMode === 'flow' ? (
                                <div className="bg-[var(--bg-element)]/50 border border-[var(--border-color)] rounded-xl p-4 space-y-2 text-xs text-[var(--text-secondary)]">
                                    <p className="font-bold text-[var(--text-primary)] mb-1">
                                        Conteneur Universel Flow Suite (.flow) :
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            Archive portable contenant tout ton storyboard, les vignettes PNG et les données de séquences/plans.
                                        </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            S&apos;ouvre directement dans <strong>FlowLight</strong> (et les futurs <strong>FlowTrack</strong> &amp; <strong>FlowPatch</strong>) en préservant les plans de feu liés.
                                        </span>
                                    </p>
                                </div>
                            ) : exportMode === 'xml' ? (
                                <div className="bg-[var(--bg-element)]/50 border border-[var(--border-color)] rounded-xl p-4 space-y-2 text-xs text-[var(--text-secondary)]">
                                    <p className="font-bold text-[var(--text-primary)] mb-1">
                                        Pack Montage XML avec coupes & plans indépendants :
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <Scissors size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            <strong>Fichiers Timeline XML & FCPXML</strong> avec toutes les coupes et durées exactes plan par plan.
                                        </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <ImageIcon size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            <strong>Dossier /plans/</strong> contenant chaque plan et pose en image haute définition indépendante (Calque Décor + Pose fusionnés).
                                        </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <Music size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            <strong>Dossier /audio/</strong> incluant automatiquement la piste son MP3 synchronisée sur la timeline.
                                        </span>
                                    </p>
                                </div>
                            ) : exportMode === 'zip' ? (
                                <div className="bg-[var(--bg-element)]/50 border border-[var(--border-color)] rounded-xl p-4 space-y-2 text-xs text-[var(--text-secondary)]">
                                    <p className="font-bold text-[var(--text-primary)] mb-1">
                                        Contenu du Pack Vidéo MP4 :
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <Video size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            Vidéo animatique <strong>animatique.mp4</strong> au framerate et à la résolution choisis.
                                        </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <ImageIcon size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            <strong>Dossier /plans/</strong> avec toutes les images individuelles numérotées + piste son MP3.
                                        </span>
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-[var(--bg-element)]/50 border border-[var(--border-color)] rounded-xl p-4 space-y-2 text-xs text-[var(--text-secondary)]">
                                    <p className="font-bold text-[var(--text-primary)] mb-1">
                                        Fiche PDF de tournage :
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <LayoutGrid size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            Tableau ordonné contenant les planches sous format de vignettes.
                                        </span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <FileText size={14} className="shrink-0 mt-0.5 text-[var(--accent)]" />
                                        <span>
                                            Informations associées : Séquence, plan, durée, valeurs de cadrage, mouvements caméra et notes.
                                        </span>
                                    </p>
                                </div>
                            )}

                            {/* Audio Track Status & Standalone MP3 Export */}
                            {exportMode !== 'pdf' && exportMode !== 'flow' && (
                                <div className="flex items-center justify-between bg-[var(--bg-element)]/40 border border-[var(--border-color)] rounded-xl px-4 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <Music
                                            size={15}
                                            className={audioTrackUrl ? 'text-[#10B981]' : 'text-stone-500'}
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-[var(--text-primary)]">
                                                {audioTrackUrl
                                                    ? `Piste son incluse : ${audioTrackName || 'piste_son.mp3'}`
                                                    : 'Aucune piste son chargée'}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">
                                                {audioTrackUrl
                                                    ? 'Sera exportée dans le pack et liée dans la timeline XML'
                                                    : "Vous pouvez ajouter un fichier MP3 depuis l'onglet Animatique"}
                                            </span>
                                        </div>
                                    </div>
                                    {audioTrackUrl && (
                                        <button
                                            onClick={handleDownloadAudioMp3Only}
                                            className="px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#10B981] text-white text-[11px] font-bold transition-colors flex items-center gap-1.5"
                                            title="Télécharger uniquement la piste audio MP3"
                                        >
                                            <Download size={12} />
                                            <span>Exporter MP3 seul</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Options fields */}
                            {exportMode === 'flow' ? null : exportMode !== 'pdf' ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
                                            Cadence (Framerate)
                                        </label>
                                        <select
                                            value={frameRate}
                                            onChange={(e) => setFrameRate(Number(e.target.value))}
                                            className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value={24}>24 fps (Cinéma)</option>
                                            <option value={25}>25 fps (PAL / Broadcast)</option>
                                            <option value={30}>30 fps (Web / NTSC)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
                                            Résolution des plans
                                        </label>
                                        <select
                                            value={resolution}
                                            onChange={(e) => setResolution(e.target.value as '1080' | '4k')}
                                            className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="1080">1920×1080 (Full HD 1080p)</option>
                                            <option value="4k">3840×2160 (4K UHD)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
                                            Titre du Projet
                                        </label>
                                        <input
                                            type="text"
                                            value={projectTitle}
                                            onChange={(e) => setProjectTitle(e.target.value)}
                                            className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-medium"
                                            placeholder="Titre du projet"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
                                                Réalisateur
                                            </label>
                                            <input
                                                type="text"
                                                value={director}
                                                onChange={(e) => setDirector(e.target.value)}
                                                className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-medium"
                                                placeholder="Nom du Réalisateur"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-bold">
                                                Directeur Photo
                                            </label>
                                            <input
                                                type="text"
                                                value={dop}
                                                onChange={(e) => setDop(e.target.value)}
                                                className="w-full bg-[var(--bg-element)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-medium"
                                                placeholder="Directeur de la Photo"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-element)]/30">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleExport}
                                className="px-5 py-2.5 bg-[var(--accent)] text-white font-bold rounded-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-md"
                            >
                                <Download size={16} />
                                {exportMode === 'pdf'
                                    ? 'Générer la Planche PDF'
                                    : exportMode === 'xml'
                                    ? 'Exporter le Pack Montage XML (.zip)'
                                    : 'Exporter le Pack Vidéo MP4 (.zip)'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
