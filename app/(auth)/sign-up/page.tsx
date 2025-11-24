import { Suspense } from "react";
import SignUpAuth from "@/components/auth/sign-up";
import SignUpSkeleton from "@/components/auth/sign-up-skeleton";

export default function SignUp() {
  return (
    <Suspense fallback={<SignUpSkeleton />}>
      <SignUpAuth />
    </Suspense>
  );
}
