import type { CSSProperties } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({ open, title, description, confirmLabel = 'DELETE EVENT', busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null;
  const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(10px)' };
  const card: CSSProperties = { width: 'min(100%, 440px)', border: '1px solid #343943', borderRadius: 20, padding: 26, background: 'linear-gradient(145deg, rgba(255,255,255,.045), transparent 45%), #101216', boxShadow: '0 30px 90px rgba(0,0,0,.55)' };
  return <div className="ls-confirm-backdrop" style={backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="ls-confirm-dialog" style={card} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="ls-confirm-icon" aria-hidden="true">!</div>
      <p className="ls-eyebrow">PERMANENT ACTION</p>
      <h2 id="confirm-dialog-title">{title}</h2>
      <p className="ls-muted" style={{ margin: '10px 0 22px' }}>{description}</p>
      <div className="ls-confirm-actions">
        <button type="button" className="ls-button ls-secondary" onClick={onCancel} disabled={busy}>CANCEL</button>
        <button type="button" className="ls-button ls-danger" onClick={onConfirm} disabled={busy}>{busy ? 'DELETING...' : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
