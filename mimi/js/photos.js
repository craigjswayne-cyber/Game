/*
 * PROGRESS PHOTOS.
 *
 * A check-in photo is the most personal thing this app holds, so it never
 * leaves the device: the file is read in the page, drawn onto a canvas at no
 * more than 720px on its long edge, and stored as a JPEG data URL alongside the
 * check-in. No upload, no object URL that dies on reload, no third party.
 *
 * The downscale is not cosmetic. A modern phone photo is four megabytes and
 * localStorage is about five, so storing the original would fill the save on
 * the first check-in and lose everything else with it.
 */
const MAX_EDGE = 720
const QUALITY = 0.6

export const MAX_PHOTOS = 3

/* One file in, one data URL out. Rejects anything that is not an image. */
export function shrink(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('not an image')); return }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('could not read the file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('could not decode the image'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/* A FileList in, up to MAX_PHOTOS data URLs out. One bad file does not take the
   others down with it. */
export async function shrinkAll(files) {
  const out = []
  for (const file of [...files].slice(0, MAX_PHOTOS)) {
    try { out.push(await shrink(file)) } catch (err) { console.warn('Made by Mimi: skipped a photo.', err.message) }
  }
  return out
}
