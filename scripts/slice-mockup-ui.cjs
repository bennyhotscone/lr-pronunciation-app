const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ASSETS =
  "C:/Users/Administrator/.cursor/projects/c-Users-Administrator-Downloads-lr-pronunciation-cursor-kit/assets";
const OUT = path.join(process.cwd(), "public", "mockup-ui");
fs.mkdirSync(OUT, { recursive: true });

async function load(name) {
  const { data, info } = await sharp(path.join(ASSETS, name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
}

function L(raw, x, y) {
  const i = (y * raw.w + x) * raw.c;
  return (raw.data[i] + raw.data[i + 1] + raw.data[i + 2]) / 3;
}

/** Find phone screen by locating dark bezel columns then bright interior. */
function findPhone(raw) {
  const { w, h } = raw;
  const midY = Math.floor(h * 0.42);
  // score each x: fraction of dark pixels in a vertical band near mid
  const darkScore = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let dark = 0;
    for (let dy = -120; dy <= 120; dy += 3) {
      const y = midY + dy;
      if (y < 0 || y >= h) continue;
      if (L(raw, x, y) < 55) dark++;
    }
    darkScore[x] = dark;
  }
  // find two strong dark bands (left/right bezels) with bright gap between
  let best = null;
  for (let left = 80; left < w * 0.45; left++) {
    if (darkScore[left] < 30) continue;
    for (let right = w - 80; right > w * 0.55; right--) {
      if (darkScore[right] < 30) continue;
      const width = right - left;
      if (width < 280 || width > 620) continue;
      // interior should be brighter on average
      let bright = 0;
      let n = 0;
      const cx = Math.floor((left + right) / 2);
      for (let dx = -40; dx <= 40; dx += 4) {
        for (let dy = -60; dy <= 60; dy += 6) {
          bright += L(raw, cx + dx, midY + dy);
          n++;
        }
      }
      const avg = bright / n;
      if (avg < 140) continue;
      const score = avg * width + darkScore[left] + darkScore[right];
      if (!best || score > best.score) best = { left, right, score, avg };
    }
  }
  if (!best) {
    // fallback centered phone
    return { left: 250, top: 60, width: 520, height: 1400 };
  }
  // refine top/bottom: first/last rows with content inside bezel
  const ix0 = best.left + 18;
  const ix1 = best.right - 18;
  let top = 40;
  let bottom = h - 40;
  for (let y = 10; y < h * 0.3; y++) {
    let dark = 0;
    for (let x = ix0; x <= ix1; x += 6) if (L(raw, x, y) < 40) dark++;
    if (dark > 20) top = y; // still in notch/bezel
    else break;
  }
  for (let y = h - 10; y > h * 0.7; y--) {
    let dark = 0;
    for (let x = ix0; x <= ix1; x += 6) if (L(raw, x, y) < 40) dark++;
    if (dark > 20) bottom = y;
    else break;
  }
  return {
    left: best.left + 14,
    top: top + 8,
    width: best.right - best.left - 28,
    height: bottom - top - 16,
  };
}

async function extract(src, outName, region, scale) {
  let pipe = sharp(path.join(ASSETS, src)).extract(region);
  if (scale !== 1) {
    pipe = pipe.resize({
      width: Math.round(region.width * scale),
      height: Math.round(region.height * scale),
      kernel: sharp.kernel.lanczos3,
    });
  }
  const out = path.join(OUT, outName);
  await pipe.png({ compressionLevel: 6 }).toFile(out);
  const m = await sharp(out).metadata();
  console.log("wrote", outName, m.width + "x" + m.height, region);
}

function sub(screen, fx, fy, fw, fh) {
  return {
    left: Math.round(screen.left + screen.width * fx),
    top: Math.round(screen.top + screen.height * fy),
    width: Math.max(8, Math.round(screen.width * fw)),
    height: Math.max(8, Math.round(screen.height * fh)),
  };
}

(async () => {
  const files = {
    pyramid: "mockup-goals-pyramid.png",
    vocab: "mockup-daily-vocab-oneclick.png",
    filesDrive: "mockup-files-drive-grid.png",
    folders: "mockup-files-real-folders.png",
    money: "mockup-class-money-appeals.png",
    desk: "mockup-desk-trapper-classroom.png",
    deskFlat: "mockup-idea5-desk-v1-classroom.png",
    deskTrapper: "mockup-idea5-desk-v2-trapper.png",
  };

  const screens = {};
  for (const [k, f] of Object.entries(files)) {
    const raw = await load(f);
    screens[k] = findPhone(raw);
    console.log("screen", k, screens[k]);
  }

  // Manual overrides where auto is weak (desk flat is top-down, not phone)
  screens.deskFlat = { left: 40, top: 80, width: 940, height: 1380 };
  screens.deskTrapper = { left: 40, top: 60, width: 940, height: 1400 };

  await extract(files.pyramid, "screen-pyramid.png", screens.pyramid, 2);
  await extract(files.vocab, "screen-daily-vocab.png", screens.vocab, 2);
  await extract(files.filesDrive, "screen-files-drive.png", screens.filesDrive, 2);
  await extract(files.folders, "screen-files-folders.png", screens.folders, 2);
  await extract(files.money, "screen-class-money.png", screens.money, 2);
  await extract(files.desk, "screen-desk-trapper.png", screens.desk, 2);
  await extract(files.deskFlat, "desk-plate-classic.png", screens.deskFlat, 2);
  await extract(files.deskTrapper, "desk-plate-trapper.png", screens.deskTrapper, 2);

  // Pyramid panel (avoid beaver header/footer)
  await extract(files.pyramid, "panel-pyramid.png", sub(screens.pyramid, 0.04, 0.16, 0.92, 0.58), 2.5);
  // Vocab card without beaver (card body)
  await extract(files.vocab, "panel-daily-vocab-card.png", sub(screens.vocab, 0.04, 0.2, 0.92, 0.58), 2.5);
  await extract(files.vocab, "btn-make-story.png", sub(screens.vocab, 0.1, 0.55, 0.8, 0.12), 2.5);
  // Wallet only
  await extract(files.money, "panel-wallet.png", sub(screens.money, 0.06, 0.14, 0.88, 0.3), 2.5);
  await extract(files.money, "chip-wallet.png", sub(screens.money, 0.1, 0.22, 0.8, 0.18), 2.5);
  // Files chrome
  await extract(files.filesDrive, "panel-files-drive.png", sub(screens.filesDrive, 0.03, 0.12, 0.94, 0.7), 2);
  await extract(files.folders, "panel-folders.png", sub(screens.folders, 0.05, 0.26, 0.9, 0.36), 2.5);

  const f = screens.folders;
  const tiles = [
    ["folder-tile-1.png", 0.06, 0.28, 0.28, 0.17],
    ["folder-tile-2.png", 0.36, 0.28, 0.28, 0.17],
    ["folder-tile-3.png", 0.66, 0.28, 0.28, 0.17],
    ["folder-tile-4.png", 0.16, 0.45, 0.28, 0.17],
    ["folder-tile-5.png", 0.5, 0.45, 0.28, 0.17],
  ];
  for (const [n, a, b, c, d] of tiles) {
    await extract(files.folders, n, sub(f, a, b, c, d), 2.5);
  }

  // Wood texture strip
  await extract(files.pyramid, "texture-wood-desk.png", { left: 0, top: 1150, width: 1024, height: 386 }, 2);

  // Theme recolors
  await sharp(path.join(OUT, "desk-plate-classic.png"))
    .modulate({ brightness: 0.9, saturation: 0.5 })
    .png()
    .toFile(path.join(OUT, "desk-plate-slate.png"));
  console.log("wrote desk-plate-slate.png");
  await sharp(path.join(OUT, "desk-plate-classic.png"))
    .modulate({ brightness: 1.06, saturation: 1.12, hue: 10 })
    .png()
    .toFile(path.join(OUT, "desk-plate-warm.png"));
  console.log("wrote desk-plate-warm.png");

  // Full mockups at 2x for max sharpness when used as backgrounds
  for (const [out, src] of [
    ["src-pyramid.png", files.pyramid],
    ["src-vocab-oneclick.png", files.vocab],
    ["src-files-drive.png", files.filesDrive],
    ["src-files-folders.png", files.folders],
    ["src-money.png", files.money],
    ["src-desk-flat.png", files.deskFlat],
  ]) {
    await sharp(path.join(ASSETS, src))
      .resize({ width: 2048, kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6 })
      .toFile(path.join(OUT, out));
    console.log("wrote", out);
  }
  console.log("DONE");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
