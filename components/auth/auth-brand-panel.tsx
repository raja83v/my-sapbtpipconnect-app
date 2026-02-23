"use client";

import { Cloud } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  title: string;
}

interface AuthBrandPanelProps {
  testimonial?: Testimonial;
}

const defaultTestimonial: Testimonial = {
  quote:
    "CPI Connect transformed our integration monitoring. We now identify and resolve issues in minutes instead of hours.",
  author: "Michael Torres",
  title: "Integration Lead, Global Manufacturing Corp",
};

export function AuthBrandPanel({
  testimonial = defaultTestimonial,
}: AuthBrandPanelProps) {
  return (
    <div className="relative hidden h-full flex-col bg-zinc-900 p-10 text-white dark:border-r lg:flex">
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.15) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Logo */}
      <div className="relative z-20 flex items-center gap-2 text-lg font-medium">
        <Cloud className="h-6 w-6 text-indigo-400" strokeWidth={1.5} />
        <span className="bg-linear-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent font-bold">
          CPI Connect
        </span>
      </div>

      {/* Testimonial */}
      <div className="relative z-20 mt-auto">
        <blockquote className="space-y-2">
          <p className="text-lg">&ldquo;{testimonial.quote}&rdquo;</p>
          <footer className="text-sm text-zinc-400">
            {testimonial.author} &mdash; {testimonial.title}
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
