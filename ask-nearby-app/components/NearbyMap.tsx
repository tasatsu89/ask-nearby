'use client'

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'

type Pin = { id:string; lat:number|null; lng:number|null; body:string; place:string|null }

function Recenter({lat,lng}:{lat:number,lng:number}){
  const map = useMap()
  useEffect(()=>{ map.setView([lat,lng],13) },[lat,lng,map])
  return null
}

export default function NearbyMap({
  lat,lng,pins
}:{lat:number;lng:number;pins:Pin[]}){
  return (
    <MapContainer center={[lat,lng]} zoom={13} style={{height:'320px',width:'100%',borderRadius:'18px'}} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      />
      <Recenter lat={lat} lng={lng} />
      <CircleMarker center={[lat,lng]} radius={9} pathOptions={{color:'#6657e8',fillColor:'#6657e8',fillOpacity:1}}>
        <Popup>You are here</Popup>
      </CircleMarker>
      {pins.filter(p=>p.lat!=null && p.lng!=null).map(p=>(
        <CircleMarker key={p.id} center={[p.lat as number,p.lng as number]} radius={7}
          pathOptions={{color:'#19a974',fillColor:'#19a974',fillOpacity:.9}}>
          <Popup><strong>{p.place || 'Nearby'}</strong><br/>{p.body}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
