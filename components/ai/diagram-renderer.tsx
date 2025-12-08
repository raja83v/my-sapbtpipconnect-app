"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Maximize2 } from "lucide-react";

interface DiagramRendererProps {
  code: string;
  type?: "mermaid" | "ascii";
}

export function DiagramRenderer({ code, type = "mermaid" }: DiagramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (type === "mermaid" && containerRef.current) {
      renderMermaid();
    }
  }, [code, type]);

  const renderMermaid = async () => {
    try {
      // Dynamically import mermaid
      const mermaid = (await import("mermaid")).default;
      
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#6366f1",
          primaryTextColor: "#fff",
          primaryBorderColor: "#818cf8",
          lineColor: "#94a3b8",
          secondaryColor: "#4f46e5",
          tertiaryColor: "#312e81",
          background: "#1e293b",
          mainBkg: "#1e293b",
          secondBkg: "#334155",
          tertiaryBkg: "#475569",
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: "basis",
        },
      });

      if (containerRef.current) {
        // Clear previous content
        containerRef.current.innerHTML = "";
        
        // Generate unique ID
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Render diagram
        const { svg } = await mermaid.render(id, code);
        containerRef.current.innerHTML = svg;
        
        // Ensure SVG scales properly within container
        const svgElement = containerRef.current.querySelector("svg");
        if (svgElement) {
          svgElement.style.maxWidth = "100%";
          svgElement.style.height = "auto";
          svgElement.removeAttribute("width");
        }
        
        setError(null);
      }
    } catch (err) {
      console.error("Mermaid rendering error:", err);
      setError(err instanceof Error ? err.message : "Failed to render diagram");
    }
  };

  const handleDownload = () => {
    if (!containerRef.current) return;

    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (type === "ascii") {
    return (
      <Card className="p-4 bg-zinc-900 overflow-x-auto">
        <pre className="text-xs text-zinc-100 whitespace-pre font-mono">
          {code}
        </pre>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-red-950/20 border-red-500/50">
        <p className="text-sm text-red-400">Failed to render diagram: {error}</p>
        <details className="mt-2">
          <summary className="text-xs text-red-300 cursor-pointer">Show diagram code</summary>
          <pre className="mt-2 text-xs text-zinc-400 overflow-x-auto">{code}</pre>
        </details>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden max-w-full">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDownload}
          className="h-8 px-2"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 px-2"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={containerRef}
        className={`p-6 bg-zinc-900 overflow-auto ${
          isFullscreen ? "fixed inset-0 z-50" : "w-full"
        }`}
        style={{ 
          minHeight: isFullscreen ? "100vh" : "300px", 
          maxHeight: isFullscreen ? "100vh" : "600px",
          maxWidth: "100%"
        }}
      />
    </Card>
  );
}
