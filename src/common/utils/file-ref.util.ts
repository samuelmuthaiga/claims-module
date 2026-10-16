import { FileRef } from '../../domain/claim.types';

/**
 * The UI uploads a file and holds its URL; the API spec refers to confirmed
 * `fileId`s. Both are accepted until the file service defines one contract.
 * A bare fileId resolves to a read URL on the files host.
 */
export const resolveFileRef = (
  url: string | undefined,
  fileId: string | undefined,
  fallbackName: string,
): FileRef | undefined => {
  if (!url && !fileId) return undefined;
  const resolvedUrl = url ?? `https://files.claims.autochek.africa/files/${encodeURIComponent(fileId!)}`;
  const name = decodeURIComponent(resolvedUrl.split('?')[0]!.split('/').pop() || fallbackName) || fallbackName;
  return { fileId, name, url: resolvedUrl };
};

export const toFileView = (file: FileRef | undefined | null) =>
  file ? { fileId: file.fileId ?? null, name: file.name, readUrl: file.url } : null;
