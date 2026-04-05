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
/**
 * Wraps ConvexProviderWithAuth for WorkOS AuthKit + Preact.
 *
 * Adapted from @convex-dev/workos but using preact/compat.
 */
import { type ComponentChildren } from "preact";
import { useCallback, useMemo } from "preact/hooks";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

type UseAuth = () => {
  isLoading: boolean;
  user: unknown;
  getAccessToken: () => Promise<string | null>;
};

export function ConvexProviderWithAuthKit({
  children,
  client,
  useAuth,
}: {
  children: ComponentChildren;
  client: ConvexReactClient;
  useAuth: UseAuth;
}) {
  const useAuthFromWorkOS = useUseAuthFromAuthKit(useAuth);
  return (
    <ConvexProviderWithAuth client={client} useAuth={useAuthFromWorkOS}>
      {children}
    </ConvexProviderWithAuth>
  );
}

function useUseAuthFromAuthKit(useAuth: UseAuth) {
  return useMemo(
    () =>
      function useAuthFromWorkOS() {
        const { isLoading, user, getAccessToken } = useAuth();

        const fetchAccessToken = useCallback(async () => {
          try {
            return await getAccessToken();
          } catch (error) {
            console.error("Error fetching WorkOS access token:", error);
            return null;
          }
        }, [getAccessToken]);

        return useMemo(
          () => ({
            isLoading,
            isAuthenticated: !!user,
            fetchAccessToken,
          }),
          [isLoading, user, fetchAccessToken],
        );
      },
    [useAuth],
  );
}
