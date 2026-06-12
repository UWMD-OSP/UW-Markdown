import { useState } from 'react';
import type { InitOptions, AssetClass } from '@uwmd/core/browser';
import { ASSET_CLASSES, TIERS } from '../catalog.js';

export function NewDealDialog(props: {
  onCreate: (opts: InitOptions) => void;
  onClose: () => void;
}) {
  const [dealName, setDealName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [assetClass, setAssetClass] = useState<string>('multifamily');
  const [tier, setTier] = useState<string>('screener');

  const create = () => {
    props.onCreate({
      dealName: dealName.trim() || 'Untitled Deal',
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      assetClass: assetClass as AssetClass,
      tier: tier as 'screener' | 'analyst',
    });
    props.onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
      onClick={props.onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <dialog
        open
        aria-label="New deal"
        className="static w-[26rem] rounded border border-rule bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') create();
        }}
      >
        <h2 className="font-display text-lg text-accent">New Deal</h2>
        <p className="mt-1 text-xs text-muted">
          Scaffolds a blank .uw.md via <code>generateBlankUWFile</code> — canonical section order,
          empty data stubs, initial pipeline-log entry.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Deal name">
            <input
              className="input"
              value={dealName}
              placeholder="Parkview Apartments — Glendale, AZ"
              onChange={(e) => setDealName(e.target.value)}
            />
          </Field>
          <Field label="Property address">
            <input
              className="input"
              value={address}
              placeholder="1234 W Camelback Rd"
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="State">
              <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset class">
              <select className="input" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier">
              <select className="input" value={tier} onChange={(e) => setTier(e.target.value)}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={props.onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90"
            onClick={create}
          >
            Create
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}
