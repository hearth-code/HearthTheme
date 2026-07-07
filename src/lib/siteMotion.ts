// Site-wide motion runtime: topbar condensation, reveal/stagger observers,
// scroll-progress custom property, and numeric readout counters. Zero
// dependencies; every effect is skipped under prefers-reduced-motion (content
// stays fully visible because SSR renders the final state).

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function initTopbar(): void {
  const topbar = document.querySelector('.hearth-topbar')
  if (!topbar) return

  const sync = () => topbar.classList.toggle('is-condensed', window.scrollY > 20)
  sync()

  let ticking = false
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        sync()
        ticking = false
      })
    },
    { passive: true },
  )
}

function initReveal(): void {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-group]')
  if (!targets.length) return

  const reveal = (el: Element) => {
    el.classList.add('is-visible')
    el.dispatchEvent(new CustomEvent('hearth:reveal', { bubbles: false }))
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach(reveal)
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        reveal(entry.target)
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.01, rootMargin: '0px 0px -4% 0px' },
  )
  targets.forEach((el) => observer.observe(el))
}

// Writes --scroll-progress (0..1: element entering the bottom of the viewport
// to leaving the top) onto each on-screen [data-scroll-fx] element. The rAF
// loop only runs while at least one such element is visible and only re-writes
// on scroll frames.
function initScrollProgress(): void {
  const targets = Array.from(document.querySelectorAll('[data-scroll-fx]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
  if (!targets.length || REDUCED() || !('IntersectionObserver' in window)) return

  const active = new Set<HTMLElement>()
  let frame = 0

  const write = () => {
    frame = 0
    const viewportH = window.innerHeight
    active.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const raw = (viewportH - rect.top) / (viewportH + rect.height)
      const progress = Math.min(1, Math.max(0, raw))
      el.style.setProperty('--scroll-progress', progress.toFixed(4))
    })
  }

  const schedule = () => {
    if (frame || !active.size) return
    frame = window.requestAnimationFrame(write)
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!(entry.target instanceof HTMLElement)) return
      if (entry.isIntersecting) active.add(entry.target)
      else active.delete(entry.target)
    })
    schedule()
  })
  targets.forEach((el) => observer.observe(el))

  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}

// [data-counter data-counter-to="48"] elements are server-rendered with the
// final value (correct without JS / for SEO). With motion allowed, they snap
// to zero and count up the first time they scroll into view.
function initCounters(): void {
  const counters = Array.from(document.querySelectorAll('[data-counter]')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
  if (!counters.length || REDUCED() || !('IntersectionObserver' in window)) return

  const lang = document.documentElement.lang || 'en'
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

  const run = (el: HTMLElement) => {
    const target = Number(el.getAttribute('data-counter-to'))
    if (!Number.isFinite(target)) return
    const decimals = Number(el.getAttribute('data-counter-decimals') || '0')
    const format = new Intl.NumberFormat(lang, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    const duration = 900
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      el.textContent = format.format(target * easeOut(t))
      if (t < 1) window.requestAnimationFrame(tick)
    }
    window.requestAnimationFrame(tick)
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) return
        observer.unobserve(entry.target)
        run(entry.target)
      })
    },
    { threshold: 0.4 },
  )

  counters.forEach((el) => {
    el.textContent = new Intl.NumberFormat(lang, {
      minimumFractionDigits: Number(el.getAttribute('data-counter-decimals') || '0'),
      maximumFractionDigits: Number(el.getAttribute('data-counter-decimals') || '0'),
    }).format(0)
    observer.observe(el)
  })
}

declare global {
  interface Window {
    __hearthRevealInit?: boolean
  }
}

// The topbar install CTA hides while the hero (which carries its own CTA) is
// on screen, and slides in once the visitor scrolls past it — the specimen-page
// "buy button always at hand" pattern. Pages without a hero never get the
// body class, so the CTA is simply always visible there.
function initHeroPresence(): void {
  const hero = document.querySelector('[data-hero-picker]')
  if (!hero) {
    document.body.classList.remove('hero-in-view')
    return
  }
  if (!('IntersectionObserver' in window)) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        document.body.classList.toggle('hero-in-view', entry.isIntersecting)
      })
    },
    { rootMargin: '-72px 0px 0px 0px' },
  )
  observer.observe(hero)
}

export function initSiteMotion(): void {
  if (window.__hearthRevealInit) return
  window.__hearthRevealInit = true

  initTopbar()
  initReveal()
  initScrollProgress()
  initCounters()
  initHeroPresence()
}
