import { NextRequest } from 'next/server'
import { createAdminClient } from './supabaseAdmin'
export async function requestUser(req:NextRequest){
 const db=createAdminClient();if(!db)return {db:null,user:null};
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!token)return {db,user:null};
 const {data,error}=await db.auth.getUser(token);return {db,user:error?null:data.user};
}
