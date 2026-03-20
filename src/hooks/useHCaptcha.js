import { useRef, useCallback, useEffect, useState } from 'react';

const SITE_KEY = '5acaec7e-83b0-464e-ba10-690889fc66ba';

export default function useHCaptcha() {
  const captchaRef = useRef(null);
  const widgetId = useRef(null);
  const [token, setToken] = useState(null);

  const renderCaptcha = useCallback(() => {
    if (!captchaRef.current || widgetId.current !== null) return;
    if (!window.hcaptcha) {
      const t = setTimeout(renderCaptcha, 300);
      return () => clearTimeout(t);
    }
    try {
      widgetId.current = window.hcaptcha.render(captchaRef.current, {
        sitekey: SITE_KEY,
        callback: (tok) => setToken(tok),
        'expired-callback': () => setToken(null),
        'error-callback': () => setToken(null),
        theme: 'light',
        size: 'normal',
      });
    } catch {
    }
  }, []);

  const resetCaptcha = useCallback(() => {
    setToken(null);
    if (widgetId.current !== null && window.hcaptcha) {
      try {
        window.hcaptcha.reset(widgetId.current);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(renderCaptcha, 500);
    return () => clearTimeout(timer);
  }, [renderCaptcha]);

  return { captchaRef, token, resetCaptcha, renderCaptcha, SITE_KEY };
}
