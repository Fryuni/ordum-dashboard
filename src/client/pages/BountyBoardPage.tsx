import { useEffect, useState } from "preact/hooks";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getItemName } from "../../common/gamedata";
import type { ItemType } from "../../common/gamedata/definition";
import ItemPicker, { type SelectedItem } from "../components/ItemPicker";
import CraftLink from "../components/CraftLink";
import Pagination from "../components/Pagination";

export default function BountyBoardPage() {
  const { isAuthenticated } = useConvexAuth();
  const permissions = isAuthenticated
    ? useQuery(api.bountyBoard.getUserPermissions, {})
    : null;
  const myOpenBounties = isAuthenticated
    ? useQuery(api.bountyBoard.listMyOpenBounties)
    : null;

  const [showForm, setShowForm] = useState(false);
  const [openPage, setOpenPage] = useState(0);
  const [closedPage, setClosedPage] = useState(0);

  const openPageResult = useQuery(api.bountyBoard.listOpenBountiesPage, {
    page: openPage,
  });

  return (
    <>
      <div class="page-header">
        <h1>📜 Bounty Board</h1>
        <p class="subtitle">
          Post bounties for items you need — offer hex coins as reward
        </p>
      </div>

      {isAuthenticated && permissions?.isEmpireMember && (
        <MyBountiesSection
          openBounties={myOpenBounties ?? []}
          closedPage={closedPage}
          onClosedPageChange={setClosedPage}
          showForm={showForm}
          onToggleForm={() => setShowForm((v) => !v)}
        />
      )}

      <div class="bb-section">
        <div class="bb-section-header">
          <h2>Open Bounties</h2>
        </div>
        {!openPageResult ? (
          <div class="loading-container">
            <div class="spinner-wrap">
              <div class="spinner" />
              <span class="loading-text">Loading bounties…</span>
            </div>
          </div>
        ) : openPageResult.bounties.length === 0 ? (
          <p class="empty-state">No open bounties yet.</p>
        ) : (
          <>
            <div class="bounty-grid">
              {openPageResult.bounties.map((b: any) => (
                <BountyCard key={b._id} bounty={b} />
              ))}
            </div>
            <Pagination
              page={openPageResult.page}
              totalPages={openPageResult.totalPages}
              onPageChange={setOpenPage}
            />
          </>
        )}
      </div>
    </>
  );
}

function BountyCard({ bounty }: { bounty: any }) {
  return (
    <div class="bounty-card">
      <div class="bounty-card-header">
        <span class="bounty-card-title">{bounty.title}</span>
        <span class="bounty-card-price">
          <span class="hex-icon">💎</span> {bounty.priceHex.toLocaleString()}
        </span>
      </div>
      {bounty.description && (
        <p class="bounty-card-desc">{bounty.description}</p>
      )}
      {bounty.items.length > 0 && (
        <div class="bounty-card-items">
          {bounty.items.map(
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
      <div class="bounty-card-footer">
        <span class="bounty-card-poster">Posted by {bounty.playerName}</span>
        <CraftLink items={bounty.items} />
        <span class="bounty-card-date">
          {new Date(bounty.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function MyBountiesSection({
  openBounties,
  closedPage,
  onClosedPageChange,
  showForm,
  onToggleForm,
}: {
  openBounties: any[];
  closedPage: number;
  onClosedPageChange: (page: number) => void;
  showForm: boolean;
  onToggleForm: () => void;
}) {
  const closedResult = useQuery(api.bountyBoard.listMyClosedBountiesPage, {
    page: closedPage,
  });
  const [closedOpen, setClosedOpen] = useState(false);

  // Hold onto the last loaded result so the section doesn't collapse/flicker
  // while a new page is loading.
  const [lastClosedResult, setLastClosedResult] = useState<
    typeof closedResult | null
  >(null);
  useEffect(() => {
    if (closedResult) setLastClosedResult(closedResult);
  }, [closedResult]);
  const displayedResult = closedResult ?? lastClosedResult;

  return (
    <div class="bb-section">
      <div class="bb-section-header">
        <h2>My Bounties</h2>
        <button
          class="btn-primary"
          onClick={onToggleForm}
          disabled={openBounties.length >= 10}
          title={
            openBounties.length >= 10
              ? "Maximum 10 open bounties"
              : "Post a new bounty"
          }
        >
          {showForm ? "Cancel" : "+ New Bounty"}
        </button>
      </div>

      {showForm && <CreateBountyForm onDone={onToggleForm} />}

      {openBounties.length === 0 && !showForm ? (
        <p class="empty-state">You haven't posted any bounties yet.</p>
      ) : (
        <div class="bounty-grid">
          {openBounties.map((b: any) => (
            <MyBountyCard key={b._id} bounty={b} />
          ))}
        </div>
      )}

      {displayedResult && displayedResult.totalCount > 0 && (
        <details
          class="closed-bounties-details"
          open={closedOpen}
          onToggle={(e) => setClosedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary class="closed-bounties-summary">
            {displayedResult.totalCount} closed bount
            {displayedResult.totalCount === 1 ? "y" : "ies"}
          </summary>
          <div class="bounty-grid">
            {displayedResult.bounties.map((b: any) => (
              <BountyCard key={b._id} bounty={b} />
            ))}
          </div>
          <Pagination
            page={displayedResult.page}
            totalPages={displayedResult.totalPages}
            onPageChange={onClosedPageChange}
          />
        </details>
      )}
    </div>
  );
}

function MyBountyCard({ bounty }: { bounty: any }) {
  const closeBounty = useMutation(api.bountyBoard.closeBounty);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    setClosing(true);
    try {
      await closeBounty({ bountyId: bounty._id });
    } finally {
      setClosing(false);
    }
  };

  if (editing) {
    return <EditBountyForm bounty={bounty} onDone={() => setEditing(false)} />;
  }

  return (
    <div class="bounty-card my-bounty-card">
      <div class="bounty-card-header">
        <span class="bounty-card-title">{bounty.title}</span>
        <span class="bounty-card-price">
          <span class="hex-icon">💎</span> {bounty.priceHex.toLocaleString()}
        </span>
      </div>
      {bounty.description && (
        <p class="bounty-card-desc">{bounty.description}</p>
      )}
      {bounty.items.length > 0 && (
        <div class="bounty-card-items">
          {bounty.items.map(
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
        <CraftLink items={bounty.items} />
        <button class="btn-secondary" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button class="btn-danger" onClick={handleClose} disabled={closing}>
          {closing ? "Closing…" : "Close"}
        </button>
      </div>
    </div>
  );
}

function CreateBountyForm({ onDone }: { onDone: () => void }) {
  const createBounty = useMutation(api.bountyBoard.createBounty);
  const gameAccounts = useQuery(api.bountyBoard.getMyGameAccounts) ?? [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [priceHex, setPriceHex] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Default to first game account once loaded
  useEffect(() => {
    if (!selectedCharacter && gameAccounts.length > 0) {
      setSelectedCharacter(gameAccounts[0]!.playerEntityId);
    }
  }, [gameAccounts, selectedCharacter]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!selectedCharacter) {
      setError("No game character available");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createBounty({
        playerEntityId: selectedCharacter,
        title: title.trim(),
        description: description.trim() || undefined,
        items,
        priceHex,
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
      {gameAccounts.length > 1 && (
        <div class="form-field">
          <label>Post as</label>
          <select
            class="bb-input"
            value={selectedCharacter}
            onChange={(e) =>
              setSelectedCharacter((e.target as HTMLSelectElement).value)
            }
          >
            {gameAccounts.map((account) => (
              <option
                key={account.playerEntityId}
                value={account.playerEntityId}
              >
                {account.playerName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div class="form-field">
        <label>Title</label>
        <input
          type="text"
          class="bb-input"
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="What do you need?"
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
          placeholder="Any extra details…"
        />
      </div>
      <div class="form-field">
        <label>Items</label>
        <ItemPicker items={items} onChange={setItems} />
      </div>
      <div class="form-field">
        <label>Reward (hex coins)</label>
        <input
          type="number"
          class="bb-input"
          min="0"
          value={priceHex}
          onInput={(e) =>
            setPriceHex(parseInt((e.target as HTMLInputElement).value) || 0)
          }
        />
      </div>
      {error && <p class="form-error">{error}</p>}
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={submitting}>
          {submitting ? "Posting…" : "Post Bounty"}
        </button>
        <button type="button" class="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditBountyForm({
  bounty,
  onDone,
}: {
  bounty: any;
  onDone: () => void;
}) {
  const updateBounty = useMutation(api.bountyBoard.updateBounty);
  const [title, setTitle] = useState(bounty.title);
  const [description, setDescription] = useState(bounty.description ?? "");
  const [items, setItems] = useState<SelectedItem[]>(bounty.items);
  const [priceHex, setPriceHex] = useState(bounty.priceHex);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateBounty({
        bountyId: bounty._id,
        title: title.trim(),
        description: description.trim() || undefined,
        items,
        priceHex,
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
        <label>Items</label>
        <ItemPicker items={items} onChange={setItems} />
      </div>
      <div class="form-field">
        <label>Reward (hex coins)</label>
        <input
          type="number"
          class="bb-input"
          min="0"
          value={priceHex}
          onInput={(e) =>
            setPriceHex(parseInt((e.target as HTMLInputElement).value) || 0)
          }
        />
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
