'use client'
import { createClient } from '@/lib/supabase'

export default function LoginButtons(){
  const supabase = createClient()

  async function signIn(provider:'google'|'apple'){
    if(!supabase) return alert('Add Supabase keys first.')
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
    const { error } = await supabase.auth.signInWithOAuth({ provider, options:{redirectTo} })
    if(error) alert(error.message)
  }

  return <div className="loginRow">
    <button className="oauth google" onClick={()=>signIn('google')}>Continue with Google</button>
    <button className="oauth apple" onClick={()=>signIn('apple')}>Continue with Apple</button>
  </div>
}
