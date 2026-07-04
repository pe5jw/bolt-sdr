// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
//
// Licensed under the GNU General Public License v2.0-or-later. See the LICENSE
// file at the repository root for the full text.

import { useMemo } from 'react';
import type { GeoPoint } from './logbook-stats';

// A self-contained "where I've worked" plot for the dashboard: every QSO grid
// projected onto an equirectangular graticule as a glowing dot, brightness/size
// scaled by how many contacts share that ~1° cell. Deliberately tile-free (no
// Leaflet / external imagery) so it renders identically in the desktop webview
// and never phones home. The graticule reads as a signal-map backdrop without
// needing coastline geometry.

const VIEW_W = 360; // 1 unit = 1° longitude
const VIEW_H = 180; // 1 unit = 1° latitude

function project(lat: number, lon: number): { x: number; y: number } {
  return { x: lon + 180, y: 90 - lat };
}

export function LogbookMiniMap({ points }: { points: GeoPoint[] }) {
  const maxCount = useMemo(
    () => points.reduce((m, p) => Math.max(m, p.count), 1),
    [points],
  );

  const graticule = useMemo(() => {
    const meridians: number[] = [];
    for (let lon = -180; lon <= 180; lon += 30) meridians.push(lon + 180);
    const parallels: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) parallels.push(90 - lat);
    return { meridians, parallels };
  }, []);

  return (
    <div className="lb-map">
      <svg
        className="lb-map-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`World map of ${points.length} logged locations`}
      >
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} className="lb-map-bg" />
        <g className="lb-map-grid">
          {graticule.meridians.map((x) => (
            <line key={`m${x}`} x1={x} y1={0} x2={x} y2={VIEW_H} />
          ))}
          {graticule.parallels.map((y) => (
            <line key={`p${y}`} x1={0} y1={y} x2={VIEW_W} y2={y} />
          ))}
          <line className="lb-map-equator" x1={0} y1={90} x2={VIEW_W} y2={90} />
        </g>
        <g className="lb-map-dots">
          {points.map((p, i) => {
            const { x, y } = project(p.lat, p.lon);
            const weight = p.count / maxCount;
            const r = 1.1 + weight * 2.4;
            return (
              <circle
                key={`${p.lat},${p.lon},${i}`}
                cx={x}
                cy={y}
                r={r}
                style={{ opacity: 0.45 + weight * 0.55 }}
              />
            );
          })}
        </g>
      </svg>
      {points.length === 0 && (
        <div className="lb-map-empty">No gridded QSOs to map yet</div>
      )}
    </div>
  );
}
