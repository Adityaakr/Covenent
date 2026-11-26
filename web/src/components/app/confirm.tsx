"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Portal } from "./ui";

/**
 * Confirmation for irreversible actions: what happens, in order, who pays the gas, and an explicit acknowledgement
 * before the transaction is sent. Escape or the backdrop cancels; focus starts on Cancel.
 */
export function ConfirmAction({ open, onClose, onConfirm, title, lead, points, gas, confirmLabel, icon = "alert" }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; lead: ReactNode;
  points: { icon: IconName; text: ReactNode }[]; gas: ReactNode; confirmLabel: string; icon?: IconName;
}) {
  const [ack, setAck] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  const close = () => { setAck(false); onClose(); };
  return (
    <Portal>
    <div className="modal-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-lead">
        <div className="confirm-head">
          <span className="icon-tile bad" style={{ width: 44, height: 44, borderRadius: 13 }}><Icon name={icon} size={20} /></span>
          <div style={{ minWidth: 0 }}>
            <h2 id="confirm-title" className="h-card" style={{ fontSize: 19 }}>{title}</h2>
            <p id="confirm-lead" className="t-s muted w5">{lead}</p>
          </div>
        </div>
        <ol className="confirm-list">
          {points.map((p, i) => <li key={i}><span className="icon-tile sm"><Icon name={p.icon} size={14} /></span><span>{p.text}</span></li>)}
        </ol>
        <div className="confirm-gas"><Icon name="wallet" size={15} /><span>{gas}</span></div>
        <label className="confirm-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I understand this cannot be undone.</span>
        </label>
        <div className="confirm-foot">
          <button ref={cancel} type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={!ack} onClick={() => { setAck(false); onConfirm(); }}><Icon name="alert" size={15} />{confirmLabel}</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
