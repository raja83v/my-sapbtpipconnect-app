import { notFound, redirect } from "next/navigation";
import { BLOG_CATEGORIES } from "@/lib/blog/content";
import { Metadata } from "next";
import { constructMetadata } from "@/lib/constructMetadata";

export async function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({
    slug: category.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const category = BLOG_CATEGORIES.find((category) => category.slug === slug);
  if (!category) {
    return;
  }

  const { title, description } = category;

  return constructMetadata({
    title: `${title} – HagenKit Blog`,
    description:
      description ||
      "Explore curated stories, walkthroughs, and best practices from the HagenKit blog.",
    image: `/api/og/help?title=${encodeURIComponent(
      title
    )}&summary=${encodeURIComponent(description)}`,
  });
}

export default async function BlogCategory({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;
  const data = BLOG_CATEGORIES.find((category) => category.slug === slug);
  if (!data) {
    notFound();
  }

  // Redirect to main blog page - filtering is now handled client-side
  // This maintains SEO/metadata while using the main blog page's filtering UI
  redirect(`/blog?category=${slug}`);
}
