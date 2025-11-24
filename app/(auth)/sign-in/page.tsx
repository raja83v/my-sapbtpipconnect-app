import { Suspense } from "react";
import SignInAuth from "@/components/auth/sign-in";
import SignInSkeleton from "@/components/auth/sign-in-skeleton";

export default function SignIn() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInAuth />
    </Suspense>
  );
}
