/**
 * PNG snapshot of any element (charts are SVG + HTML, so the element is rendered as-is).
 * html-to-image is loaded on demand to keep it out of the main bundle. Elements marked
 * `data-export-ignore` (buttons, menus) are left out; a source line is appended.
 */
export async function elementToPng(el: HTMLElement, opts: { footer?: string } = {}): Promise<Blob> {
  const { toBlob } = await import('html-to-image')
  const own = getComputedStyle(el).backgroundColor
  const bg =
    own && own !== 'rgba(0, 0, 0, 0)' && own !== 'transparent'
      ? own
      : getComputedStyle(document.body).backgroundColor || '#ffffff'
  let footer: HTMLElement | null = null
  if (opts.footer) {
    footer = document.createElement('p')
    footer.textContent = opts.footer
    footer.setAttribute('data-export-footer', '')
    footer.style.cssText =
      'margin:12px 20px 16px;font:12px/1.4 Inter,system-ui,sans-serif;color:gray'
    el.appendChild(footer)
  }
  // Render at natural height (grid cards are often stretched to their row).
  const prev = { alignSelf: el.style.alignSelf, height: el.style.height }
  el.style.alignSelf = 'start'
  el.style.height = 'auto'
  try {
    const blob = await toBlob(el, {
      pixelRatio: 2,
      backgroundColor: bg,
      cacheBust: true,
      filter: (node) => !(node instanceof HTMLElement && node.hasAttribute('data-export-ignore')),
    })
    if (!blob) throw new Error('Could not render the image')
    return blob
  } finally {
    footer?.remove()
    el.style.alignSelf = prev.alignSelf
    el.style.height = prev.height
  }
}
