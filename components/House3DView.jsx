'use client';

import { useId } from 'react';

function pts(points) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export function House3DView({ casa }) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const accent = casa?.status === 'vendido'
    ? '#ef4444'
    : casa?.status === 'alugado'
      ? '#8b5cf6'
      : casa?.status === 'reservado'
        ? '#f59e0b'
        : '#3288e0';

  const ids = {
    wall: `${uid}-h3d-wall`,
    wallSide: `${uid}-h3d-wall-side`,
    roof: `${uid}-h3d-roof`,
    roofSide: `${uid}-h3d-roof-side`,
    glass: `${uid}-h3d-glass`,
    lawn: `${uid}-h3d-lawn`,
    path: `${uid}-h3d-path`,
    shadow: `${uid}-h3d-shadow`,
    grassTexture: `${uid}-h3d-grass-texture`,
    roofTexture: `${uid}-h3d-roof-texture`,
    wallTexture: `${uid}-h3d-wall-texture`,
  };
  const url = (id) => `url(#${id})`;

  const lotTop = pts([
    { x: 36, y: 178 },
    { x: 253, y: 178 },
    { x: 326, y: 136 },
    { x: 108, y: 136 },
  ]);
  const lotFront = pts([
    { x: 36, y: 178 },
    { x: 253, y: 178 },
    { x: 253, y: 210 },
    { x: 36, y: 210 },
  ]);
  const lotSide = pts([
    { x: 253, y: 178 },
    { x: 326, y: 136 },
    { x: 326, y: 168 },
    { x: 253, y: 210 },
  ]);

  const bodyFront = pts([
    { x: 97, y: 109 },
    { x: 218, y: 109 },
    { x: 218, y: 171 },
    { x: 97, y: 171 },
  ]);
  const bodySide = pts([
    { x: 218, y: 109 },
    { x: 268, y: 82 },
    { x: 268, y: 143 },
    { x: 218, y: 171 },
  ]);
  const gable = pts([
    { x: 97, y: 109 },
    { x: 157, y: 63 },
    { x: 218, y: 109 },
  ]);
  const roofFront = pts([
    { x: 83, y: 111 },
    { x: 157, y: 54 },
    { x: 232, y: 111 },
    { x: 218, y: 119 },
    { x: 157, y: 72 },
    { x: 97, y: 119 },
  ]);
  const roofSide = pts([
    { x: 157, y: 54 },
    { x: 285, y: 82 },
    { x: 268, y: 92 },
    { x: 232, y: 111 },
  ]);
  const roofRight = pts([
    { x: 232, y: 111 },
    { x: 285, y: 82 },
    { x: 268, y: 92 },
    { x: 218, y: 119 },
  ]);
  const garageFront = pts([
    { x: 42, y: 131 },
    { x: 97, y: 131 },
    { x: 97, y: 171 },
    { x: 42, y: 171 },
  ]);
  const garageRoof = pts([
    { x: 34, y: 132 },
    { x: 73, y: 105 },
    { x: 105, y: 132 },
    { x: 96, y: 138 },
    { x: 73, y: 120 },
    { x: 45, y: 138 },
  ]);

  return (
    <div className="house-3d-wrap">
      <svg viewBox="0 0 360 230" className="house-3d-svg" role="img" aria-label={`Modelo 3D da casa ${casa?.nome || ''}`}>
        <defs>
          <pattern id={ids.grassTexture} patternUnits="userSpaceOnUse" width="96" height="96">
            <image href="/textures/terreno.jpeg" x="0" y="0" width="96" height="96" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <pattern id={ids.roofTexture} patternUnits="userSpaceOnUse" width="96" height="96">
            <image href="/textures/predio/exterior-roof.jpg" x="0" y="0" width="96" height="96" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <pattern id={ids.wallTexture} patternUnits="userSpaceOnUse" width="128" height="128">
            <image href="/textures/predio/exterior-concrete.jpg" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <linearGradient id={ids.wall} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="52%" stopColor="#e8dccb" />
            <stop offset="100%" stopColor="#cbbda9" />
          </linearGradient>
          <linearGradient id={ids.wallSide} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d8c7af" />
            <stop offset="100%" stopColor="#a9967b" />
          </linearGradient>
          <linearGradient id={ids.roof} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c85b35" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
          <linearGradient id={ids.roofSide} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9a3412" />
            <stop offset="100%" stopColor="#5f1e0b" />
          </linearGradient>
          <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#dff7ff" />
            <stop offset="55%" stopColor="#75bfe0" />
            <stop offset="100%" stopColor="#2f7291" />
          </linearGradient>
          <linearGradient id={ids.lawn} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93c47d" />
            <stop offset="100%" stopColor="#5f8f4b" />
          </linearGradient>
          <linearGradient id={ids.path} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e7ded0" />
            <stop offset="100%" stopColor="#bca98f" />
          </linearGradient>
          <filter id={ids.shadow} x="-25%" y="-25%" width="160%" height="170%">
            <feDropShadow dx="0" dy="13" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.23" />
          </filter>
        </defs>

        <rect width="360" height="230" fill="#dbeafe" />
        <ellipse cx="181" cy="192" rx="132" ry="28" fill="rgba(15,23,42,.14)" />

        <g>
          <polygon points={lotTop} fill={url(ids.grassTexture)} stroke="rgba(51,65,85,.22)" />
          <polygon points={lotTop} fill={url(ids.lawn)} opacity=".5" />
          <polygon points={lotFront} fill="#6f8f55" stroke="rgba(51,65,85,.18)" />
          <polygon points={lotSide} fill="#4f7240" stroke="rgba(51,65,85,.16)" />
          <polygon points="145,178 181,178 210,154 172,154" fill={url(ids.path)} opacity=".92" />
          <polygon points="241,167 310,127 321,132 251,173" fill="#d9cbb9" opacity=".85" />
        </g>

        <g filter={url(ids.shadow)}>
          <polygon points={bodySide} fill={url(ids.wallTexture)} stroke="rgba(71,85,105,.25)" />
          <polygon points={bodySide} fill={url(ids.wallSide)} opacity=".58" />
          <polygon points={bodyFront} fill={url(ids.wallTexture)} stroke="rgba(71,85,105,.28)" />
          <polygon points={bodyFront} fill={url(ids.wall)} opacity=".72" />
          <polygon points={gable} fill={url(ids.wall)} stroke="rgba(71,85,105,.22)" />

          <polygon points={garageFront} fill={url(ids.wallTexture)} stroke="rgba(71,85,105,.24)" />
          <polygon points={garageFront} fill="#ded4c3" opacity=".74" />
          <polygon points={garageRoof} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,.24)" />
          <polygon points={garageRoof} fill={url(ids.roof)} opacity=".74" />

          <polygon points={roofSide} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,.25)" />
          <polygon points={roofSide} fill={url(ids.roofSide)} opacity=".76" />
          <polygon points={roofFront} fill={url(ids.roofTexture)} stroke="rgba(71,85,105,.28)" />
          <polygon points={roofFront} fill={url(ids.roof)} opacity=".73" />
          <polygon points={roofRight} fill={url(ids.roofSide)} opacity=".54" />

          <rect x="141" y="132" width="32" height="39" rx="2" fill="#7c4a28" stroke="rgba(15,23,42,.25)" />
          <circle cx="167" cy="152" r="2" fill="#f7d28b" />
          <rect x="109" y="126" width="24" height="23" rx="2" fill={url(ids.glass)} stroke="rgba(255,255,255,.72)" />
          <rect x="183" y="126" width="24" height="23" rx="2" fill={url(ids.glass)} stroke="rgba(255,255,255,.72)" />
          <line x1="121" y1="126" x2="121" y2="149" stroke="rgba(255,255,255,.54)" />
          <line x1="109" y1="137.5" x2="133" y2="137.5" stroke="rgba(255,255,255,.54)" />
          <line x1="195" y1="126" x2="195" y2="149" stroke="rgba(255,255,255,.54)" />
          <line x1="183" y1="137.5" x2="207" y2="137.5" stroke="rgba(255,255,255,.54)" />
          <polygon points="232,116 255,104 255,124 232,137" fill={url(ids.glass)} stroke="rgba(255,255,255,.5)" />
          <rect x="51" y="145" width="36" height="26" rx="2" fill="#b9c1c9" stroke="rgba(51,65,85,.28)" />
          <line x1="51" y1="153" x2="87" y2="153" stroke="rgba(51,65,85,.22)" />
          <line x1="51" y1="161" x2="87" y2="161" stroke="rgba(51,65,85,.22)" />
          <rect x="91" y="169" width="133" height="5" rx="2" fill={accent} opacity=".88" />
        </g>
      </svg>
    </div>
  );
}
