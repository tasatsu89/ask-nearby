'use client'
import { useEffect, useState } from 'react'

export default function InstallApp(){
  const [deferred,setDeferred] = useState<any>(null)
  const [ios,setIos] = useState(false)
  const [standalone,setStandalone] = useState(false)
  const [showIosHelp,setShowIosHelp] = useState(false)

  useEffect(()=>{
    const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    setIos(isIos); setStandalone(!!isStandalone)
    const handler=(e:any)=>{ e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt',handler)
    return ()=>window.removeEventListener('beforeinstallprompt',handler)
  },[])

  async function install(){
    if(standalone) return
    if(deferred){
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      return
    }
    if(ios) setShowIosHelp(true)
    else alert('Open your browser menu and choose “Install app” or “Add to Home screen”.')
  }

  if(standalone) return <span className="installedBadge">✓ Installed</span>

  return <>
    <button className="pill installBtn" onClick={install}>⬇ Add app</button>
    {showIosHelp && <div className="installOverlay" onClick={()=>setShowIosHelp(false)}>
      <div className="installSheet" onClick={e=>e.stopPropagation()}>
        <div className="installHandle"></div>
        <h3>Add Ask Nearby to your iPhone</h3>
        <div className="installStep"><b>1</b><span>Open this page in <strong>Safari</strong>.</span></div>
        <div className="installStep"><b>2</b><span>Tap the <strong>Share</strong> button <span className="shareIcon">□↑</span>.</span></div>
        <div className="installStep"><b>3</b><span>Choose <strong>Add to Home Screen</strong>.</span></div>
        <div className="installStep"><b>4</b><span>Tap <strong>Add</strong>. Ask Nearby will appear with its own icon.</span></div>
        <button className="installDone" onClick={()=>setShowIosHelp(false)}>Got it</button>
      </div>
    </div>}
  </>
}
