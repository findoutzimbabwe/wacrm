'use client';

import { useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Ask the owner for their password and unlock owner controls for 10 minutes. */
export async function unlockOwner(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/owner/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body?.error || 'Could not unlock.' };
}

export function OwnerPasswordForm({
  onUnlocked,
  compact = false,
}: {
  onUnlocked: () => void;
  compact?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unlockOwner(password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      onUnlocked();
    } else {
      setError(result.error);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {!compact ? (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LockKeyhole className="size-4 text-primary" />
          Owner controls are locked
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="owner-password">Re-enter your password to continue</Label>
        <Input
          id="owner-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoFocus
          required
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Stays unlocked for 10 minutes on this browser, then locks again automatically.
        </p>
      </div>
      <Button type="submit" disabled={busy || !password}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        Unlock
      </Button>
    </form>
  );
}

export function OwnerUnlockDialog({
  open,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm it&apos;s you</DialogTitle>
          <DialogDescription>
            This action is limited to the workspace owner.
          </DialogDescription>
        </DialogHeader>
        <OwnerPasswordForm
          compact
          onUnlocked={() => {
            onOpenChange(false);
            onUnlocked();
          }}
        />
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
