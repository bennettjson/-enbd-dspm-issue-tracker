// @ts-nocheck
import { useState, useEffect, useCallback } from "react";

// ─── PERMANENT STORAGE KEYS — NEVER CHANGE ───────────────────────────────────
const SK = {
  overrides: "enbd-v4-overrides",
  comments:  "enbd-v4-comments",
  changelog: "enbd-v4-changelog",
  user:      "enbd-v4-user",
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
  {"case":"00985095","sfId":"500a6000014yZEcAAM","subject":"[ENBD] High number of False Positive in Driver's License","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"07 Apr 2026","closed":null,"owner":"Kevin O'Donovan","component":null,"resNotes":"Moving to In Progress while PS completes action.","latestSfNote":"Moving to In Progress while PS completes action — 10 Apr 2026","desc":"After the upgrade, high level of false positives was noted for detectors such as UAE Driver's license, Singapore Driver's license ..etc It was noted that document was getting tagged with these detectors even if the name of the country is fully or partially mentioned in the document with no relevance of license. No license number / dates were found in the proximity of these keywords.","sfCategory":"open","isUpgrade":true,"suggestion":"Root cause: DL detectors in pre-3.20 AI Mesh use keyword-only proximity model — country name triggers classifier without co-presence of a licence number pattern. Fix: (1) Apply mesh update enbd-3.20.0 (GS-3704 Done) once change control approved. (2) Interim: increase minimum proximity distance for country keyword trigger or add NOT clause requiring alphanumeric licence pattern within token window."},
  {"case":"00985090","sfId":"500a6000014ylkQAAQ","subject":"[ENBD] High number of False Positive in Passport","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"07 Apr 2026","closed":null,"owner":"Kevin O'Donovan","component":null,"resNotes":"Waiting for release of 3.4 DLP classifiers — 21 Apr 2026.","latestSfNote":"Waiting for 3.4 DLP classifiers — 21 Apr 2026 (INTERNAL)","desc":"After the upgrade, high level of false positives was noted for detectors such as Brazil Passport, Indonesia Passport, Tunisian Passport..etc It was noted that document was getting tagged with these detectors even if the name of the country is fully or partially mentioned in the document with no relevance of passport. No passport number / dates were found in the proximity of these keywords.","sfCategory":"open","isUpgrade":true,"suggestion":"Same root cause as 00985095. Fix: (1) Await Classifier 4.0 due 21 Apr. (2) Add proximity content detector requiring passport number format within 200 tokens of country keyword. (3) Review AI Mesh Data Attribute weights for Travel Documents — raise minimum confidence threshold."},
  {"case":"00984716","sfId":"500a6000014sIwSAAU","subject":"Custom regex  update in the ENBD production tenant","status":"Awaiting Customer","priority":"Severity 3","isClosed":false,"created":"07 Apr 2026","closed":null,"owner":"Freddy Tharakan","component":null,"resNotes":"New updated regex applied to ENBD Production Tenant.","latestSfNote":"ENBD: unable to close on their side — FP can proceed to close — 16 Apr 2026","desc":"Ref Case  : 00935675\r\n- Latest Regex provided by Engineering Need to be applied  to production Tenant.","sfCategory":"open","isUpgrade":false,"suggestion":""},
  {"case":"00983655","sfId":"500a6000014E33HAAS","subject":"UTC time on reports needs to be converted to GST","status":"Resolution Provided","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"owner":"Nathan Borowicz","component":"Configuration - DSPM","resNotes":"Hi Nisha,\r\n\r\nThanks for the details.\r\n\r\nIt is not feasible to export the report in different timezone. I have raised an Feature request for this requirement. FR202604-1780 for your reference.\r\n\r\nAs a workaround you can use the excel formula to convert the UTC time to GST time. Below is the example for your reference \r\n\r\nUTC                             Formula                   GST (UTC+4)\r\n07-Apr-2026 08:30     =A1+TIME(4,0,0)     07-Apr-2026 12:30","latestSfNote":"FR202604-1780 raised. Excel workaround provided — 07 Apr 2026","desc":"UTC time on reports needs to be converted to GST","sfCategory":"open","isUpgrade":true,"suggestion":"Platform limitation — DSPM stores all timestamps in UTC. FR202604-1780 is the correct path. Excel workaround: =A1+TIME(4,0,0). GQL analytics board widgets also return UTC — display-layer offset can be applied in widget JS formatting if available."},
  {"case":"00983487","sfId":"500a6000014AnWAAA0","subject":"[ENBD] Incorrect lower classification and False Negatives for documents with Credit Card numbers","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"owner":"Kevin O'Donovan","component":null,"resNotes":"Awaiting customer change control. Mesh enbd-3.20.0 (GS-3704) Done 13 Apr — pending ENBD change control window.","latestSfNote":"Awaiting customer change control — mesh enbd-3.20.0 (GS-3704 Done 13 Apr) — 10 Apr 2026","desc":"Incorrect lower level of classification and False Negatives identified for documents with Credit Card numbers. \n\nCASE 1:\nThe document had card numbers and the detector hit for 'PCI Filter -CC' was detected, but the Data Attribute is not flaged as 'Luhn' also the Complaince tag is not showing 'PCI'.,\nThe detector hit  'PCI Filter -CC' was detected for the document which is also a hard filter, the document should be identified with highest classification 'CONFIDENTIAL'. But here the document is classified as 'Internal' which is an incorrect classification.\n\nCASE 2:\nThere false negatives in detecting card numbers.\nComplaince tag and detector hit was not detected and this is a False Negative.\nThe Data Attribute = Luhn was detected but the document was still classified as 'Restricted' and not 'Confidential'","sfCategory":"open","isUpgrade":true,"suggestion":"Two issues: (1) Luhn validation not firing — check PCI detector JSON filter_list entry should reference Hard Filter with Luhn validation. (2) Mesh 3.20.0 revised PCI Data Attribute weighting — applying it is primary fix. Interim: verify PCI Hard Filter queryId and confirm Luhn validation in processing chain via scan-manager logs."},
  {"case":"00983481","sfId":"500a6000014A1IAAA0","subject":"[ENBD] Sensitive Documents marked with incorrect Classification as 'NULL'","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"02 Apr 2026","closed":null,"owner":"Kevin O'Donovan","component":null,"resNotes":"Awaiting customer change control. Mesh enbd-3.20.0 (GS-3704) Done 13 Apr — pending ENBD change control window.","latestSfNote":"Awaiting customer change control — mesh enbd-3.20.0 (GS-3704 Done 13 Apr) — 10 Apr 2026","desc":"For the documents which are are marked as Flow = Classification, there are detector hits on the documents like mobile number , Card numbers, Email Address, Passport numbers.\nBut still the classification of the document is 'NULL'. \nIt should have been a confidential/restricted document. These should be a classification label on the documents which has the flow = CLASSIFICATION\nAlso these document did not detect with any complaince tag or Data Attribute. This is a False Negative\nThere are multiple documents which has flow = Classification and has the Classification label as 'NULL'. We need to understand why is it occurring.","sfCategory":"open","isUpgrade":true,"suggestion":"NULL classification despite detector hits = broken mapping node. Pull scan-data-manager logs for attribute_score entries. If scores present but label NULL, the mapping node is the issue. Mesh 3.20.0 revised the mapping node for these attributes — applying it is the direct fix."},
  {"case":"00983397","sfId":"500a60000144wAlAAI","subject":"[ENBD] Discrepancies number of unclassified files shown on Enterprise. Search and Scan Configuration dashboards","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"01 Apr 2026","closed":null,"owner":"Kevin O'Donovan","component":null,"resNotes":"Under investigation.","latestSfNote":"Slack discussion opened with Pavel Dashko on behaviour differences — 14 Apr 2026","desc":"The scan performed on user shows 2 different values for the number of unclassified files on Enterprise Search Dashboard and the Scan configuration dashboards.\nThe scan was performed for 1 user on Ondrive.\nNumber of Unclassified files on 'Enterprise Search' dashboard for the scan configuration = 3310\n\t\t\t\t\t\t\t\nNumber of Unclassified files on 'Scan configuration' progress dashboard for the scan configuration = 1380\n\t\t\t\t\nThere is a difference of 3310 - 1380 =  1930 unclassified files on both the dashboards (Enterprise Search and scan configuration dashboards)","sfCategory":"open","isUpgrade":true,"suggestion":"Expected behaviour — Enterprise Search reflects cataloguing index (all discovered files) while Scan Config reflects classification queue. Run GQL query against unclassified cohort segmented by file_type and last_modified to decompose the 1,930 gap."},
  {"case":"00983062","sfId":"500a6000013yL5lAAE","subject":"Classification of files not progressing on DSPM version  - Platform 3.3.1716 and Dashboard 3.618.3","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"01 Apr 2026","closed":null,"owner":"Nathan Borowicz","component":"Server - DSPM","resNotes":"Reviewing logs — zip password shared with Husain (PS).","latestSfNote":"Old logs expired (7-day retention) — need fresh scan logs and spreadsheet — 15 Apr 2026","desc":"The current DSPM version we have on production is the latest version -  Platform 3.3.1716 and Dashboard 3.618.3 .\nWe tried to perform the scans on the onedrive users and the classification of the documents is halted.\n\nFinding from scans performed on 2 users :\n\n1 )  Status of Discovery and Classification scan performed on first user :\nScan start time : March 27 , 1:24 AM\n\nDiscovery Start Times : March 27 , 1:24 AM \t\t\t\t\t\nDisovery End Time :  March 27 , 1:52 AM\n\nClassification Start Time : March 27 , 1:24 AM\t\t\t\t\nClassification End Time :  Still ongoing on March 30 at 8:42 AM (8 more Documents pending)\t\t\t\nScan halted on :  March 28, 20.15 PM\t\t\t\t\t\nScan status on UI : Shows completed even when classification is and shows 'in progress' on UI\t\nDiscovered file  : 14 K\t\t\t\t\t\nClassified file : 13k\t\t\t\t\t\nIn progress for classification : 8\t\t\t\t\t\nUnclassified : 1.4 K (because extraction was impossible for the files)\t\t\t\t\t\t\t\t\t\t\t\t\t\nClassification was halted on March 28 at 20:15 PM and it is still stuck on April 1, 9:22 AM with same number of discovered files , classified file, inprogress for classification and unclassified files as mentioned above. The UI shows completed status for the scan performed on the user even when the classification is in progress. There is no progress for the classification for the first user.\n\n2) Status of Discovery and Classification scan performed on second user :\n\nThe scan for the second user started on March 31, 12:00 PM\nScan status on March 31, 2:15 PM :\nDiscovered file : 8K (status Completed on March 31 at 12:19 PM)\nClassified files : 0 (status in progress)\nUnclassified files  - 95\nClassification Inprogress for- 7.9 K\n\nThe classification then stopped on March 31 at 12:17 PM and was not progressing till around April 1st, 8:40 AM. The next update happened on April 1st at 8:41 AM and the scanned documents showed the updates as shown below:\n\nDiscovered file : 8K (completed)\nClassified files : 3.8 K (inprogress)\nUnclassified files  - 152\nInprogress - 4 K\n\nThe issue is that the scan halted on March 31st at  2:15 PM and resumed on April 1st at 8:00 AM(approx). This shows that the scan was halted for 16-18 hours.\nAfter the update on classification on April 1 at 8:41 AM, the scan is halted again since last 2 hours.\nThe UI shows completed status for the scan performed on the user even when the classification is in progress.","sfCategory":"open","isUpgrade":true,"suggestion":"OneDrive connector OAuth token expiry/Graph API throttling at ~16hr mark. Check connector-generic logs for HTTP 429 or 401. Related: DSPM-293 (Scan Pipeline Stabilisation — In Progress)."},
  {"case":"00976790","sfId":"500a6000011DESIAA4","subject":"Forcepoint DSPM - VA and Compliance scan report for the VMs- Request concurrence for patching and hardening the servers","status":"Closed - Unconfirmed Resolved","priority":"Severity 3","isClosed":true,"created":"16 Mar 2026","closed":"28 Mar 2026","owner":"Nathan Borowicz","component":"Server - DSPM","resNotes":"Hi Husain. Without opening: customer owns the VM and OS. As long as they:\r\n1. use supported linux flavor/version\r\n2. don't touch containerd (this is the runtime we use for k3s)\r\n3. don't run any invasive 3rd party AV\r\nthere is nothing from our side to approve or verify","latestSfNote":"Customer owns the VM and OS — patching can proceed with noted caveats — 18 Mar 2026","desc":"We are planning to proceed with patching and hardening the DSPM UAT and Production VMs. Please find attached the scan VA scan  and the Compliance report for your reference. Kindly review the details and let us know if we can proceed with the patching and hardening of the servers without causing any impact to the application.\n\nPlease be informed that we need to do the patching and hardening on priority by March 20th. The issue was raised on email with Husain on March 9th and as we have not received the response we have raised the ticket.\nAwaiting the confirmation so that we can proceed with approval and planning the activities on our end. Excepting to get the confirmation in next 2 working days.\n\nNote : The document is password protected and the password is shared with Rampurawala, Husain Abdul Tayeb <husain.rampurawala@forcepoint.com>","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"✅ Expected behaviour — ENBD owns VM/OS patching. Caveat: hardening that removes kernel modules required by Rancher can silently break pod-to-pod communication. Recommend ENBD runs DSPM health check after each hardening cycle."},
  {"case":"00976781","sfId":"500a6000011CwYfAAK","subject":"File Transfer through Rancher - Justification requested","status":"Closed - Unconfirmed Resolved","priority":"Severity 4","isClosed":true,"created":"16 Mar 2026","closed":"13 Apr 2026","owner":"Sri Shyaam R","component":"Server - DSPM","resNotes":"Kindly review below link this is the high level information have got.\r\n\r\nUploads to Rancher\r\n\r\nhttps://help.forcepoint.com/dspm/en-us/onlinehelp/guid-0aca79cc-7da2-4b7a-b650-6300d27ef607.html","latestSfNote":"Asking if ENBD has further questions — can we close this case — 10 Apr 2026","desc":"As mentioned in the call, we need to justification for  allowing the following files types to be pushed through the Forcepoint Rancher URLs to ENBD Forcepoint environment.\nWithout proper justification we will not be able to allow the file transfer to ENBD setup. Please share the details as soon as possible to close this matter.\n\nPlease be informed that we require the justification for all the file types mentioned below.\n\n\nExtensions\n\n•\t.sh\n•\t.tar\n•\t.tar.gz\n•\t.yaml\n•\t.tgz\n•\t.json\n•\t.yaml\n•\t.yml\n•\t.prov\n•\t.tpl,  .tmpl\n•\t.zip, .xz, .bz2, .gz\n•\t.sha256, .sha256sum, .sha512, .sig\n•\t.crt, .cer, .pem, .der\n•\t.key\n•\t.p12, .pfx, .jks, .pem.enc\n•\t.kubeconfig, .conf\n•\t.log, .out\n•\t.html\n•\t.js, .mjs, .map\n•\t.css\n•\t.svg, .ico, .png, .jpg, .jpeg, .gif, .webp\n•\t.woff, .woff2, .ttf, .eot\n•\t.wasm","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"Expected Rancher security behaviour. No platform change required. If operationally disruptive for specific trusted file types, Rancher ingress policy can whitelist by MIME type via DSPM platform admin."},
  {"case":"00976115","sfId":"500a6000010uClzAAE","subject":"SMS Scan not progressing","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"13 Mar 2026","closed":null,"owner":"Nathan Borowicz","component":"Connectivity - DSPM","resNotes":"Release notes and upgrade info provided to customer.","latestSfNote":"Husain to contact Nisha, pending further updates — 15 Apr 2026","desc":"The scan initiated on one SMB shared folder is getting stuck while progressing. The stats of the discovered files, classified files are shared in the attachment.\n\nThe scan stops intermittently and gets stuck for hours. Request RCA for the issue.","sfCategory":"open","isUpgrade":false,"suggestion":"Three likely causes: (1) SMB session timeout — check Windows Event Viewer for session disconnect events at stall time. (2) Permission boundary — service account loses access on subfolder with different ACLs. (3) Junction points causing crawler loop. Related: EI-41970 (SMB Scan Stuck After Platform Upgrade)."},
  {"case":"00975519","sfId":"500a6000010dIkfAAE","subject":"ENBD | Release notes / change log for both versions","status":"In Progress","priority":"Severity 3","isClosed":false,"created":"11 Mar 2026","closed":null,"owner":"Nathan Borowicz","component":"Server - DSPM","resNotes":"Release Notes for v3.3 shared. Asking to close.","latestSfNote":"Release Notes for v3.3 shared — asking to close — 16 Apr 2026","desc":"we started the process for the production upgrade to the latest version which is currently deployed in UAT.\r\n\r\nUAT version : Platform version : 3.2.626 / Dashboard version :3.601.3\r\nProduction version : 2.1.6836 / Dashboard : 3.562.0\r\n\r\nWe have been requested by our security assessment team to share the following information to proceed.\r\n\r\n1.\tRelease notes / change log for both versions \r\n2.\tConfirmation whether UAT is functioning correctly – here as you know the Onedrive and SMB scans were not working as excepted after the proxy changes we did. We need to fix them asap.\r\n3.\tList of dependencies or configuration changes introduced in this upgrade\r\n4.\tRollback steps\r\n\r\n\r\nCould you please share the details as soon as possible.","sfCategory":"open","isUpgrade":false,"suggestion":"CBUAE-regulated bank requires formal CAR. Prepare: Security Advisory + Dependency Manifest from Product, CAR covering component versions, Rancher/K8s dependency delta, downtime window, rollback procedure (VM snapshot restore + Rancher re-point — no native one-click rollback). Raise as PS tooling FR with Sanjay Balan."},
  {"case":"00973723","sfId":"500a600000zvhpyAAA","subject":"ENDB | Keycloak AD integration over LDAPS","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"06 Mar 2026","closed":null,"owner":"Nathan Borowicz","component":"Server - DSPM","resNotes":"Fixed unknown error via sAMAccountName. 0 synced / 1000 failed — under investigation.","latestSfNote":"Remote session cancelled — awaiting new availability (Mon–Fri 09:30–16:30 UTC) — 15 Apr 2026","desc":"The AD integration on key cloak is failing with error \"Error when trying to connect to LDAP:'SSL Handshake Failed\"","sfCategory":"open","isUpgrade":false,"suggestion":"LDAP bind succeeding but user attribute mapping failing. Likely: (1) Search base DN too broad — add filter (objectClass=person)(objectCategory=user). (2) sAMAccountName values with special chars in Arabic-locale AD — check Keycloak admin mappers for validation errors. (3) Non-standard UPN suffix — verify Keycloak username LDAP attribute is sAMAccountName not userPrincipalName."},
  {"case":"00972540","sfId":"500a600000zTWxRAAW","subject":"Want to apply a Custom regex rule in ENBD production Tenant","status":"Closed - Unconfirmed Resolved","priority":"Severity 3","isClosed":true,"created":"03 Mar 2026","closed":"04 Apr 2026","owner":"Freddy Tharakan","component":"Cloud - Web","resNotes":"Applied the Regex rule in ENBD production Tenant","latestSfNote":"Regex applied, case archived — 18 Mar 2026","desc":"Reference Case 00935675","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":""},
  {"case":"00972259","sfId":"500a600000zNsB7AAK","subject":"ENDB | Stop / kill Onedrive scan","status":"Closed - Unconfirmed Resolved","priority":"Severity 2","isClosed":true,"created":"03 Mar 2026","closed":"28 Mar 2026","owner":"Prashanth Gowda","component":"Classification - DSPM","resNotes":"Hussain from PS team ran the steps shared by Dev team to resolve the issue","latestSfNote":"RCA not yet provided — ticket kept open pending RCA — 18 Mar 2026","desc":"The customer has initiated a scan on Onedrive which has discovered 34M files. The scan status is in incomplete state. \r\n\r\nThere is no option to cancel the scan,  \r\n\r\nI tried to flushing the kafka topics. However, the ingesting is still happening","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"Fix confirmed in DSPM v3.4. Workaround was direct Flink job termination via Rancher Flink dashboard. Confirm with ENBD that post-upgrade scan can be stopped cleanly via UI and close."},
  {"case":"00971362","sfId":"500a600000ytbdvAAA","subject":"ENDB |  Onedrive scan file discovery is less than the actual files on the data source","status":"Resolution Provided","priority":"Severity 3","isClosed":false,"created":"27 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"The ability to cancel scan is part of 3.3.","latestSfNote":"v3.3 scan cancel feature added — ability to cancel scan confirmed in v3.3 — 10 Apr 2026","desc":"Customer Name: ENBD\r\n\r\nThe customers Onedrive has 42M files however, DSPM is only able to discover 34M files.  There is a difference of 8M files which are not discovered.  The cataloging stopped 48hours ago.  There are no connection or credential related errors in the connector generic pod.","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: DSPM-320 (Ability to scan multiple SharePoint and OneDrive objects — Open). 8M gap consistent with Graph API delta token expiry. Verify OneDrive connector service account has Sites.Read.All and Files.Read.All at tenant level."},
  {"case":"00970726","sfId":"500a600000yihEqAAI","subject":"[ENBD] DSPM UI showing incorrect status for Scan Progress","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"26 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Connectivity - DSPM","resNotes":"Rampurawala, Husain Abdul Tayeb from PS Team confirmed the case is duplicate of the case# 00972259 and confirmed to close this case","latestSfNote":"Working as designed — asking to archive — 14 Apr 2026","desc":"DSPM UI showing incorrect status for Scan Progress for the scan configuration.\nThe status is shown as incomplete even when the scan in progressing on the datasource","sfCategory":"open","isUpgrade":false,"suggestion":"Confirmed platform bug pre-3.4. Fix: DSPM v3.4 adds composite status. Interim: use GQL analytics board to monitor actual classification progress. Related: DSPM-294 (Align classification settings pages — In Refinement)."},
  {"case":"00968980","sfId":"500a600000y7QsrAAE","subject":"Failure in performing the scan on entire datasource for OneDrive","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"22 Feb 2026","closed":null,"owner":"Nathan Borowicz","component":"Configuration - DSPM","resNotes":"Hussain to confirm problem scope — Dev/PM review may result in FR.","latestSfNote":"Update requested after investigation — remote session available if needed — 14 Apr 2026","desc":"This email is regarding the full scan we performed on the entire OneDrive datasource. We initiated the scan on Feb 16 at 9:00 AM and the scan stopped with incomplete status on Feb 22 at 3:57 AM abruptly . 22M document were catalogued or classified by this time.\n\nWe need to understand how can we perform the full scan on the entire datasource without the scans getting impacted or stopped. As of today DSPM , doesn’t have the feature to initiate the scan on user level or department wise. This will make it difficult to perform the scans on the entire users as we expect. Please let us know the way forward to resolve this issue.","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: ROC-1656 (flink-job-manager OOM killed — To Do), DSPM-293 (Scan Pipeline Stabilisation — In Progress), DSPM-320 (multi-object OneDrive scope — Open). At 22M files flink-job-manager pod likely OOM-killed. Check Rancher pod restart history at abort time."},
  {"case":"00967567","sfId":"500a600000xCBCDAA4","subject":"[ENDB] Slowness in Scan","status":"Closed","priority":"Severity 3","isClosed":true,"created":"17 Feb 2026","closed":"03 Apr 2026","owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"Explanation provided, no further comments or queries made and no reason provided for case being reopened.  Archiving the case","latestSfNote":null,"desc":"The scan was initiated on the full entire data source on OneDrive.  There seems to be reduction is speed of scan progression on the second day of the scan as compared to the first day when the scan was initiated.\n\nCan we check the reason for the reduction in scan speed.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — expected behaviour. DSPM scan speed reduces on day 2+ as initial crawl covers full delta. If sustained slowness beyond day 2, check for scan-data-manager memory pressure."},
  {"case":"00965113","sfId":"500a600000w0rhGAAQ","subject":"[ENBD] Feature Request - Report File name of sensitive files in compressed folders","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"10 Feb 2026","closed":"20 Feb 2026","owner":"Kevin O'Donovan","component":"Server - DSPM","resNotes":null,"latestSfNote":null,"desc":"Feature request to report the file name of file from the compressed folder (file type 7z; tar; zip etc) which was detected with sensitive data from the discovery scan.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — No existing Jira ticket found. Platform currently classifies the archive as a whole without surfacing individual file names within nested archives. Raise as product FR — requires changes to KeyView extraction pipeline."},
  {"case":"00965106","sfId":"500a600000w0S9TAAU","subject":"[ENBD] False Postives and Negatives in Detector - Nationality","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"10 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"Post-upgrade: FN in Email, UAE Mobile, PCI tag FP. Awaiting mesh update / change control.","latestSfNote":"Awaiting customer change control — mesh enbd-3.20.0 (GS-3704 Done 13 Apr) — 10 Apr 2026","desc":"There are False Positives for Nationality Detection- \n>> The documents with keyword 'nationality' is getting identified with DOB detector.\n\nThere are False Negatives for Nationality Detection-  \n>> There are false negatives in detecting nationality even when there is a country name following to the keyword 'Nationality'","sfCategory":"open","isUpgrade":false,"suggestion":"'nationality' keyword triggers DOB detector via proximity collision with date-format strings in KYC forms. Fix: add 'nationality' as NOT-proximity term in DOB detector config. Post-upgrade FN in Email/UAE Mobile: share sample documents with Engineering (Vlad) to recalibrate thresholds for ENBD's document corpus."},
  {"case":"00965097","sfId":"500a600000w0wiYAAQ","subject":"[ENBD] False Postives and Negatives in GCC ID, Date of Birth, Emirates ID","status":"Awaiting Internal Response","priority":"Severity 2","isClosed":false,"created":"10 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"Post-upgrade: FN in UAE ID, CC, IBAN, Passport, Mobile. FP in DOB. Awaiting mesh update.","latestSfNote":"Awaiting customer change control — mesh enbd-3.20.0 (GS-3704 Done 13 Apr) — 10 Apr 2026","desc":"There are False Positives for GCC ID, Date of Birth, Emirates ID Detection- \n>> Random numbers are getting identified as GCC ID \n>> The documents with keyword 'data of birth' is getting identified with DOB detector.\n\nThere are False Negatives for GCC ID, Date of Birth, Emirates ID Detection-  \n>> There are false negatives in identifying UAE Emirates ID which has a pattern '784<4digit><7digit><1 digit>'","sfCategory":"open","isUpgrade":false,"suggestion":"(1) GCC ID over-matching: tighten regex to require country-specific prefix. UAE Emirates ID: 784-\\d{4}-\\d{7}-\\d{1}. (2) Emirates ID FN: hyphens stripped during OCR yield 784YYYYXXXXXXX — detector must handle both variants. Note: eido/Lucene strips \\b anchors — use character class constraints."},
  {"case":"00965083","sfId":"500a600000w0JsXAAU","subject":"[ENBD] Report 'Export' button not available for MS Exchange Connector","status":"Closed","priority":"Severity 2","isClosed":true,"created":"10 Feb 2026","closed":"03 Apr 2026","owner":"Kevin O'Donovan","component":"Server - DSPM","resNotes":"FR Logged: FR202602-1581","latestSfNote":null,"desc":"Report 'Export' button not available for MS Exchange Connector","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — FR202602-1581 logged. Check FR status with Product for inclusion in upcoming release."},
  {"case":"00965012","sfId":"500a600000vvJjRAAU","subject":"[ENBD] OCR Feature inaccurate - False Positives and False Negatives Detected","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"Awaiting customer to test OCR again after platform upgrade.","latestSfNote":"Customer retested after platform update — same results — 14 Apr 2026","desc":"1. Discovery on bmp files - Not Detected. Discovery scan on bmp file not supported on DSPM\n\n2. False Negative in gif file - False Negative in identifying Emirates ID, Mobile number, Email address, Card number.\nFalse Positives in gif file  detected for detector hit 'Date of birth' and complaince tag -\"PII\"\n\n3. False Negative on tiff file -   False Negative in identifying Emirates ID, Mobile number, Email address, Card number.\n\n4. Sensitive Data discovery on jpg ; png image file type and image file embedded in excel, word, pdf-\n>>Data detected correctly for Emirates ID, Mobile number and card number\n>> False negative in Detector : Email address.\n>> False Positive in Detector : Date of Birth\n>> False positives in Data Attributes - HR; Legal;Technical; LoginCredentials\n\n5. Sensitive Data discovery on mht image filetype -\n>>Classification :Restricted (Incorrect Classification- this should have been Confidential )\n>>Data detected correctly for Emirates ID, Mobile number and card number\n>> False negative in Detector :  Email address \n>> False positives in Data Attributes - HR; Legal;Technical\n>> Compliance Tag was Nil - Incorrect detection (the complaince tag should have flagged as PII and PCI data)","sfCategory":"open","isUpgrade":false,"suggestion":"Related Jira: ROC-1607 (ocr-service fails to start under high topic volume — In Progress). BMP: confirmed unsupported. GIF/TIFF FN: Tesseract degrades on indexed-colour and multi-page formats. MHT: parsed as HTML text; embedded images not extracted for OCR — platform gap, FR required."},
  {"case":"00964962","sfId":"500a600000vsG5QAAU","subject":"Feature Request -Sensitive Data Discovery on Embedded Document (Multiple levels)","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","owner":"Aravind Murugesan","component":"Server - DSPM","resNotes":"FR202602-1565/AFR1837","latestSfNote":null,"desc":"Discovery Scans on documents embedded on file on multiple levels is not working. All the files embedded should be scanned and data should be discovered, classified and labelled.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ FR logged — FR202602-1565/AFR1837. Multi-level embedded document extraction requires KeyView pipeline changes. Check FR status with Product."},
  {"case":"00964943","sfId":"500a600000vrbexAAA","subject":"Feature Request - Sensitive Data in Folder and File names not detected","status":"Closed","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","owner":"Aravind Murugesan","component":"Configuration - DSPM","resNotes":"path detectors -https://help.forcepoint.com/dspm/en-us/onlinehelp/guid-0ab37c33-e911-4f5a-88d8-43b0b6c97a32.html?hl=path%2Cdetectors","latestSfNote":null,"desc":"Feature required to detect the sensitive data stored on File or Folder name","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Resolved — path detectors available in platform. 31-detector enterprise path detector pack can be imported via JSON."},
  {"case":"00964827","sfId":"500a600000vpSUTAA2","subject":"Feature Request -Enhancement of reports","status":"Closed - Unconfirmed Resolved","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","owner":"Sri Shyaam R","component":"Server - DSPM","resNotes":"Feature Request has been raised for below - FR202602-1582\r\n\r\n1. Time of last scan on the datasource should be shown in the report.\r\n2.Time when the label was inserted into the document. If the labels are not inserted for classified documents, those documents showed be flagged with reason for no labelling.\r\n3. Need to report the time when the documents went through the classification pipeline. This is needed for ensure the document was picked up for the new scan but was skipped because there was no modification on the document.\r\nThis information is available in their audit trail, we need to bring it on the report.\r\n\r\n4. Report should show document owner, modified by, last accessed by.\r\n\r\n+++++++++++\r\n\r\n\r\n5. Once a specific datasource is selected on the Data source page, only the reports related to the selected datasource\r\n\r\n--> When we select the specific filename in that classfied files then it will filter and show only the count of files that are associated with it in enterprise search.\r\n\r\n\r\n4. Report should also show files modified from last scan on the user/folder\r\n\r\n---> when we filter the Enterprise search with the specific path / file you can add by clicking the settings and add Last modified & last accessed at it will add the time and the file being last used.","latestSfNote":null,"desc":"The scan report should have additional fields as follows:\n\n1. Time of last scan on the datasource should be shown in the report.\n2.Time when the label was inserted into the document. If the labels are not inserted for classified documents, those documents showed be flagged with reason for no labelling.\n3. Need to report the time when the documents went through the classification pipeline. This is needed for ensure the document was picked up for the new scan but was skipped because there was no modification on the document. \nThis information is available in their audit trail, we need to bring it on the report.\n4.  Report should also show files modified from last scan on the user/folder\n5. Once a specific datasource is selected on the Data source page, only the reports related to te selected datasource \n6. Report should show document owner, modified by, last accessed by.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"🔵 FR202602-1582 logged. Confirm with ENBD whether these enhancements are still required."},
  {"case":"00964812","sfId":"500a600000vp37yAAA","subject":"Feature Request - Fingerprinting feature required","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"12 Feb 2026","owner":"Prashanth Gowda","component":"Server - DSPM","resNotes":"Hi Nisha Thomas, \r\n\r\nHope you are well! \r\n\r\nThis is regarding the case 00964812. \r\n\r\nI have raised feature request. FR202602-1569 request number for your reference.","latestSfNote":null,"desc":"Fingerprinting feature is required to identify, track, and classify sensitive data by creating unique digital \"signatures\" for specific files or data patterns for sensitive information like National IDs, Passport documents, Account Statements, Drivers Liscence, License copies, Salary certificates etc","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1569 logged. Check FR roadmap status with Product."},
  {"case":"00964806","sfId":"500a600000vpBWuAAM","subject":"Feature Request - Discovery, Classification and labelling on Audio file","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","owner":"Nikhil Mahapatra","component":"Classification - DSPM","resNotes":"Hi Nisha,\r\n\r\nI hope you are doing well!\r\n\r\nThanks for contacting Forcepoint Technical Support.\r\n\r\nWe have raised the Feature request ID: FR202602-1561\r\n\r\nPlease note product team will be responsible for the design and implementation decisions of the feature request.\r\nOnce we raise a Feature request, the Product Team will review and analyze the Feature request for implementation.\r\n\r\nNote: the Feature Request process is managed by the Sales Engineering team. Any Feature Request-related questions should be directed to your Sales Engineer, Account Manager.\r\nPlease find the process for Feature Request: https://support.forcepoint.com/KBArticle?id=Forcepoint-Enhancement-and-Feature-Request-Process\r\n\r\nLet me know if you have any further queries.\r\n\r\nThank you.\r\n\r\nBest Regards,\r\nNikhil Mahapatra\r\nPrincipal Technical Support Engineer – EMEA\r\nWorking Hours: 09:00 AM – 06:00 PM BST (Monday to Friday)\r\n\r\nForcepoint\r\nSupport line number: +44 118 938 8515 (EMEA), +1 (512) 664-1360 (US)\r\nwww.forcepoint.com\r\n\r\nLog into the Forcepoint Customer HUB today and take advantage of our latest product updates,\r\neasy-to-follow self-help documents, KB articles and community groups – just a click away","latestSfNote":null,"desc":"Request to have feature to perform Discovery, Classification and labelling on Audio file to classify the call center records.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1561 logged. Audio classification requires speech-to-text pipeline integration. Significant engineering effort."},
  {"case":"00964802","sfId":"500a600000vpJ2zAAE","subject":"Feature Request - Exclude folder path on scan configuration","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","owner":"Pradeep Manjunath","component":"Configuration - DSPM","resNotes":null,"latestSfNote":null,"desc":"Request to have feature to exclude selected folder or path or users from scanning.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — Path exclusion partially available via scan configuration scope settings. Check current platform capabilities before raising new FR."},
  {"case":"00964801","sfId":"500a600000vpITWAA2","subject":"[ENBD] Monitor Progress of the scan performed on scan configurations for datasources","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"21 Feb 2026","owner":"Kevin O'Donovan","component":"Configuration - DSPM","resNotes":null,"latestSfNote":null,"desc":"1. As of Feb 2026,the progress of scan can only be monitored by increasing number of documents on the scan configuration for a datasource. There should be a single pane where the DSPM admin should have a view on all the ongoing scans. \n\n2. The tool should have feature to  list down the total number of documents in the datasource for which the scan is initiated and have the number of documents scanned across it. While scanning,  the tool does not gives an insight on total number of documents left to be scanned.\n\n3.The percentage of progress for classification should be shown with approx time of completion.\n4. The percentage of progress for labelling should be shown with approx time of completion.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — GQL analytics board can partially address this via custom widget configuration. Raise as FR combining with 00983397 observability gap."},
  {"case":"00964798","sfId":"500a600000vpHPNAA2","subject":"Feature Request -Pause /Resume feature for scans on data source","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","owner":"Nikhil Mahapatra","component":"Configuration - DSPM","resNotes":"Hi Nisha,\r\n\r\nI hope you are doing well!\r\n\r\nThanks for contacting Forcepoint Technical Support.\r\n\r\nWe have raised the Feature request ID: FR202602-1562\r\n\r\nPlease note product team will be responsible for the design and implementation decisions of the feature request.\r\nOnce we raise a Feature request, the Product Team will review and analyze the Feature request for implementation.\r\n\r\nNote: the Feature Request process is managed by the Sales Engineering team. Any Feature Request-related questions should be directed to your Sales Engineer, Account Manager.\r\nPlease find the process for Feature Request: https://support.forcepoint.com/KBArticle?id=Forcepoint-Enhancement-and-Feature-Request-Process\r\n\r\nLet me know if you have any further queries.\r\n\r\nThank you.\r\n\r\nBest Regards,\r\nNikhil Mahapatra\r\nPrincipal Technical Support Engineer – EMEA\r\nWorking Hours: 09:00 AM – 06:00 PM BST (Monday to Friday)\r\n\r\nForcepoint\r\nSupport line number: +44 118 938 8515 (EMEA), +1 (512) 664-1360 (US)\r\nwww.forcepoint.com\r\n\r\nLog into the Forcepoint Customer HUB today and take advantage of our latest product updates,\r\neasy-to-follow self-help documents, KB articles and community groups – just a click away","latestSfNote":null,"desc":"Request feature to pause the scan during peak hours and resume it from the point it was paused.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1562 logged. Pause/resume requires scan-manager checkpoint persistence. Check FR roadmap."},
  {"case":"00964796","sfId":"500a600000vpGczAAE","subject":"Proxy configuration for Cloud  connectors without impacting on-prem connectors","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"12 Feb 2026","owner":"Prashanth Gowda","component":"Configuration - DSPM","resNotes":"Hi Nisha, \r\n\r\nHope you are well! \r\n\r\nThis is regarding the case 00964796. \r\n\r\nI have raised a feature request. FR202602-1568 request number for your reference. ","latestSfNote":null,"desc":"Proxy is configured globally which makes the traffic to go through proxy for all the data source connected, even for internal on-prem data sources. The feature request was raised to set proxy based on data source connector type. The traffic for clouds data sources should go through proxy and internal on-prem should route internally. \nAs of today, to scan NAS or SharePoint on-prem, we will need to disable the proxy setting so that the traffic can be routed internally. This implies that we will not be able to perform the scans on the cloud apps and on-prem storages simultaneously.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1568 logged. Check FR roadmap."},
  {"case":"00964791","sfId":"500a600000vnwRuAAI","subject":"[ENBD] Require Error Logs on UI with segregation on different activities on datasources.","status":"Closed","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","owner":"Kevin O'Donovan","component":"Server - DSPM","resNotes":"Opened feature request FR202602-1564 for this","latestSfNote":null,"desc":"1. Logs should be made available on UI.\n\n2. Error logs are not specific to the issue which makes the troubleshooting difficult.\n\n3. The logs for scans each datasource should be seperated from each other.Currently all the logs for scans performed on any datasource are logged on a single flat file which makes it difficult to analayse.    \n\n4. The logs for scan configuration should be segregated from logs for the credentials (datasource configuration).As of today, the error logs for the ongoing scan getting performed and the issues in configuring the datasources are all found in a single file which makes the troubleshooting difficult.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1564 logged. Error logs currently in Rancher pod logs only. Per-datasource error visibility would significantly reduce time to diagnose connector failures."},
  {"case":"00964779","sfId":"500a600000vp9mpAAA","subject":"[ENBD] Feature Request -Initiating Scan on multiple users/folders/accounts/sites","status":"Closed","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","owner":"Kevin O'Donovan","component":"Connectivity - DSPM","resNotes":"Opened Feature request FR202602-1563","latestSfNote":null,"desc":"Request feature to create a single scan configuration and initiate scan for multiple users/AD groups/folders/accounts and sites. As of Feb 2026, DSPM allows to scan either on 1 user/folder or on the entire datasource  at a time. Consider the large number of users in our organisation it is not feasible to create scan configuration for each user/folder. Also it would be practically impossible to initiate and complete the scans on the entire datasource on all users/folders in one scan configuration. \n\nFeature is requested for splitting the scope of users/folders into considerable sizes for successful scan completion and labelling.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1563 logged. Related Jira: DSPM-320 (Ability to scan multiple SharePoint and OneDrive objects — Open). Monitor for inclusion in upcoming release."},
  {"case":"00964776","sfId":"500a600000voKIyAAM","subject":"Reporting the Number of hits for Detectors","status":"Closed - Unconfirmed Resolved","priority":"Severity 2","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","owner":"Sri Shyaam R","component":"Configuration - DSPM","resNotes":"Feature Request - FR202602-1583\r\n\r\nRaised for DSPM should have the feature for reporting the number of hits on the document","latestSfNote":null,"desc":"DSPM should have the feature for reporting the number of hits on the document. Currently with this feature limitation we are not able to identify the risk associated with the document. The case being if the number of hits is high the risk should be high.","sfCategory":"unconfirmed","isUpgrade":false,"suggestion":"🔵 FR202602-1583 logged. GQL analytics board can approximate this via aggregation queries on the incident index."},
  {"case":"00964769","sfId":"500a600000vorWZAAY","subject":"Feature Request - Reporting the Number of hits for Detectors","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"09 Feb 2026","owner":"Nikhil Mahapatra","component":"Configuration - DSPM","resNotes":"Duplicate.","latestSfNote":null,"desc":"DSPM should have the feature for reporting the number of hits on the document. Currently with this feature limitation we are not able to identify the risk associated with the document. The case being if the number of hits is high the risk should be high.\n\nData Detection and Response (DDR) feature does not cover this requirement.  Following are concerns with the DDR feature:\n\n1.The DDR will discovery and classify any new sensitive documents in the data source as live streaming events but CANNOT TAG the documents at the same time. The newly added/modified documents will be tagged/labelled when the DSPM admin manually initiates the next scan on the data source.\n\n2. The DDR feature requires inbound connectivity from cloud repositories to DSPM setup hosted on-prem which is a security concern. Continuous scanning feature should work with the current setup we have for DSPM in ENBD (only outbound connectivity).\n\n3. DDR feature cannot be enabled on Shared folder  (NAS Storage - Huawei Ocean Store as the agent is not supported for the Huawei OS) and on MS Exchange or any on-prem repositories like SharePoint on-prem.\n\n4. The results for DDR streaming is independent of the scan performed for the user on the datasource. Therefore, it is difficult to fetch the current status of sensitive document for users.\n\nEnabling Scheduled scan on DSPM may not cover the requirement of continuous scanning as of today.  Following are concerns with the Schedule Scanning:\n\nWe do not have the feature to run scan on selected number of users. The scan can be either configured for single user or all the users in the organisation. In both cases, the scan configuration and first full scan completion will be practically impossible. The scheduled scans can be enabled only once the first full scan is completed in this case which will cause delays in classifying the newly added/modified documents.","sfCategory":"resolved","isUpgrade":false,"suggestion":"✅ Duplicate of 00964776."},
  {"case":"00964760","sfId":"500a600000vovNJAAY","subject":"Feature REquest - Cyber Ark Integration for authentication to target datasources","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","owner":"Nikhil Mahapatra","component":"Configuration - DSPM","resNotes":"Hi Nisha,\r\n\r\nI hope you are doing well!\r\n\r\nThanks for contacting Forcepoint Technical Support.\r\n\r\nWe have raised the Feature request ID: FR202602-1559\r\n\r\nPlease note product team will be responsible for the design and implementation decisions of the feature request.\r\nOnce we raise a Feature request, the Product Team will review and analyze the Feature request for implementation.\r\n\r\nNote: the Feature Request process is managed by the Sales Engineering team. Any Feature Request-related questions should be directed to your Sales Engineer, Account Manager.\r\nPlease find the process for Feature Request: https://support.forcepoint.com/KBArticle?id=Forcepoint-Enhancement-and-Feature-Request-Process\r\n\r\nLet me know if you have any further queries.\r\n\r\nThank you.\r\n\r\nBest Regards,\r\nNikhil Mahapatra\r\nPrincipal Technical Support Engineer – EMEA\r\nWorking Hours: 09:00 AM – 06:00 PM BST (Monday to Friday)\r\n\r\nForcepoint\r\nSupport line number: +44 118 938 8515 (EMEA), +1 (512) 664-1360 (US)\r\nwww.forcepoint.com\r\n\r\nLog into the Forcepoint Customer HUB today and take advantage of our latest product updates,\r\neasy-to-follow self-help documents, KB articles and community groups – just a click away","latestSfNote":null,"desc":"Cyber Ark Integration for authentication to target data sources both cloud and on-prem","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1559 logged. Also achievable via Kubernetes secrets injection into Rancher connector pod config as an interim approach."},
  {"case":"00964754","sfId":"500a600000vozlsAAA","subject":"Feature Request - Role based Preview of the data detect","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","owner":"Nikhil Mahapatra","component":"Classification - DSPM","resNotes":"Hi Nisha,\r\n\r\nI hope you are doing well!\r\n\r\nThanks for contacting Forcepoint Technical Support.\r\n\r\nWe have raised the Feature request ID: FR202602-1558\r\n\r\nPlease note product team will be responsible for the design and implementation decisions of the feature request.\r\nOnce we raise a Feature request, the Product Team will review and analyze the Feature request for implementation.\r\n\r\nNote: the Feature Request process is managed by the Sales Engineering team. Any Feature Request-related questions should be directed to your Sales Engineer, Account Manager.\r\nPlease find the process for Feature Request: https://support.forcepoint.com/KBArticle?id=Forcepoint-Enhancement-and-Feature-Request-Process\r\n\r\nLet me know if you have any further queries.\r\n\r\nThank you.\r\n\r\nBest Regards,\r\nNikhil Mahapatra\r\nPrincipal Technical Support Engineer – EMEA\r\nWorking Hours: 09:00 AM – 06:00 PM BST (Monday to Friday)\r\n\r\nForcepoint\r\nSupport line number: +44 118 938 8515 (EMEA), +1 (512) 664-1360 (US)\r\nwww.forcepoint.com\r\n\r\nLog into the Forcepoint Customer HUB today and take advantage of our latest product updates,\r\neasy-to-follow self-help documents, KB articles and community groups – just a click away","latestSfNote":null,"desc":"Role based access to view the sensitive data detected should be available. This should be a separate role from DSPM admin user.The snippet of data should be fetched in real time and populated on the screen in masked format when requested but never stored on the DSPM database. The feature is required to fine tune the product.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1558 logged. RBAC-gated masked preview is a strong data governance requirement. Significant engineering effort. Check FR roadmap."},
  {"case":"00964738","sfId":"500a600000vonMVAAY","subject":"Feature Request -Continuous Scanning on Data sources","status":"Closed","priority":"Severity 4","isClosed":true,"created":"09 Feb 2026","closed":"13 Feb 2026","owner":"Nikhil Mahapatra","component":"Configuration - DSPM","resNotes":"Hi Nisha,\r\n\r\nI hope you are doing well!\r\n\r\nThanks for contacting Forcepoint Technical Support.\r\n\r\nWe have raised the Feature request ID: FR202602-1560\r\n\r\nPlease note product team will be responsible for the design and implementation decisions of the feature request.\r\nOnce we raise a Feature request, the Product Team will review and analyze the Feature request for implementation.\r\n\r\nNote: the Feature Request process is managed by the Sales Engineering team. Any Feature Request-related questions should be directed to your Sales Engineer, Account Manager.\r\nPlease find the process for Feature Request: https://support.forcepoint.com/KBArticle?id=Forcepoint-Enhancement-and-Feature-Request-Process\r\n\r\nLet me know if you have any further queries.\r\n\r\nThank you.\r\n\r\nBest Regards,\r\nNikhil Mahapatra\r\nPrincipal Technical Support Engineer – EMEA\r\nWorking Hours: 09:00 AM – 06:00 PM BST (Monday to Friday)\r\n\r\nForcepoint\r\nSupport line number: +44 118 938 8515 (EMEA), +1 (512) 664-1360 (US)\r\nwww.forcepoint.com\r\n\r\nLog into the Forcepoint Customer HUB today and take advantage of our latest product updates,\r\neasy-to-follow self-help documents, KB articles and community groups – just a click away","latestSfNote":null,"desc":"DSPM should have the feature for continuous scanning to detect the newly added/modified documents on datasource (cloud and on-prem) and perform the data discovery, classification and labelling without any manual intervention as soon as the user saves the document on the datasource.\n\nData Detection and Response (DDR) feature does not cover this requirement.  Following are concerns with the DDR feature:\n\n1.The DDR will discovery and classify any new sensitive documents in the data source as live streaming events but CANNOT TAG the documents at the same time. The newly added/modified documents will be tagged/labelled when the DSPM admin manually initiates the next scan on the data source.\n\n2. The DDR feature requires inbound connectivity from cloud repositories to DSPM setup hosted on-prem which is a security concern. Continuous scanning feature should work with the current setup we have for DSPM in ENBD (only outbound connectivity).\n\n3. DDR feature cannot be enabled on Shared folder  (NAS Storage - Huawei Ocean Store as the agent is not supported for the Huawei OS) and on MS Exchange or any on-prem repositories like SharePoint on-prem.\n\n4. The results for DDR streaming is independent of the scan performed for the user on the datasource. Therefore, it is difficult to fetch the current status of sensitive document for users.\n\nEnabling Scheduled scan on DSPM may not cover the requirement of continuous scanning as of today.  Following are concerns with the Schedule Scanning:\n\nWe do not have the feature to run scan on selected number of users. The scan can be either configured for single user or all the users in the organisation. In both cases, the scan configuration and first full scan completion will be practically impossible. The scheduled scans can be enabled only once the first full scan is completed in this case which will cause delays in classifying the newly added/modified documents.","sfCategory":"resolved","isUpgrade":false,"suggestion":"🔵 FR202602-1560 logged. Graph API delta query endpoint for OneDrive/SharePoint already supports change notification webhooks. Check FR roadmap for inclusion timeline."},
  {"case":"00964729","sfId":"500a600000vo6MPAAY","subject":"RBAC for Forcepoint DSPM UI","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"09 Feb 2026","closed":"19 Feb 2026","owner":"Pradeep Manjunath","component":"Server - DSPM","resNotes":null,"latestSfNote":null,"desc":"Role-based access control — separate role from DSPM admin for data visibility.","sfCategory":"nrc","isUpgrade":false,"suggestion":"🔵 FR — RBAC in DSPM UI is a significant gap for regulated environments. Check if DSPM-158 Keycloak work included any RBAC scoping."},
  {"case":"00964722","sfId":"500a600000vorUvAAI","subject":"[ENBD] False Positives and Negatives in Email Address Detection","status":"Resolution Provided","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"Hi Nisha,\r\n\r\nThank you for reaching out to us regarding the detection behavior you observed in your document. We appreciate the opportunity to clarify this for you.\r\n\r\nAfter thoroughly reviewing your concern, we would like to inform you that the behavior you have reported is working as designed. Please find the detailed explanation below:\r\n\r\n1. Detection of the Word \"Email Address\"\r\n\r\nThe detection triggered for the term \"Email Address\" (as plain text within your document) is handled by the detector named PII Soft Filter - English Standard 1. This detector is specifically configured to identify the keyword \"Email Address\" appearing within documents as part of our Personally Identifiable Information (PII) soft filtering rules. This is expected and intentional behavior.\r\n\r\n\r\n\r\n2. Detection of Email Address Pattern (e.g., xxx@xxx.com)\r\n\r\nSeparately, the detection triggered for actual email address patterns in the format xxx@xxx.com is managed by a dedicated detector named PII Soft Filter - Email. This detector is designed to identify and flag email address patterns present within documents to ensure compliance and data protection standards are met.\r\n\r\n\r\n\r\nIn summary, both detectors are functioning correctly and independently as per their defined configurations:\r\n\r\n- PII Soft Filter - English Standard 1 → Detects the literal text \"Email Address\"\r\n- PII Soft Filter - Email → Detects email address patterns (xxx@xxx.com)\r\n\r\nThere is no defect or anomaly in the system behavior. Both detections are by design and are in place to help protect sensitive information within your documents.\r\n\r\nShould you have any further questions or require additional clarification, please do not hesitate to contact us. We are happy to assist.","latestSfNote":"PS handling detector refinement — TS available for support — 07 Apr 2026","desc":"\"There are False Negatives for Email Address Detection- The pattern match to XXX@XXX.com is not working as expected.\n\nThere are False Positives in Email Address Detection - The documents with keyword 'email address' is getting identified with detector \"\"name\"\":\"\"PII Soft Filter - Email Address\"\".\"","sfCategory":"open","isUpgrade":false,"suggestion":"Working-as-designed — PII Soft Filter includes 'email address' as proximity anchor. Ensure paired with Hard Filter requiring valid RFC 5322 email pattern in proximity. In eido/Lucene: @ must be escaped, no lookahead — use simplified pattern *@*.* with field-level constraints."},
  {"case":"00964710","sfId":"500a600000voj17AAA","subject":"[ENBD] Inconsistancy in data discovery on detected same document","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"owner":"Kevin O'Donovan","component":"Classification - DSPM","resNotes":"This difference is mainly in advantage when we have a huge number of files to be scanned.\r\n\r\nAt first Scanning the files and classifying millions of file will take few hours, but to CATALOGUE them it be bit quicker that the classification, take reduced time in compare to classifying it.\r\n\r\nSo you may know how many files are there from the catalogued count.","latestSfNote":"Rancher notes reviewed, re-sent unclassified file for investigation — 06 Apr 2026","desc":"Scans performed on same file in 3 different path.\nThe discovery was performed properly on one location and skipped at both the other locations. \n\nClassified in 1 location\nCatalogued in 2 locations","sfCategory":"open","isUpgrade":false,"suggestion":"✅ Expected behaviour — classification applied to canonical path (first discovery path wins). Not a bug. For reporting: advise querying by file_hash rather than path for unique classified file counts."},
  {"case":"00964706","sfId":"500a600000vofQXAAY","subject":"Scan on new Scan Configuration not getting updated with latest Policy applied","status":"In Progress","priority":"Severity 2","isClosed":false,"created":"09 Feb 2026","closed":null,"owner":"Nathan Borowicz","component":"Classification - DSPM","resNotes":"Slack discussion shared with engineering team for investigation.","latestSfNote":"File duplication confirmed by design — two datasource configs = two result sets — 14 Apr 2026","desc":"The scan is performed on same user on 2 separate days on 2 scan configurations. There was a policy update performed after the first scan.\n\nIssues Identified : \n1. Both the results (before and after policy update) had same results and ingestion date even when the policies were updated after the first scan. As the policies are updated before the second scan the latest policies should have been applied for the second scan. \n\n2. The number of files discovered are duplicated when the scans are conducted on same user on 2 different scan configuration.  We identified that :\nThe number of document  identified after 1st scan on user on a scan configuration - 14K \nOn second scan on same user on another scan configuration - The number of discovered file again got added with 14 K (duplicated the same documents for same user)\n\n3. To get the latest or current scan results for a use, we will need to delete all the exisiting scan configuration for the user from Dashboard which will delete all the previous scan result for the user. Then new scan configuration needs to be created for the user and a new scan should be initiated for the user for the latest policy to reflect.\nOtherwise old policies which are even deleted will be shown in latest report. Also the scan results and detectors, data attributes, complaince tag, ingestion date remain the same as previous scan report.","sfCategory":"open","isUpgrade":false,"suggestion":"✅ EXPECTED BEHAVIOUR — documented in GS-3704 (comment added 13 Apr 2026). Each time a new scan connection is established, DSPM generates a unique hexadecimal configurationId/connector key. No cross-configuration deduplication. Fix: identify and remove duplicate scan configuration, then initiate a full rescan under the single remaining configuration."},
  {"case":"00963148","sfId":"500a600000v4KfLAAU","subject":"ENDB | Vulnerability on Rancher Manager","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"04 Feb 2026","closed":"14 Feb 2026","owner":"Sri Shyaam R","component":"Server - DSPM","resNotes":null,"latestSfNote":null,"desc":"We have received a Cyber Security Advisory from CBUAE on the rancher vulnerability identified. \r\nPlease check and let us know immediately if  Forcepoint  DSPM is affected by the rancher vulnerability being cited in the CBUAE notification.\r\n\r\n5) A high-severity vulnerability exists in Rancher Manager where the Rancher CLI login command may bypass TLS verification when using self-signed certificates with the --skip-verify flag. Refer to the enclosed copy of the UAE Cyber Security Council Advisory, ‘Ref: 432318349, High-Severity Vulnerability in SUSE Rancher’, dated 4 February 2026, with specific recommendations against increased cyber threats.","sfCategory":"nrc","isUpgrade":false,"suggestion":"Check specific CVE against Rancher version in ENBD's DSPM cluster. If affected, ENBD's CISO team requires formal Vendor Security Advisory response. Coordinate with Engineering for official CVE impact statement."},
  {"case":"00945594","sfId":"500a600000mrf9RAAQ","subject":"DEV EI-41268 : Re-open 00927426 : Again ENBD not able to download forensics from DPS environment","status":"Awaiting Customer","priority":"Severity 2","isClosed":false,"created":"11 Dec 2025","closed":null,"owner":"Nomvula Ncube","component":"Management Server - DLP","resNotes":"Hello Vaisakh,\r\n\r\nThank you for your time in the call, as discussed, we need to collect the logs at the time of the issues.\r\n\r\nI will keep this hold for your update.\r\n\r\nWe need to grab below logs to check the issue further.\r\n\r\n-  please start the wireshark capture at the time of the issues.\r\n-  Please take a backup of the file and replace the attached in this location dss_home%\\tomcat\\lib\\log4j-dlp.properties to enable the debug entries for DPS events.\r\n\r\n- Another debug to get the memory dump of the service.\r\n\r\n1.    On the FSM server create a folder named C:\\test\\\r\n2.    Download the zip file from https://download.oracle.com/java/20/latest/jdk-20_windows-x64_bin.zip\r\n3.    Move this into the C:\\test\\ folder and extract\r\n4.    Open a command prompt as administrator \r\n5.    Run \r\ncd C:\\test\\jdk-20_windows-x64_bin\\jdk-20\\bin\r\n\r\n6.    Now run \r\ntasklist | find \"DSSManager\"\r\n\r\n7.    And gain the PID value for the DSSManager process for example \r\n\r\nC:\\test\\jdk-20_windows-x64_bin\\jdk-20\\bin>tasklist | find \"DSSManager\"\r\nDSSManager.exe               33992 Services                   0  1,817,232 K\r\n\r\nWhere here the PID value is 33992\r\n\r\n8.    Now run \r\njmap.exe -dump:format=b,file=c:\\test\\dssmanager.hpof PID\r\n\r\nReplacing PID with the value of the PID value you found earlier on for example \r\n\r\njmap.exe -dump:format=b,file=c:\\test\\dssmanager.hpof 33992\r\n\r\nThis should run and say “Heap dump file created”\r\n\r\nYou should now find a dssmanager.hpof file created in that C:\\Test\\ folder \r\n\r\n\r\n\r\nOnce issue is captured and attach below logs.\r\n\r\n1. Wireshark output.\r\n2. Please attach below logs and revert the debug.\r\n%DSS_HOME%tomcat\\logs\\dlp\\\r\n%DSS_HOME%data-batch-server\\service-container\\container\\logs\\\r\n%DSS_HOME%Logs\r\n\r\n3. Tomcat memory dump from C:\\Test\\\r\n\r\nRegards,\r\nDineshkumar","latestSfNote":null,"desc":"We are again experiencing the issue with the DPS forensics.  Network Email channel is not showing forensics again .  Endpoint Email channel forensics is fine but  Network Email (DPS) is not showing \n\n\nThis is impacting the BANK SOC operation analysis , we need immediate assistance \nReopen 00927426","sfCategory":"open","isUpgrade":false,"suggestion":"Jira EI-41268 ([ENBD] Unable to download forensics from DPS) closed 07 Apr 2026. Jira EI-41744 ([ENBD] DLP time-outs for emails via DPS) closed 15 Apr 2026. Both related Jira tickets now closed. Awaiting Wireshark capture and DPS debug logs from customer to confirm root cause and close SF case."},
  {"case":"00945017","sfId":"500a600000meqcBAAQ","subject":"Proactive Case - Protector Installation in ENBD environment","status":"Closed","priority":"Severity 2","isClosed":true,"created":"10 Dec 2025","closed":"15 Dec 2025","owner":"Bruce Compton","component":null,"resNotes":null,"latestSfNote":null,"desc":"We going ahead with protector installation and cut over with production network for ICAP connection. For any issue on Forcepoint side we would need Forcepoint support team as back up. Please align an engineer to 9.30 PM UAE time for this activity. Thanks in advance","sfCategory":"resolved","isUpgrade":false,"suggestion":""},
  {"case":"00941179","sfId":"500a600000l6qVXAAY","subject":"Deleted Detectors Still Appearing in Rescan Results","status":"Closed - No Response from Customer","priority":"Severity 3","isClosed":true,"created":"28 Nov 2025","closed":"08 Dec 2025","owner":"Nathan Borowicz","component":"Configuration - DSPM","resNotes":null,"latestSfNote":null,"desc":"The detectors that were previously deleted are still appearing in the scan results when we perform a rescan. The only current workaround is to delete the entire scan and initiate a new one. However, this becomes impractical for customers with thousands of connectors.","sfCategory":"nrc","isUpgrade":false,"suggestion":"Same root cause as 00964706 — configurationId-scoped architecture. Deleting a detector does not retroactively remove hits from existing scan result records. Only way is a full rescan with updated detector set. Recommend raising with Engineering for a 'rescan with updated policy' capability."}
];

// ─── SF SYNC HELPERS ─────────────────────────────────────────────────────────
const deriveSfCategory = (status, isClosed) => {
  if (!isClosed) return "open";
  const l = (status || "").toLowerCase();
  if (l.includes("no response")) return "nrc";
  if (l.includes("unconfirmed")) return "unconfirmed";
  return "resolved";
};

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
  if(l.includes("awaiting customer")) return "purple";
  if(l.includes("resolution provided")) return "teal";
  if(l.includes("response received")) return "amber";
  if(l==="closed") return "green";
  if(l.includes("no response")) return "nrc";
  if(l.includes("unconfirmed")) return "amber";
  return "grey";
};

const TABS_FP   = [{id:"all",label:"All"},{id:"open",label:"Open"},{id:"upgrade",label:"🔺 Post-Upgrade"},{id:"closed",label:"Closed"},{id:"nrc",label:"NRC ⚠"},{id:"unconfirmed",label:"Unconfirmed"},{id:"resolved",label:"Resolved"},{id:"changelog",label:"📋 Change Log"}];
const TABS_ENBD = [{id:"all",label:"All Cases"},{id:"open",label:"Open"},{id:"upgrade",label:"🔺 Post-Upgrade"},{id:"unconfirmed",label:"Unconfirmed"},{id:"closed",label:"Closed"},{id:"changelog",label:"📋 Change Log"}];

// ─── ROLE GATE ────────────────────────────────────────────────────────────────
function RoleGate({onSelect}) {
  const [name,setName]=useState(""); const [org,setOrg]=useState("");
  const handleEnter = async () => {
    if(!name.trim()||!org) return;
    const u={name:name.trim(),org};
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

  const countBase=ownerFilter?merged.filter(c=>c.owner===ownerFilter):merged;
  const counts={all:countBase.length,open:countBase.filter(c=>!c.isClosed).length,upgrade:countBase.filter(c=>c.isUpgrade).length,nrc:countBase.filter(c=>c.sfCategory==="nrc").length,unconfirmed:countBase.filter(c=>c.sfCategory==="unconfirmed").length,resolved:countBase.filter(c=>c.sfCategory==="resolved").length,closed:countBase.filter(c=>c.isClosed).length,changelog:changelog.length};

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
          <span>Forcepoint DSPM · Emirates NBD · AccountId: 0015f00000R7aqFAAR · {allCases.length} cases{addedCases.length>0?` · ${addedCases.length} added`:""} · {filtered.length} shown · synced 16 Apr 2026</span>
          <span>{SUPA_URL?"☁ Supabase · shared across all users":"⚠ localStorage · changes not shared"} · {ready?"✓ Ready":"⌛ Loading..."}</span>
        </div>
      </div>

      {addingCase&&isFP&&<AddCaseModal onSave={saveNewCase} onClose={()=>setAddingCase(false)}/>}
    </div>
  );
}
