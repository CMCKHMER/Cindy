import { mulberry32 } from "./core";

/* Procedural, dependency-free preview art. Every thumbnail is an inline SVG
   data-URI so the library renders instantly and never shows a broken image.
   Real photographs (Pexels) are used for the photo/AI-art records and fall
   back to this art if the network is unavailable. */

const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`,
  )}`;

const PAL = [
  ["#17d4b4", "#0b3f52"],
  ["#4c7dff", "#141c46"],
  ["#ff4d9d", "#3a1030"],
  ["#c6f24e", "#243306"],
  ["#ffb43d", "#3d2405"],
  ["#a072ff", "#241247"],
  ["#22d3ee", "#06323d"],
  ["#ff8a4c", "#3d1a06"],
];

const txt = (x: number, y: number, s: string, size = 9, fill = "#dbe4ff", weight = 600) =>
  `<text x="${x}" y="${y}" font-family="Inter,system-ui,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`;

export function screenshotThumb(seed: number, variant: "order" | "dashboard" | "chat" | "code" = "order") {
  const r = mulberry32(seed);
  const [a, b] = PAL[Math.floor(r() * PAL.length)];
  let body = `<rect width="320" height="200" fill="#0d1424"/><rect width="320" height="22" fill="#161f36"/>`;
  body += `<circle cx="12" cy="11" r="3.5" fill="#ff5470"/><circle cx="24" cy="11" r="3.5" fill="#ffb43d"/><circle cx="36" cy="11" r="3.5" fill="#2fd98a"/>`;
  body += `<rect x="50" y="5" width="200" height="12" rx="6" fill="#0b1120"/>${txt(58, 14, "amazon.com/gp/your-account/order-details", 7, "#7f8fb5", 500)}`;
  if (variant === "order") {
    body += `<rect x="14" y="34" width="180" height="14" rx="3" fill="${a}" opacity=".9"/>${txt(20, 45, "Order placed, thank you!", 9, "#05131a", 700)}`;
    body += txt(14, 66, "Arriving Thursday, March 12", 8, "#c9d5f5");
    body += `<rect x="14" y="76" width="60" height="60" rx="6" fill="${b}"/><rect x="24" y="88" width="40" height="36" rx="4" fill="${a}" opacity=".55"/>`;
    for (let i = 0; i < 5; i++) body += `<rect x="84" y="${80 + i * 12}" width="${120 - i * 14}" height="6" rx="3" fill="#26314d"/>`;
    body += `<rect x="14" y="148" width="292" height="1" fill="#222c46"/>`;
    body += txt(14, 166, "Total", 8, "#8ea0c8");
    body += txt(250, 166, "$148.20", 11, a, 700);
    body += txt(14, 184, "Ship to: Alex · 42 Marina Blvd", 7, "#65759a", 500);
  } else if (variant === "dashboard") {
    body += `<rect x="0" y="22" width="60" height="178" fill="#111a2d"/>`;
    for (let i = 0; i < 6; i++) body += `<rect x="10" y="${38 + i * 20}" width="40" height="7" rx="3" fill="#25314e"/>`;
    for (let i = 0; i < 3; i++) body += `<rect x="${72 + i * 80}" y="34" width="72" height="42" rx="6" fill="#141e34" stroke="${a}" stroke-opacity=".35"/>${txt(80 + i * 80, 58, ["12.4k", "98.2%", "$4.1k"][i], 12, a, 700)}`;
    let pts = "";
    for (let i = 0; i < 22; i++) pts += `${72 + i * 10},${160 - r() * 62} `;
    body += `<polyline points="${pts}" fill="none" stroke="${a}" stroke-width="2"/>`;
    body += `<rect x="72" y="88" width="232" height="88" rx="6" fill="#101828"/>`;
  } else if (variant === "chat") {
    for (let i = 0; i < 5; i++) {
      const mine = i % 2 === 1;
      const w = 90 + r() * 90;
      body += `<rect x="${mine ? 306 - w : 14}" y="${34 + i * 32}" width="${w}" height="24" rx="10" fill="${mine ? a : "#1b2540"}" opacity="${mine ? 0.85 : 1}"/>`;
    }
  } else {
    body += `<rect x="0" y="22" width="34" height="178" fill="#101828"/>`;
    for (let i = 0; i < 14; i++) {
      const w = 40 + r() * 180;
      body += `<rect x="44" y="${32 + i * 12}" width="${w}" height="6" rx="3" fill="${i % 4 === 0 ? a : "#243050"}" opacity="${i % 4 === 0 ? 0.8 : 1}"/>`;
    }
  }
  return svg(320, 200, body);
}

export function docThumb(seed: number, kind: "pdf" | "word" | "excel" | "text" = "pdf") {
  const r = mulberry32(seed);
  const accent = kind === "pdf" ? "#ff5470" : kind === "word" ? "#4c7dff" : kind === "excel" ? "#2fd98a" : "#96a5c8";
  let body = `<rect width="320" height="200" fill="#161d2c"/><rect x="76" y="12" width="168" height="176" rx="4" fill="#f3f5fb"/>`;
  body += `<rect x="76" y="12" width="168" height="24" fill="${accent}" opacity=".16"/>${txt(88, 28, kind.toUpperCase(), 9, accent, 700)}`;
  if (kind === "excel") {
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 5; x++)
        body += `<rect x="${86 + x * 30}" y="${46 + y * 15}" width="28" height="13" fill="${y === 0 ? accent : "#e2e7f2"}" opacity="${y === 0 ? 0.5 : 1}"/>`;
  } else {
    body += `<rect x="88" y="46" width="110" height="9" rx="2" fill="#2a3350"/>`;
    for (let i = 0; i < 11; i++)
      body += `<rect x="88" y="${66 + i * 10}" width="${144 - (i % 4) * r() * 40}" height="4" rx="2" fill="#c3cbdd"/>`;
  }
  return svg(320, 200, body);
}

export function logoThumb(seed: number) {
  const r = mulberry32(seed);
  const [a, b] = PAL[Math.floor(r() * PAL.length)];
  const shape = Math.floor(r() * 3);
  let mark = "";
  if (shape === 0) mark = `<circle cx="160" cy="100" r="44" fill="none" stroke="${a}" stroke-width="12"/><circle cx="160" cy="100" r="16" fill="${a}"/>`;
  else if (shape === 1) mark = `<path d="M116 132 L160 56 L204 132 Z" fill="none" stroke="${a}" stroke-width="11" stroke-linejoin="round"/>`;
  else mark = `<rect x="120" y="60" width="80" height="80" rx="22" fill="${a}"/><rect x="146" y="86" width="28" height="28" rx="8" fill="${b}"/>`;
  return svg(320, 200, `<rect width="320" height="200" fill="${b}"/>${mark}`);
}

export function memeThumb(seed: number, top = "WHEN THE SCAN", bottom = "FINISHES IN 4 SECONDS") {
  const r = mulberry32(seed);
  const [a, b] = PAL[Math.floor(r() * PAL.length)];
  let body = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/>`;
  body += `<circle cx="160" cy="108" r="46" fill="#0b0f1a" opacity=".55"/><circle cx="145" cy="98" r="7" fill="#fff"/><circle cx="176" cy="98" r="7" fill="#fff"/><path d="M140 126 q20 18 40 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const impact = (y: number, s: string) =>
    `<text x="160" y="${y}" text-anchor="middle" font-family="Impact,Inter,sans-serif" font-size="19" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${s}</text>`;
  return svg(320, 200, body + impact(28, top) + impact(188, bottom));
}

export function artThumb(seed: number) {
  const r = mulberry32(seed);
  const [a, b] = PAL[Math.floor(r() * PAL.length)];
  const c = PAL[Math.floor(r() * PAL.length)][0];
  let body = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="#05070d"/></linearGradient></defs><rect width="320" height="200" fill="url(#s)"/>`;
  body += `<circle cx="${60 + r() * 200}" cy="${40 + r() * 40}" r="${18 + r() * 16}" fill="${a}" opacity=".85"/>`;
  for (let i = 0; i < 16; i++) {
    const w = 10 + r() * 22;
    const h = 40 + r() * 110;
    body += `<rect x="${i * 20 + 2}" y="${200 - h}" width="${w}" height="${h}" fill="#080d18" opacity=".92"/>`;
    for (let k = 0; k < 5; k++)
      body += `<rect x="${i * 20 + 5}" y="${200 - h + 8 + k * 14}" width="${w - 6}" height="3" fill="${k % 2 ? c : a}" opacity="${0.35 + r() * 0.6}"/>`;
  }
  body += `<rect width="320" height="200" fill="${c}" opacity=".08"/>`;
  return svg(320, 200, body);
}

export function videoThumb(seed: number, label = "00:42") {
  const r = mulberry32(seed);
  const [a, b] = PAL[Math.floor(r() * PAL.length)];
  let body = `<rect width="320" height="200" fill="${b}"/>`;
  for (let i = 0; i < 6; i++) body += `<rect x="${i * 54}" y="0" width="52" height="200" fill="${a}" opacity="${0.06 + r() * 0.16}"/>`;
  body += `<circle cx="160" cy="100" r="30" fill="#05070d" opacity=".65"/><path d="M150 84 L180 100 L150 116 Z" fill="#fff"/>`;
  body += `<rect x="248" y="172" width="58" height="16" rx="4" fill="#05070d" opacity=".8"/>${txt(256, 184, label, 9, "#fff", 600)}`;
  return svg(320, 200, body);
}

export function waveThumb(seed: number, color = "#17d4b4") {
  const r = mulberry32(seed);
  let body = `<rect width="320" height="200" fill="#0b1120"/>`;
  for (let i = 0; i < 52; i++) {
    const h = 8 + Math.abs(Math.sin(i * 0.4 + seed)) * 70 + r() * 40;
    body += `<rect x="${8 + i * 6}" y="${100 - h / 2}" width="3.4" height="${h}" rx="2" fill="${color}" opacity="${0.45 + r() * 0.55}"/>`;
  }
  return svg(320, 200, body);
}

export function brokenThumb(seed: number) {
  const r = mulberry32(seed);
  let body = `<rect width="320" height="200" fill="#141018"/>`;
  for (let i = 0; i < 26; i++) {
    const y = r() * 200;
    body += `<rect x="${r() * 60}" y="${y}" width="${60 + r() * 260}" height="${1 + r() * 7}" fill="${
      ["#ff5470", "#3a2030", "#6b7a9c", "#22d3ee"][Math.floor(r() * 4)]
    }" opacity="${0.2 + r() * 0.6}"/>`;
  }
  body += `<rect x="0" y="120" width="320" height="80" fill="#0a0d14" opacity=".85"/>`;
  body += `<path d="M148 84 L172 84 L184 116 L136 116 Z" fill="none" stroke="#ff5470" stroke-width="4"/>${txt(150, 110, "!", 18, "#ff5470", 700)}`;
  return svg(320, 200, body);
}

export function genericThumb(seed: number, label: string, color = "#7c8db5") {
  const r = mulberry32(seed);
  let body = `<rect width="320" height="200" fill="#0d1424"/>`;
  for (let i = 0; i < 40; i++)
    body += `<circle cx="${r() * 320}" cy="${r() * 200}" r="${r() * 2.2}" fill="${color}" opacity="${r() * 0.5}"/>`;
  body += `<path d="M124 60 h48 l24 24 v56 a6 6 0 0 1 -6 6 h-66 a6 6 0 0 1 -6 -6 V66 a6 6 0 0 1 6 -6z" fill="none" stroke="${color}" stroke-width="4"/><path d="M172 60 v24 h24" fill="none" stroke="${color}" stroke-width="4"/>`;
  body += `<text x="160" y="126" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="15" font-weight="700" fill="${color}">${label}</text>`;
  return svg(320, 200, body);
}

const px = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=${Math.round(
    (w * 627) / 1200,
  )}&w=${w}`;

export const PHOTOS = {
  dogA: { thumb: px(7516801, 420), full: px(7516801, 1200), credit: "RDNE Stock project" },
  dogB: { thumb: px(7516221, 420), full: px(7516221, 1200), credit: "RDNE Stock project" },
  dogC: { thumb: px(6773171, 420), full: px(6773171, 1200), credit: "Charles McKeever" },
  neonCity: { thumb: px(18545010, 420), full: px(18545010, 1200), credit: "Pachon in Motion" },
  neonAlley: { thumb: px(17195067, 420), full: px(17195067, 1200), credit: "kaio ryan" },
};