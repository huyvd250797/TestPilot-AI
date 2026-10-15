import "server-only";
import { createHash } from "crypto";
import { adminDb } from "./supabase";

export type MemoryElementInput = {
  automationId?: string | null;
  name?: string | null;
  role?: string | null;
  controlType?: string | null;
  className?: string | null;
  selector?: string | null;
  placeholder?: string | null;
  inputType?: string | null;
  enabled?: boolean | null;
  offscreen?: boolean | null;
};

export type ScreenObservation = {
  projectId?: string | null;
  environmentId?: string | null;
  platform: "web" | "windows";
  name: string;
  locationHint?: string | null;
  elements: MemoryElementInput[];
  screenshotUrl?: string | null;
  successfulUse?: boolean;
};

const usefulControlTypes = new Set([
  "button", "edit", "textbox", "combobox", "list", "listitem", "menu", "menuitem",
  "checkbox", "radiobutton", "tab", "tabitem", "hyperlink", "link", "datagrid", "table",
  "tree", "treeitem", "document", "input", "select", "textarea", "option",
]);

function compact(value?: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, 220);
}

function normalizeDynamic(value: string) {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "{uuid}")
    .replace(/\b\d{4,}\b/g, "{n}")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedLocation(platform: "web" | "windows", location?: string | null) {
  const raw = compact(location);
  if (!raw) return "";
  if (platform === "web") {
    try {
      const u = new URL(raw);
      return `${u.host}${u.pathname}`
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "{uuid}")
        .replace(/\/\d+(?=\/|$)/g, "/{id}");
    } catch { /* route/path is still useful */ }
  }
  return normalizeDynamic(raw);
}

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeMemoryElements(elements: MemoryElementInput[]) {
  const dedup = new Map<string, MemoryElementInput>();
  for (const raw of elements) {
    if (raw.offscreen === true || raw.enabled === false) continue;
    const type = compact(raw.controlType || raw.role).toLowerCase();
    const hasIdentity = Boolean(compact(raw.automationId) || compact(raw.name) || compact(raw.selector) || compact(raw.placeholder));
    if (!hasIdentity) continue;
    if (type && !usefulControlTypes.has(type) && !raw.automationId && !raw.selector) continue;
    const semanticKey = sha([
      compact(raw.automationId).toLowerCase(),
      normalizeDynamic(compact(raw.name)),
      type,
      normalizeDynamic(compact(raw.placeholder)),
      compact(raw.inputType).toLowerCase(),
    ].join("|"));
    if (!dedup.has(semanticKey)) dedup.set(semanticKey, { ...raw, name: compact(raw.name), automationId: compact(raw.automationId), controlType: compact(raw.controlType), role: compact(raw.role), selector: compact(raw.selector), placeholder: compact(raw.placeholder), inputType: compact(raw.inputType), className: compact(raw.className) });
    if (dedup.size >= 80) break;
  }
  return [...dedup.entries()].map(([semanticKey, element]) => ({ semanticKey, ...element }));
}

export function memoryIdentity(observation: Pick<ScreenObservation, "platform"|"name"|"locationHint"|"elements">) {
  const elements = normalizeMemoryElements(observation.elements);
  const name = normalizeDynamic(compact(observation.name) || "unknown screen");
  const location = normalizedLocation(observation.platform, observation.locationHint);
  const windowsAnchors = observation.platform === "windows"
    ? elements.map(e => compact(e.automationId).toLowerCase()).filter(Boolean).sort().slice(0, 8).join(",")
      || elements.map(e => normalizeDynamic(compact(e.name))).filter(Boolean).sort().slice(0, 5).join(",")
    : "";
  const semanticKey = sha(`${observation.platform}|${name}|${location}|${windowsAnchors}`).slice(0, 40);
  const signatures = elements.map(e => [compact(e.automationId).toLowerCase(), normalizeDynamic(compact(e.name)), compact(e.controlType || e.role).toLowerCase(), normalizeDynamic(compact(e.placeholder))].join("|")).sort();
  const fingerprint = sha(`${observation.platform}|${name}|${location}|${signatures.join(";")}`);
  return { semanticKey, fingerprint, elements, normalizedName: compact(observation.name) || "Unknown screen", normalizedLocation: location };
}

function scopeQuery<T extends { eq: Function; is: Function }>(query: T, environmentId?: string | null) {
  return environmentId ? query.eq("environment_id", environmentId) : query.is("environment_id", null);
}

export async function rememberScreenObservation(observation: ScreenObservation) {
  const db = adminDb();
  if (!db || !observation.projectId) return null;
  const identity = memoryIdentity(observation);
  let query: any = db.from("application_screens").select("*").eq("project_id", observation.projectId).eq("platform", observation.platform).eq("semantic_key", identity.semanticKey);
  query = scopeQuery(query, observation.environmentId);
  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) throw readError;
  const now = new Date().toISOString();
  let screen: any = existing;
  let versionChanged = false;

  if (!screen) {
    const { data, error } = await db.from("application_screens").insert({
      project_id: observation.projectId,
      environment_id: observation.environmentId || null,
      platform: observation.platform,
      semantic_key: identity.semanticKey,
      name: identity.normalizedName,
      location_hint: observation.locationHint || null,
      current_fingerprint: identity.fingerprint,
      current_version: 1,
      canonical_screenshot_url: observation.screenshotUrl || null,
      status: observation.successfulUse ? "ACTIVE" : "CANDIDATE",
      confidence: observation.successfulUse ? 0.90 : 0.72,
      successful_use_count: observation.successfulUse ? 1 : 0,
      last_seen_at: now,
      updated_at: now,
    }).select().single();
    if (error) throw error;
    screen = data;
    versionChanged = true;
  } else {
    versionChanged = screen.current_fingerprint !== identity.fingerprint;
    const nextVersion = versionChanged ? Number(screen.current_version || 1) + 1 : Number(screen.current_version || 1);
    const seen = Number(screen.seen_count || 0) + 1;
    const success = Number(screen.successful_use_count || 0) + (observation.successfulUse ? 1 : 0);
    const confidence = Math.min(0.99, 0.60 + Math.min(0.25, seen * 0.025) + Math.min(0.14, success * 0.02));
    const { data, error } = await db.from("application_screens").update({
      name: identity.normalizedName,
      location_hint: observation.locationHint || screen.location_hint,
      current_fingerprint: identity.fingerprint,
      current_version: nextVersion,
      canonical_screenshot_url: versionChanged && observation.screenshotUrl ? observation.screenshotUrl : screen.canonical_screenshot_url,
      confidence,
      seen_count: seen,
      successful_use_count: success,
      status: (observation.successfulUse || seen >= 2) ? "ACTIVE" : (screen.status === "ARCHIVED" ? "ARCHIVED" : "CANDIDATE"),
      last_seen_at: now,
      updated_at: now,
    }).eq("id", screen.id).select().single();
    if (error) throw error;
    screen = data;
  }

  let versionQuery: any = db.from("screen_versions").select("*").eq("screen_id", screen.id).eq("fingerprint", identity.fingerprint);
  const { data: knownVersion } = await versionQuery.maybeSingle();
  if (knownVersion && versionChanged && Number(knownVersion.version) !== Number(screen.current_version)) {
    await db.from("application_screens").update({ current_version: knownVersion.version, updated_at: now }).eq("id", screen.id);
    screen.current_version = knownVersion.version;
  }
  if (!knownVersion) {
    await db.from("screen_versions").insert({
      screen_id: screen.id,
      version: screen.current_version,
      fingerprint: identity.fingerprint,
      screenshot_url: observation.screenshotUrl || null,
      useful_element_count: identity.elements.length,
      change_summary: versionChanged && existing ? `Fingerprint changed from ${String(existing.current_fingerprint).slice(0, 8)} to ${identity.fingerprint.slice(0, 8)}.` : "Initial canonical version.",
      first_seen_at: now,
      last_seen_at: now,
    });
  } else {
    await db.from("screen_versions").update({ last_seen_at: now, seen_count: Number(knownVersion.seen_count || 0) + 1 }).eq("id", knownVersion.id);
  }

  for (const e of identity.elements) {
    const row = {
      screen_id: screen.id,
      semantic_key: e.semanticKey,
      automation_id: e.automationId || null,
      name: e.name || null,
      role: e.role || null,
      control_type: e.controlType || null,
      class_name: e.className || null,
      selector: e.selector || null,
      placeholder: e.placeholder || null,
      input_type: e.inputType || null,
      confidence: observation.successfulUse ? 0.92 : 0.82,
      last_seen_at: now,
    };
    const { data: current } = await db.from("ui_elements").select("id,seen_count").eq("screen_id", screen.id).eq("semantic_key", e.semanticKey).maybeSingle();
    if (current) await db.from("ui_elements").update({ ...row, seen_count: Number(current.seen_count || 0) + 1 }).eq("id", current.id);
    else await db.from("ui_elements").insert(row);
  }

  return { screenId: screen.id as string, fingerprint: identity.fingerprint, version: screen.current_version as number, versionChanged, usefulElementCount: identity.elements.length };
}

export async function rememberNavigation(args: { projectId?: string|null; environmentId?: string|null; platform: "web"|"windows"; fromScreenId?: string|null; toScreenId?: string|null; actionType?: string|null; actionSignature?: string|null; target?: Record<string,unknown>; success?: boolean; }) {
  const db = adminDb();
  if (!db || !args.projectId || !args.fromScreenId || !args.toScreenId || args.fromScreenId === args.toScreenId) return;
  const signature = (args.actionSignature || args.actionType || "NAVIGATE").trim().slice(0, 240);
  let query: any = db.from("navigation_edges").select("*").eq("project_id", args.projectId).eq("platform", args.platform).eq("from_screen_id", args.fromScreenId).eq("to_screen_id", args.toScreenId).eq("action_signature", signature);
  query = scopeQuery(query, args.environmentId);
  const { data: existing } = await query.maybeSingle();
  const now = new Date().toISOString();
  if (existing) {
    await db.from("navigation_edges").update({
      success_count: Number(existing.success_count || 0) + (args.success === false ? 0 : 1),
      failure_count: Number(existing.failure_count || 0) + (args.success === false ? 1 : 0),
      confidence: Math.min(0.99, 0.70 + Math.min(0.25, Number(existing.success_count || 0) * 0.025)),
      last_seen_at: now,
      target: args.target || existing.target || {},
    }).eq("id", existing.id);
  } else {
    await db.from("navigation_edges").insert({
      project_id: args.projectId,
      environment_id: args.environmentId || null,
      platform: args.platform,
      from_screen_id: args.fromScreenId,
      to_screen_id: args.toScreenId,
      action_signature: signature,
      action_type: args.actionType || null,
      target: args.target || {},
      success_count: args.success === false ? 0 : 1,
      failure_count: args.success === false ? 1 : 0,
      last_seen_at: now,
    });
  }
}

export async function findMemoryContext(args: { projectId?: string|null; environmentId?: string|null; platform: "web"|"windows"; name: string; locationHint?: string|null; elements: MemoryElementInput[]; }) {
  const db = adminDb();
  if (!db || !args.projectId) return null;
  const identity = memoryIdentity(args);
  let query: any = db.from("application_screens").select("id,name,current_version,confidence,seen_count,successful_use_count").eq("project_id", args.projectId).eq("platform", args.platform).eq("semantic_key", identity.semanticKey);
  query = scopeQuery(query, args.environmentId);
  const { data: screen } = await query.maybeSingle();
  if (!screen) return null;
  const { data: controls } = await db.from("ui_elements").select("automation_id,name,role,control_type,selector,placeholder,confidence,seen_count").eq("screen_id", screen.id).order("seen_count", { ascending: false }).limit(30);
  const { data: outgoing } = await db.from("navigation_edges").select("action_signature,action_type,target,confidence,success_count,to_screen_id").eq("from_screen_id", screen.id).order("success_count", { ascending: false }).limit(12);
  return { screen, controls: controls || [], outgoing: outgoing || [], fingerprint: identity.fingerprint };
}
