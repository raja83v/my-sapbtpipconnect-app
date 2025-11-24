import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatDate } from "@/lib/utils";

import { authors } from "./author";

interface BlogPost {
  title: string;
  summary: string;
  publishedAt: string;
  image: string;
  author: string;
  slug: string;
  readingTime?: number;
  mdx?: string;
  related?: string[];
  tableOfContents?: { title: string; slug: string }[];
  images?: string[];
  tweetIds?: string[];
  githubRepos?: string[];
  categories?: string[];
  _meta?: Record<string, unknown>;
}

export default function BlogCard({
  data,
  priority,
}: {
  data: BlogPost & {
    blurDataURL: string;
  };
  priority?: boolean;
}) {
  return (
    <div className="group relative">
      <article className="group relative space-y-6 rounded-xl">
        <div className="bg-card/75 ring-border-illustration hover:bg-card/50 rounded-xl border border-transparent p-0.5 shadow-md ring-1">
          <div className="before:border-border-illustration relative aspect-video overflow-hidden rounded-[10px] before:absolute before:inset-0 before:rounded-[10px] before:border">
            <Image
              src={data.image}
              alt={data.title}
              width={1200}
              height={630}
              className="h-full w-full object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              placeholder="blur"
              blurDataURL={data.blurDataURL}
            />
          </div>
        </div>

        <div className="grid gap-3 p-0.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <time dateTime={data.publishedAt}>
              {formatDate(data.publishedAt)}
            </time>
            {data.readingTime && (
              <>
                <span>•</span>
                <span>{data.readingTime} min read</span>
              </>
            )}
          </div>
          <h2 className="text-foreground text-balance text-lg font-semibold md:text-xl">
            <Link
              href={`/blog/${data.slug}`}
              className="before:absolute before:inset-0">
              {data.title}
            </Link>
          </h2>
          <p className="text-muted-foreground">{data.summary}</p>

          <div className="grid grid-cols-[1fr_auto] items-end gap-2 pt-4">
            <div className="space-y-2">
              {authors[data.author] && (
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <div className="ring-border-illustration bg-card aspect-square size-6 overflow-hidden rounded-md border border-transparent shadow-md shadow-black/15 ring-1">
                    <img
                      src={authors[data.author].image}
                      alt={authors[data.author].name}
                      width={460}
                      height={460}
                      className="size-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className="text-muted-foreground line-clamp-1 text-sm">
                    {authors[data.author].name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-6 items-center">
              <span
                aria-label={`Read ${data.title}`}
                className="text-primary group-hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors duration-200">
                Read
                <ChevronRight
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="size-3.5 translate-y-px duration-200 group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
