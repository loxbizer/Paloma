import * as THREE from 'three'

// Core rendering stack: scene, camera, WebGL renderer, lighting rig, and a
// futuristic skybox gradient. Kept engine-agnostic so game code just gets a scene.
export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a0f1a, 0.012)

  // Gradient "space station" sky.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0x0a1428) }, bot: { value: new THREE.Color(0x05060a) } },
      vertexShader: `varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
      fragmentShader: `varying vec3 vp; uniform vec3 top; uniform vec3 bot;
        void main(){ float h = normalize(vp).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bot, top, h), 1.0);} `,
    })
  )
  scene.add(sky)

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 500)
  camera.position.set(0, 1.7, 8)

  // Lighting: cool ambient + warm key + rim fill for the cartoon-realistic look.
  scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x141018, 0.7))
  const key = new THREE.DirectionalLight(0xfff2e0, 1.6)
  key.position.set(30, 60, 20)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 1; key.shadow.camera.far = 160
  key.shadow.camera.left = -70; key.shadow.camera.right = 70
  key.shadow.camera.top = 70; key.shadow.camera.bottom = -70
  key.shadow.bias = -0.0004
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x35c8ff, 0.6)
  rim.position.set(-25, 20, -30)
  scene.add(rim)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  return { renderer, scene, camera }
}
