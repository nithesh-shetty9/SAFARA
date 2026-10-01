import { Flame, Heart, HeartPulse, Phone, Shield, Siren } from 'lucide-react'

const officialEmergencyContacts = [
  { name: 'Police', number: '112', description: 'Emergency police assistance', icon: Shield, tone: 'police' },
  { name: 'Ambulance', number: '108', description: 'Medical emergency transport and care', icon: HeartPulse, tone: 'medical' },
  { name: 'Fire & Rescue', number: '101', description: 'Fire, rescue, and disaster response', icon: Flame, tone: 'fire' },
  { name: 'Women Helpline', number: '181', description: 'Support and assistance for women in distress', icon: Heart, tone: 'women' },
  { name: 'Emergency Response', number: '112', description: 'National emergency response service', icon: Siren, tone: 'response' }
]

export default function EmergencyContacts() {
  return <section className="contacts-page">
    <div className="page-heading"><span className="eyebrow">Emergency services</span><h1>Emergency Contacts</h1><p>Official emergency numbers and services you may need in an emergency.</p></div>
    <div className="official-contact-grid">
      {officialEmergencyContacts.map(contact => {
        const Icon = contact.icon
        return <article className={`official-contact-card tone-${contact.tone}`} key={`${contact.name}-${contact.number}`}>
          <div className="official-contact-heading">
            <span className="official-contact-icon"><Icon size={20} aria-hidden="true" /></span>
            <h2>{contact.name}</h2>
          </div>
          <p>{contact.description}</p>
          <div className="official-contact-action">
            <strong>{contact.number}</strong>
            <a className="button-primary" href={`tel:${contact.number}`} aria-label={`Call ${contact.name} at ${contact.number}`}><Phone size={16} /> Call</a>
          </div>
        </article>
      })}
    </div>
    <p className="official-contact-note">Calls are placed from your device when you choose a number. SAFARA does not call emergency services automatically.</p>
  </section>
}