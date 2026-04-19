import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div
        className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl ${
          type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}
      >
        {type === "success" ? (
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        )}
        <p className="font-medium text-sm">{message}</p>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 p-1 hover:bg-black/5 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface SuccessModalProps {
  title: string;
  message: string;
  onClose: () => void;
  autoRedirect?: string;
  redirectDelay?: number;
}

export function SuccessModal({ title, message, onClose, autoRedirect, redirectDelay = 3000 }: SuccessModalProps) {
  useEffect(() => {
    if (autoRedirect) {
      const timer = setTimeout(() => {
        window.location.href = autoRedirect;
      }, redirectDelay);
      return () => clearTimeout(timer);
    }
  }, [autoRedirect, redirectDelay]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-headline text-center text-primary mb-3">{title}</h2>
        <p className="text-center text-on-surface-variant mb-6">{message}</p>
        {autoRedirect && (
          <p className="text-center text-xs text-outline">Redirecting in {redirectDelay / 1000}s...</p>
        )}
        <button
          onClick={onClose}
          className="w-full mt-6 bg-primary text-on-primary py-3 rounded-full font-bold hover:bg-primary/90 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
