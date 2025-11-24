import { Suspense } from "react";
import ResetPasswordAuth from "@/components/auth/reset-password";
import SignInSkeleton from "@/components/auth/sign-in-skeleton";

export default function ResetPassword() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <ResetPasswordAuth />
    </Suspense>
  );
}
