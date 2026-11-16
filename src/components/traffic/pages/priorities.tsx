import { InvestigationDesk } from "./investigation-desk";
import { useState } from "react";
import { useApi, fmt, type Filters, type Dict } from "../api";
import { Panel, Empty, Loading } from "../ui";

export function Priorities({ filters, explore, simulate }: { filters: Filters; explore: (road: string, block: string) => void; simulate: () => void }) {
  const result = useApi("priorities", filters);
  const [limit, setLimit] = useState(5);
  if (result.error) return <div className="error-banner">{result.error}<button onClick={result.reload}>Retry</button></div>;
  if (!result.data) return <Loading>Comparing road and time-block evidence…</Loading>;
  const data = result.data;
  const rows: Dict[] = data.rows || [];
  const conditioned = !!(filters.congestion || filters.timeBlock);
  return <>
    <Panel title="Where has congestion worsened?" sub="The selected observed date range is split at its calendar midpoint. Each half needs 30 readings across 7 dates.">
      <p>These are historical period comparisons, not live alerts or proof that an intervention caused a change. Weather and demand may differ between periods.</p>
      {(data.changes || []).filter((r: Dict) => Number(r.change_pp) > 0).slice(0,5).map((r: Dict) => <div key={`${r.road_id}-${r.time_block}`} style={{padding:"12px 0",borderBottom:"1px solid #e1e8ef"}}>
        <strong>{r.road_name} ? {r.time_block}: +{fmt(r.change_pp,1)} percentage points</strong>
        <p>High congestion rose from {fmt(r.earlier_high,1)}% ({fmt(r.earlier_n)} readings) to {fmt(r.later_high,1)}% ({fmt(r.later_n)} readings).</p>
        <small>Earlier: {r.first_date} through {r.midpoint}; later: after {r.midpoint} through {r.last_date}.</small>
        <p><button className="btn" onClick={() => explore(String(r.road_id),r.time_block)}>Inspect this change</button></p>
      </div>)}
      {!(data.changes || []).some((r: Dict) => Number(r.change_pp)>0) && <Empty>No increase with sufficient evidence in both periods.</Empty>}
    </Panel>
    <InvestigationDesk filters={filters} findings={rows} />
    <Panel title="Which road and time period deserves attention first?" sub="A shortlist for investigation, calculated from your active MySQL import.">
      <p>Ranked by the share of readings labelled High congestion, then the number of High readings. A busy road alone is not treated as a problem.</p>
      <p>Only groups with at least 30 readings across 7 distinct dates and at least one High reading qualify. These are screening rules, not validated traffic standards. {fmt(data.excluded)} of {fmt(data.groups)} groups did not qualify.</p>
      {conditioned && <p role="status"><strong>Filtered comparison:</strong> a congestion filter conditions the percentages; a time-block filter removes the other-block baseline. Clear these filters for a broader priority assessment.</p>}
      <p>Historical observations describe this dataset. Repeated readings on a date are not independent evidence, and these findings do not establish causes or current road conditions.</p>
    </Panel>
    {!rows.length && <Empty>No groups meet the evidence rules. Widen your filters; no priority is inferred from insufficient data.</Empty>}
    {rows.slice(0, limit).map((r, i) => {
      const baseline = Number(r.other_readings) >= 30 && r.other_high_percent !== null;
      const gap = baseline ? Number(r.high_percent) - Number(r.other_high_percent) : null;
      return <Panel key={`${r.road_id}-${r.time_block}`} title={`${i + 1}. ${r.road_name} · ${r.time_block}`} sub={`${r.area} | ${String(r.first_date).slice(0,10)} to ${String(r.last_date).slice(0,10)}`}>
        <h3>{fmt(r.high_percent, 1)}% of readings report High congestion</h3>
        <p>{fmt(r.high_readings)} of {fmt(r.readings)} readings across {fmt(r.days)} observed dates. Mean reported volume per reading: {fmt(r.mean_volume, 1)}; this is not a count of unique vehicles.</p>
        <p><strong>Compared with this road’s other time blocks: </strong>{baseline ? `${fmt(r.other_high_percent,1)}% High congestion across ${fmt(r.other_readings)} readings. This block is ${fmt(Math.abs(gap!),1)} percentage points ${gap! >= 0 ? "higher" : "lower"}.` : "Insufficient comparison data (at least 30 other-block readings required)."}</p>
        <p>Mean reported speed: {fmt(r.mean_speed,1)}{baseline && r.other_speed !== null ? ` versus ${fmt(r.other_speed,1)} in other blocks` : ""}. The source does not document speed units.</p>
        <p><strong>What to investigate: </strong>{gap !== null && gap >= 10 ? "Check time-specific demand, signal plans and junction queues during this block. Its congestion share exceeds the same road’s other blocks by at least 10 percentage points." : "Check whether congestion persists across the road’s day and inspect capacity, incidents and roadwork before choosing an intervention. This result alone does not isolate a time-specific cause."}</p>
        <p><strong>How to validate: </strong>Review date coverage and individual observations, then collect current junction counts and queue measurements before recommending signal changes.</p>
        <button className="btn" onClick={() => explore(String(r.road_id), r.time_block)}>Explore this road and time block</button>
      </Panel>;
    })}
    {rows.length > limit && <button className="btn" onClick={() => setLimit(limit + 5)}>Show more priorities ({rows.length - limit} remaining)</button>}
    <Panel title="Test a strategy after identifying a problem" sub="The simulation is a controlled experiment, not a prediction for the shortlisted roads.">
      <p>Compare fixed and adaptive timing under surge, balanced, dataset peak and off-peak demand. Check waiting time and throughput in both winning and losing scenarios. Only demand intensity in dataset scenarios comes from historical data; directions and arrivals are generated.</p>
      <button className="btn" onClick={simulate}>Open signal simulation</button>
    </Panel>
    <Panel title="Inspect the evidence query" sub={`Active import ${data.import_id}. All selected filters apply to both the hotspot and its comparison.`}>
      <details><summary>Show SQL and bound parameters</summary><pre style={{overflowX:"auto",whiteSpace:"pre-wrap"}}>{data.sql}</pre><pre>{JSON.stringify(data.parameters)}</pre></details>
    </Panel>
  </>;
}
