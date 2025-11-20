import React, { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function App() {
  const [files, setFiles] = useState([]);
  const [fontName, setFontName] = useState("custom-icons");
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);

  const onFilesChange = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.name.toLowerCase().endsWith(".svg")
    );
    if (dropped.length) {
      setFiles(dropped);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async () => {
    if (!files.length) {
      setStatus("Please select at least one SVG file.");
      return;
    }

    try {
      setStatus("Uploading & generating font…");
      setDownloading(true);

      const formData = new FormData();
      files.forEach((f) => formData.append("icons", f));
      if (fontName.trim()) formData.append("fontName", fontName.trim());

      const res = await fetch(`${API_BASE}/api/svg-to-font`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fontName || "custom-icons"}-bundle.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatus("Done! ZIP downloaded.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-root">
      <div className="app-card">
        <header className="app-header">
          <h1>SVG → Icon Font Builder</h1>
          <p>
            Upload your SVG icons, we scale them to <strong>24×24</strong>,
            generate a <strong>TTF + WOFF2</strong> icon font, CSS and a demo
            page, and return everything as a ZIP.
          </p>
        </header>

        <section
          className="dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="dropzone-inner">
            <p className="drop-title">Drop SVG files here</p>
            <p className="drop-sub">or click to browse</p>
            <input
              type="file"
              accept=".svg"
              multiple
              onChange={onFilesChange}
            />
          </div>
        </section>

        {files.length > 0 && (
          <section className="file-list">
            <div className="file-list-header">
              <span>Selected icons ({files.length})</span>
              <button
                type="button"
                className="btn-link"
                onClick={() => setFiles([])}
              >
                Clear
              </button>
            </div>
            <ul>
              {files.map((f) => (
                <li key={f.name}>
                  <span className="file-name">{f.name}</span>
                  <span className="file-size">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="controls">
          <label className="field">
            <span>Font name</span>
            <input
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="custom-icons"
            />
          </label>

          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={downloading}
          >
            {downloading ? "Generating…" : "Generate font ZIP"}
          </button>

          {status && <p className="status">{status}</p>}

          <p className="hint">
            Backend URL: <code>{API_BASE}</code>
          </p>
        </section>
      </div>

      <footer className="footer">
        <p>Powered by Render (backend) + React (frontend) + Fantasticon.</p>
      </footer>
    </div>
  );
}
