export function LoadingScreen({ message = 'Loading SAFARA…' }) {
  return (
    <div className="screen-state">
      <div className="screen-state-card">
        <h1>SAFARA</h1>
        <p>{message}</p>
      </div>
    </div>
  )
}

export function ErrorScreen({ title = 'Something went wrong', message, action }) {
  return (
    <div className="screen-state">
      <div className="screen-state-card">
        <h1>{title}</h1>
        {message && <p>{message}</p>}
        {action}
      </div>
    </div>
  )
}

export function PlaceholderPage({ kicker, title, subtitle }) {
  return (
    <div className="page-pad">
      {kicker && <div className="page-kicker">{kicker}</div>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
      <div className="page-note">This screen is part of the foundation. Live data and maps arrive in a later phase.</div>
    </div>
  )
}
