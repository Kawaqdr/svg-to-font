// backend/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const {
  generateFonts,
  FontAssetType,
  OtherAssetType,
} = require("fantasticon");
const { scaleSvgFolder } = require("./scaleSvgs");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// CORS: public accessible
app.use(
  cors({
    origin: "*",
  })
);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "SVG → Font API" });
});

/**
 * POST /api/svg-to-font
 * Form-data:
 *   icons: multiple SVG files
 * Optional:
 *   fontName: string
 */
app.post("/api/svg-to-font", upload.array("icons"), async (req, res) => {
  const files = req.files || [];
  const fontName = (req.body.fontName || "custom-icons").toLowerCase();

  if (!files.length) {
    return res.status(400).json({ error: "No SVG files uploaded (field name: icons)" });
  }

  try {
    // Create temp workspace
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "svg-font-"));
    const inputDir = path.join(tmpRoot, "input");
    const scaledDir = path.join(tmpRoot, "scaled");
    const outputDir = path.join(tmpRoot, "output");
    await fs.mkdir(inputDir);
    await fs.mkdir(scaledDir);
    await fs.mkdir(outputDir);

    // Save uploaded SVGs to inputDir
    for (const file of files) {
      let name = file.originalname || "icon.svg";
      if (!name.toLowerCase().endsWith(".svg")) {
        name += ".svg";
      }
      const dest = path.join(inputDir, name);
      await fs.writeFile(dest, file.buffer);
    }

    // Scale them all to 24px (or whatever your script uses)
    await scaleSvgFolder(inputDir, scaledDir, 24);

    // Generate fonts via Fantasticon
    await generateFonts({
      inputDir: scaledDir,
      outputDir,
      name: fontName,
      fontTypes: [FontAssetType.TTF, FontAssetType.WOFF2],
      assetTypes: [OtherAssetType.CSS, OtherAssetType.HTML],
      normalize: true,
    });

    // Prepare ZIP response
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fontName}-bundle.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) {
        res.status(500).end("Error creating archive");
      }
    });

    archive.pipe(res);

    // Add font + assets to zip
    const maybeAddFile = async (filePath, nameInZip) => {
      try {
        await fs.access(filePath);
        archive.file(filePath, { name: nameInZip });
      } catch {
        console.warn("Missing file (skipping):", filePath);
      }
    };

    const ttfPath = path.join(outputDir, `${fontName}.ttf`);
    const woff2Path = path.join(outputDir, `${fontName}.woff2`);
    const cssPath = path.join(outputDir, `${fontName}.css`);
    const htmlPath = path.join(outputDir, `${fontName}.html`);

    await maybeAddFile(ttfPath, `${fontName}.ttf`);
    await maybeAddFile(woff2Path, `${fontName}.woff2`);
    await maybeAddFile(cssPath, `${fontName}.css`);
    await maybeAddFile(htmlPath, `${fontName}-demo.html`);

    // Also include scaled SVGs folder for reference
    archive.directory(scaledDir, "scaled-svgs");

    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "SVG to font failed", details: err.message });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SVG → Font API listening on port ${PORT}`);
});
