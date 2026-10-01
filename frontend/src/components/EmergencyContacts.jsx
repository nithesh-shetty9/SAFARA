import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Pencil, Phone, Plus, Shield, Trash2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function storageKey(userId) { return `safara_personal_contacts_v1:${userId}` }

export default function EmergencyContacts() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({ name: '', phone: '', relationship: '' })
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    try { setContacts(JSON.parse(localStorage.getItem(storageKey(user?.id)) || '[]')) }
    catch { setContacts([]) }
  }, [user?.id])

  function persist(next) {
    setContacts(next)
    localStorage.setItem(storageKey(user?.id), JSON.stringify(next))
  }

  function submit(event) {
    event.preventDefault()
    const contact = { ...form, id: editing || crypto.randomUUID() }
    if (!contact.name.trim() || !contact.phone.trim()) { setMessage('Name and phone are required.'); return }
    const next = editing ? contacts.map(item => item.id === editing ? contact : item) : [...contacts, contact]
    persist(next)
    setForm({ name: '', phone: '', relationship: '' })
    setEditing(null)
    setMessage('Saved on this device.')
  }

  function edit(contact) {
    setEditing(contact.id)
    setForm({ name: contact.name, phone: contact.phone, relationship: contact.relationship || '' })
    setMessage('')
  }

  function remove(id) {
    persist(contacts.filter(contact => contact.id !== id))
    if (editing === id) { setEditing(null); setForm({ name: '', phone: '', relationship: '' }) }
  }

  return <section className="contacts-page">
    <div className="page-heading"><span className="eyebrow">Personal safety</span><h1>Emergency contacts</h1><p>Keep the people you may need close at hand.</p></div>
    <div className="device-only"><Shield size={17} /><span><strong>This device only</strong><small>Contacts are stored in this browser and are not synced to your account.</small></span></div>
    <div className="contacts-layout">
      <div className="contact-list">
        <div className="section-heading"><h2>Personal contacts</h2><span>{contacts.length}</span></div>
        {contacts.length === 0 ? <div className="empty-state">No personal contacts added.</div> : contacts.map(contact => <article className="personal-contact" key={contact.id}>
          <div className="contact-avatar">{contact.name.trim().charAt(0).toUpperCase()}</div><div className="personal-contact-info"><strong>{contact.name}</strong><span>{contact.relationship || 'Emergency contact'} · {contact.phone}</span></div>
          <a className="icon-action" href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} title={`Call ${contact.name}`}><Phone size={17} /></a>
          <button className="icon-action" type="button" onClick={() => edit(contact)} aria-label={`Edit ${contact.name}`} title="Edit"><Pencil size={17} /></button>
          <button className="icon-action danger" type="button" onClick={() => remove(contact.id)} aria-label={`Remove ${contact.name}`} title="Remove"><Trash2 size={17} /></button>
        </article>)}
      </div>
      <form className="contact-editor" onSubmit={submit}>
        <div className="section-heading"><h2>{editing ? 'Edit contact' : 'Add contact'}</h2>{editing && <button className="bare-icon" type="button" aria-label="Cancel editing" onClick={() => { setEditing(null); setForm({ name: '', phone: '', relationship: '' }) }}><X size={17} /></button>}</div>
        <label>Name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={100} required /></label>
        <label>Phone<input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} maxLength={30} required /></label>
        <label>Relationship<input value={form.relationship} onChange={event => setForm({ ...form, relationship: event.target.value })} maxLength={80} placeholder="For example, parent" /></label>
        {message && <div className="inline-message" role="status">{message}</div>}
        <button className="button-primary" type="submit">{editing ? <Pencil size={16} /> : <Plus size={16} />}{editing ? 'Save changes' : 'Add contact'}</button>
      </form>
    </div>
    <Link to="/app/profile" className="contacts-profile-link"><ExternalLink size={15} /> Account details and sign out</Link>
  </section>
}