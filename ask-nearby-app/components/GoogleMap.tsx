'use client'
import Script from 'next/script'
import {useEffect,useRef,useState} from 'react'
type Pin={id:string;lat:number|null;lng:number|null;body:string;place:string|null}
declare global {interface Window {google:any}}
export default function GoogleMap({lat,lng,pins,onSelect}:{lat:number;lng:number;pins:Pin[];onSelect:(id:string)=>void}){
 const el=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false)
 useEffect(()=>{if(!ready||!el.current)return;const map=new window.google.maps.Map(el.current,{center:{lat,lng},zoom:13,mapTypeControl:false,streetViewControl:false});const markers=pins.filter(p=>p.lat!=null&&p.lng!=null).map(p=>{const m=new window.google.maps.Marker({map,position:{lat:p.lat,lng:p.lng},title:p.body});m.addListener('click',()=>onSelect(p.id));return m});return()=>markers.forEach(m=>m.setMap(null))},[ready,lat,lng,pins,onSelect])
 return <><Script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`} onReady={()=>setReady(true)} onError={()=>setReady(false)}/><div ref={el} className="mapCanvas"/>{!ready&&<p>Loading Google Maps… Check the Maps key if this persists.</p>}</>
}
