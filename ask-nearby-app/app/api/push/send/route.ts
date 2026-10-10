import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requestUser } from '@/lib/requestUser'

function milesBetween(lat1:number,lng1:number,lat2:number,lng2:number){
  const R=3958.8
  const dLat=(lat2-lat1)*Math.PI/180
  const dLng=(lng2-lng1)*Math.PI/180
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.sqrt(a))
}

export async function POST(req:NextRequest){
  try{
    const payload = await req.json()
    const {type,question_id}=payload||{}
    const {db:supabase,user}=await requestUser(req)
    if(!user||!supabase)return NextResponse.json({error:'Sign in required'},{status:401})
    if(!['answer','nearby_question'].includes(type))return NextResponse.json({error:'Invalid event'},{status:400})
    const {data:q}=await supabase.from('questions').select('*').eq('id',question_id).single()
    if(!q)return NextResponse.json({error:'Question missing'},{status:404})
    const {data:a}=await supabase.from('answers').select('*').eq('question_id',q.id).eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if((type==='nearby_question'&&q.user_id!==user.id)||(type==='answer'&&!a))return NextResponse.json({error:'Forbidden'},{status:403})
    if(Date.now()-new Date(type==='answer'?a.created_at:q.created_at).getTime()>5*60*1000)return NextResponse.json({error:'Event too old'},{status:400})
    const actor_user_id=user.id, question_owner_id=q.user_id,question_body=q.body,answer_body=a?.body,lat=q.lat,lng=q.lng,place=q.place

    const subject = process.env.VAPID_SUBJECT
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY


    if(!subject || !publicKey || !privateKey || !supabase){
      return NextResponse.json({error:'Push server not configured'},{status:500})
    }

    const event_key=type==='answer'?`answer:${a.id}`:`question:${q.id}`
    const {error:dedup}=await supabase.from('push_events_family').insert({event_key})
    if(dedup?.code==='23505')return NextResponse.json({ok:true,duplicate:true})
    if(dedup)return NextResponse.json({error:'Apply Family Test migration first'},{status:503})
    webpush.setVapidDetails(subject, publicKey, privateKey)

    let query = supabase.from('push_subscriptions').select('*')
    if(type === 'answer' && question_owner_id){
      query = query.eq('user_id', question_owner_id)
    }

    const { data, error } = await query
    if(error) return NextResponse.json({error:error.message},{status:500})

    let subs = (data || []).filter(s=>{try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)}catch{return false}})

    if(type === 'nearby_question'){
      subs = subs.filter((s:any)=>{
        if(s.user_id === actor_user_id) return false
        if(lat == null || lng == null || s.lat == null || s.lng == null) return false
        return milesBetween(lat,lng,s.lat,s.lng) <= (s.radius_miles || 3)
      })
    }

    const notification = type === 'answer'
      ? {
          title:'New answer on Ask Nearby',
          body: answer_body ? `Someone replied: ${answer_body}` : 'Someone answered your question.',
          url:'/'
        }
      : {
          title:'New question near you',
          body:`${place ? place + ': ' : ''}${question_body || 'Someone asked something nearby.'}`,
          url:'/'
        }

    const stale:string[] = []
    await Promise.all(subs.map(async (s:any)=>{
      try{
        await webpush.sendNotification({
          endpoint:s.endpoint,
          keys:{p256dh:s.p256dh,auth:s.auth}
        }, JSON.stringify(notification))
      }catch(err:any){
        if(err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.endpoint)
      }
    }))

    if(stale.length){
      await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    }

    return NextResponse.json({ok:true, sent:subs.length})
  }catch(e:any){
    return NextResponse.json({error:e?.message || 'Unknown error'},{status:500})
  }
}
