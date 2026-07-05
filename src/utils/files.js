// File helpers for chat attachments & voice messages.
// expo-file-system changed APIs across SDKs, so every operation tries
// the legacy API first, then the new File API — same philosophy as
// smartCompress in utils/image.js.
import * as FS from 'expo-file-system';

let LegacyFS = null;
try { LegacyFS = require('expo-file-system/legacy'); } catch (e) {}

// Read any local file as base64.
export async function readFileB64(uri) {
  const legacy = LegacyFS || FS;
  if (typeof legacy.readAsStringAsync === 'function') {
    return legacy.readAsStringAsync(uri, { encoding: 'base64' });
  }
  if (FS.File) {
    const f = new FS.File(uri);
    if (typeof f.base64 === 'function') return await f.base64();
    if (typeof f.base64Sync === 'function') return f.base64Sync();
  }
  throw new Error('Cannot read file on this SDK — run: npx expo install expo-file-system');
}

// Write base64 to a cache file and return its uri (for playback/sharing).
export async function writeTempB64(b64, filename) {
  const legacy = LegacyFS || FS;
  if (typeof legacy.writeAsStringAsync === 'function' && legacy.cacheDirectory) {
    const uri = legacy.cacheDirectory + filename;
    await legacy.writeAsStringAsync(uri, b64, { encoding: 'base64' });
    return uri;
  }
  if (FS.File && FS.Paths?.cache) {
    const f = new FS.File(FS.Paths.cache, filename);
    try { f.delete(); } catch (e) {}
    f.create();
    if (typeof f.write === 'function') {
      f.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      return f.uri;
    }
  }
  throw new Error('Cannot write file on this SDK — run: npx expo install expo-file-system');
}

export const fmtBytes = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Icon + label for a file card, by mime/extension.
export function fileKind(mime = '', name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return { icon: 'image', label: 'Image' };
  if (m.startsWith('video/')) return { icon: 'videocam', label: 'Video' };
  if (m.startsWith('audio/')) return { icon: 'musical-notes', label: 'Audio' };
  if (m.includes('pdf') || ext === 'pdf') return { icon: 'document-text', label: 'PDF' };
  if (['doc', 'docx'].includes(ext)) return { icon: 'document', label: 'Word' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'easel', label: 'PowerPoint' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { icon: 'grid', label: 'Sheet' };
  if (['zip', 'rar', '7z'].includes(ext)) return { icon: 'archive', label: 'Archive' };
  if (['js', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'ts', 'jsx'].includes(ext))
    return { icon: 'code-slash', label: 'Code' };
  if (['txt', 'md'].includes(ext)) return { icon: 'reader', label: 'Text' };
  return { icon: 'document-attach', label: 'File' };
}
