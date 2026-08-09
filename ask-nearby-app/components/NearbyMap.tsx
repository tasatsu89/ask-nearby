'use client'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Pin={id:string;lat:number|null;lng:number|null;body:string;place:string|null;reward_cents?:number}
export default function NearbyMap({lat,lng,pins}:{lat:number;lng:number;pins:Pin[]}){
  return <MapContainer center={[lat,lng]} zoom={13} scrollWheelZoom={false} className="mapCanvas">
    <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Circle center={[lat,lng]} radius={600} pathOptions={{color:'#1677ff',fillOpacity:.08}} />
    <CircleMarker center={[lat,lng]} radius={7} pathOptions={{color:'#fff',weight:3,fillColor:'#1677ff',fillOpacity:1}} />
    {pins.filter(p=>p.lat!=null&&p.lng!=null).map(p=><CircleMarker key={p.id} center={[p.lat!,p.lng!]} radius={11} pathOptions={{color:'#fff',weight:3,fillColor:'#0b57d0',fillOpacity:1}}><Popup><b>{p.place||'Nearby'}</b><br/>{p.body}<br/><b>${((p.reward_cents||0)/100).toFixed(2)} reward</b></Popup></CircleMarker>)}
  </MapContainer>
}
