export type DeploymentMode = "cloud" | "self-hosted";

/**
 * Returns the current deployment mode.
 * Reads from NEXT_PUBLIC_DEPLOYMENT_MODE env var, defaults to "self-hosted".
 * Works on both client and server.
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;
  if (mode === "cloud") return "cloud";
  return "self-hosted";
}

export function isCloudMode(): boolean {
  return getDeploymentMode() === "cloud";
}

export function isSelfHostedMode(): boolean {
  return getDeploymentMode() === "self-hosted";
}
