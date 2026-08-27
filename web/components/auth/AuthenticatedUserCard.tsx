"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type UserIdentity = {
  displayName: string;
  email: string;
  initials: string;
};

const fallbackIdentity: UserIdentity = {
  displayName: "Vallective user",
  email: "",
  initials: "VA",
};

function getInitials(displayName: string) {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallbackIdentity.initials;
  }

  const firstInitial = parts[0]?.[0] ?? "";
  const lastInitial = parts.length > 1 ? parts.at(-1)?.[0] ?? "" : "";

  return `${firstInitial}${lastInitial}`.toLocaleUpperCase("da-DK");
}

export function useCurrentUserIdentity(enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const [identity, setIdentity] = useState<UserIdentity>(fallbackIdentity);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;

    async function loadIdentity() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive || !user) {
        return;
      }

      const metadataName = user.user_metadata?.display_name;
      const displayName =
        typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : user.email?.trim() || fallbackIdentity.displayName;

      setIdentity({
        displayName,
        email: user.email?.trim() ?? "",
        initials: getInitials(displayName),
      });
    }

    void loadIdentity();

    return () => {
      isActive = false;
    };
  }, [enabled, supabase]);

  return identity;
}

type AuthenticatedUserCardProps = {
  identity?: UserIdentity;
  onLogout?: () => void | Promise<void>;
};

export default function AuthenticatedUserCard({
  identity: suppliedIdentity,
  onLogout,
}: AuthenticatedUserCardProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const loadedIdentity = useCurrentUserIdentity(!suppliedIdentity);
  const identity = suppliedIdentity ?? loadedIdentity;

  async function handleLogout() {
    if (onLogout) {
      await onLogout();
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="authenticated-user-card">
      <div className="authenticated-user-avatar" aria-hidden="true">
        {identity.initials}
      </div>

      <div className="authenticated-user-information">
        <p title={identity.displayName}>{identity.displayName}</p>
        <span>Collector</span>
      </div>

      <button
        className="authenticated-user-logout"
        type="button"
        onClick={() => {
          void handleLogout();
        }}
        title="Log ud"
        aria-label="Log ud"
      >
        ↗
      </button>

      <style jsx>{`
        .authenticated-user-card {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.024);
        }

        .authenticated-user-avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          background: #171b28;
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
        }

        .authenticated-user-information {
          min-width: 0;
          flex: 1;
        }

        .authenticated-user-information p {
          overflow: hidden;
          margin: 0;
          color: #ffffff;
          font-size: 12px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .authenticated-user-information span {
          display: block;
          margin-top: 5px;
          color: #697184;
          font-size: 10px;
        }

        .authenticated-user-logout {
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #6f7789;
          cursor: pointer;
        }

        .authenticated-user-logout:hover,
        .authenticated-user-logout:focus-visible {
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
        }

        .authenticated-user-logout:focus-visible {
          outline: 2px solid rgba(167, 139, 250, 0.72);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
