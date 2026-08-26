"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getConfigFilename } from "@/lib/wireguard";

interface ConfigQrModalProps {
  name: string;
  confText: string;
  onClose: () => void;
}

export function ConfigQrModal({ name, confText, onClose }: ConfigQrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    setQrError(null);
    QRCode.toCanvas(canvas, confText, {
      errorCorrectionLevel: "L",
      margin: 2,
      width: 280,
    }).catch((error: unknown) => {
      setQrError(
        error instanceof Error ? error.message : "Failed to generate QR code",
      );
    });
  }, [confText]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function downloadConfig() {
    const blob = new Blob([confText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getConfigFilename(name);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-qr-title"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="config-qr-title" className="text-xl font-semibold">
            {name}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={downloadConfig}>
              Download .conf
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <canvas ref={canvasRef} className="rounded-xl bg-white p-3" />
            {qrError && <p className="text-sm text-[var(--danger)]">{qrError}</p>}
          </div>
          <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[#0d1430] p-4 text-sm leading-6">
            {confText}
          </pre>
        </div>
      </div>
    </div>
  );
}
