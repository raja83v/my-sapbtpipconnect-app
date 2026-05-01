"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/marketing/container";
import { cn } from "@/lib/utils";

type Slide = {
  title: string;
  description: string;
  src: string;
  alt: string;
};

const SLIDES: Slide[] = [
  {
    title: "Dashboard",
    description:
      "Your single pane of glass — tenant health, recent failures, and key SLAs across every connected SAP CPI environment.",
    src: "/screenshots/dashboard.png",
    alt: "CPI Connect dashboard overview",
  },
  {
    title: "iFlows",
    description:
      "Browse, search, and inspect every iFlow across tenants. Drill in for execution history, payloads, and AI-assisted root-cause analysis.",
    src: "/screenshots/iflows.png",
    alt: "iFlow management view",
  },
  {
    title: "APIs",
    description:
      "Visualize traffic, latency, and consumer adoption across every published API on SAP API Management.",
    src: "/screenshots/apis.png",
    alt: "APIs dashboard",
  },
  {
    title: "Message Logs",
    description:
      "Search, filter, and replay APIM and CPI message traces from a single timeline — with full payload visibility.",
    src: "/screenshots/message-logs.png",
    alt: "Unified message logs",
  },
  {
    title: "Analytics",
    description:
      "Trends, success rates, and throughput across iFlows and APIs — exportable for executive reporting.",
    src: "/screenshots/analytics.png",
    alt: "Analytics dashboard",
  },
  {
    title: "AI Agents",
    description:
      "Let purpose-built agents debug failures, draft new iFlows, and document existing ones — grounded in your real data.",
    src: "/screenshots/ai-agents.png",
    alt: "AI Agents workspace",
  },
];

export function ProductTour() {
  const [index, setIndex] = React.useState(0);
  const total = SLIDES.length;
  const active = SLIDES[index];

  const go = React.useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  );

  // Keyboard navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  return (
    <section
      id="product-tour"
      className="border-t bg-muted/30 py-16 sm:py-20"
      aria-labelledby="product-tour-heading"
    >
      <Container>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge className="mb-4" variant="outline">
            Product Tour
          </Badge>
          <h2
            id="product-tour-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            See CPI Connect in action
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A quick visual walkthrough of every workspace — dashboard, iFlows,
            APIs, message logs, analytics, and AI agents.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-xl border bg-background shadow-2xl ring-1 ring-black/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
              <span className="size-3 rounded-full bg-red-400/70" aria-hidden />
              <span className="size-3 rounded-full bg-yellow-400/70" aria-hidden />
              <span className="size-3 rounded-full bg-green-400/70" aria-hidden />
              <span className="ml-3 truncate text-xs text-muted-foreground">
                cpi-connect.app{active.src.replace("/screenshots", "").replace(".png", "")}
              </span>
            </div>

            <div className="relative aspect-1440/900 w-full bg-background">
              {SLIDES.map((slide, i) => (
                <Image
                  key={slide.src}
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className={cn(
                    "object-cover object-top transition-opacity duration-500",
                    i === index ? "opacity-100" : "opacity-0",
                  )}
                  priority={i === 0}
                />
              ))}
            </div>

            {/* Prev / next */}
            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 sm:px-4">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Previous screenshot"
                onClick={() => go(index - 1)}
                className="pointer-events-auto h-10 w-10 rounded-full shadow-md"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Next screenshot"
                onClick={() => go(index + 1)}
                className="pointer-events-auto h-10 w-10 rounded-full shadow-md"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Caption */}
          <div className="mt-6 text-center" aria-live="polite">
            <h3 className="text-xl font-semibold">{active.title}</h3>
            <p className="mt-2 text-balance text-muted-foreground">
              {active.description}
            </p>
          </div>

          {/* Thumbnail strip */}
          <div
            className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6"
            role="tablist"
            aria-label="Product tour slides"
          >
            {SLIDES.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${slide.title}`}
                onClick={() => go(i)}
                className={cn(
                  "group relative overflow-hidden rounded-md border bg-background ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  i === index
                    ? "border-indigo-500 ring-2 ring-indigo-500/40"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <span className="sr-only">{slide.title}</span>
                <span className="relative block aspect-1440/900 w-full">
                  <Image
                    src={slide.src}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover object-top"
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-medium text-white",
                  )}
                >
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
