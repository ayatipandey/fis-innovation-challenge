import { useEffect, useRef, type ReactNode } from 'react';

/** Native <dialog>: focus is trapped and restored by the browser, Escape closes it. */
export function Dialog(p: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) {
      d.showModal();
      document.body.style.overflow = 'hidden';
    }
    if (!p.open && d.open) d.close();
    return () => {
      document.body.style.overflow = '';
    };
  }, [p.open]);
  return (
    <dialog
      ref={ref}
      className={`sheet ${p.className ?? 'modal'}`}
      aria-labelledby={p.labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) p.onClose();
      }}
    >
      {p.open && p.children}
    </dialog>
  );
}
