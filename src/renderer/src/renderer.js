const yt = window.api.yt
const $ = (id) => document.getElementById(id)

const state = {
  presets: [],
  info: null,
  type: 'video',
  selected: { video: 'v720', audio: 'a128' },
  jobId: null,
  filePath: null,
  fetchSeq: 0,
  busy: false
}

const el = {
  deps: $('deps'),
  url: $('url'),
  clear: $('btn-clear'),
  urlStatus: $('url-status'),
  preview: $('preview'),
  thumb: $('thumb'),
  title: $('title'),
  uploader: $('uploader'),
  duration: $('duration'),
  options: $('options'),
  tabs: [$('tab-video'), $('tab-audio')],
  chips: $('chips'),
  qualityHint: $('quality-hint'),
  convert: $('btn-convert'),
  progress: $('progress'),
  phase: $('phase'),
  percent: $('percent'),
  barFill: $('bar-fill'),
  bar: document.querySelector('.bar'),
  speed: $('speed'),
  cancel: $('btn-cancel'),
  result: $('result'),
  resultMsg: $('result-msg'),
  resultActions: $('result-actions'),
  show: $('btn-show'),
  openDl: $('btn-open-dl')
}

const PHASE_TEXT = {
  starting: 'กำลังเริ่ม…',
  downloading: 'กำลังดาวน์โหลด',
  processing: 'กำลังแปลง/รวมไฟล์…'
}

const AUDIO_HINT =
  'ค่า kbps คือบิตเรตที่ใช้เข้ารหัส MP3 ต้นฉบับบน YouTube ราว 128–160 kbps การเลือกสูงกว่านั้นไม่ได้ทำให้เสียงดีขึ้น'

// helpers
const fmtDuration = (s) => {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
const fmtSpeed = (b) => (b ? `${(b / 1048576).toFixed(1)} MB/s` : '')
const fmtEta = (s) => (s == null ? '' : `เหลือ ${fmtDuration(s) || '0:00'}`)
const basename = (p) =>
  String(p ?? '')
    .split(/[\\/]/)
    .pop()

const setHidden = (node, hidden) => {
  node.hidden = hidden
}

function setUrlStatus(text, isError = false) {
  el.urlStatus.textContent = text
  el.urlStatus.classList.toggle('err', isError)
}

function setBusy(busy) {
  state.busy = busy
  el.url.disabled = busy
  el.clear.disabled = busy
  el.tabs.forEach((t) => (t.disabled = busy))
  el.chips.querySelectorAll('button').forEach((b) => (b.disabled = busy || b.dataset.off === '1'))
  updateConvertButton()
}

function updateConvertButton() {
  el.convert.disabled = state.busy || !state.info || !state.selected[state.type]
}

// presets / chips
function maxHeight() {
  const hs = state.info?.heights ?? []
  return hs.length ? Math.max(...hs) : Infinity
}

function isPresetAvailable(p) {
  return p.type !== 'video' || p.height <= maxHeight()
}

function renderTabs() {
  el.tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.type === state.type)))
}

function renderChips() {
  const list = state.presets.filter((p) => p.type === state.type)

  // ถ้าตัวที่เลือกไว้ใช้ไม่ได้ ให้ถอยไปตัวที่ใหญ่ที่สุดที่ใช้ได้
  const current = list.find((p) => p.id === state.selected[state.type])
  if (!current || !isPresetAvailable(current)) {
    const ok = list.filter(isPresetAvailable)
    state.selected[state.type] = ok.length ? ok[ok.length - 1].id : null
  }

  el.chips.replaceChildren(
    ...list.map((p) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'chip'
      b.textContent = p.label
      const available = isPresetAvailable(p)
      b.dataset.off = available ? '0' : '1'
      b.disabled = !available || state.busy
      b.setAttribute('aria-pressed', String(p.id === state.selected[state.type]))
      b.addEventListener('click', () => {
        state.selected[state.type] = p.id
        renderChips()
      })
      return b
    })
  )
  el.qualityHint.textContent = state.type === 'audio' ? AUDIO_HINT : ''
  updateConvertButton()
}

// fetch info
function resetInfo() {
  state.info = null
  setHidden(el.preview, true)
  setHidden(el.options, true)
  updateConvertButton()
}

function showInfo(info) {
  state.info = info
  el.thumb.src = info.thumbnail ?? ''
  el.title.textContent = info.title
  el.uploader.textContent = info.uploader ?? ''
  el.duration.textContent = fmtDuration(info.duration)
  setHidden(el.preview, false)
  setHidden(el.options, false)
  renderTabs()
  renderChips()
}

async function fetchInfo() {
  const raw = el.url.value.trim()
  setHidden(el.clear, !raw)
  setHidden(el.result, true)
  resetInfo()

  const seq = ++state.fetchSeq
  if (!raw) return setUrlStatus('')

  setUrlStatus('กำลังดึงข้อมูลวิดีโอ…')
  let res
  try {
    res = await yt.getInfo(raw)
  } catch {
    res = { ok: false, error: 'เกิดข้อผิดพลาดภายในแอป' }
  }
  if (seq !== state.fetchSeq) return // มีการพิมพ์ใหม่แล้ว ทิ้งผลเก่า

  if (!res.ok) return setUrlStatus(res.error, true)
  setUrlStatus('')
  showInfo(res)
}

let debounce
el.url.addEventListener('input', () => {
  clearTimeout(debounce)
  debounce = setTimeout(fetchInfo, 500)
})
el.url.addEventListener('paste', () => {
  clearTimeout(debounce)
  setTimeout(fetchInfo, 0) // รอให้ค่าเข้า input ก่อน
})
el.url.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounce)
    fetchInfo()
  }
})
el.clear.addEventListener('click', () => {
  el.url.value = ''
  fetchInfo()
  el.url.focus()
})

el.tabs.forEach((t) =>
  t.addEventListener('click', () => {
    state.type = t.dataset.type
    renderTabs()
    renderChips()
  })
)

// convert
function showProgress(p) {
  const pct = Math.max(0, Math.min(100, p.percent ?? 0))
  el.phase.textContent = PHASE_TEXT[p.phase] ?? ''
  el.percent.textContent = `${Math.round(pct)}%`
  el.barFill.style.width = `${pct}%`
  el.bar.setAttribute('aria-valuenow', String(Math.round(pct)))
  el.speed.textContent =
    p.phase === 'downloading' ? [fmtSpeed(p.speed), fmtEta(p.eta)].filter(Boolean).join(' · ') : ''
}

function showResult(message, kind, filePath = null) {
  state.filePath = filePath
  el.resultMsg.textContent = message
  el.resultMsg.className = kind
  setHidden(el.resultActions, !filePath)
  setHidden(el.result, false)
}

async function convert() {
  if (state.busy || !state.info) return
  const presetId = state.selected[state.type]
  if (!presetId) return

  state.jobId = crypto.randomUUID()
  setHidden(el.result, true)
  showProgress({ phase: 'starting', percent: 0 })
  setHidden(el.progress, false)
  setBusy(true)

  let res
  try {
    res = await yt.start({ jobId: state.jobId, url: state.info.url, presetId })
  } catch {
    res = { ok: false, error: 'เกิดข้อผิดพลาดภายในแอป' }
  }

  setHidden(el.progress, true)
  state.jobId = null
  setBusy(false)

  if (res.ok) {
    showResult(`บันทึกแล้ว: ${basename(res.filePath)}`, 'ok', res.filePath)
  } else if (res.cancelled) {
    showResult('ยกเลิกแล้ว', '')
  } else {
    showResult(res.error ?? 'ไม่สำเร็จ', 'err')
  }
}

el.convert.addEventListener('click', convert)
el.cancel.addEventListener('click', () => {
  if (state.jobId) yt.cancel(state.jobId)
})
el.show.addEventListener('click', () => state.filePath && yt.showInFolder(state.filePath))
el.openDl.addEventListener('click', () => yt.openDownloads())

yt.onProgress((p) => {
  if (p.jobId === state.jobId) showProgress(p)
})

// init
async function checkDeps() {
  const d = await yt.checkDeps()
  const missing = []
  if (!d.python.ok) missing.push('python3')
  if (!d.ffmpeg.ok) missing.push('ffmpeg')
  if (!d.ytdlp.ok) missing.push('yt-dlp (ลอง pnpm install ใหม่)')
  if (missing.length) {
    el.deps.textContent = `ไม่พบ: ${missing.join(', ')} — ต้องติดตั้งก่อนจึงจะ convert ได้`
    setHidden(el.deps, false)
  }
}

async function init() {
  state.presets = await yt.getPresets()
  renderTabs()
  renderChips()
  await checkDeps()
}

init()
