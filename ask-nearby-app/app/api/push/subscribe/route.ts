import { NextRequest, NextResponse } from 'next/server'
import { requestUser } from '@/lib/requestUser'

export async function POST(req:NextRequest){
  try{
    const body = await req.json()
    const { subscription, lat, lng, radius_miles } = body || {}
    const {db:supabase,user}=await requestUser(req)
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401})
    const user_id=user.id
    if( !subscription?.endpoint) {
      return NextResponse.json({error:'Missing user/subscription'},{status:400})
    }

    const endpoint=new URL(subscription.endpoint)
    const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']
    if(endpoint.protocol!=='https:'||!allowed.includes(endpoint.hostname)||endpoint.port||endpoint.username||endpoint.password||!subscription.keys?.p256dh||!subscription.keys?.auth)return NextResponse.json({error:'Invalid subscription'},{status:400})
    if(!supabase) return NextResponse.json({error:'Server push config missing'},{status:500})

    const {data:existing}=await supabase.from('push_subscriptions').select('user_id').eq('endpoint',subscription.endpoint).maybeSingle()
    if(existing&&existing.user_id!==user.id)return NextResponse.json({error:'Subscription belongs to another account; unsubscribe first'},{status:409})
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      lat: lat ?? null,
      lng: lng ?? null,
      radius_miles: [1,3,5,10].includes(radius_miles)?radius_miles:3,
      updated_at: new Date().toISOString()
    }, { onConflict:'endpoint' })

    if(error) return NextResponse.json({error:error.message},{status:500})
    return NextResponse.json({ok:true})
  }catch(e:any){
    return NextResponse.json({error:e?.message || 'Unknown error'},{status:500})
  }
}
