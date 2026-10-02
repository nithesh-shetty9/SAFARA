// Shared helper that waits for an accurate GPS reading instead of saving the
// first (often rough Wi-Fi/IP-based) position the browser returns.
//
// getAccuratePosition({ desiredAccuracy, maxWait }) resolves with the most
// accurate reading seen within maxWait ms, preferring any reading at or
// below desiredAccuracy metres. It rejects if geolocation is unsupported or
// no reading arrives in time.

export function getAccuratePosition({ desiredAccuracy = 50, maxWait = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location not supported'))
      return
    }

    let best = null
    let watchId = null
    let settled = false

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      window.clearTimeout(timer)
      fn(value)
    }

    const timer = window.setTimeout(() => {
      if (best) finish(resolve, best)
      else finish(reject, new Error('Location unavailable'))
    }, maxWait)

    watchId = navigator.geolocation.watchPosition(
      position => {
        // Keep the most accurate reading; ignore worse ones.
        if (!best || position.coords.accuracy < best.coords.accuracy) best = position
        if (position.coords.accuracy <= desiredAccuracy) finish(resolve, position)
      },
      error => {
        if (best) finish(resolve, best)
        else finish(reject, error)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
    )
  })
}
