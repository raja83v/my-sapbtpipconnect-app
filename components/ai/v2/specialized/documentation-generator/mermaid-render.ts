/**
 * Client-side helper to render a Mermaid diagram to a PNG byte array,
 * suitable for embedding into a .docx via `ImageRun`.
 *
 * Strategy:
 *   1. Sanitize the Mermaid source (strip stray escape sequences, blank-line runs).
 *   2. mermaid.render(id, code) → SVG string.
 *   3. Encode the SVG to a Blob URL, draw it into a Canvas at 2x scale.
 *   4. Read the canvas back as a PNG Blob → Uint8Array.
 *
 * NOTES:
 *   - We force `htmlLabels: false` so mermaid emits plain SVG `<text>` nodes
 *     instead of `<foreignObject>`. Browsers will refuse to rasterise SVGs
 *     that contain `<foreignObject>` when loaded through an `<img>` tag,
 *     which causes flowcharts (which use HTML labels by default) to silently
 *     fail to render. Sequence diagrams don't use foreignObject and were
 *     unaffected by the bug.
 *
 * Falls back to `null` on any failure (no exception thrown).
 */

let mermaidInitialised = false;

async function ensureMermaid() {
  const m = (await import("mermaid")).default;
  if (!mermaidInitialised) {
    m.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      // CRITICAL: keep htmlLabels off so the resulting SVG can be rasterised
      // through `<img>` + canvas. With htmlLabels:true mermaid wraps labels
      // in <foreignObject>, which canvas cannot draw through <img>.
      flowchart: { htmlLabels: false, useMaxWidth: false },
      class: { htmlLabels: false },
    });
    mermaidInitialised = true;
  }
  return m;
}

export interface RenderedMermaidPng {
  data: Uint8Array;
  widthPx: number;
  heightPx: number;
}

/**
 * Pre-process raw Mermaid source coming from an LLM. Common failure modes
 * we repair before handing the source to mermaid.parse:
 *   - Literal `\n` escape sequences inside node labels (`A[Sender\nS4HANA]`)
 *     → mermaid expects `<br/>` for line breaks; substitute that.
 *   - Carriage returns and stray BOMs.
 *   - Tabs inside labels.
 *   - Runs of 3+ blank lines (cosmetic; trimmed for consistency).
 */
function sanitizeMermaid(input: string): string {
  let code = input.replace(/\r\n/g, "\n").replace(/\uFEFF/g, "");

  // Replace literal `\n` (two chars: backslash + n) inside [label] / (label)
  // / {label} / ((label)) with `<br/>`. Targeted to label brackets so we
  // don't accidentally edit edge text or directives.
  code = code.replace(
    /([\[(\{])([^\])}\n]*?)([\])}])/g,
    (_match, open: string, body: string, close: string) =>
      `${open}${body.replace(/\\n/g, "<br/>").replace(/\t/g, " ")}${close}`,
  );

  // Squash 3+ consecutive blank lines into a single blank line.
  code = code.replace(/\n{3,}/g, "\n\n");

  return code.trim();
}

export async function renderMermaidToPng(
  mermaidCode: string,
  options: { scale?: number } = {},
): Promise<RenderedMermaidPng | null> {
  const cleaned = sanitizeMermaid(mermaidCode);
  if (!cleaned) return null;

  try {
    const m = await ensureMermaid();

    // Surface parse errors early so we can log them for the user. If parsing
    // fails we still attempt mermaid.render, because some custom diagram
    // types only validate during render.
    try {
      await m.parse(cleaned);
    } catch (parseErr) {
      console.warn(
        "[doc-generator] Mermaid parse failed, attempting render anyway:",
        parseErr,
      );
    }

    const renderId = `dg-render-${Date.now()}-${Math.floor(
      Math.random() * 10_000,
    )}`;
    const { svg } = await m.render(renderId, cleaned);

    // Determine intrinsic SVG size
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement;

    let width = parseInt(svgEl.getAttribute("width") || "0", 10);
    let height = parseInt(svgEl.getAttribute("height") || "0", 10);

    if ((!width || !height) && svgEl.viewBox && svgEl.viewBox.baseVal) {
      width = svgEl.viewBox.baseVal.width;
      height = svgEl.viewBox.baseVal.height;
    }
    if (!width || !height) {
      width = 800;
      height = 480;
    }

    // Force the SVG to carry explicit width/height in case mermaid omitted them
    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));
    // Ensure the SVG declares a namespace, otherwise some browsers refuse
    // to draw it through an <img>.
    if (!svgEl.getAttribute("xmlns")) {
      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    const fixedSvg = new XMLSerializer().serializeToString(svgEl);

    // If mermaid still inserted a <foreignObject> (e.g. for class diagrams)
    // we cannot rasterise it via <img>; bail out gracefully.
    if (/<foreignObject\b/i.test(fixedSvg)) {
      console.warn(
        "[doc-generator] Mermaid SVG contains <foreignObject>; cannot rasterise to PNG.",
      );
      return null;
    }

    const scale = options.scale ?? 2;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const blob = new Blob([fixedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("SVG <img> load failed"));
        i.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const pngBlob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
          "image/png",
        ),
      );
      const buf = new Uint8Array(await pngBlob.arrayBuffer());
      return { data: buf, widthPx: width, heightPx: height };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.warn(
      "[doc-generator] Failed to rasterize Mermaid diagram:",
      err,
      "\n--- source (sanitized) ---\n",
      cleaned,
    );
    return null;
  }
}
