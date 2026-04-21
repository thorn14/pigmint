export interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

export interface SaveOptions {
  suggestedName: string;
  mimeType: string;
  types: PickerType[];
}

export interface SaveResult {
  kind: 'saved' | 'downloaded' | 'cancelled';
  fileName?: string;
}

interface FileSystemWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  name: string;
  createWritable(): Promise<FileSystemWritable>;
}

interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: PickerType[];
}

type ShowSaveFilePicker = (
  opts?: ShowSaveFilePickerOptions,
) => Promise<FileSystemFileHandleLike>;

function getPicker(): ShowSaveFilePicker | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
    .showSaveFilePicker;
  return typeof picker === 'function' ? picker : null;
}

export function hasFileSystemAccess(): boolean {
  return getPicker() !== null;
}

function downloadText(text: string, filename: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export async function writeToHandle(
  handle: FileSystemFileHandleLike,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function saveToNewFile(
  text: string,
  options: SaveOptions,
): Promise<{ result: SaveResult; handle: FileSystemFileHandleLike | null }> {
  const picker = getPicker();
  if (!picker) {
    downloadText(text, options.suggestedName, options.mimeType);
    return {
      result: { kind: 'downloaded', fileName: options.suggestedName },
      handle: null,
    };
  }
  try {
    const handle = await picker({
      suggestedName: options.suggestedName,
      types: options.types,
    });
    await writeToHandle(handle, text);
    return { result: { kind: 'saved', fileName: handle.name }, handle };
  } catch (err) {
    if (isAbortError(err)) {
      return { result: { kind: 'cancelled' }, handle: null };
    }
    throw err;
  }
}

export async function saveToExistingHandle(
  handle: FileSystemFileHandleLike,
  text: string,
): Promise<SaveResult> {
  await writeToHandle(handle, text);
  return { kind: 'saved', fileName: handle.name };
}

export type { FileSystemFileHandleLike };
