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
import { $router } from "./stores/router";
import DashboardPage from "./pages/DashboardPage";
import SettlementPage from "./pages/SettlementPage";
import CraftPage from "./pages/CraftPage";
import TravelerTaskPage from "./pages/TravelerTaskPage";
import ConstructionPage from "./pages/ConstructionPage";
import ContributionPage from "./pages/ContributionPage";

type RouteName =
  | "dashboard"
  | "settlement"
  | "construction"
  | "craft"
  | "travelerTask"
  | "contribution";

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
    case "contribution":
      return <ContributionPage />;
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
    route: "contribution" as const,
    href: "/contribution",
    icon: "📦",
    label: "Contribution",
  },
];

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
        <div class="content-wrapper">
          <PageContent route={page?.route ?? null} />
        </div>
      </main>
    </div>
  );
}
