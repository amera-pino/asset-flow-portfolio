import { CircleHelp } from "lucide-react";
import { useEffect } from "react";

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  isOpen: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const confirmToneClassMap = {
  primary: "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-200",
  danger: "bg-red-700 text-white hover:bg-red-800 focus:ring-red-200",
} as const;

export function ConfirmModal({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  confirmTone = "primary",
  isOpen,
  isSubmitting = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="confirm-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
            <CircleHelp className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-950" id="confirm-modal-title">
            {title}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="inline-flex min-w-[96px] items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`inline-flex min-w-[96px] items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-300 ${
              confirmToneClassMap[confirmTone]
            }`}
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
