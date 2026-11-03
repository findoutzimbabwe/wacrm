'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Lock, ShieldCheck, Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsPanelHead } from '@/components/settings/settings-panel-head';
import { OwnerPasswordForm } from './owner-unlock-dialog';
import { CoexistenceConnect } from './coexistence-connect';

type PrivateContact = { id: string; phone: string; label: string | null; created_at: string };
type WebhookInfo = {
  webhook_url: string;
  verify_token: string | null;
  connected: boolean;
  onboarding_method: string | null;
  token_expires_at: string | null;
};

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied'),
    () => toast.error('Could not copy'),
  );
}

function formatPhone(digits: string) {
  return `+${digits}`;
}

export function OwnerControls() {
  const { isOwner } = useAuth();
  const [status, setStatus] = useState<'loading' | 'locked' | 'unlocked'>('loading');
  const [until, setUntil] = useState<number | null>(null);

  const refreshLock = useCallback(async () => {
    const res = await fetch('/api/owner/unlock');
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.unlocked) {
      setStatus('unlocked');
      setUntil(body.unlocked_until);
    } else {
      setStatus('locked');
      setUntil(null);
    }
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetch('/api/owner/unlock')
      .then(async (res) => ({ res, body: await res.json().catch(() => ({})) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.ok && body.unlocked) {
          setStatus('unlocked');
          setUntil(body.unlocked_until);
        } else {
          setStatus('locked');
        }
      })
      .catch(() => !cancelled && setStatus('locked'));
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  // Re-lock the UI when the 10-minute window ends.
  useEffect(() => {
    if (status !== 'unlocked' || !until) return;
    const ms = until - Date.now();
    const t = setTimeout(() => setStatus('locked'), Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [status, until]);

  const lockNow = async () => {
    await fetch('/api/owner/unlock', { method: 'DELETE' });
    setStatus('locked');
  };

  if (!isOwner) {
    return (
      <p className="text-sm text-muted-foreground">Only the workspace owner can open this page.</p>
    );
  }

  return (
    <div>
      <SettingsPanelHead
        title="Owner controls"
        description="Connect your WhatsApp number, choose which contacts stay private, and remove chats. Only you can see this page."
        action={
          status === 'unlocked' ? (
            <Button variant="outline" size="sm" onClick={lockNow}>
              <Lock className="size-4" /> Lock now
            </Button>
          ) : null
        }
      />

      {status === 'loading' ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : status === 'locked' ? (
        <Card>
          <CardContent className="pt-6">
            <OwnerPasswordForm onUnlocked={refreshLock} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <ConnectCard onLocked={() => setStatus('locked')} />
          <PrivateContactsCard onLocked={() => setStatus('locked')} />
        </div>
      )}
    </div>
  );
}

function ConnectCard({ onLocked }: { onLocked: () => void }) {
  const [info, setInfo] = useState<WebhookInfo | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch('/api/owner/whatsapp-signup');
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body?.unlock_required) return onLocked();
    if (res.ok) {
      setInfo(body);
      setLoadedAt(Date.now());
    }
  }, [onLocked]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/owner/whatsapp-signup')
      .then(async (res) => ({ res, body: await res.json().catch(() => ({})) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.status === 403 && body?.unlock_required) onLocked();
        else if (res.ok) {
          setInfo(body);
          setLoadedAt(Date.now());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onLocked]);

  const expires = info?.token_expires_at ? new Date(info.token_expires_at) : null;
  const daysLeft = expires && loadedAt ? Math.ceil((expires.getTime() - loadedAt) / 86_400_000) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> WhatsApp number
        </CardTitle>
        <CardDescription>
          {info?.connected
            ? info.onboarding_method === 'coexistence'
              ? 'Connected with coexistence — the number also keeps working in the WhatsApp Business app.'
              : 'Connected.'
            : 'Not connected yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {daysLeft !== null ? (
          <p className={daysLeft <= 14 ? 'text-sm text-amber-500' : 'text-sm text-muted-foreground'}>
            Access from Meta {daysLeft > 0 ? `expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'has expired'} (
            {expires!.toLocaleDateString()}). Reconnect before then, or add a permanent system-user token under
            Settings → WhatsApp.
          </p>
        ) : null}

        <CoexistenceConnect onLocked={onLocked} onConnected={() => void load()} />

        {info ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">For Meta&apos;s webhook settings</p>
            <CopyRow label="Callback URL" value={info.webhook_url} />
            {info.verify_token ? <CopyRow label="Verify token" value={info.verify_token} secret /> : null}
            <p className="text-xs text-muted-foreground">
              Subscribe to: messages, smb_message_echoes, message_template_status_update,
              message_template_quality_update, account_update.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={show ? value : '•'.repeat(16)} className="font-mono text-xs" />
        {secret ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => copy(value)}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PrivateContactsCard({ onLocked }: { onLocked: () => void }) {
  const [items, setItems] = useState<PrivateContact[] | null>(null);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [purge, setPurge] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/owner/private-contacts');
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body?.unlock_required) return onLocked();
    if (res.ok) setItems(body.contacts);
    else toast.error(body?.error || 'Could not load private contacts.');
  }, [onLocked]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/owner/private-contacts')
      .then(async (res) => ({ res, body: await res.json().catch(() => ({})) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.status === 403 && body?.unlock_required) onLocked();
        else if (res.ok) setItems(body.contacts);
        else toast.error(body?.error || 'Could not load private contacts.');
      });
    return () => {
      cancelled = true;
    };
  }, [onLocked]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/owner/private-contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, label, purge }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 403 && body?.unlock_required) return onLocked();
    if (!res.ok) return toast.error(body?.error || 'Could not add the number.');
    toast.success(
      body.purged > 0
        ? `Added. Removed ${body.purged} existing chat${body.purged === 1 ? '' : 's'} from the CRM.`
        : 'Added to private contacts.',
    );
    setLabel('');
    setPhone('');
    void load();
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/owner/private-contacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body?.unlock_required) return onLocked();
    if (!res.ok) return toast.error(body?.error || 'Could not remove the number.');
    toast.success('Removed. New messages from this number will appear in the CRM again.');
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="size-4 text-primary" /> Private contacts
        </CardTitle>
        <CardDescription>
          Messages from these numbers never enter the CRM — your team can&apos;t see them and the AI never
          replies. You keep chatting with them in the WhatsApp Business app on your phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pc-label">Name</Label>
            <Input id="pc-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mom" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pc-phone">Phone number</Label>
            <Input
              id="pc-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0772 123 456 or +263 772 123 456"
              required
            />
          </div>
          <Button type="submit" disabled={busy || !phone}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Add
          </Button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
            <Checkbox checked={purge} onCheckedChange={(v) => setPurge(v === true)} />
            Also permanently delete any chats with this number that are already in the CRM
          </label>
        </form>

        {items === null ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No private contacts yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.label || 'No name'}</p>
                  <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)} aria-label="Remove">
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
