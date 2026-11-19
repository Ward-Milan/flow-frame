/**
 * PDFStyleService - Service centralisé pour le style des PDFs
 * 
 * Définit un style professionnel uniforme pour tous les générateurs PDF
 * de l'application, basé sur le style du module Light.
 */

import type { jsPDF } from 'jspdf';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PDFOrientation = 'portrait' | 'landscape';
export type PDFFormat = 'a4' | 'a3' | 'letter';

export interface PDFColors {
    accent: [number, number, number];
    headerBg: [number, number, number];
    textPrimary: [number, number, number];
    textSecondary: [number, number, number];
    textMuted: [number, number, number];
    rowOdd: [number, number, number];
    rowEven: [number, number, number];
    border: [number, number, number];
    noteBg: [number, number, number];
    noteBorder: [number, number, number];
    noteText: [number, number, number];
}

export interface PDFDimensions {
    width: number;
    height: number;
    margin: number;
}

export interface PDFHeaderOptions {
    title: string;
    subtitle?: string;
    projectTitle?: string;
    date?: string;
    credits?: string[];
    pageNumber?: number;
    totalPages?: number;
}

export interface PDFTableColumn {
    header: string;
    width: number;
    align?: 'left' | 'center' | 'right';
}

// ─── MODULE COLOR PRESETS ────────────────────────────────────────────────────

export const MODULE_COLORS: Record<string, PDFColors> = {
    light: {
        accent: [255, 180, 0],        // Orange
        headerBg: [25, 25, 25],
        textPrimary: [30, 30, 30],
        textSecondary: [80, 80, 80],
        textMuted: [150, 150, 150],
        rowOdd: [245, 245, 245],
        rowEven: [255, 255, 255],
        border: [200, 200, 200],
        noteBg: [255, 255, 220],
        noteBorder: [255, 200, 0],
        noteText: [80, 60, 0]
    },
    prod: {
        accent: [236, 72, 153],       // Pink
        headerBg: [30, 30, 30],
        textPrimary: [30, 30, 30],
        textSecondary: [80, 80, 80],
        textMuted: [150, 150, 150],
        rowOdd: [245, 245, 245],
        rowEven: [255, 255, 255],
        border: [200, 200, 200],
        noteBg: [255, 240, 245],
        noteBorder: [236, 72, 153],
        noteText: [100, 40, 60]
    },
    frame: {
        accent: [99, 102, 241],       // Indigo
        headerBg: [25, 25, 35],
        textPrimary: [30, 30, 30],
        textSecondary: [80, 80, 80],
        textMuted: [150, 150, 150],
        rowOdd: [245, 245, 250],
        rowEven: [255, 255, 255],
        border: [200, 200, 210],
        noteBg: [240, 240, 255],
        noteBorder: [99, 102, 241],
        noteText: [50, 50, 100]
    },
    real: {
        accent: [147, 51, 234],       // Purple
        headerBg: [30, 25, 35],
        textPrimary: [30, 30, 30],
        textSecondary: [80, 80, 80],
        textMuted: [150, 150, 150],
        rowOdd: [248, 245, 250],
        rowEven: [255, 255, 255],
        border: [210, 200, 220],
        noteBg: [250, 240, 255],
        noteBorder: [147, 51, 234],
        noteText: [70, 40, 100]
    },
    vault: {
        accent: [34, 197, 94],        // Green
        headerBg: [25, 30, 25],
        textPrimary: [30, 30, 30],
        textSecondary: [80, 80, 80],
        textMuted: [150, 150, 150],
        rowOdd: [245, 250, 245],
        rowEven: [255, 255, 255],
        border: [200, 210, 200],
        noteBg: [240, 255, 240],
        noteBorder: [34, 197, 94],
        noteText: [40, 80, 50]
    }
};

// ─── PDF STYLE SERVICE CLASS ─────────────────────────────────────────────────

export class PDFStyleService {
    private doc: jsPDF;
    private colors: PDFColors;
    private dimensions: PDFDimensions;

    constructor(doc: jsPDF, module: keyof typeof MODULE_COLORS = 'light') {
        this.doc = doc;
        this.colors = MODULE_COLORS[module] || MODULE_COLORS.light;
        
        this.dimensions = {
            width: (doc as any).internal.pageSize.getWidth(),
            height: (doc as any).internal.pageSize.getHeight(),
            margin: 12
        };
    }

    // ── GETTERS ──────────────────────────────────────────────────────────────

    get width(): number { return this.dimensions.width; }
    get height(): number { return this.dimensions.height; }
    get margin(): number { return this.dimensions.margin; }
    get accent(): [number, number, number] { return this.colors.accent; }

    // ── HEADER ───────────────────────────────────────────────────────────────

    /**
     * Dessine un header professionnel avec fond sombre
     */
    drawHeader(options: PDFHeaderOptions): number {
        const { title, subtitle, projectTitle, date, credits, pageNumber, totalPages } = options;
        const headerHeight = 18;

        // Fond sombre
        this.doc.setFillColor(...this.colors.headerBg);
        this.doc.rect(0, 0, this.width, headerHeight, 'F');

        // Titre principal avec accent
        this.doc.setTextColor(...this.colors.accent);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.margin, 10);

        // Sous-titre
        if (subtitle) {
            this.doc.setTextColor(180, 180, 180);
            this.doc.setFontSize(9);
            this.doc.text(subtitle, this.margin, 15);
        }

        // Infos projet à droite
        this.doc.setTextColor(200, 200, 200);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');

        if (projectTitle || date) {
            const dateStr = date || new Date().toLocaleDateString('fr-FR');
            const infoText = projectTitle ? `${projectTitle}  •  ${dateStr}` : dateStr;
            this.doc.text(infoText, this.width - this.margin, 10, { align: 'right' });
        }

        if (credits && credits.length > 0) {
            this.doc.text(credits.join('  •  '), this.width - this.margin, 15, { align: 'right' });
        }

        // Numéro de page
        if (pageNumber && totalPages) {
            this.doc.setTextColor(100, 100, 100);
            this.doc.setFontSize(7);
            this.doc.text(`${pageNumber}/${totalPages}`, this.width / 2, 16, { align: 'center' });
        }

        return headerHeight + 4;
    }

    // ── SECTION HEADER ───────────────────────────────────────────────────────

    /**
     * Dessine un header de section coloré
     */
    drawSectionHeader(title: string, y: number, customColor?: [number, number, number]): number {
        const color = customColor || this.colors.accent;
        
        this.doc.setFillColor(...color);
        this.doc.rect(this.margin, y, this.width - this.margin * 2, 6, 'F');
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.margin + 2, y + 4.5);

        return y + 8;
    }

    // ── TABLE ────────────────────────────────────────────────────────────────

    /**
     * Dessine une table professionnelle avec header et alternance de lignes
     */
    drawTable(
        columns: PDFTableColumn[],
        rows: string[][],
        y: number
    ): number {
        const rowHeight = 6;
        const totalWidth = this.width - this.margin * 2;

        // Header de table
        this.doc.setFillColor(50, 50, 50);
        this.doc.rect(this.margin, y, totalWidth, rowHeight, 'F');
        this.doc.setTextColor(200, 200, 200);
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'bold');

        let xOffset = this.margin;
        columns.forEach(col => {
            const textX = col.align === 'center' ? xOffset + col.width / 2 
                        : col.align === 'right' ? xOffset + col.width - 2 
                        : xOffset + 2;
            const align = col.align || 'left';
            this.doc.text(col.header, textX, y + 4.5, { align });
            xOffset += col.width;
        });

        y += rowHeight + 1;

        // Lignes de données
        this.doc.setFont('helvetica', 'normal');
        rows.forEach((row, idx) => {
            // Vérifier si on doit créer une nouvelle page
            if (y > this.height - 20) {
                this.doc.addPage();
                y = 20;
            }

            // Alternance de couleur
            if (idx % 2 === 0) {
                this.doc.setFillColor(...this.colors.rowOdd);
                this.doc.rect(this.margin, y - 1, totalWidth, rowHeight, 'F');
            }

            this.doc.setTextColor(...this.colors.textPrimary);
            this.doc.setFontSize(7);

            xOffset = this.margin;
            columns.forEach((col, colIdx) => {
                const text = row[colIdx] || '';
                const textX = col.align === 'center' ? xOffset + col.width / 2 
                            : col.align === 'right' ? xOffset + col.width - 2 
                            : xOffset + 2;
                const align = col.align || 'left';
                this.doc.text(text, textX, y + 3.5, { align });
                xOffset += col.width;
            });

            y += rowHeight;
        });

        return y;
    }

    /**
     * Dessine une ligne de total
     */
    drawTotalRow(label: string, value: string, y: number): number {
        const totalWidth = this.width - this.margin * 2;
        
        this.doc.setFillColor(...this.colors.accent);
        this.doc.rect(this.margin, y, totalWidth, 6, 'F');
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8);
        this.doc.text(label, this.margin + 70, y + 4.5);
        this.doc.text(value, this.width - this.margin - 40, y + 4.5);

        return y + 8;
    }

    // ── NOTES ────────────────────────────────────────────────────────────────

    /**
     * Dessine une boîte de notes
     */
    drawNotes(notes: string, y: number): number {
        const lines = this.doc.splitTextToSize(notes, this.width - this.margin * 2 - 10);
        const boxHeight = lines.length * 4 + 10;

        this.doc.setFillColor(...this.colors.noteBg);
        this.doc.rect(this.margin, y, this.width - this.margin * 2, boxHeight, 'F');
        this.doc.setDrawColor(...this.colors.noteBorder);
        this.doc.rect(this.margin, y, this.width - this.margin * 2, boxHeight, 'S');

        this.doc.setTextColor(...this.colors.noteText);
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('NOTES:', this.margin + 3, y + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(lines, this.margin + 3, y + 10);

        return y + boxHeight + 4;
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────

    /**
     * Dessine un footer avec infos de génération
     */
    drawFooter(text?: string): void {
        const footerHeight = 8;
        const y = this.height - footerHeight;

        this.doc.setFillColor(240, 240, 240);
        this.doc.rect(0, y, this.width, footerHeight, 'F');
        
        this.doc.setTextColor(100, 100, 100);
        this.doc.setFontSize(7);
        this.doc.text(
            text || 'Généré par Flow Frame  •  Document confidentiel',
            this.width / 2,
            y + 5,
            { align: 'center' }
        );
    }

    /**
     * Dessine un footer avec statistiques
     */
    drawStatsFooter(stats: string): void {
        const footerHeight = 8;
        const y = this.height - footerHeight;

        this.doc.setFillColor(240, 240, 240);
        this.doc.rect(0, y, this.width, footerHeight, 'F');
        
        this.doc.setTextColor(100, 100, 100);
        this.doc.setFontSize(7);
        this.doc.text(stats, this.width / 2, y + 5, { align: 'center' });
    }

    // ── CARDS ────────────────────────────────────────────────────────────────

    /**
     * Dessine une carte avec badge numéroté (style fiche de développement)
     */
    drawCard(
        index: number,
        title: string,
        y: number,
        height: number = 38
    ): number {
        const totalWidth = this.width - this.margin * 2;

        // Fond de la carte
        this.doc.setFillColor(...this.colors.rowOdd);
        this.doc.rect(this.margin, y, totalWidth, height, 'F');
        this.doc.setDrawColor(...this.colors.border);
        this.doc.rect(this.margin, y, totalWidth, height, 'S');

        // Badge index
        this.doc.setFillColor(...this.colors.accent);
        this.doc.circle(this.margin + 8, y + 8, 5, 'F');
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${index}`, this.margin + 8, y + 10, { align: 'center' });

        // Titre
        this.doc.setTextColor(...this.colors.textPrimary);
        this.doc.setFontSize(11);
        this.doc.text(title, this.margin + 18, y + 10);

        return y + height + 4;
    }

    // ── UTILITY ──────────────────────────────────────────────────────────────

    /**
     * Vérifie s'il y a assez d'espace pour un élément, sinon ajoute une page
     */
    checkPageBreak(y: number, requiredHeight: number): number {
        if (y + requiredHeight > this.height - 15) {
            this.doc.addPage();
            return 20;
        }
        return y;
    }

    /**
     * Définit les couleurs du module
     */
    setModuleColors(module: keyof typeof MODULE_COLORS): void {
        this.colors = MODULE_COLORS[module] || MODULE_COLORS.light;
    }

    /**
     * Définit des couleurs personnalisées
     */
    setCustomColors(colors: Partial<PDFColors>): void {
        this.colors = { ...this.colors, ...colors };
    }

    // ── INFO BOX ─────────────────────────────────────────────────────────────

    /**
     * Dessine une boîte d'informations avec plusieurs colonnes
     */
    drawInfoBox(
        items: Array<{ label: string; value: string }>,
        y: number,
        height: number = 22
    ): number {
        const totalWidth = this.width - this.margin * 2;
        const colW = totalWidth / items.length;

        this.doc.setFillColor(...this.colors.rowOdd);
        this.doc.rect(this.margin, y, totalWidth, height, 'F');
        this.doc.setDrawColor(...this.colors.border);
        this.doc.rect(this.margin, y, totalWidth, height, 'S');

        items.forEach((item, i) => {
            const cx = this.margin + colW * i + colW / 2;
            this.doc.setTextColor(...this.colors.textMuted);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(item.label, cx, y + 7, { align: 'center' });
            this.doc.setTextColor(...this.colors.textPrimary);
            this.doc.setFontSize(13);
            this.doc.text(item.value, cx, y + 17, { align: 'center' });
        });

        return y + height + 4;
    }

    // ── SIGNATURE BOX ────────────────────────────────────────────────────────

    /**
     * Dessine une zone de signature
     */
    drawSignatureBox(
        label: string,
        signatureDataUrl: string | undefined,
        signerName: string,
        y: number,
        height: number = 50
    ): number {
        const totalWidth = this.width - this.margin * 2;

        this.doc.setDrawColor(...this.colors.border);
        this.doc.setFillColor(252, 252, 252);
        this.doc.rect(this.margin, y, totalWidth, height, 'FD');

        this.doc.setFontSize(7);
        this.doc.setTextColor(...this.colors.textMuted);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(label, this.margin + 4, y + 6);

        if (signatureDataUrl && signatureDataUrl.startsWith('data:image')) {
            try {
                this.doc.addImage(signatureDataUrl, 'PNG', this.margin + 4, y + 9, 90, 34);
            } catch (e) {
                console.warn('Impossible d\'ajouter l\'image de signature', e);
            }
        } else {
            this.doc.setTextColor(200, 200, 200);
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'italic');
            this.doc.text('Signature manuscrite', this.margin + 4, y + 28);
        }

        this.doc.setFontSize(8);
        this.doc.setTextColor(...this.colors.textSecondary);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(signerName || '', this.margin + 4, y + height - 4);

        return y + height + 4;
    }

    // ── LEGAL TEXT ───────────────────────────────────────────────────────────

    /**
     * Dessine un bloc de texte légal (multi-paragraphes)
     */
    drawLegalText(paragraphs: string[], y: number, lineHeight: number = 5.5): number {
        this.doc.setFontSize(9.5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...this.colors.textPrimary);

        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                y += 3;
                continue;
            }
            const lines = this.doc.splitTextToSize(paragraph, this.width - this.margin * 2);
            y = this.checkPageBreak(y, lines.length * lineHeight);
            this.doc.text(lines, this.margin, y);
            y += lines.length * lineHeight;
        }

        return y + 4;
    }

    // ── SUMMARY BOX ──────────────────────────────────────────────────────────

    /**
     * Dessine une boîte de résumé colorée (style Light)
     */
    drawSummaryBox(
        items: Array<{ label: string; value: string }>,
        y: number,
        height: number = 16
    ): number {
        const totalWidth = this.width - this.margin * 2;

        // Fond légèrement coloré selon le module
        const bgColor: [number, number, number] = [
            Math.min(255, this.colors.accent[0] + 100),
            Math.min(255, this.colors.accent[1] + 100),
            Math.min(255, this.colors.accent[2] + 100)
        ];
        this.doc.setFillColor(...bgColor);
        this.doc.rect(this.margin, y, totalWidth, height, 'F');
        this.doc.setDrawColor(...this.colors.accent);
        this.doc.rect(this.margin, y, totalWidth, height, 'S');

        const colW = totalWidth / items.length;
        items.forEach((item, i) => {
            const cx = this.margin + colW * i + colW / 2;
            // Label muted
            const labelColor: [number, number, number] = [
                Math.max(0, this.colors.accent[0] - 50),
                Math.max(0, this.colors.accent[1] - 50),
                Math.max(0, this.colors.accent[2] - 50)
            ];
            this.doc.setTextColor(...labelColor);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(item.label, cx, y + 5, { align: 'center' });
            // Value bold
            this.doc.setTextColor(50, 40, 20);
            this.doc.setFontSize(14);
            this.doc.text(item.value, cx, y + 13, { align: 'center' });
        });

        return y + height + 4;
    }

    // ── DARK FOOTER ──────────────────────────────────────────────────────────

    /**
     * Dessine un footer sombre (style pro)
     */
    drawDarkFooter(text?: string): void {
        const footerHeight = 10;
        const y = this.height - footerHeight;

        this.doc.setFillColor(...this.colors.headerBg);
        this.doc.rect(0, y, this.width, footerHeight, 'F');
        
        this.doc.setTextColor(100, 100, 100);
        this.doc.setFontSize(7);
        this.doc.text(
            text || 'Généré par Flow Frame  •  Document confidentiel',
            this.width / 2,
            y + 6,
            { align: 'center' }
        );
    }

    // ── CHECKLIST ────────────────────────────────────────────────────────────

    /**
     * Dessine une liste de cases à cocher
     */
    drawChecklist(items: string[], y: number): number {
        this.doc.setFillColor(...this.colors.rowOdd);
        this.doc.rect(this.margin, y, this.width - this.margin * 2, 8, 'F');
        this.doc.setTextColor(...this.colors.textMuted);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('CHECKLIST', this.margin + 3, y + 5.5);
        y += 10;

        for (const item of items) {
            this.doc.setTextColor(...this.colors.textSecondary);
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(`☐  ${item}`, this.margin + 3, y + 3);
            y += 6;
        }

        return y + 2;
    }

    // ── TEXT HELPERS ─────────────────────────────────────────────────────────

    /**
     * Écrit du texte avec style et retourne la nouvelle position Y
     */
    writeText(
        text: string,
        y: number,
        options: {
            fontSize?: number;
            bold?: boolean;
            color?: 'primary' | 'secondary' | 'muted' | 'accent';
            align?: 'left' | 'center' | 'right';
            maxWidth?: number;
        } = {}
    ): number {
        const { fontSize = 9, bold = false, color = 'primary', align = 'left', maxWidth } = options;
        
        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
        
        switch (color) {
            case 'accent':
                this.doc.setTextColor(...this.colors.accent);
                break;
            case 'secondary':
                this.doc.setTextColor(...this.colors.textSecondary);
                break;
            case 'muted':
                this.doc.setTextColor(...this.colors.textMuted);
                break;
            default:
                this.doc.setTextColor(...this.colors.textPrimary);
        }

        const width = maxWidth || (this.width - this.margin * 2);
        const lines = this.doc.splitTextToSize(text, width);
        
        let x = this.margin;
        if (align === 'center') x = this.width / 2;
        else if (align === 'right') x = this.width - this.margin;

        this.doc.text(lines, x, y, { align });
        
        return y + lines.length * (fontSize * 0.5) + 2;
    }

    /**
     * Accède directement au document jsPDF pour des opérations personnalisées
     */
    getDoc(): jsPDF {
        return this.doc;
    }

    /**
     * Ajoute une nouvelle page
     */
    addPage(): void {
        this.doc.addPage();
    }

    /**
     * Génère le PDF en blob
     */
    outputBlob(): Blob {
        return this.doc.output('blob');
    }
}

// ─── FACTORY FUNCTION ────────────────────────────────────────────────────────

/**
 * Crée une nouvelle instance de jsPDF avec le service de style
 */
export async function createStyledPDF(
    options: {
        orientation?: PDFOrientation;
        format?: PDFFormat;
        module?: keyof typeof MODULE_COLORS;
    } = {}
): Promise<{ doc: jsPDF; style: PDFStyleService }> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
        orientation: options.orientation || 'portrait',
        unit: 'mm',
        format: options.format || 'a4'
    });

    const style = new PDFStyleService(doc, options.module || 'light');
    
    return { doc, style };
}
