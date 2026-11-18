import { app } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import youtubedl from 'youtube-dl-exec'
import { getPreset } from './presets.js'
import { normalizeYoutubeUrl } from './url.js'

const execFileAsync = promisify(execFile)

const BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'

// dev: ใช้ไบนารีที่ youtube-dl-exec โหลดไว้ใน node_modules
// production: ไบนารีต้องถูก unpack ออกจาก asar (ดู asarUnpack ใน electron-builder.yml)
const binPath = app.isPackaged
  ? join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'youtube-dl-exec',
      'bin',
      BIN_NAME
    )
  : youtubedl.constants.YOUTUBE_DL_PATH

const ytdl = app.isPackaged ? youtubedl.create(binPath) : youtubedl

const jobs = new Map() // jobId -> { proc, cancelled }

const nul = (v) => (v == null || v === 'NA' || v === 'None' || v === '' ? null : Number(v))

function friendlyError(stderr = '') {
  const s = stderr.toLowerCase()
  if (s.includes('private video')) return 'วิดีโอนี้เป็นส่วนตัว'
  if (s.includes('video unavailable') || s.includes('this video is not available'))
    return 'วิดีโอนี้ไม่พร้อมใช้งาน'
  if (s.includes('confirm your age')) return 'วิดีโอนี้จำกัดอายุ ต้องล็อกอินเพื่อดู'
  if (s.includes("confirm you're not a bot") || s.includes('confirm you’re not a bot'))
    return 'YouTube ขอให้ยืนยันว่าไม่ใช่บอท ลองใหม่ภายหลัง'
  if (s.includes('ffmpeg') && s.includes('not found')) return 'ไม่พบ ffmpeg ในเครื่อง'
  if (s.includes('unable to download') || s.includes('urlopen error') || s.includes('network'))
    return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้'
  const last = stderr.trim().split('\n').pop()
  return last ? last.replace(/^ERROR:\s*/, '') : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
}

async function version(cmd, args) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 8000 })
    return { ok: true, version: stdout.split('\n')[0].trim() }
  } catch {
    return { ok: false, version: null }
  }
}

export async function checkDeps() {
  const py = process.platform === 'win32' ? 'python' : 'python3'
  const [python, ffmpeg, ytdlp] = await Promise.all([
    version(py, ['--version']),
    version('ffmpeg', ['-version']),
    version(binPath, ['--version'])
  ])
  return { python, ffmpeg, ytdlp }
}

export async function getInfo(input) {
  const n = normalizeYoutubeUrl(input)
  if (!n.ok) return n
  try {
    const info = await ytdl(n.url, {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
      skipDownload: true
    })
    if (info.is_live) return { ok: false, error: 'ยังไม่รองรับไลฟ์สด' }
    const heights = [
      ...new Set(
        (info.formats ?? [])
          .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
          .map((f) => f.height)
      )
    ].sort((a, b) => a - b)
    return {
      ok: true,
      url: n.url,
      id: info.id,
      title: info.title,
      uploader: info.uploader ?? null,
      duration: info.duration ?? null,
      thumbnail: info.thumbnail ?? null,
      heights
    }
  } catch (e) {
    return { ok: false, error: friendlyError(e.stderr ?? e.message) }
  }
}

/**
 * @param {{ jobId: string, url: string, presetId: string }} req
 * @param {(p: object) => void} onProgress
 */
export function startDownload({ jobId, url, presetId }, onProgress) {
  const n = normalizeYoutubeUrl(url)
  if (!n.ok) return Promise.resolve(n)
  const preset = getPreset(presetId)
  if (!preset) return Promise.resolve({ ok: false, error: 'ไม่พบคุณภาพที่เลือก' })
  if (typeof jobId !== 'string' || !jobId || jobs.has(jobId))
    return Promise.resolve({ ok: false, error: 'jobId ไม่ถูกต้อง' })

  const output = join(app.getPath('downloads'), `%(title).150B [${preset.label}].%(ext)s`)
  const flags = {
    noPlaylist: true,
    noWarnings: true,
    newline: true,
    progress: true,
    noSimulate: true,
    output,
    print: 'after_move:FILE:%(filepath)s',
    progressTemplate: [
      'download:DL:%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
      'postprocess:PP:%(progress.status)s'
    ],
    ...preset.flags
  }

  const expected = preset.type === 'video' ? 2 : 1 // วิดีโอ+เสียงแยกกัน (โดยประมาณ)
  let finished = 0
  let filePath = null
  let stderr = ''
  let buf = ''

  const emit = (p) => onProgress?.({ jobId, ...p })

  const handleLine = (line) => {
    if (line.startsWith('DL:')) {
      const [done, total, est, speed, eta] = line.slice(3).split('|').map(nul)
      const size = total ?? est
      const pct = size ? Math.min(done / size, 1) : 0
      const overall = Math.min((finished + pct) / expected, 0.95)
      emit({ phase: 'downloading', percent: Math.round(overall * 1000) / 10, speed, eta })
      if (pct >= 1) finished += 1
    } else if (line.startsWith('PP:')) {
      emit({ phase: 'processing', percent: 97 })
    } else if (line.startsWith('FILE:')) {
      filePath = line.slice(5).trim()
    }
  }

  const proc = ytdl.exec(n.url, flags)
  const job = { proc, cancelled: false }
  jobs.set(jobId, job)
  emit({ phase: 'starting', percent: 0 })

  proc.stdout?.on('data', (chunk) => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop() ?? ''
    lines.forEach(handleLine)
  })
  proc.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  return proc
    .then(() => {
      if (buf) handleLine(buf)
      emit({ phase: 'done', percent: 100 })
      return { ok: true, filePath }
    })
    .catch((e) => {
      if (job.cancelled) {
        emit({ phase: 'cancelled', percent: 0 })
        return { ok: false, cancelled: true, error: 'ยกเลิกแล้ว' }
      }
      const error = friendlyError(stderr || e.message)
      emit({ phase: 'error', percent: 0, error })
      return { ok: false, error }
    })
    .finally(() => jobs.delete(jobId))
}

export function cancelDownload(jobId) {
  const job = jobs.get(jobId)
  if (!job) return false
  job.cancelled = true
  job.proc.kill('SIGTERM')
  return true
}

export function cancelAll() {
  for (const id of [...jobs.keys()]) cancelDownload(id)
}
