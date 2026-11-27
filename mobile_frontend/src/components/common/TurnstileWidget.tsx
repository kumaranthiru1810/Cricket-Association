import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId?: string) => void;
    };
  }
}

const SITE_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_TURNSTILE_SITE_KEY) || '';

/**
 * Lightweight Cloudflare Turnstile widget for Web.
 * Renders nothing when EXPO_PUBLIC_TURNSTILE_SITE_KEY is not configured or on native,
 * preserving the existing UI look.
 */
export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ onToken, resetSignal = 0 }) => {
  const containerRef = useRef<any>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !SITE_KEY) {
      return;
    }

    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current && window.turnstile.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_e) {}
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: 'light',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null)
      });
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      const existingScript = document.querySelector('script[data-cf-turnstile="true"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-cf-turnstile', 'true');
        script.onload = mountWidget;
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', mountWidget);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_e) {}
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  useEffect(() => {
    if (Platform.OS === 'web' && widgetIdRef.current && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (_e) {}
    }
  }, [resetSignal]);

  if (Platform.OS !== 'web' || !SITE_KEY) {
    return null;
  }

  return (
    <View style={{ marginVertical: 8, alignItems: 'center' }}>
      <div ref={containerRef} />
    </View>
  );
};

export default TurnstileWidget;

