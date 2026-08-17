// ============================================================================
// SVG glassware — 3/4-perspective serving glasses + prep vessels.
// Glasses use elliptical rims, visible wall thickness (evenodd), and
// liquid that follows the bowl profile (not flat rectangles).
// ============================================================================

const NS = "http://www.w3.org/2000/svg";
const geom = new WeakMap();
let _uid = 0;

/** Parse SVG markup into a real SVG element (WKWebView innerHTML often yields 0×0). */
function svgFromMarkup(markup) {
  const raw = String(markup || "").trim();
  try {
    const parsed = new DOMParser().parseFromString(raw, "image/svg+xml");
    const root = parsed.documentElement;
    if (
      root &&
      root.namespaceURI === NS &&
      root.localName === "svg" &&
      !parsed.querySelector("parsererror")
    ) {
      return document.importNode(root, true);
    }
  } catch (e) { /* fall through */ }
  const tmp = document.createElement("div");
  tmp.innerHTML = raw;
  return tmp.firstElementChild;
}

function hexAlpha(color, a) {
  if (!color) return `rgba(255,255,255,${a})`;
  if (color.startsWith("rgba") || color.startsWith("rgb")) return color;
  const h = color.replace("#", "");
  if (h.length !== 6) return color;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Horizontal radius of the inner cavity at a given y (perspective profile). */
function rxAt(p, y, inner = true) {
  const top = inner ? p.iTop : p.oTop;
  const bot = inner ? p.iBot : p.oBot;
  const span = Math.max(1, p.botY - p.rimY);
  const t = Math.max(0, Math.min(1, (y - p.rimY) / span));
  if (p.wall === "bowl") {
    // wider in the middle for coupe/wine
    const bulge = Math.sin(t * Math.PI) * (p.bulge || 0);
    return lerp(top, bot, t) + bulge;
  }
  if (p.wall === "hurricane") {
    const bulge = Math.sin(t * Math.PI) * (p.bulge || 0);
    return lerp(top, bot, t) + bulge;
  }
  return lerp(top, bot, t);
}

function silhouettePath(p, topRx, botRx) {
  const { cx, rimY, botY, rimRy, botRy } = p;
  // Left rim → left base → bottom arc → right base → right rim → back rim arc
  return [
    `M ${cx - topRx} ${rimY}`,
    `L ${cx - botRx} ${botY}`,
    `A ${botRx} ${botRy} 0 0 0 ${cx + botRx} ${botY}`,
    `L ${cx + topRx} ${rimY}`,
    `A ${topRx} ${rimRy} 0 0 0 ${cx - topRx} ${rimY}`,
    "Z",
  ].join(" ");
}

function bowlSilhouette(p, topRx, botRx, bulge) {
  const { cx, rimY, botY, rimRy, botRy } = p;
  const midY = lerp(rimY, botY, 0.55);
  const midRx = Math.max(topRx, botRx) + bulge;
  return [
    `M ${cx - topRx} ${rimY}`,
    `C ${cx - topRx - 2} ${lerp(rimY, midY, 0.5)} ${cx - midRx} ${midY} ${cx - botRx} ${botY}`,
    `A ${botRx} ${botRy} 0 0 0 ${cx + botRx} ${botY}`,
    `C ${cx + midRx} ${midY} ${cx + topRx + 2} ${lerp(rimY, midY, 0.5)} ${cx + topRx} ${rimY}`,
    `A ${topRx} ${rimRy} 0 0 0 ${cx - topRx} ${rimY}`,
    "Z",
  ].join(" ");
}

function hurricaneSilhouette(p, topRx, botRx, bulge) {
  const { cx, rimY, botY, rimRy, botRy } = p;
  const midY = lerp(rimY, botY, 0.45);
  const midRx = topRx + bulge;
  const neckY = lerp(rimY, botY, 0.78);
  const neckRx = botRx * 1.15;
  return [
    `M ${cx - topRx} ${rimY}`,
    `C ${cx - midRx} ${midY} ${cx - neckRx} ${neckY} ${cx - botRx} ${botY}`,
    `A ${botRx} ${botRy} 0 0 0 ${cx + botRx} ${botY}`,
    `C ${cx + neckRx} ${neckY} ${cx + midRx} ${midY} ${cx + topRx} ${rimY}`,
    `A ${topRx} ${rimRy} 0 0 0 ${cx - topRx} ${rimY}`,
    "Z",
  ].join(" ");
}

function buildProfile(glass, pad) {
  const tpl = glass.tpl;
  const W = glass.w;
  const H = glass.h;
  const cx = pad + W / 2;
  const rimRy = Math.max(9, W * 0.145);
  const rimY = pad + rimRy;
  const thick = Math.max(5.5, Math.min(11, W * 0.055));
  let botY = pad + H;
  let oTop = W / 2;
  let oBot = W / 2 * 0.9;
  let wall = "straight";
  let bulge = 0;
  let stemH = 0;
  let footW = W * 0.48;
  let ice = [];

  if (tpl === "tumbler") {
    oBot = W / 2 * (H > 150 ? 0.88 : 0.94);
    ice = H > 110
      ? [
          { x: -0.22, y: 0.52, s: 0.22, rot: 12 },
          { x: 0.08, y: 0.62, s: 0.18, rot: -14 },
          { x: -0.05, y: 0.72, s: 0.14, rot: 6 },
        ]
      : [{ x: -0.08, y: 0.58, s: 0.2, rot: 10 }];
  } else if (tpl === "cone") {
    oBot = Math.max(5, W * 0.035);
    stemH = 72;
    footW = W * 0.5;
    ice = [];
  } else if (tpl === "bowl") {
    wall = "bowl";
    bulge = W * 0.08;
    oBot = W * 0.08;
    stemH = 70;
    footW = W * 0.48;
  } else if (tpl === "marg") {
    wall = "bowl";
    bulge = W * 0.02;
    oTop = W / 2;
    oBot = W * 0.1;
    stemH = 62;
    footW = W * 0.46;
  } else {
    // hurricane
    wall = "hurricane";
    bulge = W * 0.22;
    oTop = W * 0.34;
    oBot = W * 0.1;
    stemH = 34;
    footW = W * 0.58;
    ice = [
      { x: -0.15, y: 0.5, s: 0.2, rot: 10 },
      { x: 0.1, y: 0.6, s: 0.16, rot: -8 },
    ];
  }

  const botRy = Math.max(6, oBot * 0.55);
  const iTop = Math.max(4, oTop - thick);
  const iBot = Math.max(2.5, oBot - thick * (tpl === "cone" ? 0.35 : 0.85));
  const footH = 12;
  const vbW = W + pad * 2;
  const vbH = botY + (stemH ? stemH + footH + 8 : botRy + 14) + pad * 0.3;

  const pathFn = wall === "bowl" ? bowlSilhouette : wall === "hurricane" ? hurricaneSilhouette : silhouettePath;
  const outer = wall === "straight"
    ? silhouettePath({ cx, rimY, botY, rimRy, botRy }, oTop, oBot)
    : pathFn({ cx, rimY, botY, rimRy, botRy }, oTop, oBot, bulge);
  const inner = wall === "straight"
    ? silhouettePath({ cx, rimY, botY: botY - thick * 0.35, rimRy: rimRy * 0.85, botRy: botRy * 0.8 }, iTop, iBot)
    : pathFn(
        { cx, rimY: rimY + 2, botY: botY - thick * 0.4, rimRy: rimRy * 0.82, botRy: botRy * 0.75 },
        iTop,
        iBot,
        bulge * 0.85
      );

  // Absolute ice positions from normalized coords
  const iceAbs = ice.map((c) => ({
    x: cx + c.x * W - (c.s * W) / 2,
    y: rimY + c.y * (botY - rimY),
    s: c.s * W,
    rot: c.rot,
  }));

  return {
    perspective: true,
    cx, rimY, botY, rimRy, botRy,
    oTop, oBot, iTop, iBot, thick, wall, bulge,
    outer, inner,
    stemH, footW, footH,
    vbW, vbH,
    ice: iceAbs,
    rimCx: cx, rimCy: rimY, rimRx: oTop, rimRy,
    cavBox: { x: cx - iTop, y: rimY, w: iTop * 2, h: botY - rimY },
    kind: "glass",
  };
}

function stemFootMarkup(p, stemGradId) {
  if (!p.stemH) return { stem: "", foot: "" };
  const { cx, botY, stemH, footW, footH } = p;
  const stemTop = botY - 1;
  const footCy = botY + stemH + footH / 2;
  const stem =
    `<path d="M ${cx - 5.5} ${stemTop} L ${cx + 5.5} ${stemTop} L ${cx + 3.2} ${botY + stemH} L ${cx - 3.2} ${botY + stemH} Z" fill="url(#${stemGradId})" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>` +
    `<rect x="${cx - 1.4}" y="${stemTop}" width="2.8" height="${stemH}" fill="rgba(255,255,255,0.4)"/>`;
  const foot =
    `<ellipse cx="${cx}" cy="${footCy}" rx="${footW / 2}" ry="${footH / 2}" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>` +
    `<ellipse cx="${cx}" cy="${footCy - 1.5}" rx="${footW / 2 - 5}" ry="${footH / 2 - 2.5}" fill="rgba(255,255,255,0.1)"/>` +
    `<ellipse cx="${cx}" cy="${footCy - 2.5}" rx="${footW / 2 - 10}" ry="2" fill="rgba(255,255,255,0.2)"/>`;
  return { stem, foot };
}

function iceMarkup(ice) {
  return (ice || [])
    .map((c) => {
      const hx = c.x + 3, hy = c.y + 3, hs = c.s * 0.36;
      return `<g class="ice-cube" transform="rotate(${c.rot} ${c.x + c.s / 2} ${c.y + c.s / 2})">
        <rect x="${c.x}" y="${c.y}" width="${c.s}" height="${c.s}" rx="5" fill="rgba(200,230,255,0.28)" stroke="rgba(255,255,255,0.55)" stroke-width="1.4"/>
        <rect x="${hx}" y="${hy}" width="${hs}" height="${hs}" rx="2" fill="rgba(255,255,255,0.45)"/>
        <path d="M ${c.x + 2} ${c.y + c.s - 3} L ${c.x + c.s * 0.7} ${c.y + c.s - 3}" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round"/>
      </g>`;
    })
    .join("");
}

function condensationOnGlass(p) {
  const drops = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.18 + (i % 5) * 0.14;
    const y = lerp(p.rimY, p.botY, t);
    const rx = rxAt(p, y, false);
    const side = i % 2 === 0 ? -1 : 1;
    const x = p.cx + side * (rx * 0.72 + (i % 3));
    drops.push(`<circle cx="${x}" cy="${y}" r="${1.1 + (i % 3) * 0.45}" fill="rgba(255,255,255,0.32)"/>`);
  }
  return `<g class="condensation" opacity="0.85">${drops.join("")}</g>`;
}

/** Photoreal empty glass plates (transparent PNG). Liquid overlays via SVG. */
export const GLASS_PHOTO = {
  rocks: "assets/glasses/rocks.png",
  highball: "assets/glasses/highball.png",
  collins: "assets/glasses/highball.png",
  shot: "assets/glasses/rocks.png",
  martini: "assets/glasses/martini.png",
  coupe: "assets/glasses/coupe.png",
  wine: "assets/glasses/coupe.png",
  margarita: "assets/glasses/margarita.png",
  hurricane: "assets/glasses/hurricane.png",
};

function buildGlassSvg(glass, opts = {}) {
  const liquidOnly = !!opts.liquidOnly;
  const pad = 20;
  const p = buildProfile(glass, pad);
  const uid = "g" + _uid++;
  const clipId = uid + "cav";
  const glassGrad = uid + "gg";
  const edgeGrad = uid + "edge";
  const shineGrad = uid + "shine";
  const stemGrad = uid + "stem";
  const { stem, foot } = liquidOnly ? { stem: "", foot: "" } : stemFootMarkup(p, stemGrad);
  const glassBody = `${p.outer} ${p.inner}`;

  // No baked ellipse shadow — contact shadow lives in the 3D counter CSS.
  const shell = liquidOnly
    ? `<path d="${p.inner}" fill="rgba(160,200,230,0.04)"/>`
    : `${foot}
  ${stem}
  <path d="${glassBody}" fill-rule="evenodd" fill="url(#${glassGrad})" stroke="rgba(255,236,210,0.45)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="${glassBody}" fill-rule="evenodd" fill="url(#${edgeGrad})" opacity="0.5"/>
  <path d="${p.inner}" fill="rgba(180,150,100,0.05)"/>
  ${condensationOnGlass(p)}
  <path d="M ${p.cx - p.oTop * 0.62} ${p.rimY + 8}
           L ${p.cx - p.oBot * 0.55} ${p.botY - 6}"
        stroke="url(#${shineGrad})" stroke-width="7" stroke-linecap="round" opacity="0.5" fill="none"/>
  <path d="M ${p.cx + p.oTop * 0.55} ${p.rimY + 14}
           L ${p.cx + p.oBot * 0.48} ${p.botY - 18}"
        stroke="rgba(255,220,170,0.18)" stroke-width="3" stroke-linecap="round" fill="none"/>
  <ellipse cx="${p.cx}" cy="${p.rimY}" rx="${p.oTop}" ry="${p.rimRy}"
           fill="none" stroke="rgba(255,230,190,0.3)" stroke-width="1.2"/>
  <ellipse class="rim" cx="${p.cx}" cy="${p.rimY}" rx="${p.oTop}" ry="${p.rimRy}"
           fill="rgba(255,240,210,0.04)" stroke="rgba(255,236,210,0.8)" stroke-width="2.2"/>
  <ellipse class="rim-inner" cx="${p.cx}" cy="${p.rimY + 1.5}" rx="${p.iTop}" ry="${p.rimRy * 0.78}"
           fill="none" stroke="rgba(220,190,140,0.35)" stroke-width="1.3"/>`;

  const svg =
`<svg class="glass-svg${liquidOnly ? " glass-liquid-layer" : ""}" viewBox="0 0 ${p.vbW} ${p.vbH}" width="${p.vbW}" height="${p.vbH}" xmlns="${NS}" preserveAspectRatio="xMidYMax meet">
  <defs>
    <linearGradient id="${glassGrad}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(255,230,190,0.48)"/>
      <stop offset="0.12" stop-color="rgba(255,245,220,0.2)"/>
      <stop offset="0.35" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="0.55" stop-color="rgba(200,160,100,0.06)"/>
      <stop offset="0.78" stop-color="rgba(255,236,200,0.12)"/>
      <stop offset="1" stop-color="rgba(240,210,160,0.42)"/>
    </linearGradient>
    <linearGradient id="${edgeGrad}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,236,200,0.32)"/>
      <stop offset="0.4" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="1" stop-color="rgba(140,100,60,0.16)"/>
    </linearGradient>
    <linearGradient id="${shineGrad}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,245,220,0.7)"/>
      <stop offset="0.4" stop-color="rgba(255,230,180,0.15)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="${stemGrad}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(255,236,200,0.32)"/>
      <stop offset="0.45" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="1" stop-color="rgba(255,230,180,0.28)"/>
    </linearGradient>
    <clipPath id="${clipId}"><path d="${p.inner}"/></clipPath>
  </defs>
  ${shell}
  <g clip-path="url(#${clipId})">
    <g class="bands"></g>
    <ellipse class="foam" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop * 0.9}" ry="${p.rimRy * 0.7}" fill="rgba(255,252,245,0.7)" opacity="0"/>
    <g class="ice" opacity="0">${iceMarkup(p.ice)}</g>
  </g>
  <ellipse class="surface" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop}" ry="${p.rimRy * 0.75}" fill="rgba(255,255,255,0.35)" opacity="0"/>
  <ellipse class="surface-shine" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop * 0.45}" ry="${p.rimRy * 0.35}" fill="rgba(255,255,255,0.45)" opacity="0"/>
  <g class="garnish-group"></g>
</svg>`;

  const el = svgFromMarkup(svg);
  geom.set(el, { ...p, clipId, _fill: 0, _raf: 0, _bands: [], _foam: false });
  return el;
}

/** Build glass as cohesive vector vessel (matches bar scene lighting). */
export function buildGlass(glass) {
  return buildGlassSvg(glass);
}

// ---- Prep vessels (simpler metal/glass tools; share setLiquid) ----
function prepGeometry(kind, pad) {
  const cx = pad + 55;
  if (kind === "mixing") {
    const W = 100, H = 130;
    const glass = { tpl: "tumbler", w: W, h: H };
    const p = buildProfile(glass, pad);
    return { ...p, kind: "mixing", metal: false, stemH: 0 };
  }
  if (kind === "blender") {
    const W = 108, H = 140;
    const x0 = pad, y0 = pad + 18, x1 = pad + W, y1 = pad + H, t = 7;
    const lid = `<rect class="prep-lid" x="${x0 + 8}" y="${pad}" width="${W - 16}" height="20" rx="6" fill="#c5ccd4" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
    const oTop = W / 2 - 6, oBot = W / 2 - 14;
    const cxb = pad + W / 2;
    const rimY = y0 + 6, botY = y1;
    const outer = silhouettePath({ cx: cxb, rimY, botY, rimRy: 7, botRy: 8 }, oTop, oBot);
    const inner = silhouettePath({ cx: cxb, rimY: rimY + 2, botY: botY - t, rimRy: 6, botRy: 6 }, oTop - t, oBot - t);
    return {
      perspective: true, cx: cxb, rimY, botY, rimRy: 7, botRy: 8,
      oTop, oBot, iTop: oTop - t, iBot: oBot - t, thick: t, wall: "straight", bulge: 0,
      outer, inner, stemH: 0, footW: 0, footH: 0, lid,
      vbW: W + 2 * pad, vbH: H + 2 * pad + 8, ice: [],
      rimCx: cxb, rimCy: rimY, rimRx: oTop,
      cavBox: { x: cxb - (oTop - t), y: rimY, w: (oTop - t) * 2, h: botY - rimY },
      kind: "blender", metal: false,
    };
  }
  // shaker
  const W = 92, H = 150;
  const x0 = pad, y0 = pad + 16;
  const cxb = pad + W / 2;
  const rimY = y0 + 4, botY = pad + H;
  const oTop = W / 2 - 2, oBot = W / 2 - 10, t = 5;
  const lid = `<rect class="prep-lid" x="${x0 + 10}" y="${pad}" width="${W - 20}" height="18" rx="5" fill="#c5ccd4" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>`;
  const outer = silhouettePath({ cx: cxb, rimY, botY, rimRy: 6, botRy: 10 }, oTop, oBot);
  const inner = silhouettePath({ cx: cxb, rimY: rimY + 2, botY: botY - t, rimRy: 5, botRy: 8 }, oTop - t, oBot - t);
  return {
    perspective: true, cx: cxb, rimY, botY, rimRy: 6, botRy: 10,
    oTop, oBot, iTop: oTop - t, iBot: oBot - t, thick: t, wall: "straight", bulge: 0,
    outer, inner, stemH: 0, footW: 0, footH: 0, lid, metal: true,
    vbW: W + 2 * pad, vbH: H + 2 * pad + 8,
    ice: [
      { x: cxb - 18, y: rimY + 50, s: 18, rot: 8 },
      { x: cxb + 2, y: rimY + 70, s: 14, rot: -10 },
    ],
    rimCx: cxb, rimCy: rimY, rimRx: oTop,
    cavBox: { x: cxb - (oTop - t), y: rimY, w: (oTop - t) * 2, h: botY - rimY },
    kind: "shaker",
  };
}

function assemblePrepSvg(p) {
  const uid = "p" + _uid++;
  const clipId = uid + "cav";
  const ggId = uid + "gg";
  const metalId = uid + "metal";
  const bodyFill = p.metal ? `url(#${metalId})` : `url(#${ggId})`;
  const glassBody = `${p.outer} ${p.inner}`;

  const svg =
`<svg class="glass-svg prep-svg" viewBox="0 0 ${p.vbW} ${p.vbH}" width="${p.vbW}" height="${p.vbH}" xmlns="${NS}" preserveAspectRatio="xMidYMax meet">
  <defs>
    <linearGradient id="${ggId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(255,236,200,0.38)"/>
      <stop offset="0.5" stop-color="rgba(255,255,255,0.05)"/>
      <stop offset="1" stop-color="rgba(255,230,180,0.34)"/>
    </linearGradient>
    <linearGradient id="${metalId}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f4f6f8"/>
      <stop offset="0.35" stop-color="#9aa3ae"/>
      <stop offset="0.55" stop-color="#d5dae0"/>
      <stop offset="1" stop-color="#7f8894"/>
    </linearGradient>
    <clipPath id="${clipId}"><path d="${p.inner}"/></clipPath>
  </defs>
  <path d="${glassBody}" fill-rule="evenodd" fill="${bodyFill}" stroke="rgba(255,236,210,0.5)" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="${p.inner}" fill="rgba(180,150,100,0.05)"/>
  <g clip-path="url(#${clipId})">
    <g class="bands"></g>
    <ellipse class="foam" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop * 0.9}" ry="6" fill="rgba(255,250,240,0.55)" opacity="0"/>
    <g class="ice">${iceMarkup(p.ice)}</g>
  </g>
  <ellipse class="surface" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop}" ry="6" fill="rgba(255,255,255,0.4)" opacity="0"/>
  <ellipse class="surface-shine" cx="${p.cx}" cy="${p.botY}" rx="${p.iTop * 0.4}" ry="3" fill="rgba(255,255,255,0.35)" opacity="0"/>
  ${p.lid || ""}
  <ellipse class="rim" cx="${p.cx}" cy="${p.rimY}" rx="${p.oTop}" ry="${p.rimRy}" fill="rgba(255,240,210,0.05)" stroke="rgba(255,236,210,0.65)" stroke-width="2"/>
  <g class="garnish-group"></g>
</svg>`;

  const el = svgFromMarkup(svg);
  geom.set(el, { ...p, clipId, _fill: 0, _raf: 0 });
  return el;
}

export function buildPrepVessel(kind = "shaker") {
  return assemblePrepSvg(prepGeometry(kind, 14));
}

/** Perspective liquid slice between yTop and yBot (y increases downward). */
function bandPath(p, yTop, yBot) {
  const rxT = rxAt(p, yTop, true);
  const rxB = rxAt(p, yBot, true);
  const ry = Math.max(4, p.rimRy * 0.65 * (rxT / Math.max(1, p.iTop)));
  const { cx } = p;
  // Front surface ellipse at yTop, walls down to yBot, bottom chord
  return [
    `M ${cx - rxT} ${yTop}`,
    `A ${rxT} ${ry} 0 0 1 ${cx + rxT} ${yTop}`,
    `L ${cx + rxB} ${yBot}`,
    `A ${rxB} ${Math.max(3, ry * 0.7)} 0 0 1 ${cx - rxB} ${yBot}`,
    "Z",
  ].join(" ");
}

function paintBands(bandsG, p, bands, fillPx) {
  bandsG.innerHTML = "";
  if (fillPx <= 0 || !bands.length) return;
  const bottom = p.botY - p.thick * 0.35;
  let acc = 0;
  bands.forEach((b, i) => {
    const bh = (b.frac || 0) * fillPx;
    if (bh < 0.5) { acc += bh; return; }
    const yBot = bottom - acc;
    const yTop = bottom - acc - bh;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", bandPath(p, yTop, yBot));
    path.setAttribute("fill", hexAlpha(b.color, 0.9));
    path.style.transition = "fill .45s ease";
    // darker near walls for depth
    path.setAttribute("stroke", hexAlpha(b.color, 0.35));
    path.setAttribute("stroke-width", "0.6");
    bandsG.appendChild(path);
    acc += bh;
  });
}

export function setLiquid(svg, bands, fillFrac, animate = true, opts = {}) {
  const s = geom.get(svg);
  if (!s) return;
  const h = Math.max(1, s.botY - s.rimY - s.thick * 0.35);
  const fillPx = Math.max(0, Math.min(1, fillFrac)) * h;
  const bandsG = svg.querySelector(".bands");
  if (!bandsG) return;

  s._bands = bands;
  s._foam = !!opts.foam;

  const apply = (cur) => {
    paintBands(bandsG, s, bands, cur);
    const surface = svg.querySelector(".surface");
    const shine = svg.querySelector(".surface-shine");
    const foam = svg.querySelector(".foam");
    const ice = svg.querySelector(".ice");
    const cy = s.botY - s.thick * 0.35 - cur;
    const rx = rxAt(s, cy, true);
    const ry = Math.max(4, s.rimRy * 0.7 * (rx / Math.max(1, s.iTop)));
    if (ice) ice.setAttribute("opacity", cur > 6 ? "1" : "0");
    if (surface) {
      surface.setAttribute("cx", String(s.cx));
      surface.setAttribute("cy", String(cy));
      surface.setAttribute("rx", String(rx * 0.98));
      surface.setAttribute("ry", String(ry));
      surface.setAttribute("opacity", cur > 4 ? "0.55" : "0");
      surface.setAttribute("fill", bands.length ? hexAlpha(bands[bands.length - 1].color, 0.35) : "rgba(255,255,255,0.35)");
    }
    if (shine) {
      shine.setAttribute("cx", String(s.cx - rx * 0.15));
      shine.setAttribute("cy", String(cy - 1));
      shine.setAttribute("rx", String(rx * 0.4));
      shine.setAttribute("ry", String(ry * 0.45));
      shine.setAttribute("opacity", cur > 4 ? "0.4" : "0");
    }
    if (foam) {
      foam.setAttribute("cx", String(s.cx));
      foam.setAttribute("cy", String(cy - 5));
      foam.setAttribute("rx", String(rx * 0.95));
      foam.setAttribute("ry", String(ry * 0.9));
      foam.setAttribute("opacity", opts.foam && cur > 8 ? "0.8" : "0");
    }
  };

  const from = s._fill || 0;
  // Pace large fill jumps (guess-mode mixers) so the glass doesn't flash-fill.
  let dur = 0;
  if (animate) {
    if (typeof opts.duration === "number") {
      dur = Math.max(0, opts.duration);
    } else {
      const delta = Math.abs(fillPx - from) / h;
      if (delta < 0.12) dur = 480;
      else if (delta < 0.28) dur = 650;
      else if (delta < 0.45) dur = 900;
      else dur = 1100;
    }
  }
  const start = performance.now();
  cancelAnimationFrame(s._raf);
  if (!dur) {
    apply(fillPx);
    s._fill = fillPx;
    return;
  }
  const frame = (now) => {
    const prog = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - prog, 3);
    const cur = from + (fillPx - from) * eased;
    apply(cur);
    if (prog < 1) s._raf = requestAnimationFrame(frame);
    else s._fill = fillPx;
  };
  s._raf = requestAnimationFrame(frame);
}

function gN(n) {
  return Math.round(n * 10) / 10;
}

function clampG(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Front rim of the ellipse (t=0 right, t=0.5 near-center, t=1 left). */
function rimFront(s, t) {
  const a = t * Math.PI;
  return { x: s.cx + s.oTop * Math.cos(a), y: s.rimY + s.rimRy * Math.sin(a) };
}

function wrapGarnish(inner, extraClass = "") {
  return `<g class="garnish-art${extraClass ? " " + extraClass : ""}">${inner}</g>`;
}

function citrusWheelMarkup(s, rind, pith, flesh) {
  const r = clampG(s.oTop * 0.58, 15, 24);
  const ry = r * 0.8;
  const thick = Math.max(2.4, r * 0.18);
  const p = rimFront(s, 0.15);
  let cuts = "";
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 + 0.12;
    cuts += `<line x1="0" y1="0" x2="${gN(Math.cos(a) * r * 0.68)}" y2="${gN(Math.sin(a) * ry * 0.68)}" stroke="${pith}" stroke-width="${gN(Math.max(0.5, r * 0.032))}" opacity="0.78"/>`;
  }
  return wrapGarnish(`<g transform="translate(${gN(p.x)},${gN(p.y)}) rotate(-36)">
    <ellipse cx="0" cy="${gN(ry * 0.2 + thick)}" rx="${gN(r * 0.72)}" ry="${gN(ry * 0.18)}" fill="rgba(0,0,0,0.25)"/>
    <ellipse cx="0" cy="${gN(thick * 0.6)}" rx="${gN(r)}" ry="${gN(ry)}" fill="${rind}"/>
    <ellipse cx="0" cy="0" rx="${gN(r)}" ry="${gN(ry)}" fill="${rind}" stroke="#3a6410" stroke-width="0.75"/>
    <ellipse cx="0" cy="0" rx="${gN(r * 0.84)}" ry="${gN(ry * 0.84)}" fill="${pith}"/>
    <ellipse cx="0" cy="0" rx="${gN(r * 0.75)}" ry="${gN(ry * 0.75)}" fill="${flesh}"/>
    ${cuts}
    <ellipse cx="0" cy="0" rx="${gN(r * 0.13)}" ry="${gN(ry * 0.13)}" fill="${pith}"/>
    <ellipse cx="${gN(-r * 0.22)}" cy="${gN(-ry * 0.28)}" rx="${gN(r * 0.26)}" ry="${gN(ry * 0.14)}" fill="rgba(255,255,255,0.28)"/>
  </g>`);
}

function peelTwistMarkup(s, rind, pith, thick = 1) {
  const u = clampG(s.oTop * 0.58, 14, 24);
  const p = rimFront(s, 0.16);
  const w = Math.max(1.7, u * 0.15 * thick);
  return wrapGarnish(`<g transform="translate(${gN(p.x)},${gN(p.y)}) rotate(16)">
    <path d="M ${gN(u * 0.08)} ${gN(u * 0.12)}
             C ${gN(u * 0.9)} ${gN(-u * 0.58)}, ${gN(u * 1.18)} ${gN(u * 0.12)}, ${gN(u * 0.52)} ${gN(u * 0.88)}
             S ${gN(-u * 0.12)} ${gN(u * 0.92)}, ${gN(u * 0.18)} ${gN(u * 0.42)}"
          fill="none" stroke="${rind}" stroke-width="${gN(w)}" stroke-linecap="round"/>
    <path d="M ${gN(u * 0.1)} ${gN(u * 0.12)}
             C ${gN(u * 0.86)} ${gN(-u * 0.5)}, ${gN(u * 1.08)} ${gN(u * 0.1)}, ${gN(u * 0.52)} ${gN(u * 0.78)}"
          fill="none" stroke="${pith}" stroke-width="${gN(w * 0.38)}" stroke-linecap="round" opacity="0.9"/>
  </g>`);
}

function orangePeelMarkup(s) {
  const u = clampG(s.oTop * 0.62, 16, 26);
  const p = rimFront(s, 0.14);
  return wrapGarnish(`<g transform="translate(${gN(p.x)},${gN(p.y)}) rotate(10)">
    <path d="M ${gN(-u * 0.12)} ${gN(u * 0.06)}
             C ${gN(u * 0.12)} ${gN(-u * 0.82)}, ${gN(u * 1.08)} ${gN(-u * 0.5)}, ${gN(u * 0.92)} ${gN(u * 0.38)}
             C ${gN(u * 0.84)} ${gN(u * 0.68)}, ${gN(u * 0.42)} ${gN(u * 0.5)}, ${gN(u * 0.32)} ${gN(u * 0.12)}
             C ${gN(u * 0.55)} ${gN(-u * 0.42)}, ${gN(u * 0.08)} ${gN(-u * 0.55)}, ${gN(-u * 0.12)} ${gN(u * 0.06)} Z"
          fill="#e8891a" stroke="#c56a0c" stroke-width="0.55"/>
    <path d="M ${gN(-u * 0.02)} ${gN(u * 0.02)}
             C ${gN(u * 0.18)} ${gN(-u * 0.62)}, ${gN(u * 0.88)} ${gN(-u * 0.38)}, ${gN(u * 0.78)} ${gN(u * 0.18)}"
          fill="none" stroke="#f6d089" stroke-width="${gN(Math.max(1, u * 0.07))}" stroke-linecap="round" opacity="0.75"/>
  </g>`);
}

function mintSprigMarkup(s) {
  const u = clampG(s.oTop * 0.62, 14, 24);
  const x = s.cx + s.iTop * 0.22;
  const y = s.rimY + 1;
  const leaf = (tx, ty, rot, len, fill) =>
    `<g transform="translate(${gN(tx)},${gN(ty)}) rotate(${rot})">
      <path d="M 0 0 C ${gN(-len * 0.3)} ${gN(-len * 0.32)}, ${gN(-len * 0.1)} ${gN(-len * 0.82)}, 0 ${gN(-len)}
               C ${gN(len * 0.1)} ${gN(-len * 0.82)}, ${gN(len * 0.3)} ${gN(-len * 0.32)}, 0 0 Z" fill="${fill}"/>
      <path d="M 0 0 L 0 ${gN(-len * 0.86)}" stroke="#245c32" stroke-width="0.65" opacity="0.5"/>
    </g>`;
  return wrapGarnish(`<g transform="translate(${gN(x)},${gN(y)})">
    ${leaf(0, 0, -26, u * 0.92, "#3b8a48")}
    ${leaf(1.2, 1.5, 6, u * 1.08, "#4eaa58")}
    ${leaf(2.2, 1, 34, u * 0.84, "#2f7540")}
    ${leaf(-3.5, 3.5, -46, u * 0.58, "#5cb866")}
  </g>`);
}

function oliveMarkup(s) {
  const u = clampG(s.oTop * 0.2, 7.5, 12);
  const y = s.rimY + Math.max(12, Math.min(s.oTop * 0.32, (s.botY - s.rimY) * 0.28));
  const pick = s.iTop * 0.82;
  return wrapGarnish(`
    <line x1="${gN(s.cx - pick)}" y1="${gN(s.rimY + 2)}" x2="${gN(s.cx + pick * 0.08)}" y2="${gN(y + u * 0.15)}"
          stroke="#d9c9a4" stroke-width="${gN(Math.max(1.05, u * 0.13))}" stroke-linecap="round"/>
    <ellipse cx="${gN(s.cx)}" cy="${gN(y)}" rx="${gN(u * 1.12)}" ry="${gN(u * 0.74)}" fill="#6a8c30" stroke="#4c661c" stroke-width="0.6"/>
    <ellipse cx="${gN(s.cx + u * 0.18)}" cy="${gN(y - u * 0.06)}" rx="${gN(u * 0.3)}" ry="${gN(u * 0.24)}" fill="#c4452d"/>
    <ellipse cx="${gN(s.cx - u * 0.38)}" cy="${gN(y - u * 0.26)}" rx="${gN(u * 0.32)}" ry="${gN(u * 0.16)}" fill="rgba(255,255,255,0.28)"/>
  `);
}

function cherryMarkup(s) {
  const u = clampG(s.oTop * 0.22, 8, 13);
  const p = rimFront(s, 0.17);
  return wrapGarnish(`<g transform="translate(${gN(p.x)},${gN(p.y)})">
    <path d="M 0 ${gN(-u * 0.15)} C ${gN(u * 0.12)} ${gN(-u * 1.25)}, ${gN(u * 0.72)} ${gN(-u * 1.55)}, ${gN(u * 0.58)} ${gN(-u * 1.95)}"
          fill="none" stroke="#2f7a38" stroke-width="${gN(Math.max(0.9, u * 0.11))}" stroke-linecap="round"/>
    <ellipse cx="0" cy="${gN(u * 0.2)}" rx="${gN(u)}" ry="${gN(u * 0.9)}" fill="#8e1024"/>
    <ellipse cx="0" cy="${gN(u * 0.18)}" rx="${gN(u * 0.9)}" ry="${gN(u * 0.8)}" fill="#c41832"/>
    <ellipse cx="${gN(-u * 0.3)}" cy="${gN(-u * 0.08)}" rx="${gN(u * 0.28)}" ry="${gN(u * 0.18)}" fill="rgba(255,255,255,0.32)"/>
  </g>`);
}

function coffeeBeansMarkup(s) {
  const u = clampG(s.oTop * 0.11, 3.8, 6.5);
  const fill = s._fill || 0;
  const cy = fill > 6
    ? s.botY - s.thick * 0.35 - fill - 1.5
    : s.rimY + s.rimRy * 0.45;
  const bean = (dx, dy, rot) =>
    `<g transform="translate(${gN(s.cx + dx)},${gN(cy + dy)}) rotate(${rot})">
      <ellipse cx="0" cy="0" rx="${gN(u)}" ry="${gN(u * 0.52)}" fill="#3a2214" stroke="#24150c" stroke-width="0.35"/>
      <path d="M 0 ${gN(-u * 0.38)} C ${gN(u * 0.14)} 0, ${gN(-u * 0.14)} 0, 0 ${gN(u * 0.38)}" fill="none" stroke="#c4a07a" stroke-width="0.65"/>
    </g>`;
  return wrapGarnish(`${bean(-u * 1.35, 0.4, -26)}${bean(u * 0.25, -u * 0.45, 16)}${bean(u * 1.45, u * 0.35, 48)}`);
}

function pineappleWedgeMarkup(s) {
  const u = clampG(s.oTop * 0.62, 16, 26);
  const p = rimFront(s, 0.17);
  return wrapGarnish(`<g transform="translate(${gN(p.x)},${gN(p.y)}) rotate(-26)">
    <ellipse cx="${gN(u * 0.45)}" cy="${gN(u * 0.08)}" rx="${gN(u * 0.5)}" ry="${gN(u * 0.14)}" fill="rgba(0,0,0,0.16)"/>
    <path d="M 0 0 L ${gN(u * 0.92)} ${gN(-u * 1.12)} L ${gN(u * 1.32)} ${gN(-u * 0.18)} Z" fill="#efc43c" stroke="#d4a016" stroke-width="0.55"/>
    <path d="M ${gN(u * 0.92)} ${gN(-u * 1.12)} L ${gN(u * 1.2)} ${gN(-u * 1.28)} L ${gN(u * 1.32)} ${gN(-u * 0.18)}" fill="#c9a024"/>
    <path d="M ${gN(u * 0.92)} ${gN(-u * 1.12)} L ${gN(u * 0.78)} ${gN(-u * 1.5)} L ${gN(u * 1.05)} ${gN(-u * 1.32)} Z" fill="#3d8f3a"/>
    <path d="M ${gN(u * 0.92)} ${gN(-u * 1.12)} L ${gN(u * 1.1)} ${gN(-u * 1.58)} L ${gN(u * 1.16)} ${gN(-u * 1.22)} Z" fill="#2f7540"/>
    <path d="M ${gN(u * 0.22)} ${gN(-u * 0.12)} L ${gN(u * 0.82)} ${gN(-u * 0.82)}" stroke="#ffe9a0" stroke-width="0.55" opacity="0.8"/>
    <path d="M ${gN(u * 0.38)} ${gN(-u * 0.04)} L ${gN(u * 1.02)} ${gN(-u * 0.5)}" stroke="#ffe9a0" stroke-width="0.45" opacity="0.7"/>
  </g>`);
}

function rimCrustMarkup(s, sugar) {
  const n = Math.round(clampG(s.oTop * 0.58, 20, 38));
  const fill = sugar ? "rgba(255,248,228,0.96)" : "rgba(255,255,255,0.96)";
  const stroke = sugar ? "rgba(236,208,148,0.65)" : "rgba(210,222,232,0.5)";
  const sw = Math.max(1.8, s.oTop * 0.038);
  let dots = `<ellipse cx="${gN(s.cx)}" cy="${gN(s.rimY)}" rx="${gN(s.oTop)}" ry="${gN(s.rimRy)}" fill="none" stroke="${fill}" stroke-width="${gN(sw)}" opacity="0.5"/>`;
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n;
    const j = ((i * 17) % 7 - 3) * 0.32;
    const px = s.cx + (s.oTop + j * 0.12) * Math.cos(a);
    const py = s.rimY + s.rimRy * Math.sin(a) + j * 0.18;
    dots += `<circle cx="${gN(px)}" cy="${gN(py)}" r="${gN(1.05 + (i % 3) * 0.5)}" fill="${fill}" stroke="${stroke}" stroke-width="0.2"/>`;
  }
  return wrapGarnish(dots, "garnish-art--static");
}

function garnishMarkup(s, gid) {
  switch (gid) {
    case "lime_wheel":
      return citrusWheelMarkup(s, "#4e7a1c", "#e4eeb4", "#b8cc44");
    case "lemon_twist":
      return peelTwistMarkup(s, "#f0c62e", "#fff4b0", 0.92);
    case "orange_peel":
      return orangePeelMarkup(s);
    case "mint_sprig":
      return mintSprigMarkup(s);
    case "olive":
      return oliveMarkup(s);
    case "cherry":
      return cherryMarkup(s);
    case "coffee_beans":
      return coffeeBeansMarkup(s);
    case "pineapple_wedge":
      return pineappleWedgeMarkup(s);
    case "salt_rim":
      return rimCrustMarkup(s, false);
    case "sugar_rim":
      return rimCrustMarkup(s, true);
    default:
      return "";
  }
}

export function setGarnish(svg, gid, emoji) {
  const s = geom.get(svg);
  const g = svg.querySelector(".garnish-group");
  if (!s || !g) return;
  while (g.firstChild) g.removeChild(g.firstChild);
  if (!gid || gid === "none") return;

  const art = garnishMarkup(s, gid);
  if (art) {
    try {
      const parsed = new DOMParser().parseFromString(
        `<svg xmlns="${NS}">${art}</svg>`,
        "image/svg+xml"
      );
      const root = parsed.documentElement;
      if (root && !parsed.querySelector("parsererror")) {
        [...root.childNodes].forEach((node) => {
          g.appendChild(document.importNode(node, true));
        });
        return;
      }
    } catch (e) { /* fall through */ }
    g.innerHTML = art;
    return;
  }

  const size = clampG(s.oTop * 0.38, 11, 16);
  const p = rimFront(s, 0.2);
  const text = document.createElementNS(NS, "text");
  text.setAttribute("x", String(gN(p.x)));
  text.setAttribute("y", String(gN(p.y + 2)));
  text.setAttribute("font-size", String(gN(size)));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("class", "garnish-emoji");
  text.textContent = emoji || "";
  g.appendChild(text);
}

export function clearLiquid(svg) {
  setLiquid(svg, [], 0, false);
}
