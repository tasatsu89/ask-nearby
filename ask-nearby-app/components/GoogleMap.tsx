'use client'
import Script from 'next/script'
import {useEffect,useRef,useState} from 'react'
type Pin={id:string;lat:number|null;lng:number|null;body:string;place:string|null}
declare global {interface Window {google:any}}
export default function GoogleMap({lat,lng,pins,onSelect}:{lat:number;lng:number;pins:Pin[];onSelect:(id:string)=>void}){
 const el=useRef<HTMLDivElement>(null);const mapRef=useRef<any>(null);const selectRef=useRef(onSelect);const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false)
 useEffect(()=>{selectRef.current=onSelect},[onSelect])
 useEffect(()=>{if(!ready||!el.current)return;if(!mapRef.current)mapRef.current=new window.google.maps.Map(el.current,{center:{lat,lng},zoom:13,mapTypeControl:false,streetViewControl:false});else mapRef.current.setCenter({lat,lng})},[ready,lat,lng])
 useEffect(()=>{if(!ready||!mapRef.current)return;const markers=pins.filter(p=>p.lat!=null&&p.lng!=null).map(p=>{const m=new window.google.maps.Marker({map:mapRef.current,position:{lat:p.lat,lng:p.lng},title:p.body});m.addListener('click',()=>selectRef.current(p.id));return m});return()=>markers.forEach(m=>{window.google.maps.event.clearInstanceListeners(m);m.setMap(null)})},[ready,pins])
 return <><Script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`} onReady={()=>setReady(true)} onError={()=>setFailed(true)}/><div ref={el} className="mapCanvas" aria-label="Nearby questions map"/>{!ready&&<p role="status">{failed?'The map could not load. You can still browse questions below.':'Loading map…'}</p>}</>
}
