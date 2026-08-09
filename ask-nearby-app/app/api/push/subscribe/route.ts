import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

export async function POST(req:NextRequest){
  try{
    const body = await req.json()
    const { user_id, subscription, lat, lng, radius_miles } = body || {}
    if(!user_id || !subscription?.endpoint) {
      return NextResponse.json({error:'Missing user/subscription'},{status:400})
    }

    const supabase = createAdminClient()
    if(!supabase) return NextResponse.json({error:'Server push config missing'},{status:500})

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || '',
      lat: lat ?? null,
      lng: lng ?? null,
      radius_miles: radius_miles ?? 3,
      updated_at: new Date().toISOString()
    }, { onConflict:'endpoint' })

    if(error) return NextResponse.json({error:error.message},{status:500})
    return NextResponse.json({ok:true})
  }catch(e:any){
    return NextResponse.json({error:e?.message || 'Unknown error'},{status:500})
  }
}
