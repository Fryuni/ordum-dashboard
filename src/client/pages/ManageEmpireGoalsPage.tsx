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
import { useStore } from "@nanostores/preact";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { convexSub } from "../stores/convexSub";
import { getItemName } from "../../common/gamedata";
import type { ItemType } from "../../common/gamedata/definition";
import ItemPicker, { type SelectedItem } from "../components/ItemPicker";
import CraftLink from "../components/CraftLink";

const $empireGoals = convexSub([], api.bountyBoard.listEmpireGoals, () => ({}));

const $completedGoals = convexSub([], api.bountyBoard.listEmpireGoals, () => ({
  status: "completed",
}));

export default function ManageEmpireGoalsPage() {
  const goalsState = useStore($empireGoals);
  const completedState = useStore($completedGoals);
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div class="page-header">
        <h1>🎯 Empire Goals</h1>
        <p class="subtitle">Manage goals for the entire empire</p>
      </div>

      <div class="bb-section">
        <div class="bb-section-header">
          <h2>Active Goals</h2>
          <button class="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Goal"}
          </button>
        </div>

        {showForm && <CreateEmpireGoalForm onDone={() => setShowForm(false)} />}

        {goalsState.state === "loading" && (
          <div class="loading-container">
            <div class="spinner-wrap">
              <div class="spinner" />
              <span class="loading-text">Loading goals…</span>
            </div>
          </div>
        )}
        {goalsState.state === "ready" && (
          <>
            {goalsState.value.length === 0 && !showForm ? (
              <p class="empty-state">No active empire goals.</p>
            ) : (
              <div class="bounty-grid">
                {goalsState.value.map((g: any) => (
                  <GoalCard key={g._id} goal={g} type="empire" />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {completedState.state === "ready" && completedState.value.length > 0 && (
        <details class="closed-bounties-details">
          <summary class="closed-bounties-summary">
            {completedState.value.length} completed goal
            {completedState.value.length === 1 ? "" : "s"}
          </summary>
          <div class="bounty-grid">
            {completedState.value.map((g: any) => (
              <GoalCard key={g._id} goal={g} type="empire" completed />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function GoalCard({
  goal,
  type,
  completed,
}: {
  goal: any;
  type: "empire" | "claim";
  completed?: boolean;
}) {
  const updateEmpireGoal = useMutation(api.bountyBoard.updateEmpireGoal);
  const deleteEmpireGoal = useMutation(api.bountyBoard.deleteEmpireGoal);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleComplete = async () => {
    setBusy(true);
    try {
      await updateEmpireGoal({ goalId: goal._id, status: "completed" });
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await updateEmpireGoal({ goalId: goal._id, status: "open" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteEmpireGoal({ goalId: goal._id });
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return <EditEmpireGoalForm goal={goal} onDone={() => setEditing(false)} />;
  }

  return (
    <div class={`bounty-card ${completed ? "bounty-card-closed" : ""}`}>
      <div class="bounty-card-header">
        <span class="bounty-card-title">{goal.title}</span>
      </div>
      {goal.description && <p class="bounty-card-desc">{goal.description}</p>}
      {goal.items.length > 0 && (
        <div class="bounty-card-items">
          {goal.items.map(
            (
              item: { itemType: string; itemId: number; quantity: number },
              i: number,
            ) => (
              <span key={i} class="goal-item-tag">
                {getItemName(item.itemType as ItemType, item.itemId)}{" "}
                <span class="goal-item-qty">x{item.quantity}</span>
              </span>
            ),
          )}
        </div>
      )}
      <div class="bounty-card-actions">
        <CraftLink items={goal.items} />
        {completed ? (
          <>
            <button
              class="btn-secondary"
              onClick={handleReopen}
              disabled={busy}
            >
              Reopen
            </button>
            <button class="btn-danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          </>
        ) : (
          <>
            <button class="btn-secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              class="btn-primary"
              onClick={handleComplete}
              disabled={busy}
            >
              Complete
            </button>
            <button class="btn-danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateEmpireGoalForm({ onDone }: { onDone: () => void }) {
  const createGoal = useMutation(api.bountyBoard.createEmpireGoal);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await createGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        items,
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form class="bounty-form" onSubmit={handleSubmit}>
      <div class="form-field">
        <label>Title</label>
        <input
          type="text"
          class="bb-input"
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="Goal title"
          required
        />
      </div>
      <div class="form-field">
        <label>Description (optional)</label>
        <textarea
          class="bb-textarea"
          value={description}
          onInput={(e) =>
            setDescription((e.target as HTMLTextAreaElement).value)
          }
        />
      </div>
      <div class="form-field">
        <label>Required Items</label>
        <ItemPicker items={items} onChange={setItems} />
      </div>
      {error && <p class="form-error">{error}</p>}
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create Goal"}
        </button>
        <button type="button" class="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditEmpireGoalForm({
  goal,
  onDone,
}: {
  goal: any;
  onDone: () => void;
}) {
  const updateGoal = useMutation(api.bountyBoard.updateEmpireGoal);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [items, setItems] = useState<SelectedItem[]>(goal.items);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateGoal({
        goalId: goal._id,
        title: title.trim(),
        description: description.trim() || undefined,
        items,
      });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form class="bounty-form bounty-card" onSubmit={handleSubmit}>
      <div class="form-field">
        <label>Title</label>
        <input
          type="text"
          class="bb-input"
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          required
        />
      </div>
      <div class="form-field">
        <label>Description</label>
        <textarea
          class="bb-textarea"
          value={description}
          onInput={(e) =>
            setDescription((e.target as HTMLTextAreaElement).value)
          }
        />
      </div>
      <div class="form-field">
        <label>Required Items</label>
        <ItemPicker items={items} onChange={setItems} />
      </div>
      {error && <p class="form-error">{error}</p>}
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" class="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
