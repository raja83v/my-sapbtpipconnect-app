import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUp() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
