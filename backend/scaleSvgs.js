// backend/scaleSvgs.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const SvgPath = require("svgpath");

const NEW_SIZE = 24;

/**
 * Scale every .svg in inputDir to NEW_SIZE x NEW_SIZE
 * and write the result into outputDir.
 */
async function scaleSvgFolder(inputDir, outputDir, newSize = NEW_SIZE) {
  await fsp.mkdir(outputDir, { recursive: true });

  const files = await fsp.readdir(inputDir);
  for (const file of files) {
    if (path.extname(file).toLowerCase() !== ".svg") continue;

    const srcPath = path.join(inputDir, file);
    const destPath = path.join(outputDir, file);

    const content = await fsp.readFile(srcPath, "utf8");
    const scaled = scaleSingleSvgContent(content, newSize);
    if (!scaled) {
      console.warn(`Skipping ${file}: couldn't detect original size`);
      continue;
    }
    await fsp.writeFile(destPath, scaled, "utf8");
    console.log(`Scaled to ${newSize}×${newSize}: ${file}`);
  }
}

/**
 * Scale a single SVG string to newSize x newSize.
 * Returns modified string or null if cannot detect original size.
 */
function scaleSingleSvgContent(content, newSize) {
  let minX = 0;
  let minY = 0;
  let oldWidth = null;
  let oldHeight = null;

  // 1) Try to read from viewBox
  const vbMatch = content.match(/viewBox="([^"]+)"/i);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      [minX, minY, oldWidth, oldHeight] = parts;
    }
  }

  // 2) Fallback: try width/height attributes
  if (oldWidth == null || oldHeight == null) {
    const wMatch = content.match(/\swidth="([\d.]+)(px)?"/i);
    const hMatch = content.match(/\sheight="([\d.]+)(px)?"/i);
    if (wMatch && hMatch) {
      oldWidth = parseFloat(wMatch[1]);
      oldHeight = parseFloat(hMatch[1]);
      minX = 0;
      minY = 0;
    }
  }

  // If we still don't know the original size, skip
  if (!oldWidth || !oldHeight) {
    return null;
  }

  const scaleX = newSize / oldWidth;
  const scaleY = newSize / oldHeight;

  // 4) Transform all <path> d attributes
  let out = content.replace(
    /<path([^>]*)d="([^"]+)"([^>]*)>/gi,
    (match, pre, d, post) => {
      let p = new SvgPath(d);

      if (minX !== 0 || minY !== 0) {
        p = p.translate(-minX, -minY);
      }

      p = p.scale(scaleX, scaleY);
      const newD = p.toString();

      return `<path${pre}d="${newD}"${post}>`;
    }
  );

  // 5) Normalize <svg> tag attributes
  out = out.replace(/\s(width|height|viewBox)="[^"]*"/gi, "");
  out = out.replace(
    /<svg([^>]*)>/i,
    `<svg$1 width="${newSize}" height="${newSize}" viewBox="0 0 ${newSize} ${newSize}">`
  );

  return out;
}

module.exports = {
  scaleSvgFolder,
};
