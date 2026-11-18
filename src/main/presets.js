const video = (h) => ({
  id: `v${h}`,
  type: 'video',
  label: `${h}p`,
  height: h,
  flags: {
    format: `bv*[height<=${h}]+ba/b[height<=${h}]`,
    mergeOutputFormat: 'mp4'
  }
})

const audio = (k) => ({
  id: `a${k}`,
  type: 'audio',
  label: `${k} kbps`,
  kbps: k,
  flags: {
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: `${k}K`
  }
})

export const PRESETS = [
  video(360),
  video(480),
  video(720),
  video(1080),
  audio(64),
  audio(128),
  audio(192),
  audio(256),
  audio(320)
]

export const getPreset = (id) => PRESETS.find((p) => p.id === id) ?? null

/** ส่งให้ renderer ใช้สร้างตัวเลือก (ไม่ส่ง flags ออกไป) */
export const publicPresets = () =>
  PRESETS.map(({ flags: _flags, ...rest }) => rest)
