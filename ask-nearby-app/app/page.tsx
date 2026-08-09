'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Bell, Camera, Check, ChevronLeft, Clock3, DollarSign, Heart, MapPin, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Star, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import LoginButtons from '@/components/LoginButtons'
import type { User } from '@supabase/supabase-js'

const NearbyMap = dynamic(()=>import('@/components/NearbyMap'),{ssr:false})

type Answer={
  id:string
  question_id?:string
  user_id?:string|null
  body:string
  created_at:string
  photo_url?:string|null
  accepted?:boolean
  tip_cents?:number
}

type Question={
  id:string
  user_id?:string|null
  body:string
  place:string|null
  lat:number|null
  lng:number|null
  helpful_count:number
  created_at:string
  reward_cents?:number
  status?:string
  answers?:Answer[]
  distance_meters?:number
}

type Tab='home'|'ask'|'notifications'|'profile'

const demo:Question[]=[
  {id:'d1',body:'Does Target still have this item?',place:'Target · San Jose, CA',lat:37.3382,lng:-121.8863,helpful_count:14,created_at:new Date(Date.now()-2*60*1000).toISOString(),reward_cents:200,status:'open',answers:[{id:'a1',body:'Yes — they have several in stock right now.',created_at:new Date(Date.now()-60*1000).toISOString(),photo_url:'https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=900&q=75'}]},
  {id:'d2',body:'Is this parking lot open right now?',place:'Downtown Atlanta',lat:33.75,lng:-84.39,helpful_count:8,created_at:new Date(Date.now()-5*60*1000).toISOString(),reward_cents:100,status:'open',answers:[]},
  {id:'d3',body:'Does Costco have cases of bottled water?',place:'Costco · Alpharetta, GA',lat:34.07,lng:-84.28,helpful_count:5,created_at:new Date(Date.now()-10*60*1000).toISOString(),reward_cents:0,status:'open',answers:[]}
]

const minutesAgo=(iso:string)=>Math.max(1,Math.round((Date.now()-new Date(iso).getTime())/60000))
const money=(c=0)=>c>0?`$${(c/100).toFixed(2).replace('.00','')}`:'Free'

export default function Home(){
  const supabase=useMemo(()=>createClient(),[])
  const [user,setUser]=useState<User|null>(null)
  const [questions,setQuestions]=useState<Question[]>(demo)
  const [tab,setTab]=useState<Tab>('home')
  const [selected,setSelected]=useState<Question|null>(null)
  const [body,setBody]=useState('')
  const [place,setPlace]=useState('')
  const [reward,setReward]=useState(2)
  const [deadline,setDeadline]=useState(15)
  const [coords,setCoords]=useState<{lat:number,lng:number}|null>(null)
  const [answerDraft,setAnswerDraft]=useState<Record<string,string>>({})
  const [filter,setFilter]=useState<'all'|'paid'|'following'>('all')

  async function loadAnswers(ids:string[]){
    if(!supabase||!ids.length)return {} as Record<string,Answer[]>
    const {data}=await supabase.from('answers').select('id,question_id,user_id,body,created_at,photo_url,accepted,tip_cents').in('question_id',ids)
    const grouped:Record<string,Answer[]>={}
    for(const a of (data||[]) as Answer[]){grouped[a.question_id as string]||=[];grouped[a.question_id as string].push(a)}
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

  async function postQuestion(){
    if(!body.trim())return
    if(!supabase){
      setQuestions(q=>[{id:crypto.randomUUID(),body:body.trim(),place:place||'Nearby',lat:coords?.lat||null,lng:coords?.lng||null,helpful_count:0,created_at:new Date().toISOString(),reward_cents:reward*100,status:'open',answers:[]},...q])
      setBody('');setPlace('');setTab('home');return
    }
    if(!user)return alert('Please sign in first.')
    const {error}=await supabase.from('questions').insert({user_id:user.id,body:body.trim(),place:place||null,lat:coords?.lat||null,lng:coords?.lng||null,reward_cents:reward*100,status:'open'})
    if(error)return alert(error.message)
    setBody('');setPlace('');setTab('home');loadQuestions()
  }

  async function postAnswer(qid:string){
    const txt=(answerDraft[qid]||'').trim();if(!txt)return
    if(!supabase){
      setQuestions(q=>q.map(x=>x.id===qid?{...x,answers:[...(x.answers||[]),{id:crypto.randomUUID(),body:txt,created_at:new Date().toISOString()}]}:x))
      setAnswerDraft(d=>({...d,[qid]:''}));return
    }
    if(!user)return alert('Please sign in first.')
    const {error}=await supabase.from('answers').insert({question_id:qid,user_id:user.id,body:txt})
    if(error)return alert(error.message)
    setAnswerDraft(d=>({...d,[qid]:''}));loadQuestions()
  }

  function approveAnswer(q:Question,a:Answer){
    alert(`Answer approved ✓\n${money(q.reward_cents)} reward is simulated during family testing.`)
    setQuestions(list=>list.map(x=>x.id===q.id?{...x,status:'completed',answers:(x.answers||[]).map(y=>y.id===a.id?{...y,accepted:true}:y)}:x))
    setSelected(s=>s?{...s,status:'completed',answers:(s.answers||[]).map(y=>y.id===a.id?{...y,accepted:true}:y)}:s)
  }

  const visible=questions.filter(q=>filter==='paid'?(q.reward_cents||0)>0:true)

  return <main className="appShell">
    {selected ? <DetailScreen q={selected} onBack={()=>setSelected(null)} onApprove={approveAnswer} answerDraft={answerDraft} setAnswerDraft={setAnswerDraft} postAnswer={postAnswer}/> : <>
      {tab==='home'&&<HomeScreen questions={visible} coords={coords} useLocation={useLocation} onOpen={setSelected} filter={filter} setFilter={setFilter} user={user} supabaseReady={!!supabase}/>} 
      {tab==='ask'&&<AskScreen body={body} setBody={setBody} place={place} setPlace={setPlace} reward={reward} setReward={setReward} deadline={deadline} setDeadline={setDeadline} postQuestion={postQuestion}/>} 
      {tab==='notifications'&&<NotificationsScreen/>}
      {tab==='profile'&&<ProfileScreen user={user} supabaseReady={!!supabase}/>} 
      <BottomNav tab={tab} setTab={setTab}/>
    </>}
  </main>
}

function Header({user}:{user:User|null}){
  return <header className="appHeader">
    <div className="brandWord">Near By</div>
    <div className="headerActions"><button className="iconBtn" aria-label="Notifications"><Bell size={20}/></button><div className="miniAvatar">{user?.email?.[0]?.toUpperCase()||'Y'}</div></div>
  </header>
}

function HomeScreen({questions,coords,useLocation,onOpen,filter,setFilter,user,supabaseReady}:{questions:Question[];coords:{lat:number,lng:number}|null;useLocation:()=>void;onOpen:(q:Question)=>void;filter:'all'|'paid'|'following';setFilter:(v:'all'|'paid'|'following')=>void;user:User|null;supabaseReady:boolean}){
  return <div className="screen homeScreen">
    <Header user={user}/>
    <section className="mapHero">
      {coords?<NearbyMap lat={coords.lat} lng={coords.lng} pins={questions}/>:<div className="mapFallback"><div className="mapGrid"/><div className="youDot"/><button className="locationPill" onClick={useLocation}><MapPin size={15}/> 0.3 miles</button><button className="locationCTA" onClick={useLocation}>Use my location</button></div>}
    </section>


    <section className="contentSection">
      <div className="sectionTitleRow"><h2>Questions Nearby</h2><button className="searchBtn"><Search size={18}/></button></div>
      <div className="segmented">
        <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All</button>
        <button className={filter==='paid'?'active':''} onClick={()=>setFilter('paid')}>With reward</button>
        <button className={filter==='following'?'active':''} onClick={()=>setFilter('following')}>Following</button>
      </div>
      <div className="questionList">
        {questions.map((q,i)=><button className="questionCard" onClick={()=>onOpen(q)} key={q.id}>
          <div className="cardTop"><div className="personRow"><div className="avatar">{['Y','T','M'][i%3]}</div><div><b>{['Yuki','Taro','Mika'][i%3]}</b><span>{i===0?'0.2 miles':'0.3 miles'} · {minutesAgo(q.created_at)} min ago</span></div></div><span className={(q.reward_cents||0)>0?'rewardTag':'rewardTag freeTag'}>{(q.reward_cents||0)>0?`Reward ${money(q.reward_cents)}`:'No reward'}</span></div>
          <div className="questionText">{q.body}</div>
          <div className="placeLine"><MapPin size={14}/>{q.place||'Nearby'}</div>
          <div className="thumbMock">{i===0?'🎧':i===1?'🅿️':'💧'}</div>
          <div className="cardFooter"><span>{q.answers?.length||0} answer{(q.answers?.length||0)===1?'':'s'}</span><span><Clock3 size={14}/> {10+i*5} min left</span></div>
        </button>)}
      </div>
    </section>
  </div>
}

function AskScreen({body,setBody,place,setPlace,reward,setReward,deadline,setDeadline,postQuestion}:{body:string;setBody:(s:string)=>void;place:string;setPlace:(s:string)=>void;reward:number;setReward:(n:number)=>void;deadline:number;setDeadline:(n:number)=>void;postQuestion:()=>void}){
  return <div className="screen askScreen">
    <div className="simpleTop"><h1>Ask a Question</h1></div>
    <section className="formSection">
      <label>What do you want to know?</label>
      <textarea className="bigInput" maxLength={200} value={body} onChange={e=>setBody(e.target.value)} placeholder="Does Target still have this item?"/>
      <div className="counter">{body.length}/200</div>

      <label>Photo <span>(optional)</span></label>
      <div className="photoPicker"><div className="photoPreview">🎧<button><X size={13}/></button></div><button className="addPhoto"><Camera size={24}/><span>Add</span></button></div>

      <label>Location</label>
      <div className="locationField"><div><b>{place||'Choose a place'}</b><span>{place?'Exact user location stays private':'Add a store or venue'}</span></div><button onClick={()=>setPlace(place?'':'Target · 123 Main St, San Jose, CA')}><MapPin size={20}/></button></div>

      <label>Set a reward</label>
      <p className="helper">Higher rewards can get faster answers.</p>
      <div className="rewardGrid">{[1,2,3,5].map(v=><button key={v} className={reward===v?'selected':''} onClick={()=>setReward(v)}>${v}</button>)}</div>

      <label>Time limit</label>
      <select className="selectField" value={deadline} onChange={e=>setDeadline(Number(e.target.value))}><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select>

      <button className="primaryBtn" onClick={postQuestion}>Post Question</button>
      <div className="paymentNote">Reward: {money(reward*100)} <span>(virtual during family test)</span></div>

      <div className="safetyBox"><h3><ShieldCheck size={19}/> Safety first</h3><ul><li>No requests to track people or vehicles</li><li>No trespassing or dangerous requests</li><li>Precise responder locations stay private</li><li>Report suspicious content anytime</li></ul></div>
    </section>
  </div>
}

function DetailScreen({q,onBack,onApprove,answerDraft,setAnswerDraft,postAnswer}:{q:Question;onBack:()=>void;onApprove:(q:Question,a:Answer)=>void;answerDraft:Record<string,string>;setAnswerDraft:React.Dispatch<React.SetStateAction<Record<string,string>>>;postAnswer:(id:string)=>void}){
  return <div className="screen detailScreen">
    <header className="detailTop"><button className="iconBtn" onClick={onBack}><ChevronLeft/></button><h1>Question Details</h1><button className="iconBtn"><MoreHorizontal/></button></header>
    <div className="timeLeft">8:45 remaining</div>
    <section className="detailContent">
      <div className="requesterRow"><div className="avatar large">Y</div><div><b>You</b><span>0.2 miles · 3 min ago</span></div><span className="rewardTag">Reward {money(q.reward_cents)}</span></div>
      <h2 className="detailQuestion">{q.body}</h2>
      <div className="productCard"><div className="productPic">🎧</div><div><b>Item to check</b><span>{q.place||'Nearby location'}</span></div></div>

      <h3 className="answerCount">Answers {q.answers?.length||0}</h3>
      {(q.answers||[]).map((a,i)=><article className="answerCard" key={a.id}>
        <div className="answerHeader"><div className="personRow"><div className="avatar">{i===0?'H':'J'}</div><div><b>{i===0?'Hana':'Jiro'}</b><span>0.1 miles · {minutesAgo(a.created_at)} min ago</span></div></div><span className="rating"><Star size={15} fill="currentColor"/> {i===0?'4.9':'4.7'}</span></div>
        {a.photo_url?<img className="answerPhoto" src={a.photo_url} alt="Answer evidence"/>:<div className="answerPhoto placeholder">📷 Photo evidence</div>}
        <p>{a.body}</p>
        <div className="answerActions"><button className="secondaryBtn">Reject</button><button className="acceptBtn" onClick={()=>onApprove(q,a)}><Check size={18}/> Accept</button></div>
      </article>)}

      {(!q.answers||q.answers.length===0)&&<div className="emptyAnswers">No answers yet. People nearby can respond here.</div>}
      <div className="quickAnswer"><input value={answerDraft[q.id]||''} onChange={e=>setAnswerDraft(d=>({...d,[q.id]:e.target.value}))} placeholder="I'm here — here's what I see…"/><button onClick={()=>postAnswer(q.id)}>Answer</button></div>
    </section>
  </div>
}

function NotificationsScreen(){
  return <div className="screen notificationsScreen"><div className="simpleTop"><h1>Notifications</h1></div><div className="notifTabs"><button className="active">All</button><button>Transactions</button><button>System</button></div><div className="notificationCard"><div className="successIcon"><Check/></div><div><b>Your answer was accepted</b><span>You earned a virtual $2.00 reward.</span><small>2 min ago</small></div></div><div className="notificationCard"><div className="bellIcon"><Bell/></div><div><b>New question nearby</b><span>Someone needs a quick stock check 0.4 miles away.</span><small>6 min ago</small></div></div></div>
}

function ProfileScreen({user,supabaseReady}:{user:User|null;supabaseReady:boolean}){
  return <div className="screen profileScreen"><div className="profileTop"><h1>Profile</h1><Settings size={21}/></div><section className="profileHero"><div className="profileAvatar">{user?.email?.[0]?.toUpperCase()||'Y'}</div><div className="profileName">{user?.email?.split('@')[0]||'You'}</div><div className="handle">@you</div><div className="profileRating"><Star size={18} fill="currentColor"/> 4.8 <span>(23)</span></div><small>Member since 2026</small></section><div className="statsRow"><div><b>12</b><span>Questions</span></div><div><b>15</b><span>Answers</span></div><div><b>14</b><span>Solved</span></div></div><section className="profileSection"><h3>Badges</h3><div className="badges"><div><ShieldCheck/><span>First Answer</span></div><div><Star/><span>Top Answer</span></div><div><Star/><span>Trusted</span></div></div></section><section className="profileSection"><button className="profileLink"><UserRound/> My questions <span>›</span></button><button className="profileLink"><Check/> My answers <span>›</span></button><button className="profileLink"><Heart/> Favorites <span>›</span></button><button className="profileLink"><Settings/> Settings <span>›</span></button></section><section className="earningsCard"><div><span>Total earnings</span><b>$18.00</b><small>Virtual rewards so far</small></div><DollarSign size={30}/></section>{!user&&supabaseReady&&<div className="profileLogin"><LoginButtons/></div>}</div>
}

function BottomNav({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}){
  return <nav className="bottomNav"><button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><MapPin/><span>Home</span></button><button className={tab==='ask'?'active':''} onClick={()=>setTab('ask')}><Plus/><span>Ask</span></button><button className={tab==='notifications'?'active':''} onClick={()=>setTab('notifications')}><Bell/><span>Alerts</span></button><button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}><UserRound/><span>Profile</span></button></nav>
}
