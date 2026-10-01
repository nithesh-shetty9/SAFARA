import { createContext, useContext, useRef, useState } from 'react'
const Ctx = createContext(null)
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const id = useRef(0)
  const show = (title, sub='', icon='✅') => { const key=++id.current; setItems(x=>[...x,{key,title,sub,icon}]); setTimeout(()=>setItems(x=>x.filter(i=>i.key!==key)),4000) }
  return <Ctx.Provider value={{show}}>{children}<div className="toast-wrap">{items.map(x=><div className="toast" key={x.key}><span className="toast-icon">{x.icon}</span><div className="toast-text"><div className="toast-title">{x.title}</div>{x.sub && <div className="toast-sub">{x.sub}</div>}</div></div>)}</div></Ctx.Provider>
}
export const useToast = () => useContext(Ctx)
