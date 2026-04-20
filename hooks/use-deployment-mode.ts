"use client";

import { getDeploymentMode, type DeploymentMode } from "@/lib/deployment";

export function useDeploymentMode() {
  const mode: DeploymentMode = getDeploymentMode();

  return {
    mode,
    isCloud: mode === "cloud",
    isSelfHosted: mode === "self-hosted",
  };
}
