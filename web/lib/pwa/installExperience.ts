export type InstallEnvironment = "browser" | "installed" | "ios";

type InstallEnvironmentInput = {
  displayModeStandalone: boolean;
  maxTouchPoints?: number;
  navigatorStandalone?: boolean;
  platform?: string;
  userAgent?: string;
};

export function isIosDevice({
  maxTouchPoints = 0,
  platform = "",
  userAgent = "",
}: Pick<
  InstallEnvironmentInput,
  "maxTouchPoints" | "platform" | "userAgent"
>) {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function getInstallEnvironment({
  displayModeStandalone,
  maxTouchPoints,
  navigatorStandalone,
  platform,
  userAgent,
}: InstallEnvironmentInput): InstallEnvironment {
  if (displayModeStandalone || navigatorStandalone) {
    return "installed";
  }

  if (isIosDevice({ maxTouchPoints, platform, userAgent })) {
    return "ios";
  }

  return "browser";
}
