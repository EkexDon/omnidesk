/*
 * OmniDesk Hub — product site behaviour. No dependencies, no storage, no cookies.
 * The one outside request: GitHub's public API for the latest release (version, size, date, asset links).
 * Every enhancement is optional — without it the page and its download buttons still work.
 */
(function () {
  'use strict'

  var root = document.documentElement
  root.classList.add('js')

  var REPO = 'EkexDon/omnidesk'
  var API_LATEST = 'https://api.github.com/repos/' + REPO + '/releases/latest'
  var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases'
  var ASSET_PREFIX = ('https://github.com/' + REPO + '/releases/download/').toLowerCase()
  var LATEST_DOWNLOAD = 'https://github.com/' + REPO + '/releases/latest/download/'
  var ASSETS = {
    arm: 'OmniDesk-Hub-mac-arm64.dmg',
    armZip: 'OmniDesk-Hub-mac-arm64.zip',
    intel: 'OmniDesk-Hub-mac-x64.dmg',
    win: { x64: 'OmniDesk-Hub-win-x64.exe', arm64: 'OmniDesk-Hub-win-arm64.exe' }
  }
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }

  function all(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel))
  }

  /* ------------------------------ downloads ------------------------------ */

  function isMac() {
    var ua = navigator.userAgent || ''
    // iPhones and iPods say "like Mac OS X"; iPads ask for the desktop site as a Macintosh but have touch points.
    return /Macintosh/.test(ua) && !/iPhone|iPad|iPod|Android/.test(ua) && !(navigator.maxTouchPoints > 1)
  }

  function isWindows() {
    var ua = navigator.userAgent || ''
    return /Windows NT/.test(ua) && !/Windows Phone|Xbox/.test(ua)
  }

  /** 'mac' | 'windows' | 'other' — by the user agent (what the visitor's browser says about its OS). */
  function visitorPlatform() {
    return isWindows() ? 'windows' : isMac() ? 'mac' : 'other'
  }

  /**
   * Windows on Arm or a 64-bit Intel/AMD PC: Chromium browsers tell through the architecture hint; everything else
   * gets the x64 installer (Windows on Arm runs it too, emulated).
   */
  function windowsArch() {
    var d = navigator.userAgentData
    if (!d || typeof d.getHighEntropyValues !== 'function') return Promise.resolve('x64')
    return d.getHighEntropyValues(['architecture', 'bitness']).then(
      function (v) { return v && v.architecture === 'arm' ? 'arm64' : 'x64' },
      function () { return 'x64' }
    )
  }

  function formatSize(bytes) {
    var mb = bytes / 1e6
    return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + ' MB'
  }

  function formatDate(iso) {
    var d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d)
  }

  /** A release asset by its stable name, only if its link really points at this repository's release files. */
  function asset(release, name) {
    var list = (release && release.assets) || []
    for (var i = 0; i < list.length; i++) {
      var a = list[i]
      var url = a && typeof a.browser_download_url === 'string' ? a.browser_download_url : ''
      if (a && a.name === name && url.toLowerCase().indexOf(ASSET_PREFIX) === 0) return a
    }
    return null
  }

  function setDownloadHref(href) {
    all('[data-download]').forEach(function (a) { a.setAttribute('href', href) })
  }

  function showAll(sel, on) {
    all(sel).forEach(function (el) { el.hidden = !on })
  }

  function showRelease(release, primary) {
    var version = String(release.tag_name || release.name || '').replace(/^v/i, '').replace(/[^\w.+-]/g, '').slice(0, 32)
    var size = primary && primary.size > 0 ? formatSize(primary.size) : ''
    var date = formatDate(release.published_at || release.created_at)
    if (!version || !size || !date) return
    all('[data-release]').forEach(function (p) {
      p.querySelector('[data-release-version]').textContent = version
      p.querySelector('[data-release-size]').textContent = size
      p.querySelector('[data-release-date]').textContent = date
      p.hidden = false
    })
  }

  var OTHER_WINDOWS_TEXT = { x64: 'Intel or AMD PC? Get the 64-bit build', arm64: 'Windows on Arm? Get the Arm build' }

  /** A Windows visitor: the installer for their PC on every button, Windows' requirements, the Windows steps. */
  function showWindows(arch) {
    setDownloadHref(LATEST_DOWNLOAD + ASSETS.win[arch])
    all('[data-download-label]').forEach(function (l) { l.textContent = 'Download for Windows' })
    showAll('[data-req="mac"]', false)
    showAll('[data-req="windows"]', true)
    showAll('[data-also="windows"]', false)
    showAll('[data-also="mac"]', true)
    // Key glyphs a PC writes differently (⌘K → Ctrl K).
    all('[data-key-pc]').forEach(function (k) {
      k.textContent = k.getAttribute('data-key-pc')
      k.setAttribute('data-pc', '')
    })
  }

  function applyRelease(release, platform, arch) {
    var mac = asset(release, ASSETS.arm) || asset(release, ASSETS.armZip)
    var win = { x64: asset(release, ASSETS.win.x64), arm64: asset(release, ASSETS.win.arm64) }
    all('[data-download-mac]').forEach(function (a) { a.setAttribute('href', mac ? mac.browser_download_url : RELEASES_PAGE) })
    all('[data-download-win]').forEach(function (a) {
      var w = win[a.getAttribute('data-download-win')]
      if (w) return a.setAttribute('href', w.browser_download_url)
      a.hidden = true
      // …and the " · " between it and its neighbour.
      ;[a.previousSibling, a.nextSibling].some(function (n) {
        if (!n || n.nodeType !== 3 || n.textContent.indexOf('·') < 0) return false
        n.textContent = n.textContent.replace(/\s*·\s*/, ' ')
        return true
      })
    })
    if (platform === 'windows') {
      // The build for this PC, or the other one (Windows on Arm runs x64 too; an Intel PC can't run Arm).
      var mine = win[arch] || (arch === 'arm64' ? win.x64 : null)
      setDownloadHref(mine ? mine.browser_download_url : RELEASES_PAGE)
      if (mine) showRelease(release, mine)
      else
        all('[data-platform-note]').forEach(function (p) {
          p.textContent = 'This release has no Windows installer yet — the releases page lists every build.'
          p.hidden = false
        })
      var otherArch = mine === win.x64 ? 'arm64' : 'x64'
      var other = mine ? win[otherArch] : null
      all('[data-win-other]').forEach(function (p) {
        if (!other) return
        var link = p.querySelector('[data-win-other-link]')
        link.setAttribute('href', other.browser_download_url)
        link.textContent = OTHER_WINDOWS_TEXT[otherArch]
        p.hidden = false
      })
      return
    }
    setDownloadHref(mac ? mac.browser_download_url : RELEASES_PAGE)
    if (mac) showRelease(release, mac)
    var intel = asset(release, ASSETS.intel)
    all('[data-intel]').forEach(function (p) {
      if (!intel) return
      p.querySelector('[data-intel-link]').setAttribute('href', intel.browser_download_url)
      p.hidden = false
    })
    // No Windows installer in this release: no "Also for Windows" line.
    if (!win.x64 && !win.arm64) showAll('[data-also="windows"]', false)
  }

  function fetchRelease() {
    if (!window.fetch) return Promise.reject(new Error('no fetch'))
    var ctrl = window.AbortController ? new AbortController() : null
    var timer = setTimeout(function () { if (ctrl) ctrl.abort() }, 8000)
    return fetch(API_LATEST, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub answered ' + res.status)
        return res.json()
      })
      .then(
        function (release) { clearTimeout(timer); return release },
        function (e) { clearTimeout(timer); throw e }
      )
  }

  function initDownloads() {
    var platform = visitorPlatform()
    root.setAttribute('data-visitor', platform)
    // The install steps for this OS (a Mac's or Windows'; both for anyone else).
    if (platform !== 'other') showAll('[data-steps]:not([data-steps="' + platform + '"])', false)
    if (platform === 'other') showAll('[data-platform-note]', true)
    var arch = platform === 'windows' ? windowsArch() : Promise.resolve(null)
    if (platform === 'windows') {
      showWindows('x64')
      arch.then(function (a) { if (a !== 'x64') showWindows(a) })
    }
    if (!window.fetch) return
    fetchRelease().then(
      function (release) { return arch.then(function (a) { applyRelease(release, platform, a) }) },
      function () {
        // No release yet, rate-limited or offline: the releases page always works.
        setDownloadHref(RELEASES_PAGE)
      }
    )
  }

  /* -------------------------------- videos ------------------------------- */

  var managed = []
  var ICON_PAUSE = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="0.8"/><rect x="9.4" y="3" width="2.6" height="10" rx="0.8"/></svg>'
  var ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6l7.6-4.8z"/></svg>'
  var SPEAKER = '<path d="M2.5 6.2h2.3L8.2 3.4v9.2L4.8 9.8H2.5z"/>'
  var ICON_MUTED = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' + SPEAKER + '<path d="M10.6 6.1l3.3 3.8M13.9 6.1l-3.3 3.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
  var ICON_SOUND = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' + SPEAKER + '<path d="M10.5 5.6a3.4 3.4 0 0 1 0 4.8M12.3 3.9a5.8 5.8 0 0 1 0 8.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'

  function playSafely(v) {
    var p
    try { p = v.play() } catch (e) { p = null }
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (err && err.name === 'AbortError') return
        // A browser that won't play with sound (no gesture yet) still plays it muted; the Sound button says so.
        if (err && err.name === 'NotAllowedError' && !v.muted) {
          v.muted = true
          if (v.__omni) refresh(v)
          playSafely(v)
          return
        }
        if (v.__omni) { v.__omni.button.hidden = false; refresh(v) }
      })
    }
  }

  /** A pause this script makes itself (off screen, tab hidden, reduced motion) — not the visitor's choice. */
  function autoPause(v) {
    if (v.paused) return
    v.__omni.autoPaused = true
    v.pause()
  }

  function videoName(v) {
    return v.getAttribute('data-video') === 'hero' ? 'the tour' : 'the ' + (v.getAttribute('aria-label') || 'video').split(':')[0] + ' video'
  }

  /** The big Play button: shown with reduced motion or when the browser refuses to autoplay. */
  function addPlayButton(v) {
    var hero = v.getAttribute('data-video') === 'hero'
    var b = document.createElement('button')
    b.type = 'button'
    b.className = hero ? 'play' : 'play play--sm'
    b.hidden = true
    b.setAttribute('aria-label', 'Play ' + videoName(v))
    b.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z"/></svg><span>' + (hero ? 'Play the tour' : 'Play') + '</span>'
    b.addEventListener('click', function () {
      var s = v.__omni
      s.user = true
      s.userPaused = false
      v.controls = true
      b.hidden = true
      refresh(v)
      playSafely(v)
    })
    v.parentElement.appendChild(b)
    return b
  }

  /** The small pause / play toggle every moving video keeps in its corner (WCAG 2.2.2). */
  function addToggle(v) {
    var t = document.createElement('button')
    t.type = 'button'
    t.className = v.getAttribute('data-video') === 'hero' ? 'vtoggle vtoggle--hero' : 'vtoggle'
    t.addEventListener('click', function () {
      var s = v.__omni
      if (!v.paused) {
        s.userPaused = true
        s.autoPaused = false
        v.pause()
      } else {
        s.userPaused = false
        s.user = true
        playSafely(v)
      }
      refresh(v)
    })
    v.parentElement.appendChild(t)
    return t
  }

  /**
   * Sound on / off — the trailer only (it has a score; the loops are silent). A toggle button (aria-pressed = sound on)
   * right of the pause toggle, as in the tab order, with a tooltip for what a click does. It only mutes or unmutes: it
   * never starts a video that is paused (by the visitor, off screen or for reduced motion), and it steps aside with the
   * pause toggle (big Play button, native controls).
   */
  function addSound(v) {
    var b = document.createElement('button')
    b.type = 'button'
    b.className = 'vsound'
    b.setAttribute('aria-label', 'Sound')
    b.setAttribute('aria-pressed', 'false')
    b.addEventListener('click', function () {
      v.muted = !v.muted
      if (!v.muted && v.volume === 0) v.volume = 1
      refresh(v)
    })
    v.parentElement.appendChild(b)
    return b
  }

  /** Toggle label, icon and visibility follow the video (and step aside for the big button or native controls). */
  function refresh(v) {
    var s = v.__omni
    var playing = !v.paused
    var label = (playing ? 'Pause ' : 'Play ') + videoName(v)
    if (s.toggle.getAttribute('aria-label') !== label) {
      s.toggle.setAttribute('aria-label', label)
      s.toggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY
    }
    // Paused by the visitor: the toggle stays in sight, so it's clear the loop was stopped on purpose.
    if (s.userPaused && !playing) s.toggle.setAttribute('data-user-paused', '')
    else s.toggle.removeAttribute('data-user-paused')
    s.toggle.hidden = !s.button.hidden || v.controls
    if (s.sound) {
      var on = !v.muted
      if (s.sound.getAttribute('aria-pressed') !== String(on) || !s.sound.firstChild) {
        s.sound.setAttribute('aria-pressed', String(on))
        s.sound.innerHTML = on ? ICON_SOUND : ICON_MUTED
        // The tooltip says what a click does (the name stays "Sound"; aria-pressed carries the state).
        s.sound.title = on ? 'Sound off' : 'Sound on'
      }
      s.sound.hidden = s.toggle.hidden
    }
  }

  function initVideos() {
    all('video[data-video]').forEach(function (v) {
      v.controls = false
      v.removeAttribute('autoplay')
      v.muted = true
      var s = { visible: false, near: false, user: false, userPaused: false, autoPaused: false }
      v.__omni = s
      s.button = addPlayButton(v)
      s.toggle = addToggle(v)
      // After the pause toggle in the tab order: Download → Pause the tour → Sound.
      s.sound = v.getAttribute('data-video') === 'hero' ? addSound(v) : null
      v.addEventListener('volumechange', function () { refresh(v) })
      v.addEventListener('play', function () { s.userPaused = false; s.button.hidden = true; refresh(v) })
      v.addEventListener('pause', function () {
        // Ours (off screen, hidden tab, reduced motion) or the visitor's — native controls included.
        if (s.autoPaused) s.autoPaused = false
        else if (!v.ended) s.userPaused = true
        refresh(v)
      })
      refresh(v)
      managed.push(v)
    })
    if (!managed.length) return

    var sync = function (v) {
      var s = v.__omni
      if (s.userPaused) {
        if (!v.paused) v.pause()
        return
      }
      if (reduceMotion.matches && !s.user) {
        autoPause(v)
        s.button.hidden = !v.paused
        refresh(v)
        return
      }
      if (s.visible && !document.hidden) {
        if (v.preload !== 'auto') v.preload = 'auto'
        if (v.paused) playSafely(v)
      } else {
        autoPause(v)
      }
    }

    // Posters of the feature loops load shortly before they scroll near, not all at once with the page.
    var showPoster = function (v) {
      var src = v.getAttribute('data-poster')
      if (src && !v.getAttribute('poster')) v.setAttribute('poster', src)
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          // The trailer starts as soon as a sliver of it shows; feature loops once a third is in view.
          var min = e.target.getAttribute('data-video') === 'hero' ? 0.08 : 0.3
          e.target.__omni.visible = e.isIntersecting && e.intersectionRatio >= min
          sync(e.target)
        })
      }, { threshold: [0, 0.08, 0.3, 0.6] })
      var near = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return
          showPoster(e.target)
          near.unobserve(e.target)
        })
      }, { rootMargin: '1200px 0px' })
      managed.forEach(function (v) {
        io.observe(v)
        if (v.hasAttribute('data-poster')) near.observe(v)
      })
    } else {
      managed.forEach(function (v) { showPoster(v); v.__omni.button.hidden = false; refresh(v) })
    }

    managed.forEach(function (v) { if (reduceMotion.matches) { v.__omni.button.hidden = false; refresh(v) } })
    document.addEventListener('visibilitychange', function () { managed.forEach(sync) })
    var onMotionChange = function () {
      managed.forEach(function (v) {
        if (reduceMotion.matches && !v.__omni.user) v.__omni.button.hidden = !v.paused
        sync(v)
        refresh(v)
      })
    }
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange)
  }

  /* ------------------------------- reveals ------------------------------- */

  function initReveals() {
    var items = all('.reveal')
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      items.forEach(function (el) { el.classList.add('is-in') })
      return
    }
    // Siblings that arrive together come in one after another (80 ms apart, at most 320 ms).
    items.forEach(function (el) {
      var i = all(':scope > .reveal', el.parentElement).indexOf(el)
      if (i > 0) el.style.setProperty('--delay', Math.min(i * 80, 320) + 'ms')
    })
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      })
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 })
    items.forEach(function (el) { io.observe(el) })
  }

  /* ---------------------------- nav and copy ----------------------------- */

  function initNav() {
    var nav = document.querySelector('[data-nav]')
    var toggle = document.querySelector('[data-nav-toggle]')
    var links = document.getElementById('nav-links')
    var onScroll = function () {
      if (window.scrollY > 8) nav.setAttribute('data-scrolled', '')
      else nav.removeAttribute('data-scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    var label = toggle.querySelector('.visually-hidden')
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open))
      if (label) label.textContent = open ? 'Close menu' : 'Menu'
      if (open) links.setAttribute('data-open', '')
      else links.removeAttribute('data-open')
    }
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true') })
    all('a', links).forEach(function (a) { a.addEventListener('click', function () { setOpen(false) }) })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false)
        toggle.focus()
      }
    })
  }

  function initCopy() {
    all('[data-copy]').forEach(function (btn) {
      var source = document.getElementById(btn.getAttribute('data-copy'))
      var status = btn.closest('details').querySelector('[data-copy-status]')
      var timer
      var done = function (ok) {
        status.textContent = ok ? 'Copied — paste it into Terminal and press Return.' : 'Select the command and copy it with ⌘C.'
        btn.textContent = ok ? 'Copied' : 'Copy'
        clearTimeout(timer)
        timer = setTimeout(function () { btn.textContent = 'Copy'; status.textContent = '' }, 4000)
      }
      btn.addEventListener('click', function () {
        var text = source.textContent
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true) }, function () { done(false) })
        } else {
          var range = document.createRange()
          range.selectNodeContents(source)
          var sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(range)
          var ok = false
          try { ok = document.execCommand('copy') } catch (e) { ok = false }
          done(ok)
        }
      })
    })
  }

  /** A link to a collapsed <details> (the Terminal fix) opens it on the way. */
  function initDetailLinks() {
    all('a[href^="#"]').forEach(function (a) {
      var target = document.getElementById(a.getAttribute('href').slice(1))
      if (!target || target.tagName !== 'DETAILS') return
      a.addEventListener('click', function () { target.open = true })
    })
  }

  function init() {
    // Each part stands alone: one failing must not leave the page half-enhanced (or its content hidden).
    ;[initNav, initDownloads, initVideos, initReveals, initCopy, initDetailLinks].forEach(function (part) {
      try {
        part()
      } catch (e) {
        if (part === initReveals) all('.reveal').forEach(function (el) { el.classList.add('is-in') })
        if (window.console) console.warn('OmniDesk site:', e)
      }
    })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
