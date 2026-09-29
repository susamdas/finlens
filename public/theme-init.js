// Applies the saved theme before first paint to avoid a light/dark flash.
// Kept as a file (not inline) so the Content-Security-Policy can forbid inline scripts.
;(function () {
  try {
    var raw = localStorage.getItem('finlens-theme')
    var pref = raw ? JSON.parse(raw).state.preference : 'system'
    var dark =
      pref === 'dark' || (pref !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
  } catch (e) {}
})()
