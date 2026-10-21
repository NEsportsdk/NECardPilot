"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  activateWorkspace,
  listAccessibleWorkspaces,
} from "@/lib/workspaces/workspace.client";
import type { Workspace } from "@/lib/workspaces/workspace";

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const nextWorkspaces = await listAccessibleWorkspaces(supabase);

        if (!cancelled) {
          setWorkspaces(nextWorkspaces);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Workspaces could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const activeWorkspace = workspaces.find((workspace) => workspace.isActive);

  async function handleChange(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspace?.id || switching) {
      return;
    }

    setSwitching(true);
    setMessage("");

    try {
      await activateWorkspace(supabase, workspaceId);
      router.refresh();
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Workspace could not be activated."
      );
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="workspace-switcher workspace-switcher-loading">
        <span className="workspace-dot" aria-hidden="true" />
        <span>Loading workspace…</span>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!activeWorkspace) {
    return message ? (
      <p className="workspace-error" role="status">
        {message}
        <style jsx>{styles}</style>
      </p>
    ) : null;
  }

  return (
    <div className="workspace-switcher">
      <label htmlFor="active-workspace">
        <span className="workspace-label">Active workspace</span>
        <span className="workspace-select-shell">
          <span
            className={`workspace-dot workspace-dot-${activeWorkspace.kind}`}
            aria-hidden="true"
          />
          <select
            aria-describedby={message ? "workspace-switcher-message" : undefined}
            disabled={switching || workspaces.length < 2}
            id="active-workspace"
            onChange={(event) => void handleChange(event.target.value)}
            value={activeWorkspace.id}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
                {workspace.kind === "business" ? " · Business" : " · Personal"}
              </option>
            ))}
          </select>
        </span>
      </label>

      <p className="workspace-role">
        {switching
          ? "Switching…"
          : activeWorkspace.role === "owner"
            ? "Owner access"
            : `${activeWorkspace.role.replaceAll("_", " ")} access`}
      </p>

      {message ? (
        <p className="workspace-error" id="workspace-switcher-message" role="status">
          {message}
        </p>
      ) : null}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .workspace-switcher {
    margin: 24px 9px 0;
    padding: 12px;
    border: 1px solid rgba(148, 163, 184, 0.14);
    border-radius: 15px;
    background: rgba(17, 21, 30, 0.82);
  }

  .workspace-switcher-loading {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #8b94a7;
    font-size: 11px;
  }

  .workspace-label {
    display: block;
    margin-bottom: 7px;
    color: #697386;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .workspace-select-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }

  select {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #f4f6fb;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  select:disabled {
    cursor: default;
    opacity: 0.85;
  }

  option {
    background: #11151e;
    color: #f4f6fb;
  }

  .workspace-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #7867ff;
    box-shadow: 0 0 0 4px rgba(120, 103, 255, 0.12);
  }

  .workspace-dot-business {
    background: #a793ff;
  }

  .workspace-dot-personal {
    background: #74e0bd;
    box-shadow: 0 0 0 4px rgba(116, 224, 189, 0.1);
  }

  .workspace-role,
  .workspace-error {
    margin: 8px 0 0;
    font-size: 10px;
    line-height: 1.45;
  }

  .workspace-role {
    color: #697386;
  }

  .workspace-error {
    color: #f5a3aa;
  }
`;
