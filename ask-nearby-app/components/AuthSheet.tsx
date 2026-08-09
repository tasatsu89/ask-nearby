'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function AuthSheet({open,onClose}:{open:boolean;onClose:()=>void}){
  const supabase=createClient(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [mode,setMode]=useState<'in'|'up'>('in'); const [msg,setMsg]=useState('')
  if(!open)return null
  async function submit(){
    if(!supabase)return setMsg('Supabase is not connected.')
    setMsg('Working…')
    const result=mode==='in'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password})
    if(result.error)setMsg(result.error.message); else {setMsg(mode==='up'?'Account created. If email confirmation is enabled, confirm your email.':'Signed in.'); setTimeout(onClose,500)}
  }
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="sheet"><div className="sheetHandle"/><div className="row spread"><h2>{mode==='in'?'Sign in to Near By':'Create your account'}</h2><button className="iconBtn" onClick={onClose}>×</button></div><p className="muted">Only required when you ask, answer, or manage your profile.</p><label>Email</label><input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com"/><label>Password</label><input className="input" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="8+ characters"/><button className="primary" onClick={submit}>{mode==='in'?'Sign in':'Create account'}</button><button className="textBtn" onClick={()=>setMode(mode==='in'?'up':'in')}>{mode==='in'?'New here? Create an account':'Already have an account? Sign in'}</button>{msg&&<div className="notice">{msg}</div>}</section></div>
}
