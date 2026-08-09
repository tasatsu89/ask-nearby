'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import LoginButtons from '@/components/LoginButtons'
import InstallApp from '@/components/InstallApp'
import type { User } from '@supabase/supabase-js'

const NearbyMap = dynamic(()=>import('@/components/NearbyMap'),{ssr:false})

type Answer={id:string;question_id?:string;user_id?:string|null;body:string;created_at:string}
type Question={id:string;user_id?:string|null;body:string;place:string|null;lat:number|null;lng:number|null;helpful_count:number;created_at:string;bounty_cents?:number;status?:string;answers?:Answer[];distance_meters?:number}

type Tab='home'|'ask'|'profile'

const demo:Question[]=[
 {id:'d1',body:'Does Target have the Nintendo Switch in stock right now?',place:'Target · Alpharetta, GA',lat:34.07,lng:-84.30,helpful_count:14,created_at:new Date().toISOString(),bounty_cents:200,status:'open',answers:[{id:'a1',body:'Yes — I’m here now. I can see several in the electronics case.',created_at:new Date().toISOString()}]},
 {id:'d2',body:'Is parking still available near the arena?',place:'Downtown Atlanta',lat:33.75,lng:-84.39,helpful_count:8,created_at:new Date().toISOString(),bounty_cents:150,status:'open',answers:[]},
 {id:'d3',body:'How long is the line at this coffee shop?',place:'Avalon',lat:34.07,lng:-84.28,helpful_count:5,created_at:new Date().toISOString(),bounty_cents:100,status:'open',answers:[]}
]

export default function Home(){
 const supabase=useMemo(()=>createClient(),[])
 const [user,setUser]=useState<User|null>(null)
 const [questions,setQuestions]=useState<Question[]>(demo)
 const [tab,setTab]=useState<Tab>('home')
 const [body,setBody]=useState('')
 const [place,setPlace]=useState('')
 const [bounty,setBounty]=useState(2)
 const [answerDraft,setAnswerDraft]=useState<Record<string,string>>({})
 const [coords,setCoords]=useState<{lat:number,lng:number}|null>(null)
 const [rating,setRating]=useState(4.9)
 const [tips,setTips]=useState(12.5)

 async function loadAnswers(ids:string[]){
   if(!supabase||!ids.length)return {} as Record<string,Answer[]>
   const {data}=await supabase.from('answers').select('id,question_id,user_id,body,created_at').in('question_id',ids)
   const grouped:Record<string,Answer[]>={}
   for(const a of (data||[]) as any[]){grouped[a.question_id]||=[];grouped[a.question_id].push(a)}
   return grouped
 }
 async function loadQuestions(){
   if(!supabase)return
   const {data,error}=await supabase.from('questions').select('*').order('created_at',{ascending:false}).limit(50)
   if(error||!data)return
   const grouped=await loadAnswers(data.map((r:any)=>r.id))
   setQuestions(data.map((r:any)=>({...r,answers:grouped[r.id]||[]})))
 }
 useEffect(()=>{
   if(!supabase)return
   supabase.auth.getUser().then(({data})=>setUser(data.user))
   const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null))
   loadQuestions()
   return()=>sub.subscription.unsubscribe()
 },[supabase])

 function useLocation(){navigator.geolocation?.getCurrentPosition(p=>setCoords({lat:p.coords.latitude,lng:p.coords.longitude}))}
 const money=(c=0)=>c>0?`$${(c/100).toFixed(2)}`:'Free'

 async function postQuestion(){
   if(!body.trim())return
   if(!supabase){setQuestions(q=>[{id:crypto.randomUUID(),body:body.trim(),place:place||'Nearby',lat:coords?.lat||null,lng:coords?.lng||null,helpful_count:0,created_at:new Date().toISOString(),bounty_cents:bounty*100,status:'open',answers:[]},...q]);setBody('');setPlace('');setTab('home');return}
   if(!user)return alert('Please sign in first.')
   const {error}=await supabase.from('questions').insert({user_id:user.id,body:body.trim(),place:place||null,lat:coords?.lat||null,lng:coords?.lng||null,bounty_cents:bounty*100,status:'open'})
   if(error)return alert(error.message)
   setBody('');setPlace('');setTab('home');loadQuestions()
 }
 async function postAnswer(qid:string){
   const txt=(answerDraft[qid]||'').trim();if(!txt)return
   if(!supabase){setQuestions(q=>q.map(x=>x.id===qid?{...x,answers:[...(x.answers||[]),{id:crypto.randomUUID(),body:txt,created_at:new Date().toISOString()}]}:x));setAnswerDraft(d=>({...d,[qid]:''}));return}
   if(!user)return alert('Please sign in first.')
   const {error}=await supabase.from('answers').insert({question_id:qid,user_id:user.id,body:txt})
   if(error)return alert(error.message)
   setAnswerDraft(d=>({...d,[qid]:''}));loadQuestions()
 }
 function acceptAnswer(qid:string){setQuestions(q=>q.map(x=>x.id===qid?{...x,status:'resolved'}:x));alert('Answer accepted ✓\nFamily test: bounty is simulated, no real money moved.')}
 function addTip(){setTips(v=>v+1);alert('Demo tip +$1.00 added. No real payment yet.')}

 return <main className="shell">
   <header className="top">
    <div className="brand"><div className="logo">N</div><div><h1>Near By</h1><p>Ask someone who’s actually there.</p></div></div>
    <div className="topActions"><InstallApp/><button className="pill" onClick={useLocation}>📍 {coords?'Location on':'Use location'}</button></div>
   </header>

   {!user&&supabase&&<div className="authCard"><div><strong>Join Near By</strong><div className="small">Ask, answer, build reputation.</div></div><LoginButtons/></div>}

   {tab==='home'&&<>
    <section className="hero"><span className="eyebrow">REAL-TIME LOCAL ANSWERS</span><h2>Know what’s happening before you get there.</h2><p>Ask nearby people about stock, lines, parking, events and anything happening right now.</p><button className="heroBtn" onClick={()=>setTab('ask')}>＋ Ask a question</button></section>
    <div className="chips"><span className="chip active">All</span><span className="chip">With bounty</span><span className="chip">Shopping</span><span className="chip">Parking</span><span className="chip">Events</span></div>
    <div className="content">
     <section className="panel"><div className="head"><strong>Popular near you</strong><span className="small">Live</span></div><div className="feed">
      {questions.map(q=><article className="card" key={q.id}>
       <div className="requestTop"><div><div className="meta">{q.place||'Nearby'} {q.distance_meters!=null&&`· ${(q.distance_meters/1609.344).toFixed(1)} mi`}</div><div className="qtext">{q.body}</div></div><div className="bounty">{money(q.bounty_cents)}</div></div>
       <div className="trust">● Verified location hidden · Fresh answer preferred</div>
       {(q.answers||[]).map(a=><div className="answer" key={a.id}><div>💬 {a.body}</div>{q.status!=='resolved'&&<div className="answerBtns"><button className="btn accent" onClick={()=>acceptAnswer(q.id)}>✓ Approve answer</button><button className="btn" onClick={addTip}>＋ $1 Tip</button></div>}</div>)}
       {q.status==='resolved'&&<div className="verified">✓ Answer approved · Rating prompt ready</div>}
       {q.status!=='resolved'&&<div className="reply"><input className="field" value={answerDraft[q.id]||''} onChange={e=>setAnswerDraft(d=>({...d,[q.id]:e.target.value}))} placeholder="I’m here — here’s what I see…"/><button className="btn accent" onClick={()=>postAnswer(q.id)}>Answer</button></div>}
      </article>)}
     </div></section>
     <aside className="sideStack"><section className="panel"><div className="head"><strong>Nearby map</strong><span className="small">Exact user locations hidden</span></div>{coords?<NearbyMap lat={coords.lat} lng={coords.lng} pins={questions}/>:<div className="mapPlaceholder"><div>🗺️</div><strong>See nearby requests</strong><span>Turn on location to see what people need around you.</span><button className="btn accent" onClick={useLocation}>Use my location</button></div>}</section><section className="panel safety"><strong>Safety first</strong><p>No people-tracking, surveillance, trespassing, dangerous or illegal requests. Report suspicious content anytime.</p></section></aside>
    </div>
   </>}

   {tab==='ask'&&<section className="panel askPage"><div className="head"><strong>Ask a Question</strong><button className="btn" onClick={()=>setTab('home')}>Close</button></div><label>Your question</label><textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Does Target have this in stock?"/><label>Where?</label><input className="field" value={place} onChange={e=>setPlace(e.target.value)} placeholder="Target, Alpharetta, GA"/><label>Set a bounty <span className="small">(optional)</span></label><div className="rewardButtons">{[0,1,2,3,5].map(v=><button className={bounty===v?'selected':''} onClick={()=>setBounty(v)} key={v}>{v===0?'Free':`$${v}`}</button>)}</div><div className="safetyCheck">🛡️ No tracking people, private-property surveillance, trespassing, illegal or dangerous tasks.</div><button className="bigPrimary" onClick={postQuestion}>Post Question · {bounty===0?'Free':`$${bounty} virtual`}</button><div className="small center">Family test mode: rewards and tips are simulated.</div></section>}

   {tab==='profile'&&<div className="profileGrid"><section className="panel profileCard"><div className="profileAvatar">Y</div><h2>Your Profile</h2><div className="stars">★★★★★ <b>{rating.toFixed(1)}</b></div><div className="ratingGrid"><div><strong>15</strong><span>Answers</span></div><div><strong>12</strong><span>Approved</span></div><div><strong>${tips.toFixed(2)}</strong><span>Virtual earned</span></div></div></section><section className="panel"><div className="head"><strong>Reputation</strong></div><div className="profileLine"><span>Helper rating</span><b>⭐ 4.9</b></div><div className="profileLine"><span>Requester rating</span><b>⭐ 4.8</b></div><div className="profileLine"><span>Verified answers</span><b>12</b></div><div className="profileLine"><span>Tips earned</span><b>${tips.toFixed(2)}</b></div><button className="bigPrimary" onClick={()=>setRating(5)}>Demo: receive 5★ rating</button></section></div>}

   <nav className="bottom"><button className={tab==='home'?'navActive':''} onClick={()=>setTab('home')}>⌂<span>Home</span></button><button className={tab==='ask'?'navActive':''} onClick={()=>setTab('ask')}>＋<span>Ask</span></button><button className={tab==='profile'?'navActive':''} onClick={()=>setTab('profile')}>◉<span>Profile</span></button></nav>
 </main>
}
