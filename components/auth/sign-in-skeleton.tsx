import { Skeleton } from "@/components/ui/skeleton";
import { IconInnerShadowTop } from "@tabler/icons-react";

export default function SignInSkeleton() {
  return (
    <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Sign Up button skeleton */}
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Left panel - static content */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <IconInnerShadowTop className="mr-2 h-6 w-6" />
          HagenKit
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;HagenKit gave us launch-ready auth, billing, and UI in a
              single weekend. Our team shipped features instead of scaffolding
              infrastructure.&rdquo;
            </p>
            <footer className="text-sm">
              — Sarah Mitchell, Principal Product Designer
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right panel - form skeleton */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          {/* Header skeleton */}
          <div className="flex flex-col space-y-2 text-center">
            <Skeleton className="mx-auto h-8 w-3/4" />
            <Skeleton className="mx-auto h-4 w-2/3" />
          </div>

          {/* Form skeleton */}
          <div className="grid gap-6">
            <div className="grid gap-4">
              {/* Email field */}
              <div className="grid gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>

              {/* Password field */}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="ml-auto h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>

              {/* Remember me */}
              <div className="flex items-center space-x-2">
                <Skeleton className="size-4" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Sign in button */}
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google button */}
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Terms skeleton */}
          <Skeleton className="mx-auto h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
