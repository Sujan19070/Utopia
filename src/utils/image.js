// Robust photo -> base64 JPEG for Firestore.
// Tries every available path so photo upload works on any Expo SDK:
//   1. expo-image-manipulator legacy API (manipulateAsync)
//   2. expo-image-manipulator new API (ImageManipulator.manipulate)
//   3. the base64 the image picker itself returned (no resize, last resort)
// Throws a readable error only if all three fail or the result is too big
// for a Firestore document.

const MAX_B64 = 950000; // ~700KB binary, safe under Firestore's 1MB doc limit

async function viaManipulator(uri, width, quality) {
  let IM;
  try {
    IM = await import('expo-image-manipulator');
  } catch (e) {
    return null; // package not installed
  }
  // Legacy API
  if (typeof IM.manipulateAsync === 'function') {
    try {
      const fmt = IM.SaveFormat?.JPEG ?? 'jpeg';
      const r = await IM.manipulateAsync(uri, [{ resize: { width } }], {
        compress: quality, format: fmt, base64: true,
      });
      if (r?.base64) return r.base64;
    } catch (e) {}
  }
  // New API
  const M = IM.ImageManipulator ?? IM.default?.ImageManipulator;
  if (M && typeof M.manipulate === 'function') {
    try {
      const ctx = M.manipulate(uri);
      ctx.resize({ width });
      const ref = await ctx.renderAsync();
      const fmt = IM.SaveFormat?.JPEG ?? 'jpeg';
      const r = await ref.saveAsync({ compress: quality, format: fmt, base64: true });
      if (r?.base64) return r.base64;
    } catch (e) {}
  }
  return null;
}

// asset: the object from ImagePicker result.assets[0]
// (call the picker with base64: true so the fallback path exists)
export async function smartCompress(asset, width = 900, quality = 0.55) {
  let b64 = await viaManipulator(asset.uri, width, quality);
  if (b64 && b64.length > MAX_B64) {
    b64 = await viaManipulator(asset.uri, Math.round(width * 0.7), 0.3);
  }
  if (!b64 && asset.base64) b64 = asset.base64; // picker fallback (unresized)
  if (!b64) {
    throw new Error(
      'Photo processing failed. Run: npx expo install expo-image-manipulator, then restart with npx expo start -c'
    );
  }
  if (b64.length > MAX_B64) {
    throw new Error('This photo is too large — please choose a smaller one.');
  }
  return b64;
}

// Back-compat for older call sites.
export async function compressToB64(uri, width = 900, quality = 0.55) {
  return smartCompress({ uri }, width, quality);
}
