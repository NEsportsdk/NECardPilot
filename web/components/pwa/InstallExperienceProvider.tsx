"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getInstallEnvironment,
  type InstallEnvironment,
} from "@/lib/pwa/installExperience";

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallExperienceValue = {
  canPrompt: boolean;
  environment: InstallEnvironment;
  install: () => Promise<InstallOutcome>;
  ready: boolean;
};

const InstallExperienceContext = createContext<
  InstallExperienceValue | undefined
>(undefined);

function readEnvironment() {
  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean;
  };

  return getInstallEnvironment({
    displayModeStandalone: window.matchMedia("(display-mode: standalone)")
      .matches,
    maxTouchPoints: navigator.maxTouchPoints,
    navigatorStandalone: standaloneNavigator.standalone,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
}

export function InstallExperienceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [environment, setEnvironment] =
    useState<InstallEnvironment>("browser");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    }

    function refreshEnvironment() {
      setEnvironment(readEnvironment());
      setReady(true);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      refreshEnvironment();
    }

    function handleInstalled() {
      setDeferredPrompt(null);
      setEnvironment("installed");
      setReady(true);
    }

    refreshEnvironment();
    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener
    );
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener("change", refreshEnvironment);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener
      );
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener("change", refreshEnvironment);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) {
      return "unavailable";
    }

    try {
      const result = await deferredPrompt.prompt();
      setDeferredPrompt(null);

      if (result.outcome === "accepted") {
        setEnvironment("installed");
      }

      return result.outcome;
    } catch {
      setDeferredPrompt(null);
      return "unavailable";
    }
  }, [deferredPrompt]);

  const value = useMemo(
    () => ({
      canPrompt: Boolean(deferredPrompt) && environment !== "installed",
      environment,
      install,
      ready,
    }),
    [deferredPrompt, environment, install, ready]
  );

  return (
    <InstallExperienceContext.Provider value={value}>
      {children}
    </InstallExperienceContext.Provider>
  );
}

export function useInstallExperience() {
  const context = useContext(InstallExperienceContext);

  if (!context) {
    throw new Error(
      "useInstallExperience must be used inside InstallExperienceProvider."
    );
  }

  return context;
}
