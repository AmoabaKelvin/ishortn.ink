"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { defaultGeneratorState } from "./state";

import type { QrCodeGenerateResult } from "uqr";
import type { QRCodeContextValue } from "./state";
import type { GenerateQRCodeResult, QRCodeGeneratorState } from "./types";

const QRCodeContext = createContext<QRCodeContextValue | null>(null);

interface QRCodeProviderProps {
  children: React.ReactNode;
}

export function QRCodeProvider({ children }: QRCodeProviderProps) {
  // Main QR code state
  const [state, setStateInternal] = useState<QRCodeGeneratorState>(defaultGeneratorState());
  const [qrcode, setQrcodeInternal] = useState<QrCodeGenerateResult | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generatedInfo, setGeneratedInfo] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const setState = useCallback((newState: Partial<QRCodeGeneratorState>) => {
    setStateInternal((prev) => ({ ...prev, ...newState }));
  }, []);

  const setQrcode = useCallback((result: GenerateQRCodeResult | null) => {
    if (result) {
      setQrcodeInternal(result.qrcode);
      setGeneratedInfo(result.info);
    } else {
      setQrcodeInternal(null);
      setGeneratedInfo(null);
    }
  }, []);

  const resetState = useCallback(() => {
    setStateInternal(defaultGeneratorState());
    setQrcodeInternal(null);
    setDataUrl(null);
    setGeneratedInfo(null);
  }, []);

  const value = useMemo(
    () => ({
      // State
      state,
      qrcode,
      dataUrl,
      generatedInfo,
      // Actions
      setState,
      setQrcode,
      setDataUrl,
      setGeneratedInfo,
      resetState,
    }),
    [state, qrcode, dataUrl, generatedInfo, setState, setQrcode, resetState],
  );

  return <QRCodeContext.Provider value={value}>{children}</QRCodeContext.Provider>;
}

export function useQRCode() {
  const context = useContext(QRCodeContext);
  if (!context) {
    throw new Error("useQRCode must be used within a QRCodeProvider");
  }
  return context;
}
