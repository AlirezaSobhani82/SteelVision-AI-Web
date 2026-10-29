
import { useEffect, useState } from 'react'
import './App.css'
import IntroAnimation from './IntroAnimation';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

const initialStats = [
  { label: 'تصاویر بررسی‌شده', value: '۰', icon: '▧', color: 'orange' },
  { label: 'کل عیوب شناسایی‌شده', value: '۰', icon: '⌕', color: 'red' },
  { label: 'میانگین اطمینان مدل', value: '—', icon: '◎', color: 'green' },
  { label: 'کلاس‌های عیب شناسایی‌شده', value: '۰', icon: '◈', color: 'blue' },
]

const defectNames = {
  crease: 'چین‌خوردگی',
  crescent_gap: 'شکاف هلالی',
  inclusion: 'ناخالصی',
  oil_spot: 'لکه روغن',
  punching_hole: 'سوراخ پانچ',
  rolled_pit: 'حفره نورد',
  silk_spot: 'لکه ابریشمی',
  waist_folding: 'تاخوردگی میانی',
  water_spot: 'لکه آب',
  welding_line: 'خط جوش',
}

const sampleDefects = []
import * as XLSX from 'xlsx'

function exportExcel(history, defectNames) {
  if (!history.length) {
    alert('هنوز گزارشی برای خروجی گرفتن ثبت نشده است.')
    return
  }

  const summary = history.map((report) => ({
    'شناسه گزارش': report.id,
    'نام تصویر': report.image_name || '—',
    'زمان بازرسی': report.createdAt || '—',
    'تعداد کل عیوب': Number(report.total_defects || 0),
    'عرض تصویر': report.image_width || 0,
    'ارتفاع تصویر': report.image_height || 0,
  }))

  const detections = history.flatMap((report) =>
    (report.detections || []).map((item) => ({
      'شناسه گزارش': report.id,
      'نام تصویر': report.image_name || '—',
      'زمان بازرسی': report.createdAt || '—',
      'نوع عیب': defectNames[item.class_name] || item.class_name || '—',
      'درصد اطمینان': Number(
        item.confidence_percent ?? Number(item.confidence || 0) * 100
      ),
      'X1': item.bbox?.x1 ?? '',
      'Y1': item.bbox?.y1 ?? '',
      'X2': item.bbox?.x2 ?? '',
      'Y2': item.bbox?.y2 ?? '',
    }))
  )

  const classCounts = {}

  history.forEach((report) => {
    Object.entries(report.defect_counts || {}).forEach(([name, count]) => {
      classCounts[name] = (classCounts[name] || 0) + Number(count || 0)
    })
  })

  const classes = Object.entries(classCounts).map(([name, count]) => ({
    'نوع عیب': defectNames[name] || name,
    'تعداد شناسایی‌شده': count,
  }))

  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summary),
    'خلاصه بازرسی‌ها'
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      detections.length
        ? detections
        : [{ پیام: 'هیچ عیبی شناسایی نشده است.' }]
    ),
    'جزئیات تشخیص‌ها'
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      classes.length ? classes : [{ پیام: 'داده‌ای موجود نیست.' }]
    ),
    'آمار کلاس‌ها'
  )

  XLSX.writeFile(
    workbook,
    `SteelVision-Reports-${Date.now()}.xlsx`
  )
}

function exportPDF(history, defectNames) {
  if (!history.length) {
    alert('هنوز گزارشی برای خروجی گرفتن ثبت نشده است.')
    return
  }

  const rows = history.map((report) => {
    const detections = (report.detections || [])
      .map((item) => {
        const name =
          defectNames[item.class_name] || item.class_name || 'نامشخص'

        const confidence = Number(
          item.confidence_percent ?? Number(item.confidence || 0) * 100
        )

        return `${name} (${confidence.toFixed(1)}٪)`
      })
      .join('، ')

    return `
      <tr>
        <td>${escapeHTML(report.id || '—')}</td>
        <td>${escapeHTML(report.image_name || '—')}</td>
        <td>${escapeHTML(report.createdAt || '—')}</td>
        <td>${Number(report.total_defects || 0)}</td>
        <td>${escapeHTML(detections || 'بدون عیب شناسایی‌شده')}</td>
      </tr>
    `
  }).join('')

  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    alert('پنجره گزارش مسدود شده است. اجازه بازشدن پنجره را در مرورگر فعال کن.')
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>گزارش بازرسی SteelVision AI</title>
      <style>
        body {
          font-family: Tahoma, Arial, sans-serif;
          direction: rtl;
          padding: 24px;
          color: #172033;
        }
        h1 { font-size: 22px; }
        p { color: #555; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 24px;
        }
        th, td {
          border: 1px solid #d5dbe5;
          padding: 9px;
          text-align: right;
          font-size: 12px;
          overflow-wrap: anywhere;
        }
        th { background: #edf2f7; }
        @media print {
          body { padding: 0; }
          tr { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>گزارش بازرسی SteelVision AI</h1>
      <p>تاریخ تهیه گزارش: ${escapeHTML(new Date().toLocaleString('fa-IR'))}</p>
      <p>تعداد بازرسی‌ها: ${history.length.toLocaleString('fa-IR')}</p>
      <p>مجموع عیوب شناسایی‌شده: ${history.reduce(
        (sum, report) => sum + Number(report.total_defects || 0),
        0
      ).toLocaleString('fa-IR')}</p>
      <table>
        <thead>
          <tr>
            <th>شناسه</th>
            <th>نام تصویر</th>
            <th>زمان بازرسی</th>
            <th>تعداد عیوب</th>
            <th>جزئیات تشخیص</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>این گزارش بر اساس خروجی ذخیره‌شده مدل تهیه شده است و جایگزین ارزیابی کارشناس کنترل کیفیت نیست.</p>
      <script>
        window.onload = () => setTimeout(() => window.print(), 500)
      </script>
    </body>
    </html>
  `)

  printWindow.document.close()
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function Icon({ children }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>
}

function ZoomableImage({ src, alt, className = '' }) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [positionStart, setPositionStart] = useState({ x: 0, y: 0 })

  function resetZoom() {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  function changeZoom(amount) {
    setScale((current) => {
      const next = Math.min(4, Math.max(1, current + amount))

      if (next === 1) {
        setPosition({ x: 0, y: 0 })
      }

      return next
    })
  }

  return (
    <div className="zoom-viewer">
      <div className="zoom-toolbar">
        <button
          type="button"
          onClick={() => changeZoom(0.25)}
          disabled={scale >= 4}
          aria-label="بزرگ‌نمایی"
        >
          +
        </button>

        <span>{Math.round(scale * 100)}٪</span>

        <button
          type="button"
          onClick={() => changeZoom(-0.25)}
          disabled={scale <= 1}
          aria-label="کوچک‌نمایی"
        >
          −
        </button>

        <button type="button" onClick={resetZoom}>
          اندازه اصلی
        </button>
      </div>

      <div
        className={`zoom-viewport ${scale > 1 ? 'zoomed' : ''}`}
        onPointerDown={(event) => {
          if (scale <= 1) return

          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
          setDragStart({ x: event.clientX, y: event.clientY })
          setPositionStart(position)
        }}
        onPointerMove={(event) => {
          if (!dragging || scale <= 1) return

          setPosition({
            x: positionStart.x + event.clientX - dragStart.x,
            y: positionStart.y + event.clientY - dragStart.y,
          })
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onWheel={(event) => {
          if (!event.ctrlKey) return

          event.preventDefault()
          changeZoom(event.deltaY < 0 ? 0.25 : -0.25)
        }}
      >
        <img
          src={src}
          alt={alt}
          className={className}
          draggable="false"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  )
}

function App() {
  const [showIntro, setShowIntro] = useState(
    () => !sessionStorage.getItem('steelvision-intro-seen')
  )

  const [activePage, setActivePage] = useState('dashboard')
  const [comparisonReport, setComparisonReport] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [confidence, setConfidence] = useState(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('steelvision-history') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('steelvision-history', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function chooseFile(file) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('لطفاً یک فایل تصویری معتبر انتخاب کن.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('حجم تصویر نباید بیشتر از ۲۰ مگابایت باشد.')
      return
    }

    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  async function analyzeImage() {
    if (!selectedFile) {
      setError('ابتدا یک تصویر انتخاب کن.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(
        `${API_URL}/predict?conf=${confidence / 100}`,
        {
          method: 'POST',
          body: formData,
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'پردازش تصویر ناموفق بود.')
      }


      const report = {
        ...data,
        id: `${Date.now()}`,
        createdAt: new Date().toLocaleString('fa-IR'),
        originalImageUrl: preview,
        annotatedImageUrl: data.annotated_image_url
          ? `${API_URL}${data.annotated_image_url}`
          : '',
        total_defects: Number(data.total_defects ?? data.detections?.length ?? 0),
        defect_counts: data.defect_counts ?? {},
        detections: data.detections ?? [],
      }

      setResult(report)
      setHistory((previous) => [report, ...previous].slice(0, 100))
    } catch (err) {
      setError(
        err.message?.includes('Failed to fetch')
          ? 'ارتباط با سرور برقرار نشد. مطمئن شو بک‌اند اجراست و تنظیمات CORS انجام شده است.'
          : err.message || 'خطایی هنگام پردازش رخ داد.',
      )
    } finally {
      setLoading(false)
    }
  }

  function openReport(report) {
    setResult(report)
    setActivePage('detection')
    setError('')
  }

  const pageTitles = {
    dashboard: 'داشبورد مدیریتی',
    detection: 'تشخیص عیوب سطح',
    reports: 'گزارش‌های بازرسی',
    comparison: 'مقایسه تصاویر',
  }

  return (
    <>
      {showIntro && (
        <IntroAnimation
          onComplete={() => {
            sessionStorage.setItem('steelvision-intro-seen', '1')
            setShowIntro(false)
          }}
        />
      )}

      <div className="app-shell" dir="rtl">
        <aside className="sidebar">
          <div className="brand">
          <div className="brand-mark">
            <span>SV</span>
          </div>

          <div className="brand-copy">
            <strong>SteelVision <span>AI</span></strong>
            <small>سامانه هوشمند کنترل کیفیت</small>
          </div>
        </div>

        <div className="sidebar-section-title">منوی اصلی</div>

        <nav className="sidebar-nav">
          <button
            className={activePage === 'dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActivePage('dashboard')}
          >
            <Icon>▦</Icon>
            <span>داشبورد</span>
          </button>

          <button
            className={activePage === 'detection' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActivePage('detection')}
          >
            <Icon>⌕</Icon>
            <span>تشخیص عیوب</span>
            <span className="nav-badge">AI</span>
          </button>

          <button
            className={activePage === 'reports' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActivePage('reports')}
          >
            <Icon>▤</Icon>
            <span>گزارش‌های بازرسی</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="model-card">
            <div className="model-card-top">
              <span className="status-dot" />
              <span>وضعیت سامانه</span>
            </div>
            <strong>SteelVision Engine</strong>
            <small>مدل تشخیص عیب YOLO</small>
            <div className="model-divider" />
            <div className="model-status">
              <span>آماده پردازش</span>
              <span className="online-label">محلی</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <span>STEELVISION AI</span>
            <span>نسخه ۱.۰</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">SteelVision AI <span>/</span> {pageTitles[activePage]}</div>
            <h1>{pageTitles[activePage]}</h1>
          </div>

          <div className="topbar-left">
            <div className="system-status">
              <span className="status-dot" />
              <span>سامانه آماده</span>
            </div>
            <div className="user-avatar">SV</div>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'dashboard' && (
            <section>
              <div className="welcome-banner">
                <div className="welcome-content">
                  <span className="eyebrow">INDUSTRIAL QUALITY INTELLIGENCE</span>
                  <h2>کنترل کیفیت، دقیق‌تر از همیشه.</h2>
                  <p>
                    عیوب سطحی ورق‌های فولادی را با کمک هوش مصنوعی شناسایی کن
                    و فرایند بازرسی را هوشمندتر پیش ببر.
                  </p>
                  <button className="primary-button" onClick={() => setActivePage('detection')}>
                    <span>+</span> شروع بازرسی جدید
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="scan-ring ring-one" />
                  <div className="scan-ring ring-two" />
                  <div className="scan-center">SV<span>AI</span></div>
                  <span className="scan-cross cross-one">+</span>
                  <span className="scan-cross cross-two">+</span>
                  <span className="scan-line" />
                </div>
                <div className="banner-index">01 / QUALITY CONTROL</div>
              </div>

              <div className="section-heading">
                <div>
                  <h3>نمای کلی عملکرد</h3>
                  <p>خلاصه‌ای از وضعیت سامانه و نتایج بازرسی</p>
                </div>
                <span className="demo-label">
                  {history.length ? 'بر اساس بازرسی‌های ثبت‌شده' : 'آمار نمایشی'}
                </span>
              </div>

              <div className="stats-grid">
                {initialStats.map((stat, index) => {
                  const values = [
                    history.length.toLocaleString('fa-IR'),

                    history
                      .reduce((sum, item) => sum + Number(item.total_defects || 0), 0)
                      .toLocaleString('fa-IR'),

                    (() => {
                      const detections = history.flatMap((item) => item.detections || [])
                      if (!detections.length) return '—'

                      const average =
                        detections.reduce(
                          (sum, item) =>
                            sum +
                            Number(
                              item.confidence_percent ??
                                (Number(item.confidence || 0) * 100)
                            ),
                          0
                        ) / detections.length

                      return `${average.toLocaleString('fa-IR', {
                        maximumFractionDigits: 1,
                      })}٪`
                    })(),

                    new Set(
                      history.flatMap((item) =>
                        Object.keys(item.defect_counts || {})
                      )
                    ).size.toLocaleString('fa-IR'),
                  ]

                  return (
                    <article className="stat-card" key={stat.label}>
                      <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
                      <div className="stat-label">{stat.label}</div>
                      <div className="stat-value">{values[index]}</div>
                      <div className="stat-foot">
                      <span className="stat-foot-mark">↗</span>
                      <span>
                        {index === 0
                          ? 'تعداد تصاویر ثبت‌شده'
                          : index === 1
                            ? 'مجموع عیوب تشخیص‌داده‌شده'
                            : index === 2
                              ? 'میانگین اطمینان تشخیص‌ها'
                              : 'کلاس‌های مشاهده‌شده'}
                      </span>
                    </div>
                    </article>
                  )
                })}
              </div>

              <div className="dashboard-grid">
                <article className="panel defect-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>پراکندگی عیوب سطحی</h3>
                      <p>نمونه‌ای از فراوانی کلاس‌های عیب</p>
                    </div>
                    <span className="panel-icon">▥</span>
                  </div>

                  <div className="chart-legend">
                    <span className="legend-dot" /> تعداد عیوب
                  </div>

                  <div className="horizontal-chart">
                    {Object.entries(
                      history.reduce((counts, item) => {
                        Object.entries(item.defect_counts || {}).forEach(([name, count]) => {
                          counts[name] = (counts[name] || 0) + Number(count || 0)
                        })
                        return counts
                      }, {})
                    )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([name, count], _, all) => {
                        const maxCount = Math.max(1, ...all.map((item) => item[1]))

                        return {
                          name: defectNames[name] || name,
                          count,
                          percent: (count / maxCount) * 100,
                        }
                      })
                      .map((item) => (
                        <div className="chart-row" key={item.name}>
                          <span className="chart-name">{item.name}</span>

                          <div className="chart-track">
                            <div
                              className="chart-bar"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>

                          <span className="chart-count">
                            {item.count.toLocaleString('fa-IR')}
                          </span>
                        </div>
                      ))}

                    {history.length === 0 && (
                      <div className="empty-inline">
                        هنوز گزارشی برای نمایش آمار ثبت نشده است.
                      </div>
                    )}

                    {history.length > 0 &&
                      history.every((item) => !Number(item.total_defects || 0)) && (
                        <div className="empty-inline">
                          در تصاویر بررسی‌شده عیبی شناسایی نشده است.
                        </div>
                      )}
                  </div>
                </article>

                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>آخرین بازرسی‌ها</h3>
                      <p>آخرین نتایج پردازش تصاویر</p>
                    </div>
                    <button className="text-button" onClick={() => setActivePage('reports')}>
                      مشاهده همه ←
                    </button>
                  </div>

                  {history.length ? (
                    <div className="activity-list">
                      {history.slice(0, 4).map((item) => (
                        <button
                          className="activity-item"
                          key={item.id}
                          onClick={() => openReport(item)}
                        >
                          <div className="activity-file">▧</div>
                          <div className="activity-info">
                            <strong>{item.image_name}</strong>
                            <span>{item.createdAt}</span>
                          </div>
                          <div className="activity-count">
                            <strong>{item.total_defects}</strong>
                            <span>عیب</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state compact">
                      <div className="empty-icon">▤</div>
                      <strong>هنوز بازرسی‌ای ثبت نشده است</strong>
                      <p>اولین تصویر را بررسی کن تا نتایج اینجا نمایش داده شوند.</p>
                      <button className="outline-button" onClick={() => setActivePage('detection')}>
                        شروع بازرسی
                      </button>
                    </div>
                  )}
                </article>
              </div>

              <div className="dashboard-note">
                <span className="note-icon">i</span>
                <span>
                  {history.length
                    ? 'آمار بازرسی‌ها از نتایج ذخیره‌شده در همین مرورگر محاسبه می‌شود.'
                    : 'کارت‌های آماری و نمودار فعلی نمایشی هستند؛ با انجام بازرسی، نتایج واقعی جایگزین بخش‌های مرتبط می‌شوند.'}
                </span>
              </div>
            </section>
          )}

          {activePage === 'detection' && (
            <section>
              <div className="page-intro">
                <div>
                  <span className="eyebrow">AI-POWERED INSPECTION</span>
                  <h2>بازرسی هوشمند سطح فولاد</h2>
                  <p>تصویر ورق فولادی را بارگذاری کن تا مدل YOLO عیوب احتمالی را شناسایی کند.</p>
                </div>
                <div className="detection-tag"><span className="status-dot" /> موتور تشخیص YOLO</div>
              </div>

              <div className="detection-layout">
                <article className="panel upload-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>ورودی تصویر</h3>
                      <p>تصویر موردنظر را برای تحلیل انتخاب کن</p>
                    </div>
                    <span className="step-number">01</span>
                  </div>

                  <label
                    className={`upload-zone ${preview ? 'has-preview' : ''}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      chooseFile(event.dataTransfer.files?.[0])
                    }}
                  >
                    {preview ? (
                      <img src={preview} alt="پیش‌نمایش تصویر انتخاب‌شده" className="upload-preview" />
                    ) : (
                      <div className="upload-placeholder">
                        <div className="upload-symbol">↑</div>
                        <strong>تصویر را اینجا رها کن</strong>
                        <span>یا برای انتخاب فایل کلیک کن</span>
                        <small>JPG، PNG، BMP، TIFF · حداکثر ۲۰ مگابایت</small>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/bmp,image/tiff"
                      onChange={(event) => chooseFile(event.target.files?.[0])}
                    />
                  </label>

                  {selectedFile && (
                    <div className="selected-file">
                      <div className="file-type-icon">IMG</div>
                      <div className="selected-file-info">
                        <strong>{selectedFile.name}</strong>
                        <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} مگابایت</span>
                      </div>
                      <button
                        className="remove-file"
                        onClick={() => {
                          setSelectedFile(null)
                          setPreview('')
                          setResult(null)
                          setError('')
                        }}
                        aria-label="حذف تصویر"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="confidence-setting">
                    <div className="confidence-label">
                      <label htmlFor="confidence">آستانه اطمینان تشخیص</label>
                      <strong>{confidence.toLocaleString('fa-IR')}٪</strong>
                    </div>
                    <input
                      id="confidence"
                      type="range"
                      min="5"
                      max="95"
                      step="5"
                      value={confidence}
                      onChange={(event) => setConfidence(Number(event.target.value))}
                    />
                    <div className="range-labels"><span>حساسیت بیشتر</span><span>فقط تشخیص‌های مطمئن‌تر</span></div>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <button
                    className="primary-button analyze-button"
                    onClick={analyzeImage}
                    disabled={!selectedFile || loading}
                  >
                    {loading ? <><span className="loading-spinner" /> در حال تحلیل تصویر...</> : <>⌕ شروع تحلیل با هوش مصنوعی</>}
                  </button>
                  <p className="privacy-note">تصویر برای تحلیل به سرور محلی سامانه ارسال می‌شود.</p>
                </article>

                <article className="panel result-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>نتیجه تحلیل</h3>
                      <p>خروجی مدل و جزئیات عیوب شناسایی‌شده</p>
                    </div>
                    <span className="step-number">02</span>
                  </div>

                  {result ? (
                    <>
                     <div className="result-main-image">
                        <span className="comparison-image-title">
                          تصویر تشخیص‌داده‌شده
                        </span>

                        <img
                          src={
                            result.annotatedImageUrl ||
                            (result.annotated_image
                              ? `${API_URL}/outputs/images/${result.annotated_image.split(/[\\/]/).pop()}`
                              : result.originalImageUrl || preview)
                          }
                          alt="نتیجه تشخیص عیوب"
                          className="result-large-image"
                        />
                      </div>

                      <button
                        className="primary-button compare-button"
                        onClick={() => {
                          setComparisonReport(result)
                          setActivePage('comparison')
                        }}
                      >
                        ⇄ مقایسه تصاویر اصلی و تشخیص‌داده‌شده
                      </button>


                      <div className="result-summary">
                        <div><span>تعداد عیوب</span><strong>{result.total_defects}</strong></div>
                        <div><span>ابعاد تصویر</span><strong>{result.image_width} × {result.image_height}</strong></div>
                      </div>

                      <div className="detection-list-heading">عیوب شناسایی‌شده</div>
                      {result.detections?.length ? (
                        <div className="detection-list">
                          {result.detections.map((detection, index) => (
                            <div className="detection-row" key={`${detection.class_name}-${index}`}>
                              <span className="detection-bullet" />
                              <span className="detection-name">{defectNames[detection.class_name] || detection.class_name}</span>
                              <span className="detection-confidence">{Number(detection.confidence_percent).toLocaleString('fa-IR')}٪</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-defects">عیبی بالاتر از آستانه اطمینان انتخاب‌شده شناسایی نشد.</div>
                      )}
                      <div className="result-disclaimer">نتیجه مدل باید در کنار ارزیابی کارشناس کنترل کیفیت بررسی شود.</div>
                    </>
                  ) : (
                    <div className="result-empty">
                      <div className="result-target">
                        <span className="target-corner corner-a" />
                        <span className="target-corner corner-b" />
                        <span className="target-corner corner-c" />
                        <span className="target-corner corner-d" />
                        <div className="target-center">SV<span>AI</span></div>
                      </div>
                      <strong>آماده دریافت تصویر</strong>
                      <p>پس از بارگذاری تصویر و اجرای تحلیل، نتیجه تشخیص در این بخش نمایش داده می‌شود.</p>
                      <div className="result-empty-footer"><span className="status-dot" /> منتظر تصویر ورودی</div>
                    </div>
                  )}
                </article>
              </div>
            </section>
          )}

          {activePage === 'comparison' && (
            <section className="comparison-page">
              <div className="page-intro">
                <div>
                  <span className="eyebrow">IMAGE COMPARISON</span>
                  <h2>مقایسه تصاویر اصلی و تشخیص‌داده‌شده</h2>
                  <p>تصویر اصلی را با خروجی مدل هوش مصنوعی مقایسه کن.</p>
                </div>

                <button
                  className="outline-button"
                  onClick={() => setActivePage('detection')}
                >
                  ← بازگشت به نتیجه
                </button>
              </div>

              {comparisonReport && (
                <>
                  <div className="comparison-page-images">
                    <article className="panel comparison-large-card">
                      <h3>تصویر اصلی</h3>
                      <ZoomableImage
                        src={comparisonReport.originalImageUrl || preview}
                        alt="تصویر اصلی فولاد"
                        className="comparison-large-image"
                      />
                    </article>

                    <article className="panel comparison-large-card">
                      <h3>تصویر تشخیص‌داده‌شده</h3>
                      <ZoomableImage
                        src={
                          comparisonReport.annotatedImageUrl ||
                          (comparisonReport.annotated_image
                            ? `${API_URL}/outputs/images/${comparisonReport.annotated_image.split(/[\\/]/).pop()}`
                            : comparisonReport.originalImageUrl || preview)
                        }
                        alt="تصویر تشخیص عیوب توسط هوش مصنوعی"
                        className="comparison-large-image"
                      />
                    </article>
                  </div>

                  <div className="result-summary">
                    <div>
                      <span>تعداد عیوب شناسایی‌شده</span>
                      <strong>{comparisonReport.total_defects ?? 0}</strong>
                    </div>

                    <div>
                      <span>ابعاد تصویر</span>
                      <strong>
                        {comparisonReport.image_width} × {comparisonReport.image_height}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}


          {activePage === 'reports' && (
            <section>
              <div className="page-intro">
                <div>
                  <span className="eyebrow">INSPECTION ARCHIVE</span>
                  <h2>گزارش‌های بازرسی</h2>
                  <p>نتایج بازرسی‌هایی که در این مرورگر ذخیره شده‌اند.</p>
                </div>
                <div className="report-actions">
                  <button
                    className="outline-button"
                    onClick={() => exportPDF(history, defectNames)}
                  >
                    دریافت گزارش PDF
                  </button>

                  <button
                    className="outline-button"
                    onClick={() => exportExcel(history, defectNames)}
                  >
                    دریافت گزارش Excel
                  </button>

                  <button
                    className="primary-button"
                    onClick={() => setActivePage('detection')}
                  >
                    <span>+</span> بازرسی جدید
                  </button>
                </div>
              </div>

              <div className="report-summary-grid">
                <div className="report-summary-card">
                  <span>تعداد بازرسی‌ها</span>
                  <strong>{history.length.toLocaleString('fa-IR')}</strong>
                </div>
                <div className="report-summary-card">
                  <span>مجموع عیوب شناسایی‌شده</span>
                  <strong>{history.reduce((sum, item) => sum + (item.total_defects || 0), 0).toLocaleString('fa-IR')}</strong>
                </div>
                <div className="report-summary-card">
                  <span>آخرین بازرسی</span>
                  <strong className="last-report-date">{history[0]?.createdAt || '—'}</strong>
                </div>
              </div>

              <article className="panel reports-panel">
                <div className="panel-heading">
                  <div>
                    <h3>تاریخچه نتایج</h3>
                    <p>برای مشاهده جزئیات، یک گزارش را انتخاب کن.</p>
                  </div>
                  {history.length > 0 && (
                    <button
                      className="clear-history-button"
                      onClick={() => {
                        if (window.confirm('تمام گزارش‌های ذخیره‌شده در این مرورگر حذف شوند؟')) {
                          setHistory([])
                          setResult(null)
                        }
                      }}
                    >
                      پاک‌کردن تاریخچه
                    </button>
                  )}
                </div>

                {history.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>نام تصویر</th>
                          <th>زمان بازرسی</th>
                          <th>تعداد عیوب</th>
                          <th>وضعیت</th>
                          <th>جزئیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((item) => (
                          <tr key={item.id}>
                            <td><span className="table-file-icon">▧</span>{item.image_name}</td>
                            <td>{item.createdAt}</td>
                            <td><strong>{item.total_defects}</strong></td>
                            <td>
                              <span className={item.total_defects ? 'table-status detected' : 'table-status clean'}>
                                {item.total_defects ? 'عیب شناسایی شد' : 'بدون عیب شناسایی‌شده'}
                              </span>
                            </td>
                            <td>
                              <button className="table-action" onClick={() => openReport(item)}>مشاهده ←</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">▤</div>
                    <strong>هنوز گزارشی ثبت نشده است</strong>
                    <p>بعد از اولین تحلیل تصویر، گزارش آن در این بخش قرار می‌گیرد.</p>
                    <button className="primary-button" onClick={() => setActivePage('detection')}>شروع اولین بازرسی</button>
                  </div>
                )}
              </article>
              <div className="dashboard-note">
                <span className="note-icon">i</span>
                گزارش‌ها فعلاً در حافظه مرورگر ذخیره می‌شوند و بین مرورگرها یا رایانه‌های مختلف همگام نیستند.
              </div>
            </section>
          )}

          <footer className="app-footer">
            <span>SteelVision AI <span className="footer-separator">•</span> سامانه هوشمند بازرسی سطح فولاد</span>
            <span>طراحی‌شده برای کنترل کیفیت صنعتی</span>
          </footer>
        </div>
      </main>
      </div>
    </>
  )
}

export default App

