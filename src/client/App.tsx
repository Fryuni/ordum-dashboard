/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
import { useStore } from "@nanostores/preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { $router } from "./stores/router";
import DashboardPage from "./pages/DashboardPage";
import SettlementPage from "./pages/SettlementPage";
import CraftPage from "./pages/CraftPage";
import TravelerTaskPage from "./pages/TravelerTaskPage";
import ConstructionPage from "./pages/ConstructionPage";
import StorageAuditPage from "./pages/StorageAuditPage";
import InventorySearchPage from "./pages/InventorySearchPage";
import BountyBoardPage from "./pages/BountyBoardPage";
import ManageEmpireGoalsPage from "./pages/ManageEmpireGoalsPage";
import ManageClaimGoalsPage from "./pages/ManageClaimGoalsPage";
import UserManagementPage from "./pages/UserManagementPage";

// ─── Sign-In Page ──────────────────────────────────────────────────────────

// Email/password sign-in is only available in development; production users
// all sign in via Discord so they can be linked to a Discord identity.
const EMAIL_SIGN_IN_ENABLED = (import.meta as any).env?.DEV === true;

function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    signIn("password", formData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div class="sign-in-page">
      <div class="sign-in-card">
        <div class="sign-in-brand">ORDUM</div>
        <p class="sign-in-subtitle">Empire Management Dashboard</p>

        {EMAIL_SIGN_IN_ENABLED && (
          <>
            <form onSubmit={handleSubmit}>
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                class="sign-in-input"
              />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
                class="sign-in-input"
              />
              <input name="flow" type="hidden" value={flow} />
              <button
                type="submit"
                class="sign-in-btn primary"
                disabled={loading}
              >
                {loading
                  ? "..."
                  : flow === "signIn"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </form>

            {error && <p class="sign-in-error">{error}</p>}

            <button
              type="button"
              class="sign-in-toggle"
              onClick={() => {
                setFlow((f) => (f === "signIn" ? "signUp" : "signIn"));
                setError(null);
              }}
            >
              {flow === "signIn"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>

            <div class="sign-in-divider">
              <span>or</span>
            </div>
          </>
        )}

        <button
          type="button"
          class="sign-in-btn discord"
          onClick={() => void signIn("discord")}
        >
          <svg
            viewBox="0 -28.5 256 256"
            width="18"
            height="18"
            fill="currentColor"
          >
            <path d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193a161.094 161.094 0 0 0 13.882-22.584 136.426 136.426 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.862 22.563 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z" />
          </svg>
          Sign in with Discord
        </button>
      </div>
    </div>
  );
}

// ─── RequireAuth page wrapper ──────────────────────────────────────────────
// Wrap any page component with this to redirect unauthenticated users to
// the sign-in page.

export function RequireAuth({ children }: { children: ComponentChildren }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div class="page-header">
        <p class="subtitle">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignInPage />;
  }

  return <>{children}</>;
}

// ─── Profile Icon (top-right) ──────────────────────────────────────────────

function ProfileIcon() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = isAuthenticated ? useQuery(api.auth.currentUser) : null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <a href="/sign-in" class="profile-icon" title="Sign in">
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" />
        </svg>
      </a>
    );
  }

  const name = user?.name ?? user?.email ?? "User";
  const initial = (name[0] ?? "U").toUpperCase();

  return (
    <div class="profile-wrapper" ref={ref}>
      <button
        class="profile-icon authenticated"
        onClick={() => setOpen((o) => !o)}
        title={name}
      >
        <span class="profile-initial">{initial}</span>
      </button>
      {open && (
        <div class="profile-dropdown">
          <div class="profile-dropdown-header">{name}</div>
          <button
            class="profile-dropdown-item"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page routing ──────────────────────────────────────────────────────────

type RouteName =
  | "dashboard"
  | "settlement"
  | "construction"
  | "craft"
  | "travelerTask"
  | "storageAudit"
  | "inventorySearch"
  | "bountyBoard"
  | "manageEmpireGoals"
  | "manageClaimGoals"
  | "manageUsers"
  | "signIn";

function PageContent({ route }: { route: RouteName | null }) {
  switch (route) {
    case "dashboard":
      return <DashboardPage />;
    case "settlement":
      return <SettlementPage />;
    case "construction":
      return <ConstructionPage />;
    case "craft":
      return <CraftPage />;
    case "travelerTask":
      return <TravelerTaskPage />;
    case "storageAudit":
      return <StorageAuditPage />;
    case "inventorySearch":
      return <InventorySearchPage />;
    case "bountyBoard":
      return <BountyBoardPage />;
    case "manageEmpireGoals":
      return <ManageEmpireGoalsPage />;
    case "manageClaimGoals":
      return <ManageClaimGoalsPage />;
    case "manageUsers":
      return <UserManagementPage />;
    case "signIn":
      return <SignInPage />;
    default:
      return (
        <div class="page-header">
          <h1>404 — Page Not Found</h1>
          <p class="subtitle">
            <a href="/">← Back to Dashboard</a>
          </p>
        </div>
      );
  }
}

const NAV_ITEMS = [
  { route: "dashboard" as const, href: "/", icon: "📊", label: "Dashboard" },
  {
    route: "settlement" as const,
    href: "/settlement",
    icon: "🏰",
    label: "Settlement",
  },
  {
    route: "construction" as const,
    href: "/construction",
    icon: "🏗️",
    label: "Construction",
  },
  {
    route: "craft" as const,
    href: "/craft",
    icon: "⚒️",
    label: "Craft Planner",
  },
  {
    route: "travelerTask" as const,
    href: "/traveler-task",
    icon: "🧳",
    label: "Traveler Tasks",
  },
  {
    route: "bountyBoard" as const,
    href: "/bounty-board",
    icon: "📜",
    label: "Bounty Board",
  },
  {
    route: "storageAudit" as const,
    href: "/storage-audit",
    icon: "🔍",
    label: "Storage Audit",
  },
  {
    route: "inventorySearch" as const,
    href: "/inventory-search",
    icon: "📋",
    label: "Inventory Search",
  },
];

// ─── App ───────────────────────────────────────────────────────────────────

function ManagementNav({ currentRoute }: { currentRoute: string | null }) {
  const { isAuthenticated } = useConvexAuth();
  const permissions = isAuthenticated
    ? useQuery(api.bountyBoard.getUserPermissions, {})
    : null;

  if (!permissions) return null;

  const items: Array<{
    route: string;
    href: string;
    icon: string;
    label: string;
  }> = [];

  if (permissions.isCapitalOfficer) {
    items.push({
      route: "manageEmpireGoals",
      href: "/manage/empire-goals",
      icon: "🎯",
      label: "Empire Goals",
    });
  }

  if (permissions.officerClaims.length > 0) {
    items.push({
      route: "manageClaimGoals",
      href: "/manage/claim-goals",
      icon: "🎯",
      label: "Claim Goals",
    });
  }

  if (permissions.isAdmin) {
    items.push({
      route: "manageUsers",
      href: "/manage/users",
      icon: "👥",
      label: "User Management",
    });
  }

  if (items.length === 0) return null;

  return (
    <div class="nav-section">
      <div class="nav-section-label">Management</div>
      {items.map((item) => (
        <a
          key={item.route}
          href={item.href}
          class={currentRoute === item.route ? "active" : ""}
        >
          <span class="icon">{item.icon}</span>
          {item.label}
        </a>
      ))}
    </div>
  );
}

export default function App() {
  const page = useStore($router);

  return (
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">ORDUM</div>
        <nav class="nav">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.route}
              href={item.href}
              class={page?.route === item.route ? "active" : ""}
            >
              <span class="icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
          <ManagementNav currentRoute={page?.route ?? null} />
        </nav>
        <div class="sidebar-footer">
          <a
            href="https://discord.gg/xnvcKubejB"
            target="_blank"
            rel="noopener noreferrer"
            class="discord-link"
          >
            <svg
              class="icon"
              viewBox="0 -28.5 256 256"
              width="18"
              height="18"
              fill="currentColor"
            >
              <path d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193a161.094 161.094 0 0 0 13.882-22.584 136.426 136.426 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.862 22.563 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z" />
            </svg>
            Discord
          </a>
        </div>
      </aside>

      <main class="main-content">
        <ProfileIcon />
        <div class="content-wrapper">
          <PageContent route={page?.route ?? null} />
        </div>
      </main>
    </div>
  );
}
