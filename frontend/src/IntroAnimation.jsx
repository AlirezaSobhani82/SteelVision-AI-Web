import { useEffect, useRef, useState } from 'react'
import './IntroAnimation.css'

export default function IntroAnimation({ onComplete }) {
  const videoRef = useRef(null)
  const [leaving, setLeaving] = useState(false)

  const finishIntro = () => {
    if (leaving) return
    setLeaving(true)

    setTimeout(() => {
      onComplete?.()
    }, 700)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.currentTime = 0

    const playVideo = async () => {
      try {
        await video.play()
      } catch (error) {
        console.error('SteelVision video playback error:', error)
      }
    }

    playVideo()
  }, [])

  return (
    <section
      className={`intro-screen video-intro ${leaving ? 'intro-leaving' : ''}`}
      dir="rtl"
    >
      <video
        ref={videoRef}
        className="intro-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finishIntro}
      >
        <source src="/steelvision-intro.mp4" type="video/mp4" />
        مرورگر شما از پخش ویدئو پشتیبانی نمی‌کند.
      </video>

      <div className="intro-video-shade" />

      <button className="intro-skip" onClick={finishIntro}>
        رد کردن انیمیشن <span>←</span>
      </button>
    </section>
  )
}