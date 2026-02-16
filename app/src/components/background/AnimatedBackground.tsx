import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Shader for animated mesh gradient
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 uv = vUv;
    float time = uTime * 0.08;
    
    // Create flowing noise patterns
    float noise1 = snoise(uv * 2.0 + time * 0.5);
    float noise2 = snoise(uv * 3.0 - time * 0.3 + vec2(100.0));
    float noise3 = snoise(uv * 1.5 + time * 0.2 + vec2(200.0));
    
    // Combine noises for organic movement
    float combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
    
    // Create color mixing based on position and noise
    float mixFactor1 = smoothstep(-0.5, 0.5, combinedNoise + uv.x * 0.5 - 0.25);
    float mixFactor2 = smoothstep(-0.3, 0.7, combinedNoise + uv.y * 0.5);
    
    vec3 color1 = mix(uColor1, uColor2, mixFactor1);
    vec3 color2 = mix(uColor3, uColor4, mixFactor2);
    vec3 finalColor = mix(color1, color2, smoothstep(0.3, 0.7, combinedNoise * 0.5 + 0.5));
    
    // Add subtle vignette
    float vignette = 1.0 - smoothstep(0.3, 1.2, length(uv - 0.5) * 1.5);
    finalColor *= vignette * 0.85 + 0.15;
    
    // Darken overall for better text contrast
    finalColor *= 0.4;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function MeshGradient() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uColor1: { value: new THREE.Color('#070B14') },
    uColor2: { value: new THREE.Color('#0B1222') },
    uColor3: { value: new THREE.Color('#001a33') },
    uColor4: { value: new THREE.Color('#0a1a2e') },
  }), []);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });
  
  useEffect(() => {
    const handleResize = () => {
      if (materialRef.current) {
        materialRef.current.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[3, 2, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// Floating particles component
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 80;
  
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
      
      vel[i * 3] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
    }
    
    return [pos, vel];
  }, []);
  
  useFrame(() => {
    if (!particlesRef.current) return;
    
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      posArray[i * 3] += velocities[i * 3];
      posArray[i * 3 + 1] += velocities[i * 3 + 1];
      posArray[i * 3 + 2] += velocities[i * 3 + 2];
      
      // Wrap around
      if (posArray[i * 3] > 2) posArray[i * 3] = -2;
      if (posArray[i * 3] < -2) posArray[i * 3] = 2;
      if (posArray[i * 3 + 1] > 1.5) posArray[i * 3 + 1] = -1.5;
      if (posArray[i * 3 + 1] < -1.5) posArray[i * 3 + 1] = 1.5;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  const positionAttribute = useMemo(() => {
    return new THREE.BufferAttribute(positions, 3);
  }, [positions]);
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={positionAttribute} />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color="#00F0FF"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// Connection lines between particles
function ConnectionLines() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const particleCount = 30;
  const maxConnections = 3;
  const connectionDistance = 0.6;
  
  const particlePositions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1;
    }
    return pos;
  }, []);
  
  const linePositions = useMemo(() => {
    return new Float32Array(particleCount * maxConnections * 6);
  }, []);
  
  const lineColors = useMemo(() => {
    return new Float32Array(particleCount * maxConnections * 6);
  }, []);
  
  useFrame((state) => {
    if (!linesRef.current) return;
    
    const time = state.clock.elapsedTime * 0.1;
    const positions = linesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = linesRef.current.geometry.attributes.color.array as Float32Array;
    
    let lineIndex = 0;
    
    for (let i = 0; i < particleCount && lineIndex < particleCount * maxConnections; i++) {
      const x1 = particlePositions[i * 3] + Math.sin(time + i) * 0.1;
      const y1 = particlePositions[i * 3 + 1] + Math.cos(time + i * 0.5) * 0.1;
      const z1 = particlePositions[i * 3 + 2];
      
      let connections = 0;
      
      for (let j = i + 1; j < particleCount && connections < maxConnections; j++) {
        const x2 = particlePositions[j * 3] + Math.sin(time + j) * 0.1;
        const y2 = particlePositions[j * 3 + 1] + Math.cos(time + j * 0.5) * 0.1;
        const z2 = particlePositions[j * 3 + 2];
        
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
        
        if (dist < connectionDistance) {
          const idx = lineIndex * 6;
          positions[idx] = x1;
          positions[idx + 1] = y1;
          positions[idx + 2] = z1;
          positions[idx + 3] = x2;
          positions[idx + 4] = y2;
          positions[idx + 5] = z2;
          
          colors[idx] = 0;
          colors[idx + 1] = 0.94;
          colors[idx + 2] = 1;
          colors[idx + 3] = 0;
          colors[idx + 4] = 0.94;
          colors[idx + 5] = 1;
          
          lineIndex++;
          connections++;
        }
      }
    }
    
    // Clear remaining lines
    for (let i = lineIndex * 6; i < positions.length; i++) {
      positions[i] = 0;
    }
    
    linesRef.current.geometry.attributes.position.needsUpdate = true;
    linesRef.current.geometry.attributes.color.needsUpdate = true;
  });
  
  const positionAttr = useMemo(() => new THREE.BufferAttribute(linePositions, 3), [linePositions]);
  const colorAttr = useMemo(() => new THREE.BufferAttribute(lineColors, 3), [lineColors]);
  
  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <primitive attach="attributes-position" object={positionAttr} />
        <primitive attach="attributes-color" object={colorAttr} />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 1], fov: 75 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
      >
        <MeshGradient />
        <FloatingParticles />
        <ConnectionLines />
      </Canvas>
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(7, 11, 20, 0.6) 100%)'
        }}
      />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay'
        }}
      />
    </div>
  );
}