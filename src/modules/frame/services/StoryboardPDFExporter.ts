import { jsPDF } from 'jspdf';
import { MODULE_COLORS, PDFStyleService } from '../../../core/PDFStyleService';
import type { StoryboardCard } from '../types';

export interface StoryboardPDFOptions {
    projectTitle: string;
    projectDate?: string;
    director?: string;
    dop?: string;
    credits?: string[];
}

const resolveImageToBase64 = async (url: string): Promise<{ format: string; base64: string } | null> => {
    if (!url) return null;
    if (url.startsWith('data:image/')) {
        const commaIndex = url.indexOf(',');
        if (commaIndex !== -1) {
            const header = url.substring(0, commaIndex);
            const base64 = url.substring(commaIndex + 1);
            const match = header.match(/data:image\/([a-zA-Z0-9+.-]+);base64/);
            if (match) {
                return {
                    format: match[1] === 'jpeg' ? 'jpg' : match[1],
                    base64
                };
            }
        }
        return null;
    }
    if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const result = reader.result as string;
                    const commaIndex = result.indexOf(',');
                    if (commaIndex !== -1) {
                        const header = result.substring(0, commaIndex);
                        const base64 = result.substring(commaIndex + 1);
                        const match = header.match(/data:image\/([a-zA-Z0-9+.-]+);base64/);
                        const ext = match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'png';
                        resolve({ format: ext, base64 });
                    } else {
                        resolve(null);
                    }
                };
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.error("Failed to fetch and resolve asset URL to base64:", url, err);
            return null;
        }
    }
    return null;
};

export class StoryboardPDFExporter {

    /**
     * Generates a professional storyboard contact sheet (planche de storyboard) PDF
     */
    static async generateStoryboardPDF(
        cards: StoryboardCard[],
        options: StoryboardPDFOptions
    ): Promise<Blob> {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const styleService = new PDFStyleService(doc, 'frame');

        const W = 210;
        const H = 297;
        const margin = 12;
        let y = 26;
        let pageCount = 1;

        // Flatten cards to individual subframes/drawings for sequential list
        interface FlatClip {
            id: string;
            clipName: string;
            sceneNumber: string;
            shotNumber: string;
            duration: number;
            imageData: string;
            scale: string;
            focalLength: string;
            cameraAngle: string;
            movement: string;
            support: string;
            locationEffect: string;
            soundType: string;
            description: string;
        }

        const clips: FlatClip[] = [];
        cards.forEach((card) => {
            const cardDuration = card.info.duration || 3;
            const subFrames = card.subFrames && card.subFrames.length > 0
                ? card.subFrames
                : [{ id: 'default', data: card.data || '' }];
            
            const defaultDur = cardDuration / subFrames.length;
            
            subFrames.forEach((frame, idx) => {
                const clipName = `SEQ ${card.info.sequence} · PLAN ${card.info.shot}${subFrames.length > 1 ? ` · POSE ${idx + 1}` : ''}  [${card.info.locationEffect || 'INT. JOUR'}]`;
                clips.push({
                    id: frame.id,
                    clipName,
                    sceneNumber: card.info.sequence,
                    shotNumber: card.info.shot,
                    duration: frame.duration !== undefined ? frame.duration : defaultDur,
                    imageData: frame.data || card.data || '',
                    scale: card.info.scale || 'Plan Moyen',
                    focalLength: card.info.focalLength || '35mm',
                    cameraAngle: card.info.cameraAngle || 'Niveau œil',
                    movement: card.info.movement || 'Fixe',
                    support: card.info.support || 'Trépied',
                    locationEffect: card.info.locationEffect || 'INT. JOUR',
                    soundType: card.info.soundType || 'Synchrone',
                    description: card.info.description || ''
                });
            });
        });

        // Helper to draw headers on new pages
        const drawPageHeader = (pageNum: number) => {
            styleService.drawHeader({
                title: 'PLANCHE DE STORYBOARD',
                subtitle: 'Découpage Technique & Dessins d\'Animation',
                projectTitle: options.projectTitle,
                date: options.projectDate,
                credits: options.credits,
                pageNumber: pageNum,
                totalPages: 99 // Placeholder (will be replaced by doc.getNumberOfPages() later)
            });
        };

        // Draw first page header
        drawPageHeader(1);

        if (clips.length === 0) {
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('Aucun plan à afficher dans le storyboard.', W / 2, H / 2, { align: 'center' });
        } else {
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i];
                const cardHeight = 36;
                const cardSpacing = 4;

                // Check for page overflow
                if (y + cardHeight > H - 15) {
                    doc.addPage();
                    pageCount++;
                    drawPageHeader(pageCount);
                    y = 26;
                }

                // 1. Draw Card Background Box
                const isEven = i % 2 === 0;
                doc.setFillColor(...(isEven ? MODULE_COLORS.frame.rowEven : MODULE_COLORS.frame.rowOdd));
                doc.rect(margin, y, W - margin * 2, cardHeight, 'F');
                doc.setDrawColor(...MODULE_COLORS.frame.border);
                doc.rect(margin, y, W - margin * 2, cardHeight, 'S');

                // 2. Draw Image Thumbnail (keeping 16:9 ratio)
                const thumbW = 48;
                const thumbH = 27;
                const tx = margin + 4.5;
                const ty = y + 4.5;

                // Draw gray bounding frame for the image
                doc.setFillColor(240, 240, 242);
                doc.rect(tx, ty, thumbW, thumbH, 'F');
                doc.setDrawColor(...MODULE_COLORS.frame.border);
                doc.rect(tx, ty, thumbW, thumbH, 'S');

                if (clip.imageData) {
                    try {
                        const resolved = await resolveImageToBase64(clip.imageData);
                        if (resolved) {
                            const format = resolved.format.toUpperCase() === 'JPEG' || resolved.format.toUpperCase() === 'JPG' ? 'JPEG' : 'PNG';
                            doc.addImage(resolved.base64, format, tx, ty, thumbW, thumbH, undefined, 'FAST');
                        }
                    } catch (err) {
                        console.error("Failed to render storyboard image in PDF:", err);
                    }
                } else {
                    doc.setFontSize(8);
                    doc.setTextColor(180, 180, 180);
                    doc.text('Pas d\'image', tx + thumbW / 2, ty + thumbH / 2 + 2, { align: 'center' });
                }

                // 3. Draw Index Circle Badge
                const bx = margin + 58;
                const by = y + 8;
                doc.setFillColor(...MODULE_COLORS.frame.accent);
                doc.circle(bx, by, 4.5, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.text(`${i + 1}`, bx, by + 2.5, { align: 'center' });

                // 4. Draw Title Metadata
                doc.setTextColor(...MODULE_COLORS.frame.textPrimary);
                doc.setFontSize(10.5);
                doc.setFont('helvetica', 'bold');
                doc.text(clip.clipName, bx + 7, by + 2.5);

                // 5. Draw Properties Grid (Optique, Cadrage, Angle, Mouvement, Support, Durée, Son)
                doc.setFontSize(7.5);
                doc.setTextColor(...MODULE_COLORS.frame.textSecondary);

                const propY = y + 17;
                doc.setFont('helvetica', 'bold');
                doc.text('Optique:', bx, propY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${clip.focalLength} · ${clip.scale} (${clip.cameraAngle})`, bx + 13, propY);

                const mouvX = bx + 68;
                doc.setFont('helvetica', 'bold');
                doc.text('Caméra:', mouvX, propY);
                doc.setFont('helvetica', 'normal');
                doc.text(`${clip.movement} [${clip.support}] · ${clip.duration.toFixed(1)}s`, mouvX + 12, propY);

                // 6. Draw Description / Action (Multi-line text box)
                const descY = y + 25;
                doc.setFont('helvetica', 'bold');
                doc.text(`Action (${clip.soundType}):`, bx, descY);
                doc.setFont('helvetica', 'normal');

                const maxDescWidth = W - margin * 2 - 58 - 28;
                const wrappedDesc = doc.splitTextToSize(clip.description || 'Aucune note d\'action.', maxDescWidth);
                doc.text(wrappedDesc, bx + 28, descY);

                y += cardHeight + cardSpacing;
            }
        }

        // Replace total pages placeholder in all headers
        const totalPagesCount = doc.getNumberOfPages();
        for (let j = 1; j <= totalPagesCount; j++) {
            doc.setPage(j);
            
            // Re-draw text with actual total page count
            doc.setFillColor(...MODULE_COLORS.frame.headerBg);
            doc.rect(W / 2 - 10, 14, 20, 3.5, 'F');
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`${j}/${totalPagesCount}`, W / 2, 16, { align: 'center' });
        }

        return doc.output('blob');
    }
}
