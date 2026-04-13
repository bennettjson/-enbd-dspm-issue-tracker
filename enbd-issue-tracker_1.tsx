// @ts-nocheck
import { useState, useEffect, useCallback } from "react";

// ─── PERMANENT STORAGE KEYS — NEVER CHANGE ───────────────────────────────────
const SK = {
  overrides: "enbd-v4-overrides",
  comments:  "enbd-v4-comments",
  changelog: "enbd-v4-changelog",
  user:      "enbd-v4-user",
  apiKey:    "enbd-v4-apikey",
  lastVisit: "enbd-v4-lastvisit",
  added:     "enbd-v4-added",
};

const SF_BASE = "https://forcepoint2.lightning.force.com/lightning/r/Case";

// ─── SUPABASE (shared state for static/GitHub Pages deployment) ──────────────
let SUPA_URL='', SUPA_KEY=''
try { SUPA_URL=import.meta.env.VITE_SUPABASE_URL||''; SUPA_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||''; } catch {}

const supaHdr=()=>({ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, 'Content-Type':'application/json' });
const supaGet=async key=>{
  if(!SUPA_URL||!SUPA_KEY) return null;
  try {
    const r=await fetch(`${SUPA_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,{headers:supaHdr()});
    const d=await r.json(); return d[0]?.value||null;
  } catch { return null; }
};
const supaSet=async(key,val)=>{
  if(!SUPA_URL||!SUPA_KEY) return false;
  try {
    const r=await fetch(`${SUPA_URL}/rest/v1/kv_store`,{method:'POST',headers:{...supaHdr(),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({key,value:val,updated_at:new Date().toISOString()})});
    return r.ok;
  } catch { return false; }
};

// Storage priority: window.storage (Claude artifact) → Supabase (shared/GitHub Pages) → localStorage (fallback)
const lsGet=async(key,shared=true)=>{
  try { if(window.storage) { const r=await window.storage.get(key,shared); return r?.value&&r.value!=="null"?JSON.parse(r.value):null; } } catch {}
  if(shared) { const v=await supaGet(key); if(v&&v!=="null") try { return JSON.parse(v); } catch {} }
  try { const v=localStorage.getItem(key); return v&&v!=="null"?JSON.parse(v):null; } catch { return null; }
};
const lsSet=async(key,val,shared=true)=>{
  const s=JSON.stringify(val);
  try { if(window.storage) { await window.storage.set(key,s,shared); return; } } catch {}
  if(shared) { const ok=await supaSet(key,s); if(ok) return; }
  try { localStorage.setItem(key,s); } catch(e) { console.error("storage write failed",key,e); }
};

// ─── ENG OPTIONS ─────────────────────────────────────────────────────────────
const ENG_OPTIONS = [
  { value: "",              label: "— Unset",           color: "#718096" },
  { value: "required",     label: "🔴 Eng Required",    color: "#C62828" },
  { value: "not-required", label: "🟢 Not Required",    color: "#166534" },
  { value: "under-review", label: "🟡 Under Review",    color: "#B45309" },
  { value: "fr",           label: "🔵 Feature Request", color: "#1D4ED8" },
];
const engLabel = v => ENG_OPTIONS.find(o => o.value === v) || ENG_OPTIONS[0];
const fmtTs  = () => new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtDate = ts => { try { return new Date(ts).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return ts||""; }};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED = [
  {"case":"00985095","sfId":"500a6000014yZEcAAM","subject":"[ENBD] High False Positives in Driver's Licence","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"07 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":"Moving to In Progress while PS completes action.","latestSfNote":"Moving to In Progress while PS completes action — 10 Apr 2026","desc":"After upgrade, UAE/Singapore DL detectors firing on country name alone. Awaiting mesh update enbd-3.20.0 (GS-3704) or Classifier 4.0.","sfCategory":"open","isUpgrade":true,"suggestion":"Root cause: DL detectors in pre-3.20 AI Mesh use keyword-only proximity model — country name triggers classifier without co-presence of a licence number pattern. Fix: (1) Apply mesh update enbd-3.20.0 (GS-3704 Done) once change control approved. (2) Interim: increase minimum proximity distance for country keyword trigger or add NOT clause requiring alphanumeric licence pattern within token window."},
  {"case":"00985090","sfId":"500a6000014ylkQAAQ","subject":"[ENBD] High False Positives in Passport","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"07 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":"Waiting for release of 3.4 DLP classifiers — 21 Apr 2026.","latestSfNote":"Waiting for 3.4 DLP classifiers — 21 Apr 2026 (INTERNAL)","desc":"After upgrade, Brazil/Indonesia/Tunisian Passport detectors firing on country name alone.","sfCategory":"open","isUpgrade":true,"suggestion":"Same root cause as 00985095. Fix: (1) Await Classifier 4.0 due 21 Apr. (2) Add proximity content detector requiring passport number format within 200 tokens of country keyword. (3) Review AI Mesh Data Attribute weights for Travel Documents — raise minimum confidence threshold."},
  {"case":"00983655","sfId":"500a6000014E33HAAS","subject":"UTC time on reports needs GST conversion","status":"Resolution Provided","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"component":"Configuration - DSPM","owner":"Prashanth Gowda","resNotes":"FR202604-1780 raised. Excel formula workaround: =A1+TIME(4,0,0).","latestSfNote":"FR202604-1780 raised. Excel workaround provided — 07 Apr 2026","desc":"Report timestamps in UTC; ENBD requires GST (UTC+4). FR raised for native timezone export.","sfCategory":"open","isUpgrade":true,"suggestion":"Platform limitation — DSPM stores all timestamps in UTC. FR202604-1780 is the correct path. Excel workaround: =A1+TIME(4,0,0). GQL analytics board widgets also return UTC — display-layer offset can be applied in widget JS formatting if available."},
  {"case":"00983487","sfId":"500a6000014AnWAAA0","subject":"[ENBD] Incorrect classification & FN — Credit Card numbers","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":"Awaiting customer change control. Mesh update enbd-3.20.0 available (GS-3704).","latestSfNote":"Awaiting Customer Change control — mesh update enbd-3.20.0 (GS-3704) — 10 Apr 2026","desc":"PCI Filter hits not triggering Luhn/PCI tag. Documents classified Internal not Confidential.","sfCategory":"open","isUpgrade":true,"suggestion":"Two issues: (1) Luhn validation not firing — check PCI detector JSON filter_list entry should reference Hard Filter with Luhn validation. (2) Mesh 3.20.0 revised PCI Data Attribute weighting — applying it is primary fix. Interim: verify PCI Hard Filter queryId and confirm Luhn validation in processing chain via scan-manager logs."},
  {"case":"00983481","sfId":"500a6000014A1IAAA0","subject":"[ENBD] Sensitive Docs classified as NULL","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":"Awaiting customer change control. Mesh update enbd-3.20.0 available (GS-3704).","latestSfNote":"Awaiting Customer Change control — mesh update enbd-3.20.0 (GS-3704) — 10 Apr 2026","desc":"Docs with detector hits for mobile/card/email/passport receiving NULL classification.","sfCategory":"open","isUpgrade":true,"suggestion":"NULL classification despite detector hits = broken mapping node. Pull scan-data-manager logs for attribute_score entries. If scores present but label NULL, the mapping node is the issue. Mesh 3.20.0 revised the mapping node for these attributes — applying it is the direct fix."},
  {"case":"00983480","sfId":"500a6000014B645AAC","subject":"[ENBD] FP in Data Attributes — AI Mesh Refinement Required","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":"Awaiting customer change control. Mesh update enbd-3.20.0 available (GS-3704).","latestSfNote":"Awaiting Customer Change control — mesh update enbd-3.20.0 (GS-3704) — 10 Apr 2026","desc":"HR/Legal/Confidential/Financial attributes firing on docs with no sensitive content.","sfCategory":"open","isUpgrade":true,"suggestion":"Over-broad keyword matching in pre-3.20 AI Mesh. Fix: (1) Mesh 3.20.0 primary fix. (2) Interim: increase minimum_evidence_count for affected attributes from 1 to 3. (3) Check for templated docs where header/footer vocabulary alone triggers attributes — use path exclusion."},
  {"case":"00983397","sfId":"500a60000144wAlAAI","subject":"[ENBD] Discrepancy in unclassified file counts across dashboards","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"01 Apr 2026","closed":null,"component":null,"owner":"Husain Rampurwala","resNotes":null,"latestSfNote":null,"desc":"Enterprise Search: 3,310 unclassified vs Scan Config: 1,380. Delta of 1,930.","sfCategory":"open","isUpgrade":true,"suggestion":"Expected behaviour — Enterprise Search reflects cataloguing index (all discovered files) while Scan Config reflects classification queue. Run GQL query against unclassified cohort segmented by file_type and last_modified to decompose the 1,930 gap."},
  {"case":"00983062","sfId":"500a6000013yL5lAAE","subject":"Classification not progressing — Platform 3.3.1716","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"01 Apr 2026","closed":null,"component":"Server - DSPM","owner":"Prashanth Gowda","resNotes":"Reviewing logs — zip password shared with Husain (PS).","latestSfNote":"Will review logs and update — 07 Apr 2026","desc":"Classification halting for 16–18 hours on OneDrive users. UI shows Completed when still running.","sfCategory":"open","isUpgrade":true,"suggestion":"OneDrive connector OAuth token expiry/Graph API throttling at ~16hr mark. Check connector-generic logs for HTTP 429 or 401. Related: DSPM-293 (Scan Pipeline Stabilisation — In Progress)."},
  {"case":"00976790","sfId":"500a6000011DESIAA4","subject":"VA and Compliance scan — patching/hardening DSPM VMs","status":"Closed - Unconfirmed Resolved","priority":"Severity 3","isClosed":true,"created":"16 Mar 2026","closed":"28 Mar 2026","component":"Server - DSPM","owner":"Nathan Borowicz","resNotes":"Customer owns VM/OS — no Forcepoint approval needed.","latestSfNote":null,"desc":"Patching and hardening of DSPM UAT and Production VMs requested.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"✅ Expected behaviour — ENBD owns VM/OS patching. Caveat: hardening that removes kernel modules required by Rancher can silently break pod-to-pod communication. Recommend ENBD runs DSPM health check after each hardening cycle."},
  {"case":"00976781","sfId":"500a6000011CwYfAAQ","subject":"File Transfer through Rancher — Justification requested","status":"Resolution Provided","priority":"Severity 4","isClosed":false,"created":"16 Mar 2026","closed":null,"component":"Server - DSPM","owner":"Sri Shyaam R","resNotes":"Help article shared.","latestSfNote":null,"desc":"Multiple file type extensions requiring justification for Rancher URL transfer.","sfCategory":"open","isUpgrade":false,"suggestion":"Expected Rancher security behaviour. No platform change required. If operationally disruptive for specific trusted file types, Rancher ingress policy can whitelist by MIME type via DSPM platform admin."},
  {"case":"00976115","sfId":"500a6000010uClzAAE","subject":"SMB Scan not progressing","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"13 Mar 2026","closed":null,"component":"Connectivity - DSPM","owner":"Joseph Herlihy","resNotes":null,"latestSfNote":null,"desc":"SMB shared folder scan stops intermittently and gets stuck for hours. RCA requested.","sfCategory":"open","isUpgrade":false,"suggestion":"Three likely causes: (1) SMB session timeout — check Windows Event Viewer for session disconnect events at stall time. (2) Permission boundary — service account loses access on subfolder with different ACLs. (3) Junction points causing crawler loop. Related: EI-41970 (SMB Scan Stuck After Platform Upgrade)."},
  {"case":"00975519","sfId":"500a6000010dIkfAAE","subject":"ENBD | Release notes — blocking production upgrade","status":"Awaiting Internal Response","priority":"Severity 3","isClosed":false,"created":"11 Mar 2026","closed":null,"component":"Server - DSPM","owner":"Joseph Herlihy","resNotes":null,"latestSfNote":null,"desc":"Security team requiring formal release notes, dependency list, rollback steps before approving production upgrade.","sfCategory":"open","isUpgrade":false,"suggestion":"CBUAE-regulated bank requires formal CAR. Prepare: Security Advisory + Dependency Manifest from Product, CAR covering component versions, Rancher/K8s dependency delta, downtime window, rollback procedure (VM snapshot restore + Rancher re-point — no native one-click rollback). Raise as PS tooling FR with Sanjay Balan."},
  {"case":"00973723","sfId":"500a600000zvhpyAAA","subject":"AD integration failed — SSL Handshake on Keycloak","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"06 Mar 2026","closed":null,"component":"Server - DSPM","owner":"Marek Przepiorka","resNotes":"Fixed unknown error via sAMAccountName. 0 synced / 1000 failed — under investigation.","latestSfNote":"Fixed unknown error via sAMAccountName. 0 synced, 1000 failed — 13 Apr 2026","desc":"Keycloak LDAP — unknown error fixed but user sync showing 0 synced / 1000 failed.","sfCategory":"open","isUpgrade":false,"suggestion":"LDAP bind succeeding but user attribute mapping failing. Likely: (1) Search base DN too broad — add filter (objectClass=person)(objectCategory=user). (2) sAMAccountName values with special chars in Arabic-locale AD — check Keycloak admin mappers for validation errors. (3) Non-standard UPN suffix — verify Keycloak username LDAP attribute is sAMAccountName not userPrincipalName."},
  {"case":"00972259","sfId":"500a600000zNsB7AAK","subject":"ENBD | Stop/kill OneDrive scan — 34M files stuck","status":"Closed - Unconfirmed Resolved","priority":"Severity 2","isClosed":true,"created":"03 Mar 2026","closed":"28 Mar 2026","component":"Classification - DSPM","owner":"Prashanth Gowda","resNotes":"PS team applied Dev team steps. Fix in DSPM v3.4.","latestSfNote":null,"desc":"Scan stuck in incomplete state with 34M files — no UI option to cancel.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"Fix confirmed in DSPM v3.4. Workaround was direct Flink job termination via Rancher Flink dashboard. Confirm with ENBD that post-upgrade scan can be stopped cleanly via UI and close."},
  {"case":"00971362","sfId":"500a600000ytbdvAAA","subject":"ENBD | OneDrive discovery: 34M of 42M (8M gap)","status":"Resolution Provided","priority":"Severity 3","isClosed":false,"created":"27 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Marek Przepiorka","resNotes":"Resolution provided.","latestSfNote":null,"desc":"42M files in OneDrive but DSPM only discovering 34M. Cataloguing stopped after 48hrs.","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: DSPM-320 (Ability to scan multiple SharePoint and OneDrive objects — Open). 8M gap consistent with Graph API delta token expiry. Verify OneDrive connector service account has Sites.Read.All and Files.Read.All at tenant level."},
  {"case":"00970726","sfId":"500a600000yihEqAAI","subject":"DSPM UI shows incorrect scan status","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"26 Feb 2026","closed":null,"component":"Connectivity - DSPM","owner":"Prashanth Gowda","resNotes":"Confirmed post-upgrade. Status shows Complete after Discovery not after Classification.","latestSfNote":"UI still shows wrong scan status post-upgrade — 03 Apr 2026","desc":"Scan status shows Completed when classification still running.","sfCategory":"open","isUpgrade":false,"suggestion":"Confirmed platform bug pre-3.4. Fix: DSPM v3.4 adds composite status. Interim: use GQL analytics board to monitor actual classification progress. Related: DSPM-294 (Align classification settings pages — In Refinement)."},
  {"case":"00968980","sfId":"500a600000y7QsrAAE","subject":"Failure in performing full OneDrive scan","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"22 Feb 2026","closed":null,"component":"Configuration - DSPM","owner":"Nagaraju Bandi","resNotes":"Hussain to confirm problem scope — Dev/PM review may result in FR.","latestSfNote":"Hussain to confirm problem scope — 10 Apr 2026","desc":"Scan stopped abruptly after 22M files. No per-user/per-department scan scope.","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: ROC-1656 (flink-job-manager OOM killed — To Do), DSPM-293 (Scan Pipeline Stabilisation — In Progress), DSPM-320 (multi-object OneDrive scope — Open). At 22M files flink-job-manager pod likely OOM-killed. Check Rancher pod restart history at abort time."},
  {"case":"00967567","sfId":"500a600000xCBCDAA4","subject":"[ENBD] Slowness in Scan","status":"Closed","priority":"Severity 3","isClosed":true,"created":"17 Feb 2026","closed":"03 Apr 2026","component":"Classification - DSPM","owner":"Kevin O'Donovan","resNotes":"Explanation provided. Archived.","latestSfNote":null,"desc":"Reduction in scan speed on second day of full OneDrive scan.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — expected behaviour. DSPM scan speed reduces on day 2+ as initial crawl covers full delta. If sustained slowness beyond day 2, check for scan-data-manager memory pressure."},
  {"case":"00965113","sfId":null,"subject":"[ENBD] FR — File names in compressed folders","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"10 Feb 2026","closed":"20 Feb 2026","component":"Server - DSPM","owner":"Kevin O'Donovan","resNotes":null,"latestSfNote":null,"desc":"Feature request: report file name of sensitive file inside 7z/tar/zip.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — No existing Jira ticket found. Platform currently classifies the archive as a whole without surfacing individual file names within nested archives. Raise as product FR — requires changes to KeyView extraction pipeline."},
  {"case":"00965106","sfId":"500a600000w0S9TAAU","subject":"[ENBD] FP and FN — Nationality detector","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"10 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Kevin O'Donovan","resNotes":"Post-upgrade: FN in Email, UAE Mobile, PCI tag FP. Awaiting mesh update / change control.","latestSfNote":"FN in Nationality, Email, UAE Mobile. PCI tag FP. Awaiting change control — 03 Apr 2026","desc":"Keyword 'nationality' triggering DOB detector. Post-upgrade FN in Email, UAE Mobile. PCI tag FP.","sfCategory":"open","isUpgrade":false,"suggestion":"'nationality' keyword triggers DOB detector via proximity collision with date-format strings in KYC forms. Fix: add 'nationality' as NOT-proximity term in DOB detector config. Post-upgrade FN in Email/UAE Mobile: share sample documents with Engineering (Vlad) to recalibrate thresholds for ENBD's document corpus."},
  {"case":"00965097","sfId":"500a600000w0wiYAAQ","subject":"[ENBD] FP and FN — GCC ID, Date of Birth, Emirates ID","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"10 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Kevin O'Donovan","resNotes":"Post-upgrade: FN in UAE ID, CC, IBAN, Passport, Mobile. FP in DOB. Awaiting mesh update.","latestSfNote":"Post-upgrade: FN in UAE ID, CC, IBAN, Passport, Mobile. FP in DOB — 03 Apr 2026","desc":"Random numbers identified as GCC ID. Emirates ID pattern 784-YYYY-XXXXXXX-C not matching.","sfCategory":"open","isUpgrade":false,"suggestion":"(1) GCC ID over-matching: tighten regex to require country-specific prefix. UAE Emirates ID: 784-\\d{4}-\\d{7}-\\d{1}. (2) Emirates ID FN: hyphens stripped during OCR yield 784YYYYXXXXXXX — detector must handle both variants. Note: eido/Lucene strips \\b anchors — use character class constraints."},
  {"case":"00965083","sfId":"500a600000w0JsXAAU","subject":"[ENBD] Report Export button — MS Exchange","status":"Closed","priority":"Severity 2","isClosed":true,"created":"10 Feb 2026","closed":"03 Apr 2026","component":"Server - DSPM","owner":"Kevin O'Donovan","resNotes":"FR202602-1581 logged.","latestSfNote":null,"desc":"Report export button absent in UI for MS Exchange connector.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — FR202602-1581 logged. Check FR status with Product for inclusion in upcoming release."},
  {"case":"00965012","sfId":"500a600000vvJjRAAU","subject":"OCR Feature inaccurate — FP and FN in image files","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Aravind Murugesan","resNotes":null,"latestSfNote":null,"desc":"BMP not supported. GIF/TIFF FN for Emirates ID, mobile, email, card. Wrong classification on MHT.","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: ROC-1607 (ocr-service fails to start under high topic volume — In Progress). BMP: confirmed unsupported. GIF/TIFF FN: Tesseract degrades on indexed-colour and multi-page formats. MHT: parsed as HTML text; embedded images not extracted for OCR — platform gap, FR required."},
  {"case":"00964962","sfId":null,"subject":"FR — Sensitive Data Discovery on Embedded Docs","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","component":"Server - DSPM","owner":"Aravind Murugesan","resNotes":"FR202602-1565/AFR1837 raised.","latestSfNote":null,"desc":"Discovery scans on documents embedded in files at multiple levels not working.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ FR logged — FR202602-1565/AFR1837. Multi-level embedded document extraction requires KeyView pipeline changes. Check FR status with Product."},
  {"case":"00964943","sfId":null,"subject":"FR — Sensitive Data in Folder and File names","status":"Closed","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","component":"Configuration - DSPM","owner":"Aravind Murugesan","resNotes":"Path detectors documentation shared.","latestSfNote":null,"desc":"Feature to detect sensitive data stored in folder or file names.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — path detectors available in platform. 31-detector enterprise path detector pack can be imported via JSON."},
  {"case":"00964827","sfId":null,"subject":"FR — Enhancement of scan reports","status":"Closed - Unconfirmed Resolved","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","component":"Server - DSPM","owner":"Sri Shyaam R","resNotes":"FR202602-1582 raised.","latestSfNote":null,"desc":"Report enhancements: last scan time, label timestamps, document owner.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"🔵 FR202602-1582 logged. Confirm with ENBD whether these enhancements are still required."},
  {"case":"00964812","sfId":null,"subject":"FR — Fingerprinting feature required","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"12 Feb 2026","component":"Server - DSPM","owner":"Prashanth Gowda","resNotes":"FR202602-1569 raised.","latestSfNote":null,"desc":"Fingerprinting to identify/track sensitive data via unique signatures.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1569 logged. Check FR roadmap status with Product."},
  {"case":"00964806","sfId":null,"subject":"FR — Discovery & Classification on Audio files","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","component":"Classification - DSPM","owner":"Nikhil Mahapatra","resNotes":"FR202602-1561 raised.","latestSfNote":null,"desc":"Discovery, classification and labelling on audio files for call centre records.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1561 logged. Audio classification requires speech-to-text pipeline integration. Significant engineering effort."},
  {"case":"00964802","sfId":null,"subject":"FR — Exclude folder path on scan configuration","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","component":"Configuration - DSPM","owner":"Pradeep Manjunath","resNotes":null,"latestSfNote":null,"desc":"Feature to exclude specific folders/paths/users from scanning.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — Path exclusion partially available via scan configuration scope settings. Check current platform capabilities before raising new FR."},
  {"case":"00964801","sfId":null,"subject":"[ENBD] FR — Monitor scan progress across all configs","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"21 Feb 2026","component":"Configuration - DSPM","owner":"Kevin O'Donovan","resNotes":null,"latestSfNote":null,"desc":"Single-pane scan progress view with total document count, completion % and ETA.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — GQL analytics board can partially address this via custom widget configuration. Raise as FR combining with 00983397 observability gap."},
  {"case":"00964798","sfId":null,"subject":"FR — Pause/Resume feature for scans","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","component":"Configuration - DSPM","owner":"Nikhil Mahapatra","resNotes":"FR202602-1562 raised.","latestSfNote":null,"desc":"Pause during peak hours and resume from point it was paused.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1562 logged. Pause/resume requires scan-manager checkpoint persistence. Check FR roadmap."},
  {"case":"00964796","sfId":null,"subject":"FR — Proxy config: Cloud vs on-prem connectors","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"12 Feb 2026","component":"Configuration - DSPM","owner":"Prashanth Gowda","resNotes":"FR202602-1568 raised.","latestSfNote":null,"desc":"Separate proxy settings for cloud and on-prem connectors.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1568 logged. Check FR roadmap."},
  {"case":"00964791","sfId":null,"subject":"[ENBD] FR — Error Logs on UI per datasource","status":"Closed","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","component":"Server - DSPM","owner":"Kevin O'Donovan","resNotes":"FR202602-1564 raised.","latestSfNote":null,"desc":"Error logs segregated per datasource, available on UI.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1564 logged. Error logs currently in Rancher pod logs only. Per-datasource error visibility would significantly reduce time to diagnose connector failures."},
  {"case":"00964779","sfId":null,"subject":"[ENBD] FR — Scan on multiple users/folders/accounts","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","component":"Connectivity - DSPM","owner":"Kevin O'Donovan","resNotes":"FR202602-1563 raised.","latestSfNote":null,"desc":"Single scan config for multiple users/AD groups/folders/accounts.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1563 logged. Related Jira: DSPM-320 (Ability to scan multiple SharePoint and OneDrive objects — Open). Monitor for inclusion in upcoming release."},
  {"case":"00964776","sfId":null,"subject":"FR — Reporting number of detector hits on docs","status":"Closed - Unconfirmed Resolved","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","component":"Configuration - DSPM","owner":"Sri Shyaam R","resNotes":"FR202602-1583 raised.","latestSfNote":null,"desc":"Report number of detector hits per document for risk scoring.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"🔵 FR202602-1583 logged. GQL analytics board can approximate this via aggregation queries on the incident index."},
  {"case":"00964769","sfId":null,"subject":"FR — Detector hit count (dup of 00964776)","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","component":"Configuration - DSPM","owner":"Nikhil Mahapatra","resNotes":"Duplicate.","latestSfNote":null,"desc":"Duplicate of 00964776.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Duplicate of 00964776."},
  {"case":"00964760","sfId":null,"subject":"FR — CyberArk Integration for datasource auth","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","component":"Configuration - DSPM","owner":"Nikhil Mahapatra","resNotes":"FR202602-1559 raised.","latestSfNote":null,"desc":"CyberArk integration for authentication to cloud and on-prem datasources.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1559 logged. Also achievable via Kubernetes secrets injection into Rancher connector pod config as an interim approach."},
  {"case":"00964754","sfId":null,"subject":"FR — Role-based masked preview of detected data","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","component":"Classification - DSPM","owner":"Nikhil Mahapatra","resNotes":"FR202602-1558 raised.","latestSfNote":null,"desc":"Role-based access for real-time masked data preview, not stored in DSPM DB.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1558 logged. RBAC-gated masked preview is a strong data governance requirement. Significant engineering effort. Check FR roadmap."},
  {"case":"00964738","sfId":null,"subject":"FR — Continuous Scanning on Data sources","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","component":"Configuration - DSPM","owner":"Nikhil Mahapatra","resNotes":"FR202602-1560 raised.","latestSfNote":null,"desc":"Continuous scanning to detect newly added/modified documents without manual intervention.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1560 logged. Graph API delta query endpoint for OneDrive/SharePoint already supports change notification webhooks. Check FR roadmap for inclusion timeline."},
  {"case":"00964729","sfId":null,"subject":"RBAC for Forcepoint DSPM UI","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","component":"Server - DSPM","owner":"Pradeep Manjunath","resNotes":null,"latestSfNote":null,"desc":"Role-based access control — separate role from DSPM admin for data visibility.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — RBAC in DSPM UI is a significant gap for regulated environments. Check if DSPM-158 Keycloak work included any RBAC scoping."},
  {"case":"00964722","sfId":"500a600000vorUvAAI","subject":"FP and FN — Email Address Detection","status":"Resolution Provided","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Pradeep Manjunath","resNotes":"Working-as-designed. Two detector explanation provided.","latestSfNote":null,"desc":"PII Soft Filter firing on literal text 'email address'. Actual email pattern detection inconsistent.","sfCategory":"open","isUpgrade":false,"suggestion":"Working-as-designed — PII Soft Filter includes 'email address' as proximity anchor. Ensure paired with Hard Filter requiring valid RFC 5322 email pattern in proximity. In eido/Lucene: @ must be escaped, no lookahead — use simplified pattern *@*.* with field-level constraints."},
  {"case":"00964710","sfId":"500a600000voj17AAA","subject":"Inconsistency — same document at multiple paths","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Kenneth Hernandez","resNotes":"Cataloguing vs classification behaviour explained.","latestSfNote":null,"desc":"File classified in 1 of 3 paths, catalogued only in remaining 2.","sfCategory":"open","isUpgrade":false,"suggestion":"✅ Expected behaviour — classification applied to canonical path (first discovery path wins). Not a bug. For reporting: advise querying by file_hash rather than path for unique classified file counts."},
  {"case":"00964706","sfId":"500a600000vofQXAAY","subject":"Scan not updated with Policy — file duplication","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"component":"Classification - DSPM","owner":"Prashanth Gowda","resNotes":null,"latestSfNote":null,"desc":"Same user scanned twice = 14K + 14K duplicated. Old policy results persist.","sfCategory":"open","isUpgrade":false,"suggestion":"✅ EXPECTED BEHAVIOUR — documented in GS-3704 (comment added 13 Apr 2026). Each time a new scan connection is established, DSPM generates a unique hexadecimal configurationId/connector key. No cross-configuration deduplication. Fix: identify and remove duplicate scan configuration, then initiate a full rescan under the single remaining configuration."},
  {"case":"00963148","sfId":null,"subject":"ENBD | Rancher Vulnerability — CBUAE Advisory","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"04 Feb 2026","closed":"14 Feb 2026","component":"Server - DSPM","owner":"Sri Shyaam R","resNotes":null,"latestSfNote":null,"desc":"CBUAE cyber advisory on high-severity Rancher TLS bypass CVE. ENBD asked if DSPM is affected.","sfCategory":"nrc","isUpgrade":false,"suggestion":"Check specific CVE against Rancher version in ENBD's DSPM cluster. If affected, ENBD's CISO team requires formal Vendor Security Advisory response. Coordinate with Engineering for official CVE impact statement."},
  {"case":"00941179","sfId":null,"subject":"Deleted Detectors Still Appearing in Rescan","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"28 Nov 2025","closed":"08 Dec 2025","component":"Configuration - DSPM","owner":"Nathan Borowicz","resNotes":null,"latestSfNote":null,"desc":"Deleted detectors reappear on rescan. Only workaround: delete entire scan — impractical at scale.","sfCategory":"nrc","isUpgrade":false,"suggestion":"Same root cause as 00964706 — configurationId-scoped architecture. Deleting a detector does not retroactively remove hits from existing scan result records. Only way is a full rescan with updated detector set. Recommend raising with Engineering for a 'rescan with updated policy' capability."}
];

// ─── COLOURS ─────────────────────────────────────────────────────────────────
const C = {
  teal:"#00AF9A",tealDk:"#007A6C",tealLt:"#E6F7F5",navy:"#023E8A",navyDk:"#011F4A",
  ink:"#1D252C",inkMid:"#4A5568",inkSoft:"#718096",bg:"#F8FAFB",surface:"#FFFFFF",
  border:"#E2E8F0",stripe:"#F1F5F9",red:"#C62828",redBg:"#FEF2F2",redBd:"#FECACA",
  amber:"#B45309",amberBg:"#FFFBEB",amberBd:"#FDE68A",green:"#166534",greenBg:"#F0FDF4",
  greenBd:"#BBF7D0",orange:"#C2410C",orangeBg:"#FFF7ED",orangeBd:"#FED7AA",
  nrcBg:"#FEF3C7",nrcBd:"#FCD34D",nrcTxt:"#92400E",purple:"#5B21B6",
  purpleBg:"#F5F3FF",purpleBd:"#DDD6FE",enbdGold:"#C9A84C",
};

const pill = (label, color) => {
  const m={red:{bg:C.redBg,color:C.red,border:C.redBd},amber:{bg:C.amberBg,color:C.amber,border:C.amberBd},green:{bg:C.greenBg,color:C.green,border:C.greenBd},orange:{bg:C.orangeBg,color:C.orange,border:C.orangeBd},grey:{bg:C.stripe,color:C.inkMid,border:C.border},nrc:{bg:C.nrcBg,color:C.nrcTxt,border:C.nrcBd},teal:{bg:C.tealLt,color:C.tealDk,border:C.teal},purple:{bg:C.purpleBg,color:C.purple,border:C.purpleBd}};
  const s=m[color]||m.grey;
  return <span style={{display:"inline-flex",alignItems:"center",padding:"1px 7px",borderRadius:20,fontSize:9,fontWeight:600,fontFamily:"monospace",whiteSpace:"nowrap",border:`1px solid ${s.border}`,background:s.bg,color:s.color}}>{label}</span>;
};

const statColor = s => {
  if(!s) return "grey"; const l=s.toLowerCase();
  if(l.includes("awaiting internal")||l.includes("in progress")) return "amber";
  if(l==="closed") return "green"; if(l.includes("no response")) return "nrc";
  if(l.includes("unconfirmed")) return "amber"; return "grey";
};

const TABS_FP   = [{id:"all",label:"All"},{id:"open",label:"Open"},{id:"upgrade",label:"🔺 Post-Upgrade"},{id:"closed",label:"Closed"},{id:"nrc",label:"NRC ⚠"},{id:"unconfirmed",label:"Unconfirmed"},{id:"resolved",label:"Resolved"},{id:"changelog",label:"📋 Change Log"}];
const TABS_ENBD = [{id:"all",label:"All Cases"},{id:"open",label:"Open"},{id:"upgrade",label:"🔺 Post-Upgrade"},{id:"closed",label:"Closed"},{id:"changelog",label:"📋 Change Log"}];

// ─── ROLE GATE ────────────────────────────────────────────────────────────────
function RoleGate({onSelect}) {
  const [name,setName]=useState(""); const [org,setOrg]=useState("");
  const handleEnter = async () => {
    if(!name.trim()||!org) return;
    const u={name:name.trim(),org};
    try { await window.storage.set(SK.user,JSON.stringify(u),false); } catch(e){}
    onSelect(u);
  };
  return (
    <div style={{minHeight:"100vh",background:C.navyDk,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:C.surface,borderRadius:12,padding:"36px 40px",width:380,boxShadow:"0 8px 40px rgba(0,0,0,0.35)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:36,height:36,background:C.teal,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",fontFamily:"monospace"}}>FP</div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.navyDk}}>DSPM Issue Tracker</div>
          <div style={{fontSize:9,color:C.inkSoft,fontFamily:"monospace"}}>Emirates NBD · Forcepoint Shared Portal</div></div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:10,fontWeight:600,color:C.inkMid,display:"block",marginBottom:4,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:.5}}>Your Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEnter()} placeholder="e.g. Ahmed Al Rashidi" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:10,fontWeight:600,color:C.inkMid,display:"block",marginBottom:6,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:.5}}>I am from</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Forcepoint","fp"],["Emirates NBD","enbd"]].map(([label,val])=>(
              <button key={val} onClick={()=>setOrg(val)} style={{padding:"10px 8px",borderRadius:7,border:`2px solid ${org===val?C.teal:C.border}`,background:org===val?C.tealLt:C.surface,cursor:"pointer",fontWeight:600,fontSize:11,color:org===val?C.tealDk:C.inkMid}}>{label}</button>
            ))}
          </div>
        </div>
        <button onClick={handleEnter} disabled={!name.trim()||!org} style={{width:"100%",padding:"10px",borderRadius:7,border:"none",background:(!name.trim()||!org)?"#CBD5E0":C.teal,color:"white",fontWeight:700,fontSize:12,cursor:(!name.trim()||!org)?"not-allowed":"pointer"}}>
          Enter Portal →
        </button>
        <div style={{marginTop:14,fontSize:9,color:C.inkSoft,textAlign:"center",fontFamily:"monospace"}}>Forcepoint staff: full edit access · ENBD: view + comments</div>
      </div>
    </div>
  );
}

// ─── COMMENT PANEL ────────────────────────────────────────────────────────────
function CommentPanel({caseNum,user,comments,onAdd}) {
  const [text,setText]=useState("");
  const cc=comments[caseNum]||[];
  return (
    <div style={{padding:"12px 16px 14px",background:"#F8F9FF",borderTop:`1px solid ${C.border}`}}>
      <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.navy,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>💬 Comments — Case {caseNum}</div>
      {cc.length===0&&<div style={{fontSize:10,color:C.inkSoft,fontStyle:"italic",marginBottom:10}}>No comments yet.</div>}
      <div style={{maxHeight:160,overflowY:"auto",marginBottom:10,display:"flex",flexDirection:"column",gap:6}}>
        {cc.map((c,i)=>(
          <div key={i} style={{background:c.org==="fp"?C.tealLt:"#EFF6FF",border:`1px solid ${c.org==="fp"?C.teal:"#BFDBFE"}`,borderRadius:6,padding:"7px 10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{fontSize:8,fontWeight:700,fontFamily:"monospace",padding:"1px 6px",borderRadius:10,background:c.org==="fp"?C.teal:"#1E40AF",color:"white"}}>{c.org==="fp"?"FORCEPOINT":"ENBD"}</span>
              <span style={{fontSize:9,fontWeight:600,color:C.ink}}>{c.name}</span>
              <span style={{fontSize:8,color:C.inkSoft,fontFamily:"monospace",marginLeft:"auto"}}>{c.ts}</span>
            </div>
            <div style={{fontSize:10.5,color:C.ink,lineHeight:1.5}}>{c.text}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={2} placeholder="Add a comment..." style={{flex:1,padding:"6px 8px",borderRadius:5,border:`1px solid ${C.border}`,fontSize:10.5,resize:"vertical",fontFamily:"inherit",outline:"none"}}/>
        <button onClick={()=>{if(text.trim()){onAdd(caseNum,{name:user.name,org:user.org,text:text.trim(),ts:fmtTs()});setText("");}}} disabled={!text.trim()} style={{padding:"7px 14px",borderRadius:5,border:"none",background:text.trim()?C.teal:"#CBD5E0",color:"white",fontWeight:700,fontSize:10.5,cursor:text.trim()?"pointer":"not-allowed",whiteSpace:"nowrap"}}>Post</button>
      </div>
    </div>
  );
}

// ─── LIVE SF + JIRA PANEL ─────────────────────────────────────────────────────
function LiveDataPanel({c,isFP}) {
  const [loading,setLoading]=useState(false);
  const [sfNotes,setSfNotes]=useState(null);
  const [jiraTickets,setJiraTickets]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [failed,setFailed]=useState(null);
  const [apiKey,setApiKey]=useState(null);
  const [keyInput,setKeyInput]=useState("");

  useEffect(()=>{
    if(!isFP) return;
    (async()=>{ const k=await lsGet(SK.apiKey,true); setApiKey(k||""); })();
  },[isFP]);

  const reset=useCallback(()=>{setLoaded(false);setSfNotes(null);setJiraTickets(null);setFailed(null);},[]);

  const load=useCallback(async(key)=>{
    if(loaded||loading) return;
    setLoading(true); setFailed(null);
    const hdrs={"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-beta":"mcp-client-2025-04-04"};
    const mcpServers=[{type:"url",url:"https://mcp.cloud.cdata.com/mcp",name:"cdata"}];
    const parseReply=d=>{ const t=(d.content||[]).flatMap(b=>b.type==="text"?[b.text]:b.type==="mcp_tool_result"?(b.content||[]).filter(x=>x.type==="text").map(x=>x.text):[]).join(""); const j=t.slice(t.indexOf("{"),t.lastIndexOf("}")+1); return j?JSON.parse(j):{}; };
    try {
      let sfN=[], jiraT=[];
      try {
        const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:hdrs,body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:800,system:"Query CData MCP. Return ONLY valid JSON: {\"comments\":[{\"body\":\"...\",\"date\":\"...\",\"isPublic\":true}]}",messages:[{role:"user",content:`SELECT CommentBody,CreatedDate,IsPublished FROM [Salesforce].[Salesforce].[CaseComment] WHERE [ParentId] IN (SELECT [Id] FROM [Salesforce].[Salesforce].[Case] WHERE [CaseNumber]='${c.case}') ORDER BY CreatedDate DESC LIMIT 5`}],mcp_servers:mcpServers})});
        if(!r.ok) throw new Error(`SF ${r.status}`);
        sfN=parseReply(await r.json()).comments||[];
      } catch(e){ console.warn("SF:",e.message); }
      setSfNotes(sfN);
      try {
        const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:hdrs,body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:800,system:"Query CData MCP. Return ONLY valid JSON: {\"issues\":[{\"key\":\"...\",\"summary\":\"...\",\"status\":\"...\",\"assignee\":\"...\",\"updated\":\"...\"}]}",messages:[{role:"user",content:`SELECT [Key],[Summary],[StatusName],[AssigneeDisplayName],[Updated] FROM [Jira].[Jira].[Issues] WHERE [ProjectKey] IN ('GS','DSPM','ROC','EI') AND ([Summary] LIKE '%${c.case}%' OR [Description] LIKE '%${c.case}%' OR [Summary] LIKE '%ENBD%') AND [Updated]>='2024-01-01' ORDER BY [Updated] DESC LIMIT 8`}],mcp_servers:mcpServers})});
        if(!r.ok) throw new Error(`Jira ${r.status}`);
        jiraT=parseReply(await r.json()).issues||[];
      } catch(e){ console.warn("Jira:",e.message); }
      setJiraTickets(jiraT); setLoaded(true);
    } catch(e) { setFailed(e.message||"Unknown error"); }
    setLoading(false);
  },[c.case,loaded,loading]);

  useEffect(()=>{ if(apiKey) load(apiKey); },[apiKey,load]);

  if(!isFP) return null;

  if(apiKey===null) return null; // still reading from storage

  if(!apiKey) return (
    <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`,background:"#FFFBEB",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.amber}}>🔑 Anthropic API Key required for live SF + Jira data</span>
      <input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&keyInput.trim()){ lsSet(SK.apiKey,keyInput.trim(),true); setApiKey(keyInput.trim()); }}} placeholder="sk-ant-..." style={{flex:1,minWidth:200,padding:"4px 8px",borderRadius:5,border:`1px solid ${C.amberBd}`,fontSize:10.5,outline:"none"}}/>
      <button onClick={()=>{ if(keyInput.trim()){ lsSet(SK.apiKey,keyInput.trim(),true); setApiKey(keyInput.trim()); }}} disabled={!keyInput.trim()} style={{padding:"4px 12px",borderRadius:5,border:"none",background:keyInput.trim()?C.teal:"#CBD5E0",color:"white",fontWeight:700,fontSize:10.5,cursor:keyInput.trim()?"pointer":"not-allowed",whiteSpace:"nowrap"}}>Save Key</button>
    </div>
  );

  if(failed) return (
    <div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,background:C.redBg,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:10,color:C.red,fontFamily:"monospace"}}>⚠ Live data error: {failed}</span>
      <button onClick={()=>{reset();load(apiKey);}} style={{fontSize:9,padding:"2px 8px",borderRadius:4,border:`1px solid ${C.redBd}`,background:"white",color:C.red,cursor:"pointer",fontFamily:"monospace"}}>↻ Retry</button>
      <button onClick={()=>{lsSet(SK.apiKey,"",true);setApiKey("");reset();}} style={{fontSize:9,padding:"2px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:"white",color:C.inkMid,cursor:"pointer",fontFamily:"monospace"}}>Change Key</button>
    </div>
  );

  const jsc=s=>{if(!s)return"grey";const l=s.toLowerCase();if(l==="done"||l==="closed")return"green";if(l.includes("progress"))return"amber";return"purple";};
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:`1px solid ${C.border}`}}>
      <div style={{padding:"12px 14px",borderRight:`1px solid ${C.border}`,background:"#FFF9F0"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:"#B45309",textTransform:"uppercase",letterSpacing:.5}}>☁ Salesforce — Latest Notes</div>
          {loaded&&<button onClick={()=>{reset();load(apiKey);}} style={{fontSize:8,padding:"2px 7px",borderRadius:4,border:`1px solid ${C.amberBd}`,background:C.amberBg,color:C.amber,cursor:"pointer",fontFamily:"monospace"}}>↻</button>}
        </div>
        {loading&&<div style={{fontSize:10,color:C.inkSoft,fontStyle:"italic"}}>⟳ Loading...</div>}
        {!loading&&sfNotes&&sfNotes.length===0&&<div style={{fontSize:10,color:C.inkSoft,fontStyle:"italic"}}>No case comments found.</div>}
        {sfNotes&&sfNotes.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:150,overflowY:"auto"}}>{sfNotes.map((n,i)=>(
          <div key={i} style={{background:"white",border:`1px solid ${C.amberBd}`,borderRadius:5,padding:"7px 10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              {n.isPublic===false&&<span style={{fontSize:8,fontFamily:"monospace",padding:"1px 5px",borderRadius:10,background:"#FEE2E2",color:C.red,border:`1px solid ${C.redBd}`}}>INTERNAL</span>}
              {n.isPublic===true&&<span style={{fontSize:8,fontFamily:"monospace",padding:"1px 5px",borderRadius:10,background:C.greenBg,color:C.green,border:`1px solid ${C.greenBd}`}}>PUBLIC</span>}
              <span style={{fontSize:8,color:C.inkSoft,fontFamily:"monospace",marginLeft:"auto"}}>{n.date?new Date(n.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):""}</span>
            </div>
            <div style={{fontSize:10,color:C.ink,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{n.body}</div>
          </div>
        ))}</div>}
      </div>
      <div style={{padding:"12px 14px",background:"#F8F5FF"}}>
        <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.purple,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>🎫 Jira — Linked Tickets (GS)</div>
        {loading&&<div style={{fontSize:10,color:C.inkSoft,fontStyle:"italic"}}>⟳ Loading...</div>}
        {!loading&&jiraTickets&&jiraTickets.length===0&&<div style={{fontSize:10,color:C.inkSoft,fontStyle:"italic"}}>No linked Jira tickets found.</div>}
        {jiraTickets&&jiraTickets.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:150,overflowY:"auto"}}>{jiraTickets.map((t,i)=>(
          <div key={i} style={{background:"white",border:`1px solid ${C.purpleBd}`,borderRadius:5,padding:"7px 10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <a href={`https://forcepoint.atlassian.net/browse/${t.key}`} target="_blank" rel="noopener noreferrer" style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.purple,textDecoration:"none",borderBottom:`1px dashed ${C.purple}`}}>{t.key}</a>
              {pill(t.status,jsc(t.status))}
              <span style={{fontSize:8,color:C.inkSoft,fontFamily:"monospace",marginLeft:"auto"}}>{t.updated?new Date(t.updated).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):""}</span>
            </div>
            <div style={{fontSize:10,color:C.ink,lineHeight:1.4}}>{t.summary}</div>
            {t.assignee&&<div style={{fontSize:9,color:C.inkSoft,marginTop:2}}>👤 {t.assignee}</div>}
          </div>
        ))}</div>}
      </div>
    </div>
  );
}

// ─── ENG COMPONENTS ───────────────────────────────────────────────────────────
function EngDropdown({value,onChange}) {
  const opt=engLabel(value);
  return <select value={value||""} onChange={e=>onChange(e.target.value)} style={{padding:"3px 5px",borderRadius:4,border:`1px solid ${C.border}`,fontSize:9,background:C.surface,cursor:"pointer",width:"100%",color:opt.color,fontWeight:600}}>
    {ENG_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}
function EngBadge({value}) {
  const opt=engLabel(value);
  if(!value) return <span style={{color:C.inkSoft,fontSize:9}}>—</span>;
  return <span style={{fontSize:9,fontWeight:600,color:opt.color,fontFamily:"monospace"}}>{opt.label}</span>;
}

// ─── CHANGELOG TAB ────────────────────────────────────────────────────────────
function ChangelogTab({changelog, onCaseClick}) {
  const sorted=[...changelog].sort((a,b)=>b.ts-a.ts);
  const fc=f=>{if(f==="engineering")return"#1D4ED8";if(f==="status")return C.amber;if(f==="resNotes")return C.green;if(f==="owner")return C.navy;if(f==="roadmap")return C.purple;if(f==="comment")return C.teal;return C.inkMid;};
  return (
    <div style={{padding:"14px 0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.navy}}>📋 Change Log — All Sessions</div>
        <span style={{fontFamily:"monospace",fontSize:9,color:C.inkSoft}}>{sorted.length} entries</span>
      </div>
      {sorted.length===0&&<div style={{textAlign:"center",color:C.inkSoft,fontSize:11,padding:"32px 0",fontStyle:"italic"}}>No changes recorded yet.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {sorted.map((entry,i)=>(
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 14px",display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontFamily:"monospace",fontSize:8.5,color:C.inkSoft,whiteSpace:"nowrap",minWidth:120,paddingTop:1}}>{fmtDate(entry.ts)}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                <span onClick={()=>onCaseClick&&onCaseClick(entry.caseNum)} style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.navy,cursor:"pointer",borderBottom:`1px dashed ${C.navy}`}} title="Jump to case">{entry.caseNum}</span>
                <span style={{fontSize:9,padding:"1px 7px",borderRadius:10,fontWeight:600,fontFamily:"monospace",background:"#F0F4FF",color:fc(entry.field),border:`1px solid ${fc(entry.field)}33`}}>{entry.field}</span>
                <span style={{fontSize:9,padding:"1px 7px",borderRadius:10,background:entry.org==="fp"?C.tealLt:"#EFF6FF",color:entry.org==="fp"?C.tealDk:"#1E40AF",fontWeight:600,fontFamily:"monospace",border:`1px solid ${entry.org==="fp"?C.teal:"#BFDBFE"}`}}>{entry.org==="fp"?"FORCEPOINT":"ENBD"} · {entry.userName}</span>
              </div>
              {entry.field!=="comment"&&(
                <div style={{display:"flex",gap:8,alignItems:"center",fontSize:10,flexWrap:"wrap"}}>
                  {entry.oldVal&&<span style={{color:C.red,textDecoration:"line-through",fontFamily:"monospace",fontSize:9,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.oldVal}</span>}
                  {entry.oldVal&&<span style={{color:C.inkSoft}}>→</span>}
                  <span style={{color:C.ink,fontWeight:600,fontSize:10,maxWidth:300}}>{entry.newVal||"(cleared)"}</span>
                </div>
              )}
              {entry.field==="comment"&&<div style={{fontSize:10,color:C.ink,fontStyle:"italic",lineHeight:1.4}}>"{entry.newVal}"</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ADD CASE MODAL ───────────────────────────────────────────────────────────
function AddCaseModal({onSave,onClose}) {
  const today=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const [f,setF]=useState({case:"",subject:"",status:"Awaiting Internal Response",priority:"Severity 2",component:"",owner:"",created:today,desc:"",sfId:"",sfCategory:"open",isClosed:false,isUpgrade:false});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const valid=f.case.trim()&&f.subject.trim()&&f.owner.trim();
  const submit=()=>{
    if(!valid) return;
    const isClosed=f.status.toLowerCase().includes("closed");
    onSave({...f,case:f.case.trim(),sfCategory:isClosed?"resolved":"open",isClosed,closed:isClosed?today:null});
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:10,padding:"24px 28px",width:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:C.navy,marginBottom:16}}>+ Add New Case</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          {[["Case #","case","00987654",true],["Salesforce ID","sfId","500a...",false],["Subject","subject","Brief description",true],["Owner","owner","e.g. Husain Rampurwala",true],["Component","component","e.g. Classification - DSPM",false],["Date Opened","created",today,false]].map(([lbl,key,ph,req])=>(
            <div key={key}>
              <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace",textTransform:"uppercase"}}>{lbl}{req&&<span style={{color:C.red}}> *</span>}</label>
              <input value={f[key]} onChange={set(key)} placeholder={ph} style={{width:"100%",padding:"5px 8px",border:`1px solid ${!f[key]&&req?C.redBd:C.border}`,borderRadius:5,fontSize:10.5,boxSizing:"border-box",outline:"none"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div>
            <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace",textTransform:"uppercase"}}>Status</label>
            <select value={f.status} onChange={set("status")} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:"white"}}>
              {["Awaiting Customer","Awaiting Internal Response","In Progress","Resolution Provided","Closed","Closed - No Response from Customer","Closed - Unconfirmed Resolved"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace",textTransform:"uppercase"}}>Priority</label>
            <select value={f.priority} onChange={set("priority")} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:"white"}}>
              {["Severity 2","Severity 3","Severity 4"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace",textTransform:"uppercase"}}>Description</label>
          <textarea value={f.desc} onChange={set("desc")} rows={3} placeholder="Issue description..." style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,resize:"vertical",fontFamily:"monospace",boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={submit} disabled={!valid} style={{padding:"7px 18px",borderRadius:5,border:"none",background:valid?C.teal:"#CBD5E0",color:"white",fontWeight:700,fontSize:10.5,cursor:valid?"pointer":"not-allowed"}}>+ Add Case</button>
          <button onClick={onClose} style={{padding:"7px 14px",borderRadius:5,border:`1px solid ${C.border}`,background:"white",color:C.inkMid,fontSize:10.5,cursor:"pointer"}}>Cancel</button>
          <span style={{fontSize:9,color:C.inkSoft,fontFamily:"monospace"}}>* required</span>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [overrides,setOverridesState]=useState(null);
  const [comments,setComments]=useState({});
  const [changelog,setChangelog]=useState([]);
  const [addedCases,setAddedCases]=useState([]);
  const [expanded,setExpanded]=useState({});
  const [editing,setEditing]=useState(null);
  const [editVal,setEditVal]=useState({});
  const [tab,setTab]=useState("open");
  const [search,setSearch]=useState("");
  const [ready,setReady]=useState(false);
  const [saveStatus,setSaveStatus]=useState({});
  const [sort,setSort]=useState({col:"created",dir:"desc"});
  const [ownerFilter,setOwnerFilter]=useState("");
  const [lastVisit,setLastVisit]=useState(0);
  const [addingCase,setAddingCase]=useState(false);

  useEffect(()=>{
    (async()=>{
      const cu=await lsGet(SK.user,false); if(cu) setUser(cu);
      const ov=await lsGet(SK.overrides);   setOverridesState(ov||{});
      const co=await lsGet(SK.comments);    setComments(co||{});
      const cl=await lsGet(SK.changelog);   setChangelog(cl||[]);
      const ad=await lsGet(SK.added);       setAddedCases(ad||[]);
      const lv=await lsGet(SK.lastVisit,false); setLastVisit(lv||0);
      await lsSet(SK.lastVisit,Date.now(),false);
      setReady(true);
    })();
  },[]);

  const persistAll=useCallback(async(ov,cl,co,ad)=>{
    await lsSet(SK.overrides,ov); await lsSet(SK.changelog,cl); await lsSet(SK.comments,co);
    if(ad!==undefined) await lsSet(SK.added,ad);
  },[]);

  const logChange=useCallback((caseNum,field,oldVal,newVal,userName,org)=>({
    ts:Date.now(),caseNum,field,oldVal:String(oldVal||""),newVal:String(newVal||""),userName,org
  }),[]);

  const saveEngineering=useCallback(async(caseNum,val)=>{
    if(overrides===null) return;
    const prev=overrides[caseNum]||{};
    const seed=[...SEED,...addedCases].find(s=>s.case===caseNum)||{};
    const oldV=prev.engineering||seed.engineering||"";
    const newOv={...overrides,[caseNum]:{...prev,engineering:val,_updatedBy:user?.name||"",_updatedAt:fmtTs()}};
    const newCl=[...changelog,logChange(caseNum,"engineering",oldV,val,user?.name||"",user?.org||"fp")];
    setOverridesState(newOv); setChangelog(newCl);
    await persistAll(newOv,newCl,comments);
    setSaveStatus(p=>({...p,[caseNum]:"saved"}));
    setTimeout(()=>setSaveStatus(p=>({...p,[caseNum]:null})),2000);
  },[overrides,changelog,comments,addedCases,user,logChange,persistAll]);

  const saveEdit=useCallback(async(caseNum)=>{
    if(overrides===null) return;
    const prev=overrides[caseNum]||{};
    const seed=[...SEED,...addedCases].find(s=>s.case===caseNum)||{};
    const entries=["status","resNotes","roadmap","owner","engineering"].reduce((acc,f)=>{
      const o=prev[f]||seed[f]||""; const n=editVal[f]||"";
      if(String(o)!==String(n)) acc.push(logChange(caseNum,f,o,n,user.name,user.org));
      return acc;
    },[]);
    const newOv={...overrides,[caseNum]:{...prev,...editVal,_updatedBy:user.name,_updatedAt:fmtTs()}};
    const newCl=[...changelog,...entries];
    setOverridesState(newOv); setChangelog(newCl); setEditing(null);
    await persistAll(newOv,newCl,comments);
    setSaveStatus(p=>({...p,[caseNum]:"saved"}));
    setTimeout(()=>setSaveStatus(p=>({...p,[caseNum]:null})),2000);
  },[overrides,changelog,comments,addedCases,editVal,user,logChange,persistAll]);

  const clearOverride=useCallback(async(caseNum)=>{
    if(overrides===null) return;
    const u={...overrides}; delete u[caseNum];
    const newCl=[...changelog,logChange(caseNum,"overrides","all overrides","(cleared)",user.name,user.org)];
    setOverridesState(u); setChangelog(newCl); setEditing(null);
    await persistAll(u,newCl,comments);
  },[overrides,changelog,comments,user,logChange,persistAll]);

  const addComment=useCallback(async(caseNum,comment)=>{
    const newCo={...comments,[caseNum]:[...(comments[caseNum]||[]),comment]};
    const newCl=[...changelog,logChange(caseNum,"comment","",comment.text,comment.name,comment.org)];
    setComments(newCo); setChangelog(newCl);
    await persistAll(overrides||{},newCl,newCo);
  },[comments,changelog,overrides,logChange,persistAll]);

  const saveNewCase=useCallback(async(nc)=>{
    const newAd=[...addedCases,nc];
    const newCl=[...changelog,logChange(nc.case,"added","","New case added manually",user.name,user.org)];
    setAddedCases(newAd); setChangelog(newCl); setAddingCase(false);
    await persistAll(overrides||{},newCl,comments,newAd);
  },[addedCases,changelog,overrides,comments,user,logChange,persistAll]);

  const goToCase=useCallback((caseNum)=>{
    setTab("all"); setOwnerFilter(""); setSearch(caseNum);
    setTimeout(()=>setExpanded(p=>({...p,[caseNum]:true})),80);
  },[]);

  // ── DATA ──
  const allCases=[...SEED,...addedCases];
  const merged=allCases.map(c=>({...c,...((overrides||{})[c.case]||{})}));
  const owners=[...new Set(merged.map(c=>c.owner).filter(Boolean))].sort();
  const isNew=caseNum=>lastVisit>0&&changelog.some(e=>e.caseNum===caseNum&&e.ts>lastVisit);

  const filterByTab=(c,t)=>{
    if(t==="all"||t==="changelog") return true;
    if(t==="upgrade") return c.isUpgrade; if(t==="nrc") return c.sfCategory==="nrc";
    if(t==="unconfirmed") return c.sfCategory==="unconfirmed"; if(t==="resolved") return c.sfCategory==="resolved";
    if(t==="closed") return c.isClosed; return !c.isClosed;
  };
  const sevNum=s=>s==="Severity 2"?0:s==="Severity 3"?1:s==="Severity 4"?2:3;
  const sortFn=(a,b)=>{
    const{col,dir}=sort;
    const av=col==="priority"?sevNum(a.priority):a[col]||"";
    const bv=col==="priority"?sevNum(b.priority):b[col]||"";
    const r=av<bv?-1:av>bv?1:0; return dir==="asc"?r:-r;
  };
  const filtered=merged.filter(c=>{
    const s=search.toLowerCase();
    return filterByTab(c,tab)&&(!ownerFilter||c.owner===ownerFilter)&&
      (!s||c.case.includes(s)||(c.subject||"").toLowerCase().includes(s)||(c.owner||"").toLowerCase().includes(s)||(c.status||"").toLowerCase().includes(s));
  }).sort(sortFn);

  const counts={all:merged.length,open:merged.filter(c=>!c.isClosed).length,upgrade:merged.filter(c=>c.isUpgrade).length,nrc:merged.filter(c=>c.sfCategory==="nrc").length,unconfirmed:merged.filter(c=>c.sfCategory==="unconfirmed").length,resolved:merged.filter(c=>c.sfCategory==="resolved").length,closed:merged.filter(c=>c.isClosed).length,changelog:changelog.length};

  const exportCSV=useCallback(()=>{
    const cols=["case","subject","status","priority","component","owner","created","closed","resNotes"];
    const hdr=["Case #","Subject","Status","Priority","Component","Owner","Opened","Closed","Resolution Notes"];
    const rows=filtered.map(c=>cols.map(k=>`"${String(c[k]||"").replace(/"/g,'""')}"`).join(","));
    const csv=[hdr.join(","),...rows].join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`ENBD-DSPM-${tab}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  },[filtered,tab]);

  const isFP=user?.org==="fp";
  const TABS=isFP?TABS_FP:TABS_ENBD;
  const statDefs=isFP?[["all","Total",C.navy],["open","Open",C.red],["upgrade","Post-Upgrade",C.orange],["closed","Closed",C.inkMid],["nrc","NRC ⚠",C.nrcTxt],["unconfirmed","Unconfirmed",C.amber],["resolved","Resolved",C.green]]:[["all","Total",C.navy],["open","Open",C.red],["upgrade","Post-Upgrade",C.orange],["closed","Closed",C.inkMid]];

  const nrcLabel=s=>{
    if(!s) return null; const l=s.toLowerCase();
    if(l.includes("no response")) return "This case was closed after no response from ENBD within the required timeframe. Please comment below to reopen.";
    if(l.includes("unconfirmed")) return "Resolution not yet confirmed by ENBD. Please comment below.";
    return null;
  };

  if(!ready||overrides===null) return (
    <div style={{minHeight:"100vh",background:C.navyDk,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:36,height:36,background:C.teal,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white",fontFamily:"monospace"}}>FP</div>
      <div style={{color:"rgba(255,255,255,.6)",fontSize:11,fontFamily:"monospace"}}>⟳ Loading saved data...</div>
    </div>
  );
  if(!user) return <RoleGate onSelect={async u=>{await lsSet(SK.user,u,false);setUser(u);}}/>;

  const st={
    wrap:{fontFamily:"system-ui,-apple-system,sans-serif",background:C.bg,color:C.ink,fontSize:12,minHeight:"100vh"},
    hdr:{background:C.navyDk,borderBottom:`3px solid ${C.teal}`,position:"sticky",top:0,zIndex:99},
    hi:{padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"},
    th:{padding:"7px 9px",textAlign:"left",fontSize:8.5,fontWeight:600,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",letterSpacing:0.6,fontFamily:"monospace",whiteSpace:"nowrap",borderRight:"1px solid rgba(255,255,255,0.06)"},
    td:{padding:"7px 9px",verticalAlign:"top",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,lineHeight:1.4,fontSize:10.5},
  };

  const SortTh=({col,label,width,minWidth})=>{
    const active=sort.col===col;
    return <th onClick={()=>setSort(p=>({col,dir:p.col===col&&p.dir==="asc"?"desc":"asc"}))}
      style={{...st.th,width,minWidth,cursor:"pointer",userSelect:"none",background:active?"rgba(0,175,154,0.18)":undefined}}>
      {label} {active?(sort.dir==="asc"?"▲":"▼"):"⇅"}
    </th>;
  };

  return (
    <div style={st.wrap}>
      {/* HEADER */}
      <div style={st.hdr}>
        <div style={st.hi}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:28,height:28,background:C.teal,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",fontFamily:"monospace",flexShrink:0}}>FP</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"white"}}>Emirates NBD — DSPM Issue Tracker</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",marginTop:1}}>Forcepoint & ENBD Shared Portal · {ready?"✓ Live":"⌛ Loading..."}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:"monospace",fontSize:9,padding:"2px 10px",borderRadius:20,border:`1px solid ${isFP?C.teal:C.enbdGold}`,color:isFP?C.teal:C.enbdGold}}>
              {isFP?"⬤ Forcepoint Staff":"⬤ ENBD Stakeholder"} — {user.name}
            </span>
            <button onClick={async()=>{await lsSet(SK.user,null,false);setUser(null);}} style={{padding:"4px 10px",borderRadius:5,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:9,cursor:"pointer"}}>Not you?</button>
          </div>
        </div>
        {!isFP&&<div style={{padding:"5px 16px 7px",background:"rgba(201,168,76,0.1)",borderTop:"1px solid rgba(201,168,76,0.2)",fontSize:9.5,color:C.enbdGold,fontFamily:"monospace"}}>👁 ENBD View · Read-only · Comments enabled · Change log available</div>}
      </div>

      <div style={{padding:"14px 16px 60px"}}>
        {/* STAT CARDS */}
        <div style={{display:"grid",gridTemplateColumns:`repeat(${statDefs.length},1fr)`,gap:7,marginBottom:14}}>
          {statDefs.map(([id,label,color])=>(
            <div key={id} onClick={()=>setTab(id)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px",position:"relative",overflow:"hidden",cursor:"pointer",...(tab===id?{boxShadow:`0 0 0 2px ${C.teal}`}:{})}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}}/>
              <div style={{fontSize:8,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,color:C.inkSoft,fontFamily:"monospace"}}>{label}</div>
              <div style={{fontSize:22,fontWeight:700,lineHeight:1.1,letterSpacing:-1,color}}>{counts[id]}</div>
              <div style={{fontSize:8,color:C.inkSoft,marginTop:1}}>cases</div>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by case #, subject, owner or status..."
            style={{flex:1,minWidth:180,padding:"6px 12px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:11,outline:"none",background:C.surface}}/>
          {search&&<button onClick={()=>setSearch("")} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,fontSize:10,cursor:"pointer",color:C.inkMid}}>✕</button>}
          <select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:10.5,background:C.surface,color:ownerFilter?C.navy:C.inkMid,cursor:"pointer"}}>
            <option value="">All owners</option>
            {owners.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={exportCSV} title="Export current view to CSV" style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,fontSize:10.5,cursor:"pointer",color:C.inkMid,whiteSpace:"nowrap"}}>⬇ CSV</button>
          {isFP&&<button onClick={()=>setAddingCase(true)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.teal}`,background:C.tealLt,fontSize:10.5,cursor:"pointer",color:C.tealDk,fontWeight:600,whiteSpace:"nowrap"}}>+ Add Case</button>}
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${tab===t.id?C.navy:C.border}`,background:tab===t.id?C.navy:C.surface,color:tab===t.id?"white":C.inkMid,fontWeight:600,fontSize:10,cursor:"pointer"}}>
              {t.label} ({counts[t.id]||0})
            </button>
          ))}
        </div>

        {tab==="changelog"&&<ChangelogTab changelog={changelog} onCaseClick={goToCase}/>}

        {tab!=="changelog"&&(
        <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface,boxShadow:"0 1px 2px rgba(0,0,0,.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
            <thead>
              <tr style={{background:C.navyDk}}>
                <th style={{...st.th,width:26}}></th>
                <SortTh col="case" label="Case #" width={90}/>
                <SortTh col="subject" label="Subject" minWidth={200}/>
                <SortTh col="status" label="Status" minWidth={115}/>
                <SortTh col="priority" label="Sev" width={55}/>
                <SortTh col="component" label="Component" minWidth={90}/>
                <SortTh col="owner" label="Owner" minWidth={90}/>
                <SortTh col="created" label="Opened" width={72}/>
                <SortTh col="closed" label="Closed" width={65}/>
                <SortTh col="resNotes" label="Resolution Notes" minWidth={140}/>
                <th style={{...st.th,width:105}}>Eng / FR</th>
                {isFP&&<th style={{...st.th,width:45}}>Edit</th>}
                <th style={{...st.th,width:45,borderRight:"none"}}>💬</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={isFP?13:12} style={{...st.td,textAlign:"center",color:C.inkSoft,padding:24,borderRight:"none"}}>No cases match the current filter.</td></tr>}
              {filtered.map((c,i)=>{
                const bg=i%2===0?C.surface:C.stripe;
                const isExp=expanded[c.case];
                const ov=(overrides||{})[c.case];
                const commentCount=(comments[c.case]||[]).length;
                const engVal=ov?.engineering||c.engineering||"";
                const saved=saveStatus[c.case]==="saved";
                const newActivity=isNew(c.case);
                return [
                  <tr key={c.case} style={{background:bg,cursor:"pointer"}} onClick={()=>setExpanded(p=>({...p,[c.case]:!p[c.case]}))}>
                    <td style={{...st.td,textAlign:"center",borderRight:"none",padding:"7px 6px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:3,background:isExp?C.teal:C.tealLt,color:isExp?"white":C.tealDk,fontSize:9,fontWeight:700,transform:isExp?"rotate(90deg)":"none",transition:"transform .15s"}}>▶</span>
                    </td>
                    <td style={st.td}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        {newActivity&&<span title="Updated since your last visit" style={{width:6,height:6,borderRadius:"50%",background:C.teal,flexShrink:0,display:"inline-block"}}/>}
                        <a href={`${SF_BASE}/${c.sfId||c.case}/view`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:C.navy,textDecoration:"none",borderBottom:`1px dashed ${C.navy}`}}>{c.case}</a>
                        {c.isUpgrade&&<span style={{fontSize:8,color:C.orange}}>🔺</span>}
                        {ov&&<span style={{fontSize:8,color:saved?"#16A34A":C.teal}}>{saved?"✓":"✎"}</span>}
                      </div>
                    </td>
                    <td style={{...st.td,minWidth:200}}><span style={{fontWeight:600,color:C.ink,fontSize:10.5,lineHeight:1.3}}>{c.subject}</span></td>
                    <td style={st.td}>{pill(c.status,statColor(c.status))}</td>
                    <td style={st.td}>{pill(c.priority,c.priority==="Severity 2"?"orange":c.priority==="Severity 3"?"amber":"grey")}</td>
                    <td style={{...st.td,fontSize:10,color:C.inkMid}}>{c.component||"—"}</td>
                    <td style={{...st.td,fontSize:10,color:C.inkMid,whiteSpace:"nowrap"}}>{c.owner}</td>
                    <td style={{...st.td,fontFamily:"monospace",fontSize:9,color:C.inkSoft,whiteSpace:"nowrap"}}>{c.created}</td>
                    <td style={{...st.td,fontFamily:"monospace",fontSize:9,color:c.closed?C.green:C.inkSoft,whiteSpace:"nowrap"}}>{c.closed||"—"}</td>
                    <td style={{...st.td,fontSize:10,color:C.inkMid,fontStyle:"italic"}}>{c.resNotes||"—"}</td>
                    <td style={st.td} onClick={e=>e.stopPropagation()}>
                      {isFP?<EngDropdown value={engVal} onChange={v=>saveEngineering(c.case,v)}/>:<EngBadge value={engVal}/>}
                    </td>
                    {isFP&&<td style={st.td} onClick={e=>{e.stopPropagation();setEditing(c.case);setEditVal({status:ov?.status||c.status||"",resNotes:ov?.resNotes||c.resNotes||"",roadmap:ov?.roadmap||"",owner:ov?.owner||c.owner||"",engineering:engVal});}}>
                      <span style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,fontSize:9,cursor:"pointer",color:C.inkMid}}>✎</span>
                    </td>}
                    <td style={{...st.td,borderRight:"none",textAlign:"center"}} onClick={e=>{e.stopPropagation();setExpanded(p=>({...p,[c.case]:!p[c.case]}));}}>
                      <span style={{fontSize:9,color:commentCount>0?C.tealDk:C.inkSoft,fontFamily:"monospace",fontWeight:commentCount>0?700:400}}>{commentCount>0?`💬${commentCount}`:"💬"}</span>
                    </td>
                  </tr>,

                  editing===c.case&&isFP&&(
                    <tr key={c.case+"-edit"}>
                      <td colSpan={13} style={{padding:0,borderRight:"none"}} onClick={e=>e.stopPropagation()}>
                        <div style={{background:"#FFFBEB",border:`1px solid ${C.amberBd}`,borderRadius:6,padding:"12px 14px"}}>
                          <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.amber,marginBottom:10,textTransform:"uppercase",letterSpacing:.5}}>✎ Updating Case {c.case}</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                            <div>
                              <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace"}}>STATUS OVERRIDE</label>
                              <select value={editVal.status} onChange={e=>setEditVal(p=>({...p,status:e.target.value}))} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:C.surface}}>
                                {["Awaiting Customer","Awaiting Internal Response","In Progress","Response received from Customer","Resolution Provided","Closed","Closed - No Response from Customer","Closed - Unconfirmed Resolved","Escalated to Engineering"].map(s=><option key={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace"}}>OWNER</label>
                              <input value={editVal.owner} onChange={e=>setEditVal(p=>({...p,owner:e.target.value}))} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:C.surface}}/>
                            </div>
                          </div>
                          <div style={{marginBottom:10}}>
                            <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace"}}>RESOLUTION / UPDATE NOTES</label>
                            <textarea value={editVal.resNotes} onChange={e=>setEditVal(p=>({...p,resNotes:e.target.value}))} rows={2} style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:C.surface,resize:"vertical",fontFamily:"inherit"}}/>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                            <div>
                              <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace"}}>ROADMAP / ETA</label>
                              <input value={editVal.roadmap||""} onChange={e=>setEditVal(p=>({...p,roadmap:e.target.value}))} placeholder="e.g. Q3 2026..." style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:C.surface}}/>
                            </div>
                            <div>
                              <label style={{fontSize:9,fontWeight:600,color:C.inkMid,display:"block",marginBottom:3,fontFamily:"monospace"}}>ENG / FR</label>
                              <select value={editVal.engineering||""} onChange={e=>setEditVal(p=>({...p,engineering:e.target.value}))} style={{width:"100%",padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:5,fontSize:10.5,background:C.surface,color:engLabel(editVal.engineering).color,fontWeight:600}}>
                                {ENG_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <button onClick={()=>saveEdit(c.case)} style={{padding:"6px 16px",borderRadius:5,border:"none",background:C.teal,color:"white",fontWeight:700,fontSize:10.5,cursor:"pointer"}}>✓ Save</button>
                            <button onClick={()=>setEditing(null)} style={{padding:"6px 14px",borderRadius:5,border:`1px solid ${C.border}`,background:C.surface,color:C.inkMid,fontSize:10.5,cursor:"pointer"}}>Cancel</button>
                            {ov&&<button onClick={()=>clearOverride(c.case)} style={{padding:"6px 14px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,fontSize:10.5,cursor:"pointer"}}>✕ Clear overrides</button>}
                            {saved&&<span style={{fontSize:10,color:"#16A34A",fontWeight:600,fontFamily:"monospace"}}>✓ Saved</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),

                  isExp&&editing!==c.case&&(
                    <tr key={c.case+"-desc"}>
                      <td colSpan={isFP?13:12} style={{padding:0,borderRight:"none"}}>
                        <div style={{padding:"12px 16px 12px 44px",background:"#F0F9FF",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:C.tealDk,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>📋 Description — Case {c.case}</div>
                          {!isFP&&nrcLabel(c.status)&&(
                            <div style={{marginBottom:8,padding:"8px 12px",background:C.nrcBg,border:`1px solid ${C.nrcBd}`,borderRadius:5,fontSize:10.5,color:C.nrcTxt,lineHeight:1.5}}>⚠ <strong>Note:</strong> {nrcLabel(c.status)}</div>
                          )}
                          <div style={{fontSize:10.5,color:C.inkMid,lineHeight:1.7,whiteSpace:"pre-wrap",background:"white",border:`1px solid ${C.border}`,borderRadius:5,padding:"10px 12px",maxHeight:140,overflowY:"auto",fontFamily:"monospace"}}>{c.desc||"No description on record."}</div>
                          {c.latestSfNote&&<div style={{marginTop:8,padding:"7px 10px",background:"#FFFBEB",border:`1px solid ${C.amberBd}`,borderRadius:5,fontSize:10,color:C.amber,lineHeight:1.5}}><strong>☁ Seed SF Note:</strong> {c.latestSfNote}</div>}
                          {c.suggestion&&(
                            <div style={{marginTop:8,padding:"10px 12px",background:"#F0FDF4",border:`1px solid ${C.greenBd}`,borderRadius:5}}>
                              <div style={{fontFamily:"monospace",fontSize:8.5,fontWeight:700,color:C.green,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>💡 Forcepoint SME Suggestion</div>
                              <div style={{fontSize:10.5,color:"#14532D",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{c.suggestion}</div>
                            </div>
                          )}
                          {ov?.roadmap&&<div style={{marginTop:6,fontSize:10.5,color:C.tealDk,fontWeight:600}}>🗓 Roadmap/ETA: {ov.roadmap}</div>}
                          {ov?._updatedBy&&<div style={{marginTop:4,fontSize:9,color:C.inkSoft,fontFamily:"monospace"}}>Last updated by {ov._updatedBy} · {ov._updatedAt}</div>}
                          {!isFP&&c.sfCategory==="unconfirmed"&&(
                            <button onClick={()=>addComment(c.case,{name:user.name,org:user.org,text:"✅ ENBD confirms this case is resolved.",ts:fmtTs()})} style={{marginTop:10,padding:"7px 16px",borderRadius:5,border:`1px solid ${C.greenBd}`,background:C.greenBg,color:C.green,fontSize:10.5,fontWeight:700,cursor:"pointer"}}>✓ Confirm Resolved</button>
                          )}
                        </div>
                        <LiveDataPanel c={c} isFP={isFP}/>
                        <CommentPanel caseNum={c.case} user={user} comments={comments} onAdd={addComment}/>
                      </td>
                    </tr>
                  )
                ];
              })}
            </tbody>
          </table>
        </div>
        )}

        <div style={{marginTop:10,fontSize:9,color:C.inkSoft,fontFamily:"monospace",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span>Forcepoint DSPM · Emirates NBD · AccountId: 0015f00000R7aqFAAR · {allCases.length} cases ({addedCases.length} added) · {filtered.length} shown</span>
          <span>{SUPA_URL?"☁ Supabase · shared across all users":"⚠ localStorage · changes not shared"} · {ready?"✓ Ready":"⌛ Loading..."}</span>
        </div>
      </div>

      {addingCase&&isFP&&<AddCaseModal onSave={saveNewCase} onClose={()=>setAddingCase(false)}/>}
    </div>
  );
}
