'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'

function urlBase64ToUint8Array(base64String:string){
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))
}

export default function PushNotifications({
  user, coords, radiusMiles
}:{
  user:User|null
  coords:{lat:number,lng:number}|null
  radiusMiles:number
}){
  const [state,setState] = useState('Enable alerts')

  async function enable(){
    try{
      if(!user) return alert('Sign in first.')
      if(!('serviceWorker' in navigator) || !('PushManager' in window)){
        return alert('Push notifications are not supported in this browser.')
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if(!vapid) return alert('VAPID public key is not configured.')

      setState('Enabling…')
      const permission = await Notification.requestPermission()
      if(permission !== 'granted'){ setState('Alerts blocked'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      const existing = await reg.pushManager.getSubscription()
      const subscription = existing || await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(vapid)
      })

      const res = await fetch('/api/push/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          user_id:user.id,
          subscription:subscription.toJSON(),
          lat:coords?.lat ?? null,
          lng:coords?.lng ?? null,
          radius_miles:radiusMiles
        })
      })
      if(!res.ok) throw new Error((await res.json()).error || 'Could not save subscription')
      setState('Alerts on')
    }catch(e:any){
      setState('Enable alerts')
      alert(e?.message || 'Could not enable notifications.')
    }
  }

  return <button className="pill" onClick={enable}>🔔 {state}</button>
}
