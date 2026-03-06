import { useState, useEffect, useCallback } from 'react';

export function useWorkspace() {
  const [isImmersive, setIsImmersive] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'legal' | 'guide'>('none');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showSecretThemeModal, setShowSecretThemeModal] = useState(false);

  // --- WAKE LOCK API (Keep Screen On) ---
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.debug('[Lectorium] Wake Lock active (Screen On)');
        } catch (err: any) {
          if (err.name !== 'NotAllowedError') {
            console.warn('[Lectorium] Wake Lock denied:', err.message);
          }
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  // Theme Application
  useEffect(() => {
    const root = document.documentElement;
    const godModeTheme = localStorage.getItem('god_mode_theme');
    
    if (godModeTheme) {
        try {
            const parsed = JSON.parse(godModeTheme);
            if (parsed.vars) {
                Object.entries(parsed.vars).forEach(([key, value]) => {
                    root.style.setProperty(key, value as string);
                });
                root.classList.add('custom');
            }
        } catch (e) { console.warn("Erro ao carregar tema secreto"); }
    } else {
        const savedTheme = localStorage.getItem('app-theme') || 'forest';
        const customColor = localStorage.getItem('custom-theme-brand');
        
        // Limpa classes antes de aplicar
        root.className = ''; 
        if (savedTheme !== 'forest') {
            root.classList.add(savedTheme);
            if (savedTheme === 'custom' && customColor) {
                root.style.setProperty('--custom-brand', customColor);
            }
        }
    }
  }, []);

  // Fullscreen Preference
  useEffect(() => {
    const fsPref = localStorage.getItem('fullscreen_pref');
    if (fsPref === 'true' && !document.fullscreenElement) {
        setTimeout(() => setShowFullscreenPrompt(true), 1000);
    }
  }, []);

  const checkOnboarding = useCallback(() => {
      const legalAccepted = localStorage.getItem('legal_terms_accepted_v1');
      const guideSeen = localStorage.getItem('onboarding_guide_seen');
      const cookiesAccepted = localStorage.getItem('cookie_consent_accepted');

      if (!cookiesAccepted) {
          // Cookie component handles itself
          return;
      }

      if (!legalAccepted) {
          setOnboardingStep('legal');
          return;
      }

      if (!guideSeen) {
          setOnboardingStep('guide');
          setShowGuideModal(true);
          return;
      }

      setOnboardingStep('none');
  }, []);

  // Run checkOnboarding on mount
  useEffect(() => {
      checkOnboarding();
  }, [checkOnboarding]);

  const handleCookieAccepted = () => {
      // Quando cookie é aceito, dispara verificação dos próximos passos
      checkOnboarding();
  };

  const handleLegalAccepted = () => {
      localStorage.setItem('legal_terms_accepted_v1', 'true');
      checkOnboarding(); // Verifica próximo passo (Guia)
  };

  const handleGuideCompleted = () => {
      localStorage.setItem('onboarding_guide_seen', 'true');
      setShowGuideModal(false);
      checkOnboarding();
  };

  return {
    isImmersive,
    setIsImmersive,
    showFullscreenPrompt,
    setShowFullscreenPrompt,
    onboardingStep,
    showGuideModal,
    showSecretThemeModal,
    setShowSecretThemeModal,
    handleLegalAccepted,
    handleGuideCompleted,
    handleCookieAccepted,
  };
}
