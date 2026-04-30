/**
 * DOCX Export Utility
 *
 * Converts a GeneratedDocument into a professionally formatted .docx file
 * using the `docx` library. Runs client-side in the browser.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  Tab,
  TabStopType,
  TabStopPosition,
  LevelFormat,
  ImageRun,
  convertInchesToTwip,
  type ITableCellOptions,
  type ISectionOptions,
  type FileChild,
} from "docx";
import type { GeneratedDocument, MermaidDiagram } from "@/types/documentation-generator";
import { getDocumentTypeTitle } from "@/types/documentation-generator";

// ============================================================================
// Cover diagram image (rasterized client-side)
// ============================================================================

export interface CoverDiagramImage {
  /** Raw PNG bytes (from canvas.toBlob → arrayBuffer). */
  data: Uint8Array;
  /** Display width in pixels (will be embedded at this size). */
  widthPx: number;
  /** Display height in pixels. */
  heightPx: number;
}

/**
 * Pre-rendered Mermaid diagrams keyed by the *exact* mermaid source
 * (trimmed). Used to replace ```mermaid code blocks in section markdown
 * and the standalone diagrams page with proper PNG images.
 */
export type DiagramImageMap = Map<string, CoverDiagramImage>;

function normaliseMermaid(code: string): string {
  return code.trim().replace(/\r\n/g, "\n");
}

// ============================================================================
// Main Export Function
// ============================================================================

export async function generateDocx(
  generatedDoc: GeneratedDocument,
  options: {
    coverDiagram?: CoverDiagramImage;
    diagramImages?: DiagramImageMap;
  } = {},
): Promise<Blob> {
  const doc = new Document({
    creator: "SAP CPI Connect — Documentation Generator",
    title: generatedDoc.title,
    description: `${getDocumentTypeTitle(generatedDoc.type)} for ${generatedDoc.iflowName}`,
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2)", alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(1.0), hanging: convertInchesToTwip(0.25) } } } },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: "%3.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { after: 120, line: 276 } },
        },
        heading1: {
          run: { font: "Calibri", size: 36, bold: true, color: "1F4E79" },
          paragraph: { spacing: { before: 360, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "2E75B6", space: 4 } } },
        },
        heading2: {
          run: { font: "Calibri", size: 30, bold: true, color: "2E75B6" },
          paragraph: { spacing: { before: 280, after: 160 } },
        },
        heading3: {
          run: { font: "Calibri", size: 26, bold: true, color: "404040" },
          paragraph: { spacing: { before: 200, after: 120 } },
        },
        heading4: {
          run: { font: "Calibri", size: 24, bold: true, color: "595959" },
          paragraph: { spacing: { before: 160, after: 100 } },
        },
      },
    },
    sections: [
      buildCoverPage(generatedDoc),
      ...(options.coverDiagram
        ? [buildArchitecturePage(generatedDoc, options.coverDiagram)]
        : []),
      buildTocSection(generatedDoc),
      buildBodySection(generatedDoc, options.diagramImages),
    ],
  });

  return Packer.toBlob(doc);
}

// ============================================================================
// Cover Page
// ============================================================================

function buildCoverPage(doc: GeneratedDocument): ISectionOptions {
  return {
    properties: {
      page: {
        margin: { top: convertInchesToTwip(1.5), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1.25) },
      },
    },
    children: [
      ...spacerParagraphs(5),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "SAP CPI Integration", size: 28, font: "Calibri", color: "808080" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: doc.title, bold: true, size: 56, font: "Calibri", color: "1F4E79" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: getDocumentTypeTitle(doc.type), size: 32, font: "Calibri", color: "2E75B6" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 300 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6" } },
        children: [],
      }),
      buildMetadataTable(doc),
      ...spacerParagraphs(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Generated by SAP CPI Connect — Documentation Generator", italics: true, size: 20, color: "808080" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [
          new TextRun({
            text: `Generated on ${new Date(doc.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
            italics: true, size: 20, color: "808080",
          }),
        ],
      }),
    ],
  };
}

function buildMetadataTable(doc: GeneratedDocument): Table {
  const rows: [string, string][] = [
    ["iFlow Name", doc.iflowName],
    ["Version", doc.version],
    ["Document Type", getDocumentTypeTitle(doc.type)],
    ["Sections", `${doc.sections.length}`],
    ["Diagrams", `${doc.diagrams.length}`],
    ["Generated", new Date(doc.generatedAt).toLocaleString()],
  ];

  const cellOpts = (shaded: boolean): Partial<ITableCellOptions> => ({
    width: { size: 50, type: WidthType.PERCENTAGE },
    shading: shaded ? { type: ShadingType.SOLID, color: "F2F7FB", fill: "F2F7FB" } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  });

  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 70, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value], i) =>
        new TableRow({
          children: [
            new TableCell({
              ...cellOpts(i % 2 === 0),
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22, color: "1F4E79" })] })],
            }),
            new TableCell({
              ...cellOpts(i % 2 === 0),
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })],
            }),
          ],
        })
    ),
  });
}

// ============================================================================
// Architecture Overview Page (Mermaid PNG embedded via ImageRun)
// ============================================================================

function buildArchitecturePage(
  doc: GeneratedDocument,
  cover: CoverDiagramImage,
): ISectionOptions {
  // Cap to a sensible page width: ~6.0 inches at 96dpi = 576px
  const maxWidth = 576;
  const ratio = cover.widthPx > 0 ? cover.heightPx / cover.widthPx : 0.6;
  const width = Math.min(cover.widthPx, maxWidth);
  const height = Math.max(60, Math.round(width * ratio));

  return {
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1),
          right: convertInchesToTwip(1),
        },
      },
    },
    children: [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Architecture Overview" })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `End-to-end view of the ${doc.iflowName} integration flow.`,
            italics: true,
            size: 22,
            color: "595959",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        children: [
          new ImageRun({
            type: "png",
            data: cover.data,
            transformation: { width, height },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({
            text: "Figure 1 — Integration architecture",
            italics: true,
            size: 18,
            color: "808080",
          }),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };
}

// ============================================================================
// Table of Contents (Manual — renders immediately, no field update needed)
// ============================================================================

function buildTocSection(doc: GeneratedDocument): ISectionOptions {
  const tocEntries: FileChild[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Table of Contents" })],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];

  doc.sections.forEach((section, idx) => {
    tocEntries.push(
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: convertInchesToTwip(0.25) },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: "dot" }],
        children: [
          new TextRun({ text: `${idx + 1}.  `, bold: true, size: 24, color: "1F4E79" }),
          new TextRun({ text: section.title, size: 24, color: "333333" }),
          new TextRun({ children: [new Tab()] }),
        ],
      })
    );
  });

  if (doc.diagrams.length > 0) {
    tocEntries.push(
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: convertInchesToTwip(0.25) },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: "dot" }],
        children: [
          new TextRun({ text: `${doc.sections.length + 1}.  `, bold: true, size: 24, color: "1F4E79" }),
          new TextRun({ text: "Diagrams", size: 24, color: "333333" }),
          new TextRun({ children: [new Tab()] }),
        ],
      })
    );
  }

  tocEntries.push(new Paragraph({ children: [new PageBreak()] }));

  return {
    properties: {
      page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1.25) } },
    },
    children: tocEntries,
  };
}

// ============================================================================
// Body Section — Main Document Content
// ============================================================================

function buildBodySection(
  doc: GeneratedDocument,
  diagramImages?: DiagramImageMap,
): ISectionOptions {
  const children: FileChild[] = [];

  doc.sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: `${sectionIdx + 1}. ${section.title}` })],
      })
    );

    const elements = markdownToDocxElements(section.content, diagramImages);
    children.push(...elements);
  });

  if (doc.diagrams.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: `${doc.sections.length + 1}. Diagrams` })],
      })
    );

    for (const diagram of doc.diagrams) {
      children.push(...renderDiagram(diagram, diagramImages));
    }
  }

  return {
    properties: {
      page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.25), right: convertInchesToTwip(1.25) } },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: doc.title, italics: true, size: 18, color: "808080" })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 18, color: "808080" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" }),
              new TextRun({ text: " of ", size: 18, color: "808080" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "808080" }),
            ],
          }),
        ],
      }),
    },
    children,
  };
}

// ============================================================================
// Markdown → DOCX Elements (returns Paragraph | Table mixed)
// ============================================================================

function markdownToDocxElements(
  markdown: string,
  diagramImages?: DiagramImageMap,
): FileChild[] {
  const elements: FileChild[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    // Code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;

      // Mermaid: try to embed a rasterized PNG instead of code text
      if (lang.toLowerCase() === "mermaid") {
        const code = codeLines.join("\n");
        const img = diagramImages?.get(normaliseMermaid(code));
        if (img) {
          elements.push(...buildEmbeddedDiagram(img));
          continue;
        }
        // Fall back to text rendering when no image is available.
      }

      if (lang) {
        elements.push(
          new Paragraph({
            spacing: { before: 160, after: 0 },
            shading: { type: ShadingType.SOLID, color: "E8EDF3", fill: "E8EDF3" },
            children: [new TextRun({ text: `  ${lang.toUpperCase()}`, bold: true, font: "Consolas", size: 16, color: "2E75B6" })],
          })
        );
      }

      for (const codeLine of codeLines) {
        elements.push(
          new Paragraph({
            shading: { type: ShadingType.SOLID, color: "F5F5F5", fill: "F5F5F5" },
            spacing: { before: 0, after: 0 },
            indent: { left: 200 },
            children: [new TextRun({ text: codeLine || " ", font: "Consolas", size: 17, color: "333333" })],
          })
        );
      }
      elements.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].replace(/[*_`]/g, "");
      const heading = level === 1 ? HeadingLevel.HEADING_2 : level === 2 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4;
      elements.push(new Paragraph({ heading, children: [new TextRun({ text })] }));
      i++;
      continue;
    }

    // Markdown table → real DOCX Table
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const table = buildDocxTable(tableLines);
      if (table) {
        elements.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
        elements.push(table);
        elements.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      }
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (ulMatch) {
      const indent = Math.floor((ulMatch[1].length || 0) / 2);
      elements.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.25) + indent * convertInchesToTwip(0.25) },
          bullet: { level: indent },
          children: parseInlineFormatting(ulMatch[2]),
        })
      );
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      const indent = Math.floor((olMatch[1].length || 0) / 2);
      elements.push(
        new Paragraph({
          numbering: { reference: "ordered-list", level: indent },
          children: parseInlineFormatting(olMatch[2]),
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      elements.push(
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "CCCCCC" } },
          children: [],
        })
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      const text = line.replace(/^>\s*/, "");
      elements.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.4) },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "2E75B6" } },
          spacing: { before: 80, after: 80 },
          children: [new TextRun({ text, italics: true, color: "555555", size: 22 })],
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      new Paragraph({ spacing: { after: 120 }, children: parseInlineFormatting(line) })
    );
    i++;
  }

  return elements;
}

// ============================================================================
// Markdown Table → DOCX Table (proper Table object with styled header)
// ============================================================================

function buildDocxTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;

  const rows: string[][] = [];
  let headerRowIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      headerRowIdx = rows.length - 1;
      continue;
    }
    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }

  if (rows.length === 0) return null;

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidth = Math.floor(100 / colCount);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIdx) => {
      const isHeader = rowIdx <= headerRowIdx || (headerRowIdx === -1 && rowIdx === 0);
      return new TableRow({
        tableHeader: isHeader,
        children: Array.from({ length: colCount }, (_, colIdx) => {
          const cellText = row[colIdx] || "";
          return new TableCell({
            width: { size: colWidth, type: WidthType.PERCENTAGE },
            shading: isHeader
              ? { type: ShadingType.SOLID, color: "1F4E79", fill: "1F4E79" }
              : rowIdx % 2 === 0
                ? { type: ShadingType.SOLID, color: "F2F7FB", fill: "F2F7FB" }
                : undefined,
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: isHeader
                  ? [new TextRun({ text: cellText.replace(/[*`]/g, ""), bold: true, size: 20, color: "FFFFFF", font: "Calibri" })]
                  : parseInlineFormatting(cellText),
              }),
            ],
          });
        }),
      });
    }),
  });
}

// ============================================================================
// Inline Formatting  (**bold**, *italic*, `code`, etc.)
// ============================================================================

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 22 }));
    }
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, size: 22 }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true, size: 22 }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true, size: 22 }));
    } else if (match[5]) {
      runs.push(new TextRun({
        text: match[5], font: "Consolas", size: 20, color: "C7254E",
        shading: { type: ShadingType.SOLID, color: "F9F2F4", fill: "F9F2F4" },
      }));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 22 }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 22 }));
  }
  return runs;
}

// ============================================================================
// Diagram Rendering
// ============================================================================

function renderDiagram(
  diagram: MermaidDiagram,
  diagramImages?: DiagramImageMap,
): FileChild[] {
  const elements: FileChild[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: diagram.title })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `Diagram Type: ${diagram.type}`, italics: true, color: "808080", size: 20 })],
    }),
  ];

  // Prefer an embedded PNG when available
  const img = diagramImages?.get(normaliseMermaid(diagram.mermaidCode));
  if (img) {
    elements.push(...buildEmbeddedDiagram(img));
    elements.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
    return elements;
  }

  elements.push(
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: "E8EDF3", fill: "E8EDF3" },
      border: { left: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6" } },
      spacing: { before: 100, after: 60 },
      children: [new TextRun({ text: "  Mermaid Diagram — paste into mermaid.live or any Mermaid-compatible renderer", bold: true, size: 18, color: "2E75B6" })],
    }),
  );

  for (const line of diagram.mermaidCode.split("\n")) {
    elements.push(
      new Paragraph({
        shading: { type: ShadingType.SOLID, color: "F8F8F8", fill: "F8F8F8" },
        spacing: { before: 0, after: 0 },
        indent: { left: 240 },
        children: [new TextRun({ text: line || " ", font: "Consolas", size: 18, color: "333333" })],
      })
    );
  }

  elements.push(new Paragraph({ spacing: { after: 240 }, children: [] }));
  return elements;
}

// Shared helper: embed a rasterized Mermaid diagram image, scaled to fit
// the page text width (~6 inches at standard margins).
function buildEmbeddedDiagram(img: CoverDiagramImage): FileChild[] {
  const maxWidthPx = 576; // ~6in @ 96dpi
  const aspect = img.heightPx > 0 && img.widthPx > 0
    ? img.heightPx / img.widthPx
    : 0.6;
  const width = Math.min(img.widthPx || maxWidthPx, maxWidthPx);
  const height = Math.round(width * aspect);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [
        new ImageRun({
          type: "png",
          data: img.data,
          transformation: { width, height },
        }),
      ],
    }),
  ];
}

// ============================================================================
// Utilities
// ============================================================================

function spacerParagraphs(count: number): Paragraph[] {
  return Array.from({ length: count }, () => new Paragraph({ text: "", spacing: { after: 200 } }));
}
