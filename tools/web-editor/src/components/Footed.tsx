// Shared UI for a single FOOTED value — a total derived from line items by core
// (deriveRentRoll / deriveOperatingStatement). Renders the value with a
// "ƒ derived" badge, an inline override editor (locked-with-explicit-override),
// and a "revert to ƒ" affordance when hand-pinned. Used by RentRollModel and
// OperatingStatementModel so every footed total behaves identically.

import { useEffect, useRef, useState } from 'react';
import type { DerivedField } from '@uwmd/core/browser';

export function FootedValue(props: {
  field: DerivedField;
  pinned: boolean;
  /** The value currently stored in the file (the override, when pinned). */
  storedValue: number | undefined;
  onOverride: (value: number, note: string) => void;
  onRevert: () => void;
}) {
  const { field, pinned, storedValue, onOverride, onRevert } = props;
  const [editing, setEditing] = useState(false);
  const shown = pinned && typeof storedValue === 'number' ? storedValue : field.value;

  if (editing) {
    return (
      <OverrideInput
        field={field}
        initial={shown}
        onCancel={() => setEditing(false)}
        onSave={(value, note) => {
          onOverride(value, note);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      {pinned ? (
        <span
          title="Manually pinned — not footed from line items"
          className="rounded-full border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-warn"
        >
          manual
        </span>
      ) : (
        <span
          title="Derived from the line items"
          className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[0.6rem] font-semibold text-accent"
        >
          ƒ derived
        </span>
      )}
      <span className={`tabular-nums ${pinned ? 'text-warn' : 'font-semibold'}`}>
        {formatDerived(shown, field.kind)}
      </span>
      {pinned ? (
        <button
          type="button"
          className="text-[0.65rem] font-semibold text-accent hover:underline"
          onClick={onRevert}
        >
          revert to ƒ
        </button>
      ) : (
        <button
          type="button"
          className="text-[0.65rem] text-muted hover:text-accent hover:underline"
          onClick={() => setEditing(true)}
        >
          override
        </button>
      )}
    </span>
  );
}

function OverrideInput(props: {
  field: DerivedField;
  initial: number;
  onSave: (value: number, note: string) => void;
  onCancel: () => void;
}) {
  const { field, initial, onSave, onCancel } = props;
  const [raw, setRaw] = useState(formatDerived(initial, field.kind, true));
  const [note, setNote] = useState('');
  const valueRef = useRef<HTMLInputElement>(null);

  // Focus the value field when the inline override opens (accessible replacement
  // for the autoFocus attribute, which biome's a11y lint flags).
  useEffect(() => {
    valueRef.current?.focus();
    valueRef.current?.select();
  }, []);

  const save = () => {
    const value = parseOverride(raw, field.kind);
    if (value === null) {
      onCancel();
      return;
    }
    onSave(value, note);
  };

  return (
    <span className="flex items-center justify-end gap-1">
      <input
        ref={valueRef}
        type="text"
        inputMode="decimal"
        aria-label={`Override value for ${field.label}`}
        className="num w-24 rounded border border-accent bg-paper px-1.5 py-0.5 text-sm focus:ring-1 focus:ring-accent focus:outline-none"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <input
        type="text"
        placeholder="why?"
        aria-label={`Reason for overriding ${field.label}`}
        className="w-20 rounded border border-rule bg-paper px-1.5 py-0.5 text-xs focus:border-accent focus:outline-none"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button type="button" className="text-xs font-semibold text-ok hover:underline" onClick={save}>
        ✓
      </button>
      <button type="button" className="text-xs text-muted hover:text-error" onClick={onCancel}>
        ✕
      </button>
    </span>
  );
}

export function formatDerived(value: number, kind: DerivedField['kind'], plain = false): string {
  if (!Number.isFinite(value)) return '—';
  if (kind === 'rate') return plain ? String(Math.round(value * 1e4) / 100) : `${(value * 100).toFixed(2)}%`;
  if (kind === 'psf') return plain ? value.toFixed(2) : `$${value.toFixed(2)}`;
  if (plain) return String(Math.round(value));
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function parseOverride(raw: string, kind: DerivedField['kind']): number | null {
  const cleaned = raw.replace(/[$,\s%]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === 'rate') return n / 100; // input is a percent
  if (kind === 'count') return Math.round(n);
  return n;
}
