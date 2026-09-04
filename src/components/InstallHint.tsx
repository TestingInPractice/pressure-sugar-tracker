import { useState, useEffect } from 'react';

const DISMISS_KEY = 'install-hint-dismissed';

function isInstalled(): boolean {
  try {
    if ((navigator as any).standalone === true) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch { /* matchMedia may throw in some environments */ }
  return false;
}

function isIOS(): boolean {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in window);
  } catch { return false; }
}

let beforeInstallPrompt: Event | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    beforeInstallPrompt = e;
  });
}

interface Props {
  className?: string;
}

export default function InstallHint({ className = '' }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isIOS()) { setVisible(true); return; }
    if (beforeInstallPrompt) { setVisible(true); return; }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  if (isIOS()) {
    return (
      <div className={`install-hint ${className}`} role="note">
        <span className="install-hint__text">
          Установить на iPhone: нажмите ⎙ «Поделиться» → «На экран «Домой»»
        </span>
        <button type="button" className="install-hint__dismiss" onClick={dismiss}
                aria-label="Закрыть подсказку">✕</button>
      </div>
    );
  }

  return (
    <div className={`install-hint ${className}`} role="note">
      <span className="install-hint__text">Установить приложение</span>
      <button type="button" className="install-hint__dismiss" onClick={dismiss}
              aria-label="Закрыть подсказку">✕</button>
    </div>
  );
}
