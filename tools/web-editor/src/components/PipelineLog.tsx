import type { ParsedUWFile } from '@uwmd/core/browser';

interface LogEntry {
  timestamp?: string;
  agent_or_actor?: string;
  event_type?: string;
  status?: string;
  notes?: string;
}

export function PipelineLog({ parsed }: { parsed: ParsedUWFile }) {
  const entries: LogEntry[] = parsed.pipeline_log.flatMap((block) => {
    const e = (block.content as { entries?: LogEntry[] }).entries;
    return Array.isArray(e) ? e : [];
  });

  return (
    <div className="max-w-4xl">
      <h2 className="font-display text-xl text-accent">Pipeline Log</h2>
      <p className="mt-1 text-sm text-muted">
        Append-only provenance trail — {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}.
      </p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-accent text-left text-[0.68rem] tracking-wider text-white uppercase">
            <th className="px-3 py-1.5">Timestamp</th>
            <th className="px-3 py-1.5">Actor</th>
            <th className="px-3 py-1.5">Event</th>
            <th className="px-3 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={`${e.timestamp ?? ''}|${e.agent_or_actor ?? ''}|${e.event_type ?? ''}|${e.status ?? ''}`}
              className="border-b border-rule odd:bg-paper even:bg-canvas"
            >
              <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                {e.timestamp?.slice(0, 19).replace('T', ' ') ?? '—'}
              </td>
              <td className="px-3 py-1.5">{e.agent_or_actor ?? '—'}</td>
              <td className="px-3 py-1.5">{e.event_type ?? '—'}</td>
              <td className="px-3 py-1.5">{e.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
