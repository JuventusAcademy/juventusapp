import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle, X, Goal } from "lucide-react";
export function Brand() {
  return (
    <div className="brand academy-brand">
      <img
        src="/juventus-academy-logo.jpg"
        alt="Logo Juventus Academy São Carlos"
      />
      <span>
        Juventus Academy<small>São Carlos · FutGestão</small>
      </span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={28} />
      <p>Carregando informações…</p>
    </div>
  );
}
export function Empty({
  title = "O próximo passo começa aqui",
  text = "Cadastre o primeiro registro para organizar sua escola.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Goal size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <div>
        <strong>Não foi possível carregar</strong>
        <p>{message}</p>
        {retry && (
          <button className="btn secondary" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button aria-label="Fechar" className="icon-btn" onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={"badge " + value}>{label || value}</span>;
}
