// Edit provenance + mode controls. Collapsed by default (sensible manual-edit
// defaults); expand to stamp a different actor/source/confidence, attach a
// note, mark human-review-required, or switch to append (supersede) mode so
// edits archive the prior version instead of overwriting it.

import { useState } from 'react';
import type { EditSettings } from '../edits.js';

export function EditModeBar(props: {
  settings: EditSettings;
  onChange: (patch: Partial<EditSettings>) => void;
}) {
  const { settings, onChange } = props;
  const [open, setOpen] = useState(false);

  const nonDefault =
    settings.mode !== 'replace' ||
    settings.confidence !== 'high' ||
    settings.actor !== 'web-editor' ||
    settings.source !== 'manual' ||
    settings.humanReview ||
    settings.notes.trim() !== '';

  return (
    <div className="border-b border-rule bg-paper text-xs">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-canvas"
      >
        <span className="text-muted">{open ? '▾' : '▸'}</span>
        <span className="font-semibold">Edit provenance</span>
        <span className="text-muted">
          {settings.mode === 'supersede' ? 'append (supersede)' : 'replace in place'} ·{' '}
          {settings.confidence} · {settings.actor}
        </span>
        {nonDefault && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-warn">modified</span>}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-rule px-4 py-3 sm:grid-cols-4">
          <Labeled label="Mode">
            <select
              className="input"
              value={settings.mode}
              onChange={(e) => onChange({ mode: e.target.value as EditSettings['mode'] })}
            >
              <option value="replace">Replace in place</option>
              <option value="supersede">Append (supersede)</option>
            </select>
          </Labeled>
          <Labeled label="Confidence">
            <select
              className="input"
              value={settings.confidence}
              onChange={(e) => onChange({ confidence: e.target.value as EditSettings['confidence'] })}
            >
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </Labeled>
          <Labeled label="Actor">
            <input
              className="input"
              value={settings.actor}
              onChange={(e) => onChange({ actor: e.target.value })}
            />
          </Labeled>
          <Labeled label="Source">
            <input
              className="input"
              value={settings.source}
              onChange={(e) => onChange({ source: e.target.value })}
            />
          </Labeled>
          <Labeled label="Note (→ _meta.notes)" wide>
            <input
              className="input"
              value={settings.notes}
              placeholder="optional reason for this edit"
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </Labeled>
          <Labeled label="Human review">
            <label className="flex items-center gap-2 py-1.5">
              <input
                type="checkbox"
                checked={settings.humanReview}
                onChange={(e) => onChange({ humanReview: e.target.checked })}
              />
              <span>require review</span>
            </label>
          </Labeled>
          <p className="col-span-2 self-center text-muted sm:col-span-1">
            {settings.mode === 'supersede'
              ? 'Edits append a new version; the prior is archived in History.'
              : 'Edits update the current block in place.'}
          </p>
        </div>
      )}
    </div>
  );
}

function Labeled({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`block ${wide ? 'col-span-2' : ''}`}>
      <span className="mb-1 block font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}
