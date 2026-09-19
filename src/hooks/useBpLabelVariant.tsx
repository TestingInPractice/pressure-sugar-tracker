import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BP_LABEL_VARIANTS,
  DEFAULT_BP_LABEL_VARIANT,
} from '../logic/bp-labels';
import type { BpLabelSet, BpLabelVariant } from '../logic/bp-labels';

const STORAGE_KEY = 'bp-label-variant';

interface BpLabelVariantContextValue {
  variant: BpLabelVariant;
  labels: BpLabelSet;
  setVariant: (v: BpLabelVariant) => void;
}

const BpLabelVariantContext = createContext<BpLabelVariantContextValue | null>(null);

function isBpLabelVariant(value: string): value is BpLabelVariant {
  return value === 'sad' || value === 'vd' || value === 'en';
}

function readStoredVariant(): BpLabelVariant {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null && isBpLabelVariant(stored) ? stored : DEFAULT_BP_LABEL_VARIANT;
}

interface BpLabelVariantProviderProps {
  children: ReactNode;
  /** Переопределяет localStorage (для тестов). */
  initialVariant?: BpLabelVariant;
}

export function BpLabelVariantProvider({ children, initialVariant }: BpLabelVariantProviderProps) {
  const [variant, setVariant] = useState<BpLabelVariant>(
    () => initialVariant ?? readStoredVariant(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, variant);
  }, [variant]);

  const value: BpLabelVariantContextValue = {
    variant,
    labels: BP_LABEL_VARIANTS[variant],
    setVariant,
  };

  return <BpLabelVariantContext.Provider value={value}>{children}</BpLabelVariantContext.Provider>;
}

export function useBpLabelVariant(): BpLabelVariantContextValue {
  const ctx = useContext(BpLabelVariantContext);
  if (ctx !== null) return ctx;
  return {
    variant: DEFAULT_BP_LABEL_VARIANT,
    labels: BP_LABEL_VARIANTS[DEFAULT_BP_LABEL_VARIANT],
    setVariant: () => {},
  };
}