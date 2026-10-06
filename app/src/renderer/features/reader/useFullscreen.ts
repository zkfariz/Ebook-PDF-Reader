import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

const REVEAL_ZONE = 8 // px from the top edge that brings the toolbar back
const HIDE_BELOW = 120 // px: moving further down hides it again

/**
 * Full screen (F13). Main owns the window state (win.setFullScreen) and reports every change,
 * so the toolbar also stays in sync when Windows itself changes it. The toolbar is hidden in
 * full screen and reappears when the mouse touches the top edge of the screen.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)
  const [toolbarShown, setToolbarShown] = useState(false)
  const current = useRef(false)

  useEffect(() => {
    const off = window.api.win.onFullScreenChange((on) => {
      current.current = on
      setFullscreen(on)
      setToolbarShown(false)
    })
    return () => {
      off()
      // Leaving the reading screen also leaves full screen.
      if (current.current) void window.api.win.setFullScreen(false)
    }
  }, [])

  const toggleFullscreen = useCallback(() => void window.api.win.setFullScreen(!current.current), [])
  const exitFullscreen = useCallback(() => {
    if (current.current) void window.api.win.setFullScreen(false)
  }, [])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!fullscreen) return
      if (e.clientY <= REVEAL_ZONE) setToolbarShown(true)
      else if (e.clientY > HIDE_BELOW && !document.querySelector('.toolbar:focus-within')) setToolbarShown(false)
    },
    [fullscreen]
  )

  return { fullscreen, toolbarShown, toggleFullscreen, exitFullscreen, onPointerMove }
}
