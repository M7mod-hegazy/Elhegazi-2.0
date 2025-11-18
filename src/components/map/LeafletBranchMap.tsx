import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons in bundlers by using CDN asset URLs
// This avoids missing marker icons in Vite/React builds without file-loader config.
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface LeafletBranchMapProps {
  center: { lat: number; lng: number };
  name?: string;
  address?: string;
  heightClass?: string; // e.g., 'h-80'
  className?: string;
}

const LeafletBranchMap: React.FC<LeafletBranchMapProps> = ({
  center,
  name,
  address,
  heightClass = 'h-80',
  className = '',
}) => {
  const position: [number, number] = [center.lat, center.lng];
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg ${heightClass} ${className}`}>
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full"
        style={{ isolation: 'isolate' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{name || 'الفرع'}</div>
              {address && <div className="opacity-80">{address}</div>}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default LeafletBranchMap;
