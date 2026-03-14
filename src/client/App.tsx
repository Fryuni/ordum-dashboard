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

type RouteName = "dashboard" | "settlement" | "craft" | "travelerTask";

function PageContent({ route }: { route: RouteName | null }) {
  switch (route) {
    case "dashboard":
      return <DashboardPage />;
    case "settlement":
      return <SettlementPage />;
    case "craft":
      return <CraftPage />;
    case "travelerTask":
      return <TravelerTaskPage />;
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
      </aside>

      <main class="main-content">
        <div class="content-wrapper">
          <PageContent route={page?.route ?? null} />
        </div>
      </main>
    </div>
  );
}
