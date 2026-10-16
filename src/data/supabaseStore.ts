import { requireSupabase } from "./supabase";
import type { Db, Photo } from "./types";

export const emptyLiveDb = (): Db => ({ version: 3, customers: [], workers: [], admins: [], jobs: [], notices: [], settings: { commissionPct: 10, confirmWindowHours: 48 }, session: null });
export async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error, status } = await requireSupabase().rpc(name, args);
  if (error && status === 401) window.dispatchEvent(new Event("siesie:session-expired"));
  if (error) throw new Error(error.message);
  return data as T;
}
// Storage paths are kept in the database. Expiring signed URLs exist only in memory.
const signed = new Map<string, { url: string; expires: number }>();
const original = new Map<string, string>();
async function resolveImage(value: string): Promise<string> {
  if (!value.startsWith("storage://")) return value;
  const [, bucket, path] = value.match(/^storage:\/\/([^/]+)\/(.+)$/) || [];
  if (!bucket || !path) return "";
  if (bucket === "siesie-portfolio") {
    const url = requireSupabase().storage.from(bucket).getPublicUrl(path).data.publicUrl;
    original.set(url, value);
    return url;
  }
  const cached = signed.get(value);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 300);
  if (error) throw new Error("An attached photo could not be loaded. Please try again.");
  signed.set(value, { url: data.signedUrl, expires: Date.now() + 240_000 });
  original.set(data.signedUrl, value);
  return data.signedUrl;
}
async function hydrate(value: unknown, field = ""): Promise<unknown> {
  if (typeof value === "string") return ["src", "frontPhoto", "selfie"].includes(field) ? resolveImage(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map((item) => hydrate(item)));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await hydrate(item, key)])));
  return value;
}
export function clearLiveImages() { signed.clear(); original.clear(); }
export async function liveSnapshot(): Promise<Db> {
  // Supabase validates the access token on the RPC. A temporary network error
  // must not destroy a valid local auth session.
  return await hydrate(await rpc<Db>("siesie_snapshot")) as Db;
}
export async function uploadImage(src: string | undefined, folder: string, publicPhoto = false): Promise<string | undefined> {
  if (!src) return undefined;
  if (original.has(src)) return original.get(src);
  if (src.startsWith("storage://")) return src;
  if (!src.startsWith("data:image/")) throw new Error("Choose a new JPG or PNG photo.");
  const client = requireSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Log in before uploading a photo.");
  const blob = await (await fetch(src)).blob();
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type) || blob.size > 5 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP image smaller than 5 MB.");
  const bucket = publicPhoto ? "siesie-portfolio" : "siesie-private";
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${blob.type.split("/")[1]}`;
  const { error: uploadError } = await client.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  return `storage://${bucket}/${path}`;
}
export async function uploadPhotos(photos: Photo[], folder: string, publicPhoto = false): Promise<Photo[]> {
  return Promise.all(photos.map(async (photo) => ({ id: photo.id, caption: photo.caption, src: await uploadImage(photo.src, folder, publicPhoto) })));
}
export async function liveAction<T>(action: string, input: Record<string, unknown>): Promise<T> {
  const payload = { ...input };
  const jobId = String(payload.jobId || payload.id || "");
  for (const key of ["photos", "evidence"]) if (Array.isArray(payload[key])) payload[key] = await uploadPhotos(payload[key] as Photo[], `jobs/${jobId}`);
  if (action === "register_worker" || action === "resubmit_verification") {
    payload.frontPhoto = await uploadImage(payload.frontPhoto as string | undefined, "verification");
    payload.selfie = await uploadImage(payload.selfie as string | undefined, "verification");
  }
  if (action === "portfolio") payload.photo = (await uploadPhotos([payload.photo as Photo], "portfolio", true))[0];
  return rpc<T>("siesie_action", { action, input: payload });
}
