'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/**
 * "Connect WhatsApp" via Meta Embedded Signup.
 *
 * Default mode is COEXISTENCE: the owner scans a QR code with the
 * WhatsApp Business app, and the number keeps working on the phone
 * (calls, manual chats) while the CRM receives the messages too.
 */

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;
const GRAPH_VERSION = 'v21.0';

type SessionInfo = {
  event?: string;
  waba_id?: string;
  phone_number_id?: string;
};

type FBLoginResponse = { authResponse?: { code?: string } | null; status?: string };
type FBStatic = {
  init: (opts: Record<string, unknown>) => void;
  login: (cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FBStatic;
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSdk(): Promise<FBStatic> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
      resolve(window.FB!);
    };
    if (document.getElementById('facebook-jssdk')) return;
    const s = document.createElement('script');
    s.id = 'facebook-jssdk';
    s.async = true;
    s.defer = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.onerror = () => reject(new Error('Could not load Facebook. Check your connection or ad-blocker.'));
    document.body.appendChild(s);
  });
}

export type SignupResult = {
  phone_info?: { display_phone_number?: string; verified_name?: string };
  webhook_url?: string;
  verify_token?: string | null;
  token_expires_at?: string | null;
};

export function CoexistenceConnect({
  onConnected,
  onLocked,
}: {
  onConnected: (result: SignupResult) => void;
  onLocked: () => void;
}) {
  const session = useRef<SessionInfo>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin !== 'string' || !event.origin.endsWith('facebook.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        session.current = {
          event: data.event,
          waba_id: data.data?.waba_id,
          phone_number_id: data.data?.phone_number_id,
        };
        if (data.event === 'CANCEL') {
          toast.message('Signup was closed before it finished.');
        } else if (data.event === 'ERROR') {
          toast.error(data.data?.error_message || 'Meta reported an error during signup.');
        }
      } catch {
        // Not a signup message.
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!APP_ID || !CONFIG_ID) {
    return (
      <p className="text-sm text-destructive">
        Missing NEXT_PUBLIC_META_APP_ID or NEXT_PUBLIC_META_ES_CONFIG_ID in the server settings.
      </p>
    );
  }

  const finish = async (code: string) => {
    // The session message can land a moment after the login callback.
    for (let i = 0; i < 20 && !session.current.waba_id; i++) {
      await new Promise((r) => setTimeout(r, 150));
    }
    const info = session.current;
    const res = await fetch('/api/owner/whatsapp-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        waba_id: info.waba_id,
        phone_number_id: info.phone_number_id,
        coexistence: info.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403 && body?.unlock_required) {
      onLocked();
      throw new Error('Owner controls locked — unlock and try again.');
    }
    if (!res.ok || body?.registration_error) {
      throw new Error(body?.registration_error || body?.error || 'Could not finish connecting.');
    }
    return body as SignupResult;
  };

  const start = async () => {
    setBusy(true);
    session.current = {};
    try {
      const FB = await loadFacebookSdk();
      const code = await new Promise<string>((resolve, reject) => {
        FB.login(
          (response) => {
            const c = response?.authResponse?.code;
            if (c) resolve(c);
            else reject(new Error('Signup was cancelled.'));
          },
          {
            config_id: CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: 'whatsapp_business_app_onboarding',
              sessionInfoVersion: '3',
            },
          },
        );
      });
      const result = await finish(code);
      const label =
        result.phone_info?.display_phone_number || result.phone_info?.verified_name || 'your number';
      setDone(label);
      toast.success(`Connected ${label}. It keeps working in the WhatsApp Business app too.`);
      onConnected(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Have your phone with the WhatsApp Business app nearby and up to date.</li>
        <li>Click the button, log in with Facebook and choose your business portfolio.</li>
        <li>When asked, choose to connect your <strong>existing WhatsApp Business app</strong> number and scan the QR code from the app.</li>
        <li>When the app asks about sharing chat history, choose <strong>don&apos;t share</strong>.</li>
      </ol>
      <Button onClick={start} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
        Connect WhatsApp (keep using the Business app)
      </Button>
      {done ? (
        <p className="flex items-center gap-2 text-sm text-emerald-500">
          <CheckCircle2 className="size-4" /> Connected {done}
        </p>
      ) : null}
    </div>
  );
}
