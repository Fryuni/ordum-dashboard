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
import { useState } from "preact/hooks";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type User = {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  linkedCharacters: Array<{
    _id: Id<"userGameAccounts">;
    playerEntityId: string;
    playerName: string;
  }>;
};

export default function UserManagementPage() {
  const users = useQuery(api.userManagement.listUsers);

  return (
    <>
      <div class="page-header">
        <h1>👥 User Management</h1>
        <p class="subtitle">
          Link Discord users to their in-game characters and manage admin access
        </p>
      </div>

      {users === undefined ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading users…</span>
          </div>
        </div>
      ) : users === null ? (
        <div class="error-banner">
          <span class="error-icon">⚠</span>
          <span>You need admin access to view this page.</span>
        </div>
      ) : users.length === 0 ? (
        <div class="bb-section">
          <p class="empty-state">No signed-in users yet.</p>
        </div>
      ) : (
        <div class="user-list">
          {users.map((u) => (
            <UserRow key={u._id} user={u} />
          ))}
        </div>
      )}
    </>
  );
}

function UserRow({ user }: { user: User }) {
  const unlink = useMutation(api.userManagement.unlinkCharacter);
  const setAdmin = useMutation(api.userManagement.setUserAdmin);
  const [unlinkBusy, setUnlinkBusy] = useState<Id<"userGameAccounts"> | null>(
    null,
  );
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const displayName = user.name ?? user.email ?? "Unknown user";

  const handleUnlink = async (accountId: Id<"userGameAccounts">) => {
    setUnlinkBusy(accountId);
    try {
      await unlink({ accountId });
    } finally {
      setUnlinkBusy(null);
    }
  };

  const handleToggleAdmin = async () => {
    setAdminBusy(true);
    setAdminError(null);
    try {
      await setAdmin({ userId: user._id, isAdmin: !user.isAdmin });
    } catch (err: any) {
      setAdminError(err.message);
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div class="user-row">
      <div class="user-row-header">
        {user.image ? (
          <img class="user-avatar" src={user.image} alt="" />
        ) : (
          <div class="user-avatar user-avatar-placeholder">
            {displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div class="user-row-info">
          <div class="user-row-name">
            {displayName}
            {user.isAdmin && <span class="admin-badge">Admin</span>}
          </div>
          {user.email && user.name && (
            <div class="user-row-email">{user.email}</div>
          )}
        </div>
        <button
          class={user.isAdmin ? "btn-danger" : "btn-secondary"}
          onClick={handleToggleAdmin}
          disabled={adminBusy}
        >
          {user.isAdmin ? "Remove admin" : "Make admin"}
        </button>
      </div>

      {adminError && <p class="form-error">{adminError}</p>}

      <div class="user-row-characters">
        <div class="user-row-subheading">In-game characters</div>
        {user.linkedCharacters.length === 0 ? (
          <p class="user-row-empty">No characters linked.</p>
        ) : (
          <div class="linked-character-list">
            {user.linkedCharacters.map((c) => (
              <div key={c._id} class="linked-character">
                <span class="linked-character-name">🎮 {c.playerName}</span>
                <button
                  class="btn-danger"
                  onClick={() => handleUnlink(c._id)}
                  disabled={unlinkBusy === c._id}
                >
                  {unlinkBusy === c._id ? "Removing…" : "Unlink"}
                </button>
              </div>
            ))}
          </div>
        )}
        <CharacterSearch userId={user._id} />
      </div>
    </div>
  );
}

function CharacterSearch({ userId }: { userId: Id<"users"> }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const link = useMutation(api.userManagement.linkCharacter);

  // Only fire the query once the user types 2+ characters
  const results = useQuery(
    api.userManagement.searchCharacters,
    query.trim().length >= 2 ? { query } : "skip",
  );

  const handleLink = async (playerEntityId: string) => {
    setBusy(playerEntityId);
    setError(null);
    try {
      await link({ userId, playerEntityId });
      setQuery("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div class="character-search">
      <input
        type="text"
        class="bb-input"
        placeholder="Search in-game characters…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      {error && <p class="form-error">{error}</p>}
      {results && results.length > 0 && (
        <div class="character-search-results">
          {results.map((r) => (
            <div key={r.playerEntityId} class="character-search-row">
              <span class="character-search-name">{r.userName}</span>
              {r.alreadyLinked ? (
                <span class="character-search-note">Already linked</span>
              ) : (
                <button
                  class="btn-primary"
                  onClick={() => handleLink(r.playerEntityId)}
                  disabled={busy === r.playerEntityId}
                >
                  {busy === r.playerEntityId ? "Linking…" : "Link"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {results && results.length === 0 && query.trim().length >= 2 && (
        <p class="empty-state" style="padding: 12px">
          No characters match "{query}"
        </p>
      )}
    </div>
  );
}
