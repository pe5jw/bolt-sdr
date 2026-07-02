// SPDX-License-Identifier: GPL-2.0-or-later
//
// Renderer switch for the panadapter surface. WebGPU 3D is the default when the
// operator/device allows it; the existing WebGL2 panadapter remains the fallback
// for unsupported GPU stacks or `?webgpuPanadapter=0`.

import { useState, type ComponentProps } from 'react';
import { isWebGpuPanadapterEnabled } from '../gl/webgpu/flag';
import { Panadapter } from './Panadapter';
import { Panadapter3D } from './Panadapter3D';

type PanadapterProps = NonNullable<ComponentProps<typeof Panadapter>>;

export function PanadapterSurface(props: PanadapterProps) {
  const [pan3dUnavailable, setPan3dUnavailable] = useState(false);
  const usePan3d = isWebGpuPanadapterEnabled() && !pan3dUnavailable;

  if (usePan3d) {
    return <Panadapter3D {...props} onUnavailable={() => setPan3dUnavailable(true)} />;
  }
  return <Panadapter {...props} />;
}
