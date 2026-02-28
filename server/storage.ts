// Supabase Storage helpers (server-side)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string; bucket: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.supabaseUrl;
  const apiKey = ENV.supabaseServiceKey;
  const bucket = ENV.supabaseStorageBucket || "public";

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Supabase storage credentials missing: set SUPABASE_URL and SUPABASE_SERVICE_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, bucket };
}

function buildUploadUrl(baseUrl: string, bucket: string, relKey: string): URL {
  return new URL(
    `storage/v1/object/${bucket}/${normalizeKey(relKey)}`,
    ensureTrailingSlash(baseUrl)
  );
}

function buildDeleteUrl(baseUrl: string, bucket: string, relKey: string): URL {
  return new URL(
    `storage/v1/object/${bucket}/${normalizeKey(relKey)}`,
    ensureTrailingSlash(baseUrl)
  );
}

function buildListUrl(baseUrl: string, bucket: string): URL {
  return new URL(
    `storage/v1/object/list/${bucket}`,
    ensureTrailingSlash(baseUrl)
  );
}

function buildPublicUrl(baseUrl: string, bucket: string, relKey: string): string {
  const publicBaseUrl = ENV.supabasePublicUrl || baseUrl;
  return new URL(
    `storage/v1/object/public/${bucket}/${normalizeKey(relKey)}`,
    ensureTrailingSlash(publicBaseUrl)
  ).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, apikey: apiKey };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey, bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, bucket, key);
  const body =
    typeof data === "string"
      ? Buffer.from(data, "utf-8")
      : data;
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      ...buildAuthHeaders(apiKey),
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  }).catch(err => {
    console.error(`Fetch error during storage upload: ${err.message}`, { url: uploadUrl.toString() });
    throw err;
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    console.error(`Storage upload failed: ${response.status} ${response.statusText}`, { 
      url: uploadUrl.toString(),
      message 
    });
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  return { key, url: buildPublicUrl(baseUrl, bucket, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey, bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  void apiKey;
  return {
    key,
    url: buildPublicUrl(baseUrl, bucket, key),
  };
}

export function getStorageKeyFromUrl(rawUrl: string): string | null {
  const { bucket } = getStorageConfig();
  try {
    const url = new URL(rawUrl);
    const path = url.pathname;
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const privateMarker = `/storage/v1/object/${bucket}/`;
    const publicIndex = path.indexOf(publicMarker);
    if (publicIndex >= 0) {
      return normalizeKey(path.slice(publicIndex + publicMarker.length));
    }
    const privateIndex = path.indexOf(privateMarker);
    if (privateIndex >= 0) {
      return normalizeKey(path.slice(privateIndex + privateMarker.length));
    }
    return null;
  } catch {
    return null;
  }
}

export async function storageDeleteByUrl(rawUrl: string): Promise<{ success: boolean; key: string }> {
  const { baseUrl, apiKey, bucket } = getStorageConfig();
  const key = getStorageKeyFromUrl(rawUrl);
  if (!key) {
    throw new Error("URL de imagem invalida ou fora do bucket configurado");
  }
  const deleteUrl = buildDeleteUrl(baseUrl, bucket, key);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: buildAuthHeaders(apiKey),
  }).catch(err => {
    console.error(`Fetch error during storage delete by URL: ${err.message}`, { url: deleteUrl.toString() });
    throw err;
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    console.error(`Storage delete by URL failed: ${response.status} ${response.statusText}`, { 
      url: deleteUrl.toString(),
      message 
    });
    throw new Error(
      `Storage delete failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  return { success: true, key };
}

export async function storageDeleteByKey(relKey: string): Promise<{ success: boolean; key: string }> {
  const { baseUrl, apiKey, bucket } = getStorageConfig();
  const key = normalizeKey(relKey);
  const deleteUrl = buildDeleteUrl(baseUrl, bucket, key);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: buildAuthHeaders(apiKey),
  }).catch(err => {
    console.error(`Fetch error during storage delete: ${err.message}`, { url: deleteUrl.toString() });
    throw err;
  });
  if (!response.ok) {
    if (response.status === 404) {
      console.warn(`Storage delete by key: file not found (404), treating as success`, { url: deleteUrl.toString() });
      return { success: true, key };
    }
    const message = await response.text().catch(() => response.statusText);
    console.error(`Storage delete failed: ${response.status} ${response.statusText}`, { 
      url: deleteUrl.toString(),
      message 
    });
    throw new Error(
      `Storage delete failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  return { success: true, key };
}

export async function storageList(prefix: string): Promise<string[]> {
  const { baseUrl, apiKey, bucket } = getStorageConfig();
  const listUrl = buildListUrl(baseUrl, bucket);
  const normalizedPrefix = normalizeKey(prefix);
  const prefixWithSlash = normalizedPrefix
    ? (normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`)
    : "";
  const limit = 1000;
  let offset = 0;
  const keys: string[] = [];

  while (true) {
    const response = await fetch(listUrl, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: prefixWithSlash, limit, offset }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage list failed (${response.status} ${response.statusText}): ${message}`
      );
    }

    const data = await response.json().catch(() => []);
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) break;

    for (const item of items) {
      const name = item?.name;
      if (!name) continue;
      const isFolder = item?.id == null && item?.metadata == null;
      if (isFolder) continue;
      keys.push(normalizeKey(`${prefixWithSlash}${name}`));
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return keys;
}
