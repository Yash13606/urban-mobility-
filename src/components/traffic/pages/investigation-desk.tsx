import { useState } from "react";
import { useApi, postApi, fmt, type Filters, type Dict } from "../api";
import { Panel, Empty } from "../ui";

export function InvestigationDesk({ filters, findings }: { filters: Filters; findings: Dict[] }) {
  const plans = useApi("plans");
  const [selection, setSelection] = useState("");
  const [owner, setOwner] = useState("");
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function mutate(body: Dict) {
    setBusy(true); setMessage("");
    try { const data = await postApi(body); plans.setData(data); setMessage("Saved to MySQL."); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  const chosen = findings.find(r => `${r.road_id}|${r.time_block}` === selection);
  function download() {
    const text = (plans.data?.rows || []).map((r: Dict) => {
      const f = r.evidence.finding;
      return `Investigation #${r.plan_id}: ${f.road_name} / ${f.time_block}\nStatus: ${r.status}\nOwner: ${r.owner}\nNext action: ${r.next_action}\nEvidence: ${f.high_readings}/${f.readings} High readings across ${f.days} dates; import ${r.evidence.import_id}\nSnapshot: ${r.evidence.recorded_at}\nFilters: ${JSON.stringify(r.evidence.filters)}\n`;
    }).join("\n");
    const url = URL.createObjectURL(new Blob(["Traffic investigation brief\nHistorical evidence; actions are proposed, not proven outcomes.\n\n" + text], {type:"text/plain"}));
    const link = document.createElement("a"); link.href=url; link.download="traffic-investigation-brief.txt"; link.click(); URL.revokeObjectURL(url);
  }
  return <Panel title="Turn a finding into an investigation" sub="Save an evidence snapshot, assign responsibility and track follow-up. Plans remain available after refresh.">
    <form onSubmit={e => {e.preventDefault(); if(chosen) void mutate({action:"savePlan",filters,road:chosen.road_id,timeBlock:chosen.time_block,owner,next_action:action});}} style={{display:"grid",gap:12}}>
      <label>Evidence to investigate <select required value={selection} onChange={e=>setSelection(e.target.value)} style={{width:"100%",padding:10}}><option value="">Choose a qualified road and time block</option>{findings.map(r=><option key={`${r.road_id}|${r.time_block}`} value={`${r.road_id}|${r.time_block}`}>{r.road_name} / {r.time_block} — {fmt(r.high_percent,1)}% High</option>)}</select></label>
      <label>Responsible person or team <input required maxLength={120} value={owner} onChange={e=>setOwner(e.target.value)} placeholder="e.g. Project review team" style={{width:"100%",padding:10}} /></label>
      <label>Next action and evidence to collect <textarea required maxLength={1000} value={action} onChange={e=>setAction(e.target.value)} placeholder="e.g. Review evening observations, then collect current queue lengths before considering a signal trial." style={{width:"100%",padding:10,minHeight:80}} /></label>
      <button className="btn primary" disabled={busy||!chosen}>Save investigation</button>
    </form>
    <p role="status">{message}</p>
    {plans.error && <p role="alert">{plans.error}<button className="btn" onClick={plans.reload}>Retry</button></p>}
    {!plans.data && !plans.error && <p>Loading saved investigations…</p>}
    {plans.data?.rows?.length===0 && <Empty>No saved investigations yet.</Empty>}
    {(plans.data?.rows || []).map((r: Dict)=><article key={r.plan_id} style={{padding:"16px 0",borderTop:"1px solid #e1e8ef"}}>
      <h3>{r.evidence.finding.road_name} · {r.evidence.finding.time_block}</h3>
      <p>{r.next_action}</p><p>Owner: {r.owner} | Saved evidence: {fmt(r.evidence.finding.high_percent,1)}% High, {fmt(r.evidence.finding.readings)} readings | Import {r.evidence.import_id}</p>
      <label>Status <select value={r.status} disabled={busy} onChange={e=>void mutate({action:"planStatus",id:r.plan_id,status:e.target.value})}>{["Open","Investigating","Reviewed"].map(s=><option key={s}>{s}</option>)}</select></label>
      <small> Reviewed means the investigation was reviewed; it does not mean congestion was fixed.</small>
    </article>)}
    {!!plans.data?.rows?.length && <button className="btn" onClick={download}>Download investigation brief</button>}
    <p>Saved plans cover all filters and imports; each retains its original evidence. The latest 200 plans are shown.</p>
  </Panel>;
}
