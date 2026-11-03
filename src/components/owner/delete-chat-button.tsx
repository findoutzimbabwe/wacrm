'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OwnerUnlockDialog } from './owner-unlock-dialog';

/**
 * Owner-only "Delete chat" for the inbox header. Permanently removes the
 * conversation (and optionally the contact) from the CRM. Requires the
 * owner password unlock; nothing changes on the phone.
 */
export function DeleteChatButton({
  conversationId,
  onDeleted,
}: {
  conversationId: string;
  onDeleted?: () => void;
}) {
  const { isOwner } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [alsoContact, setAlsoContact] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOwner) return null;

  const doDelete = async () => {
    setBusy(true);
    const res = await fetch(
      `/api/owner/conversations/${encodeURIComponent(conversationId)}${alsoContact ? '?contact=1' : ''}`,
      { method: 'DELETE' },
    );
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 403 && body?.unlock_required) {
      setUnlockOpen(true);
      return;
    }
    if (!res.ok) {
      toast.error(body?.error || 'Could not delete the chat.');
      return;
    }
    setConfirmOpen(false);
    toast.success('Chat deleted from the CRM.');
    onDeleted?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label="Delete chat"
        title="Delete chat (owner only)"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat from the CRM?</DialogTitle>
            <DialogDescription>
              The conversation and its messages are permanently removed for everyone in the CRM. Your
              WhatsApp Business app keeps its copy. To stop future messages from this number appearing,
              add it under Settings → Owner controls → Private contacts.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={alsoContact} onCheckedChange={(v) => setAlsoContact(v === true)} />
            Also delete the contact card
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OwnerUnlockDialog open={unlockOpen} onOpenChange={setUnlockOpen} onUnlocked={() => void doDelete()} />
    </>
  );
}
