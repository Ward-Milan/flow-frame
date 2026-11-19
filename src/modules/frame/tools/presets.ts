const makeSvgDataUrl = (svgContent: string): string => {
    // Base64 encoding for 100% reliable canvas loading
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
};

// --- STICKMAN WALKING (4 FRAMES) ---
const walkingSvg1 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="920" y2="720" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="1000" y2="720" stroke="black" stroke-width="15"/>
</svg>`;

const walkingSvg2 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="980" cy="390" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="980" y1="430" x2="980" y2="590" stroke="black" stroke-width="15"/>
  <line x1="980" y1="470" x2="910" y2="510" stroke="black" stroke-width="15"/>
  <line x1="980" y1="470" x2="1050" y2="530" stroke="black" stroke-width="15"/>
  <line x1="980" y1="590" x2="910" y2="700" stroke="black" stroke-width="15"/>
  <line x1="980" y1="590" x2="1040" y2="700" stroke="black" stroke-width="15"/>
</svg>`;

const walkingSvg3 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="1000" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="1000" y1="440" x2="1000" y2="600" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="480" x2="950" y2="550" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="480" x2="1050" y2="550" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="600" x2="970" y2="720" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="600" x2="1030" y2="720" stroke="black" stroke-width="15"/>
</svg>`;

const walkingSvg4 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="1020" cy="390" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="1020" y1="430" x2="1020" y2="590" stroke="black" stroke-width="15"/>
  <line x1="1020" y1="470" x2="980" y2="530" stroke="black" stroke-width="15"/>
  <line x1="1020" y1="470" x2="1080" y2="510" stroke="black" stroke-width="15"/>
  <line x1="1020" y1="590" x2="1060" y2="700" stroke="black" stroke-width="15"/>
  <line x1="1020" y1="590" x2="980" y2="700" stroke="black" stroke-width="15"/>
</svg>`;

// --- STICKMAN JUMPING (4 FRAMES) ---
const jumpingSvg1 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="460" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="960" y1="500" x2="960" y2="630" stroke="black" stroke-width="15"/>
  <line x1="960" y1="530" x2="900" y2="580" stroke="black" stroke-width="15"/>
  <line x1="960" y1="530" x2="1020" y2="580" stroke="black" stroke-width="15"/>
  <line x1="960" y1="630" x2="920" y2="700" stroke="black" stroke-width="15"/>
  <line x1="960" y1="630" x2="1000" y2="700" stroke="black" stroke-width="15"/>
  <line x1="920" y1="700" x2="900" y2="680" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="700" x2="1020" y2="680" stroke="black" stroke-width="15"/>
</svg>`;

const jumpingSvg2 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="330" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="960" y1="370" x2="960" y2="520" stroke="black" stroke-width="15"/>
  <line x1="960" y1="400" x2="890" y2="330" stroke="black" stroke-width="15"/>
  <line x1="960" y1="400" x2="1030" y2="330" stroke="black" stroke-width="15"/>
  <line x1="960" y1="520" x2="930" y2="640" stroke="black" stroke-width="15"/>
  <line x1="960" y1="520" x2="990" y2="640" stroke="black" stroke-width="15"/>
</svg>`;

const jumpingSvg3 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="270" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="960" y1="310" x2="960" y2="460" stroke="black" stroke-width="15"/>
  <line x1="960" y1="340" x2="880" y2="260" stroke="black" stroke-width="15"/>
  <line x1="960" y1="340" x2="1040" y2="260" stroke="black" stroke-width="15"/>
  <line x1="960" y1="460" x2="920" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="460" x2="1000" y2="540" stroke="black" stroke-width="15"/>
  <line x1="920" y1="540" x2="900" y2="510" stroke="black" stroke-width="15"/>
  <line x1="1000" y1="540" x2="1020" y2="510" stroke="black" stroke-width="15"/>
</svg>`;

const jumpingSvg4 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="480" r="40" stroke="black" stroke-width="15" fill="none"/>
  <line x1="960" y1="520" x2="960" y2="650" stroke="black" stroke-width="15"/>
  <line x1="960" y1="550" x2="890" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="550" x2="1030" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="650" x2="910" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="650" x2="1010" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

// --- EXPLOSION (3 FRAMES) ---
const explosionSvg1 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <path d="M 960 500 L 980 520 L 1010 490 L 990 540 L 1030 560 L 980 570 L 960 610 L 940 570 L 890 560 L 930 540 L 910 490 L 940 520 Z" fill="#FFA500" stroke="red" stroke-width="10"/>
</svg>`;

const explosionSvg2 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <path d="M 960 400 L 1020 440 L 1080 380 L 1050 480 L 1150 510 L 1040 540 L 1000 660 L 940 560 L 800 550 L 910 500 L 870 380 L 930 460 Z" fill="#FF4500" stroke="red" stroke-width="15"/>
  <circle cx="1060" cy="300" r="30" fill="gray"/>
  <circle cx="840" cy="620" r="45" fill="gray"/>
</svg>`;

const explosionSvg3 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="480" r="120" fill="#EAEAEA" stroke="gray" stroke-width="8"/>
  <circle cx="1080" cy="380" r="160" fill="#D3D3D3" stroke="gray" stroke-width="8"/>
  <circle cx="820" cy="420" r="140" fill="#C0C0C0" stroke="gray" stroke-width="8"/>
</svg>`;

// --- STICKMAN LOOKING AROUND (3 FRAMES) ---
const lookSvg1 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <circle cx="940" cy="395" r="5" fill="black"/> <!-- looking left -->
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="930" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="990" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

const lookSvg2 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <circle cx="950" cy="395" r="5" fill="black"/> <!-- facing forward -->
  <circle cx="970" cy="395" r="5" fill="black"/>
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="930" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="990" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

const lookSvg3 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <circle cx="980" cy="395" r="5" fill="black"/> <!-- looking right -->
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="930" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="990" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

// --- DIALOGUE (2 FRAMES) ---
const dialogueSvg1 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <circle cx="945" cy="395" r="5" fill="black"/>
  <circle cx="975" cy="395" r="5" fill="black"/>
  <line x1="950" y1="420" x2="970" y2="420" stroke="black" stroke-width="10"/> <!-- closed mouth -->
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="930" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="990" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

const dialogueSvg2 = `
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#FFFFFF"/>
  <circle cx="960" cy="400" r="40" stroke="black" stroke-width="15" fill="none"/>
  <circle cx="945" cy="395" r="5" fill="black"/>
  <circle cx="975" cy="395" r="5" fill="black"/>
  <circle cx="960" cy="420" r="10" stroke="black" stroke-width="8" fill="none"/> <!-- open mouth -->
  <line x1="960" y1="440" x2="960" y2="600" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="900" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="480" x2="1020" y2="540" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="930" y2="740" stroke="black" stroke-width="15"/>
  <line x1="960" y1="600" x2="990" y2="740" stroke="black" stroke-width="15"/>
</svg>`;

export const animationPresets = [
    {
        id: 'stickman_walking',
        name: 'Stickman : Marche',
        frames: [walkingSvg1, walkingSvg2, walkingSvg3, walkingSvg4].map(makeSvgDataUrl)
    },
    {
        id: 'stickman_jumping',
        name: 'Stickman : Saut',
        frames: [jumpingSvg1, jumpingSvg2, jumpingSvg3, jumpingSvg4].map(makeSvgDataUrl)
    },
    {
        id: 'stickman_dialogue',
        name: 'Stickman : Parole',
        frames: [dialogueSvg1, dialogueSvg2].map(makeSvgDataUrl)
    },
    {
        id: 'stickman_look_around',
        name: 'Stickman : Regarde autour',
        frames: [lookSvg1, lookSvg2, lookSvg3].map(makeSvgDataUrl)
    },
    {
        id: 'explosion_impact',
        name: 'Effet : Explosion',
        frames: [explosionSvg1, explosionSvg2, explosionSvg3].map(makeSvgDataUrl)
    }
];
