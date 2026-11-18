const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be'
])

const ID_RE = /^[\w-]{11}$/

/**
 * รับลิงก์ YouTube ทุกรูปแบบ แล้วคืนลิงก์มาตรฐาน https://www.youtube.com/watch?v=ID
 * @param {string} input
 * @returns {{ ok: true, url: string, videoId: string } | { ok: false, error: string }}
 */
export function normalizeYoutubeUrl(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: false, error: 'กรุณาวางลิงก์ YouTube' }

  let u
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' }
  }

  const host = u.hostname.toLowerCase()
  if (!YT_HOSTS.has(host)) return { ok: false, error: 'รองรับเฉพาะลิงก์ YouTube' }

  const parts = u.pathname.split('/').filter(Boolean)
  let id = null

  if (host === 'youtu.be') {
    id = parts[0]
  } else if (parts[0] === 'watch') {
    id = u.searchParams.get('v')
  } else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) {
    id = parts[1]
  }

  if (!id || !ID_RE.test(id)) {
    if (parts[0] === 'playlist') {
      return { ok: false, error: 'ลิงก์เพลย์ลิสต์ยังไม่รองรับ กรุณาใช้ลิงก์วิดีโอเดี่ยว' }
    }
    return { ok: false, error: 'ไม่พบรหัสวิดีโอในลิงก์นี้' }
  }

  return { ok: true, url: `https://www.youtube.com/watch?v=${id}`, videoId: id }
}
