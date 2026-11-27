/**
 * Interactive 3D PC Build Visualizer
 * Renders a procedural 3D PC chassis and internal components synced to the user's selected parts.
 * Uses Three.js WebGL when available, with an automatic pure-Canvas 3D fallback for offline use.
 */
class PCViewer3D {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onPartClick = options.onPartClick || (() => {});
    this.onPartHover = options.onPartHover || (() => {});

    this.currentBuild = null;
    this.currentStats = null;
    this.isDark = false;
    this.glassOpen = false;
    this.autoRotate = true;
    this.hoveredCategory = null;
    this.externalHighlight = null;

    // Camera spherical orbit coordinates
    this.orbit = {
      theta: 0.52,
      phi: 1.38,
      radius: 9.2,
      targetTheta: 0.52,
      targetPhi: 1.38,
      targetRadius: 9.2,
      targetY: -0.05
    };

    this.pointer = {
      isDown: false,
      moved: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0
    };

    this.fans = [];
    this.rgbMaterials = [];
    this.categoryGroups = {};
    this.glassGroup = null;
    this.glassProgress = 0;
    this.clock = 0;
    this.rafId = null;

    this.useThree = typeof window.THREE !== "undefined" && this._checkWebGL();
    if (this.useThree) {
      this._initThree();
    } else {
      this._initFallbackCanvas();
    }

    this._bindInteractions();
    this._startLoop();
  }

  _checkWebGL() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(
        window.WebGLRenderingContext &&
          (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch {
      return false;
    }
  }

  _initThree() {
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 320);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.canvas = this.renderer.domElement;
    this.canvas.className = "viewer-canvas";
    this.container.innerHTML = "";
    this.container.appendChild(this.canvas);

    this.raycaster = new THREE.Raycaster();
    this.mouseNdc = new THREE.Vector2(-99, -99);

    // Studio Lighting Rig
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.75);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.keyLight.position.set(5.5, 7.5, 6.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 22;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.fillLight.position.set(-6, 2.5, 4.5);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 0.65);
    this.rimLight.position.set(-2.5, 5, -6.5);
    this.scene.add(this.rimLight);

    // Subtle interior point light so components inside the dark chassis pop clearly
    this.interiorLight = new THREE.PointLight(0xe0f2fe, 0.75, 7.5);
    this.interiorLight.position.set(0.2, 0.4, 1.15);
    this.scene.add(this.interiorLight);

    // Pedestal / floor contact shadow plane
    const floorGeo = new THREE.CircleGeometry(4.4, 48);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.92,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55
    });
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -2.48;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Responsive ResizeObserver
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this._handleResize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener("resize", () => this._handleResize());
    }
  }

  _initFallbackCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "viewer-canvas";
    this.container.innerHTML = "";
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this._handleResize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this._handleResize());
      this.resizeObserver.observe(this.container);
    }
  }

  _handleResize() {
    const width = Math.max(this.container.clientWidth, 280);
    const height = Math.max(this.container.clientHeight, 280);
    if (this.useThree && this.renderer && this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    } else if (this.canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
  }

  setTheme(isDark) {
    this.isDark = Boolean(isDark);
    if (!this.useThree) return;

    if (this.isDark) {
      this.ambientLight.intensity = 0.55;
      this.hemiLight.color.setHex(0xcbd5e1);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.7;
      this.floorMat.color.setHex(0x1e293b);
      this.floorMat.opacity = 0.65;
    } else {
      this.ambientLight.intensity = 0.78;
      this.hemiLight.color.setHex(0xffffff);
      this.hemiLight.groundColor.setHex(0x94a3b8);
      this.hemiLight.intensity = 0.85;
      this.floorMat.color.setHex(0xcbd5e1);
      this.floorMat.opacity = 0.5;
    }
  }

  setCameraPreset(preset) {
    this.autoRotate = false;
    switch (preset) {
      case "hero":
        this.orbit.targetTheta = 0.52;
        this.orbit.targetPhi = 1.38;
        this.orbit.targetRadius = 9.2;
        break;
      case "inside":
        this.orbit.targetTheta = 0.04;
        this.orbit.targetPhi = 1.52;
        this.orbit.targetRadius = 7.8;
        break;
      case "front":
        this.orbit.targetTheta = 1.32;
        this.orbit.targetPhi = 1.44;
        this.orbit.targetRadius = 8.8;
        break;
      case "top":
        this.orbit.targetTheta = 0.45;
        this.orbit.targetPhi = 0.82;
        this.orbit.targetRadius = 9.4;
        break;
      default:
        break;
    }
  }

  toggleGlass() {
    this.glassOpen = !this.glassOpen;
    return this.glassOpen;
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    return this.autoRotate;
  }

  highlightPart(category) {
    this.externalHighlight = category || null;
  }

  clearHighlight() {
    this.externalHighlight = null;
  }

  updateBuild(build, stats) {
    this.currentBuild = build;
    this.currentStats = stats;
    if (this.useThree) {
      this._rebuildThreeScene();
    }
  }

  _disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
  }

  _tagCategory(object, category) {
    object.traverse((child) => {
      child.userData.category = category;
    });
  }

  _makeBadgeTexture(topText, bottomText, bgHex, accentHex, textHex = "#f8fafc") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 256, 14);
    ctx.fillRect(0, 118, 256, 10);

    ctx.fillStyle = textHex;
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(topText, 128, 54);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(bottomText, 128, 92);

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  _createFan(radius, depth, options = {}) {
    const { rgb = false, rgbOffset = 0, frameColor = 0x181c24, bladeColor = 0x262c38 } = options;
    const fanGroup = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.55,
      metalness: 0.25
    });

    // Outer ring housing
    const ringGeo = new THREE.CylinderGeometry(radius, radius, depth, 24, 1, true);
    const ringMesh = new THREE.Mesh(ringGeo, frameMat);
    ringMesh.rotation.x = Math.PI / 2;
    fanGroup.add(ringMesh);

    // Square corner mounting bezel
    const bezelSize = radius * 2.02;
    const bezelBarThick = radius * 0.16;
    const barGeoH = new THREE.BoxGeometry(bezelSize, bezelBarThick, depth * 0.9);
    const barGeoV = new THREE.BoxGeometry(bezelBarThick, bezelSize, depth * 0.9);

    const topBar = new THREE.Mesh(barGeoH, frameMat);
    topBar.position.y = radius - bezelBarThick * 0.35;
    const botBar = new THREE.Mesh(barGeoH, frameMat);
    botBar.position.y = -radius + bezelBarThick * 0.35;
    const leftBar = new THREE.Mesh(barGeoV, frameMat);
    leftBar.position.x = -radius + bezelBarThick * 0.35;
    const rightBar = new THREE.Mesh(barGeoV, frameMat);
    rightBar.position.x = radius - bezelBarThick * 0.35;
    fanGroup.add(topBar, botBar, leftBar, rightBar);

    // RGB LED halo ring
    if (rgb) {
      const haloGeo = new THREE.TorusGeometry(radius * 0.88, radius * 0.065, 10, 28);
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.5,
        roughness: 0.25
      });
      haloMat.userData.rgbOffset = rgbOffset;
      this.rgbMaterials.push(haloMat);
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.z = depth * 0.36;
      fanGroup.add(halo);
    }

    // Spinning rotor (hub + 7 pitched blades)
    const rotor = new THREE.Group();
    const hubMat = new THREE.MeshStandardMaterial({
      color: rgb ? 0x334155 : 0x1e2430,
      roughness: 0.35,
      metalness: 0.5
    });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, depth * 0.72, 18), hubMat);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: rgb ? 0xe2e8f0 : bladeColor,
      emissive: rgb ? 0x38bdf8 : 0x000000,
      emissiveIntensity: rgb ? 0.35 : 0,
      roughness: 0.4,
      metalness: 0.15
    });
    if (rgb) {
      bladeMat.userData.rgbOffset = rgbOffset + 0.4;
      this.rgbMaterials.push(bladeMat);
    }

    const bladeCount = 7;
    const bladeGeo = new THREE.BoxGeometry(radius * 0.64, radius * 0.22, 0.018);
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      const bladeWrap = new THREE.Group();
      bladeWrap.rotation.z = angle;

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.x = radius * 0.5;
      blade.rotation.x = 0.48;
      bladeWrap.add(blade);
      rotor.add(bladeWrap);
    }

    fanGroup.add(rotor);
    this.fans.push({ rotor, speed: 5.5 + (rgbOffset % 1.5) });
    return fanGroup;
  }

  _rebuildThreeScene() {
    this._disposeGroup(this.rootGroup);
    this.fans = [];
    this.rgbMaterials = [];
    this.categoryGroups = {};
    this.glassGroup = null;

    const build = this.currentBuild;
    if (!build) return;

    const casePart = build.case;
    const mbPart = build.motherboard;
    const cpuPart = build.cpu;
    const gpuPart = build.gpu;
    const ramPart = build.ram;
    const ssdPart = build.storage;
    const psuPart = build.psu;

    const isCompactCase = !casePart.formFactors.includes("ATX");
    const caseL = isCompactCase ? 3.8 : 4.35; // X axis (rear -X to front +X)
    const caseH = isCompactCase ? 3.95 : 4.6; // Y axis (bottom -Y to top +Y)
    const caseW = isCompactCase ? 2.08 : 2.18; // Z axis (back tray -Z to glass +Z)

    // Adjust pedestal height to sit snugly under case feet
    this.floorMesh.position.y = -caseH / 2 - 0.18;

    const hasAnyRgb =
      Boolean(casePart.rgb || mbPart.rgb || gpuPart.rgb || ramPart.rgb);
    this.interiorLight.color.setHex(hasAnyRgb ? 0xbae6fd : 0xf1f5f9);
    this.interiorLight.intensity = hasAnyRgb ? 0.95 : 0.72;

    // ---------------------------------------------------------
    // 1. PC CASE CHASSIS & FANS
    // ---------------------------------------------------------
    const caseGroup = new THREE.Group();
    const isNzxt = casePart.id === "case-3";
    const isCorsair = casePart.id === "case-4";
    const isLianLi = casePart.id === "case-5";
    const isMontech = casePart.id === "case-2";

    const chassisMat = new THREE.MeshStandardMaterial({
      color: isNzxt ? 0x222730 : isCorsair ? 0x252b34 : 0x1b2029,
      roughness: 0.48,
      metalness: 0.55
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x11151d,
      roughness: 0.62,
      metalness: 0.45
    });
    const meshGrillMat = new THREE.MeshStandardMaterial({
      color: 0x161a22,
      roughness: 0.78,
      metalness: 0.35
    });

    const wall = 0.08;
    // Bottom floor
    const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(caseL, wall, caseW), chassisMat);
    bottomPanel.position.y = -caseH / 2 + wall / 2;
    bottomPanel.castShadow = true;
    bottomPanel.receiveShadow = true;
    caseGroup.add(bottomPanel);

    // Top panel with recessed mesh strip
    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(caseL, wall, caseW), chassisMat);
    topPanel.position.y = caseH / 2 - wall / 2;
    topPanel.castShadow = true;
    caseGroup.add(topPanel);

    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(caseL * 0.68, 0.02, caseW * 0.62), meshGrillMat);
    topMesh.position.set(-0.08, caseH / 2 + 0.005, 0.08);
    caseGroup.add(topMesh);

    // Rear wall (-X)
    const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(wall, caseH, caseW), chassisMat);
    rearPanel.position.x = -caseL / 2 + wall / 2;
    rearPanel.castShadow = true;
    caseGroup.add(rearPanel);

    // Solid right side panel (-Z) & Motherboard tray
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(caseL, caseH, wall), chassisMat);
    rightPanel.position.z = -caseW / 2 + wall / 2;
    rightPanel.castShadow = true;
    caseGroup.add(rightPanel);

    const trayZ = -caseW / 2 + 0.28;
    const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(caseL - 0.16, caseH - 0.16, 0.04), darkMetalMat);
    trayMesh.position.z = trayZ;
    trayMesh.receiveShadow = true;
    caseGroup.add(trayMesh);

    // Front bezel frame (+X) — open mesh center so front fans are visible!
    const frontX = caseL / 2 - wall / 2;
    const frameThick = 0.16;
    const frontLeftPost = new THREE.Mesh(new THREE.BoxGeometry(wall * 1.4, caseH, frameThick), chassisMat);
    frontLeftPost.position.set(frontX, 0, caseW / 2 - frameThick / 2);
    const frontRightPost = new THREE.Mesh(new THREE.BoxGeometry(wall * 1.4, caseH, frameThick), chassisMat);
    frontRightPost.position.set(frontX, 0, -caseW / 2 + frameThick / 2);
    const frontTopBar = new THREE.Mesh(new THREE.BoxGeometry(wall * 1.4, 0.24, caseW), chassisMat);
    frontTopBar.position.set(frontX, caseH / 2 - 0.12, 0);
    const frontBotBar = new THREE.Mesh(new THREE.BoxGeometry(wall * 1.4, 0.24, caseW), chassisMat);
    frontBotBar.position.set(frontX, -caseH / 2 + 0.12, 0);
    caseGroup.add(frontLeftPost, frontRightPost, frontTopBar, frontBotBar);

    // Front mesh slats (styled per case)
    const slatCount = isCorsair ? 14 : 18;
    const slatSpanH = caseH - 0.56;
    const slatGeo = new THREE.BoxGeometry(0.03, 0.045, caseW - frameThick * 2 + 0.02);
    const slatMat = new THREE.MeshStandardMaterial({
      color: isNzxt ? 0x2d3440 : 0x1a1f28,
      roughness: 0.65,
      metalness: 0.4,
      transparent: true,
      opacity: 0.62
    });
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      const t = i / (slatCount - 1);
      slat.position.set(caseL / 2 + 0.01, -slatSpanH / 2 + t * slatSpanH, 0);
      caseGroup.add(slat);
    }

    // Signature case accents
    if (isCorsair) {
      const yellowTab = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.05, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      yellowTab.position.set(caseL / 2 - 0.02, caseH / 2 - 0.12, caseW / 2 - 0.06);
      caseGroup.add(yellowTab);
    } else if (isNzxt) {
      // NZXT signature cable management bar inside
      const nzxtBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, caseH - 1.35, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.38, metalness: 0.5 })
      );
      nzxtBar.position.set(0.88, 0.42, trayZ + 0.11);
      caseGroup.add(nzxtBar);
    }

    // Front I/O power button & USB ports on top-front edge
    const pwrBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.9
      })
    );
    pwrBtn.position.set(caseL / 2 - 0.28, caseH / 2 + 0.015, caseW / 2 - 0.3);
    caseGroup.add(pwrBtn);

    // 4 Case Feet
    const footGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.16, 16);
    const footMat = new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: 0.7, metalness: 0.35 });
    const footOffsets = [
      [-caseL / 2 + 0.45, -caseW / 2 + 0.32],
      [caseL / 2 - 0.45, -caseW / 2 + 0.32],
      [-caseL / 2 + 0.45, caseW / 2 - 0.32],
      [caseL / 2 - 0.45, caseW / 2 - 0.32]
    ];
    footOffsets.forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(fx, -caseH / 2 - 0.08, fz);
      foot.castShadow = true;
      caseGroup.add(foot);
    });

    // PSU Shroud (bottom internal chamber)
    const shroudH = 0.92;
    const shroudL = caseL - 0.68;
    const shroudW = caseW - 0.36;
    const shroudTopY = -caseH / 2 + wall + shroudH;
    const shroudCenterX = -caseL / 2 + wall + shroudL / 2;

    const shroudTop = new THREE.Mesh(new THREE.BoxGeometry(shroudL, 0.05, shroudW), darkMetalMat);
    shroudTop.position.set(shroudCenterX, shroudTopY - 0.025, 0.1);
    shroudTop.receiveShadow = true;
    caseGroup.add(shroudTop);

    // Shroud front face (+Z) with window cutout for PSU visibility
    const shroudFrontRight = new THREE.Mesh(new THREE.BoxGeometry(shroudL * 0.44, shroudH, 0.05), darkMetalMat);
    shroudFrontRight.position.set(shroudCenterX + shroudL * 0.28, shroudTopY - shroudH / 2, caseW / 2 - 0.12);
    const shroudFrontEnd = new THREE.Mesh(new THREE.BoxGeometry(0.05, shroudH, shroudW), darkMetalMat);
    shroudFrontEnd.position.set(shroudCenterX + shroudL / 2, shroudTopY - shroudH / 2, 0.1);
    caseGroup.add(shroudFrontRight, shroudFrontEnd);

    // Front Intake Fans
    const frontFanX = caseL / 2 - 0.2;
    if (isLianLi) {
      // Dual huge 160mm RGB fans
      [-0.68, 0.72].forEach((fy, idx) => {
        const fan = this._createFan(0.66, 0.16, { rgb: true, rgbOffset: idx * 1.4 });
        fan.rotation.y = Math.PI / 2;
        fan.position.set(frontFanX, fy, 0.08);
        caseGroup.add(fan);
      });
    } else if (isMontech) {
      // Triple 120mm ARGB fans
      [-1.12, 0.0, 1.12].forEach((fy, idx) => {
        const fan = this._createFan(0.5, 0.14, { rgb: true, rgbOffset: idx * 1.1 });
        fan.rotation.y = Math.PI / 2;
        fan.position.set(frontFanX, fy, 0.08);
        caseGroup.add(fan);
      });
    } else {
      // 2x clean stealth intake fans
      const fanYPos = isCompactCase ? [-0.55, 0.62] : [-0.45, 0.85];
      fanYPos.forEach((fy, idx) => {
        const fan = this._createFan(0.52, 0.14, { rgb: false, rgbOffset: idx });
        fan.rotation.y = Math.PI / 2;
        fan.position.set(frontFanX, fy, 0.08);
        caseGroup.add(fan);
      });
      // NZXT H5 Flow angled bottom GPU intake fan
      if (isNzxt) {
        const angledFan = this._createFan(0.46, 0.12, { rgb: false, rgbOffset: 2.2 });
        angledFan.rotation.x = Math.PI / 2;
        angledFan.rotation.y = -0.58;
        angledFan.position.set(caseL / 2 - 0.56, -caseH / 2 + 0.42, 0.08);
        caseGroup.add(angledFan);
      }
    }

    // Rear Exhaust Fan
    const rearFan = this._createFan(0.48, 0.14, { rgb: isMontech, rgbOffset: 3.1 });
    rearFan.rotation.y = Math.PI / 2;
    rearFan.position.set(-caseL / 2 + 0.16, caseH / 2 - 1.05, 0.08);
    caseGroup.add(rearFan);

    this._tagCategory(caseGroup, "case");
    this.categoryGroups.case = caseGroup;
    this.rootGroup.add(caseGroup);

    // Tempered Glass Left Side Panel (+Z)
    const glassGroup = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.15,
      roughness: 0.06,
      metalness: 0.12,
      reflectivity: 0.9,
      depthWrite: false
    });
    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(caseL - 0.18, caseH - 0.18, 0.03), glassMat);
    glassGroup.add(glassPane);

    // Subtle dark ceramic edge border on glass
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.4, metalness: 0.5 });
    const borderT = 0.09;
    const gTop = new THREE.Mesh(new THREE.BoxGeometry(caseL - 0.14, borderT, 0.036), borderMat);
    gTop.position.y = (caseH - 0.18) / 2 - borderT / 2;
    const gBot = new THREE.Mesh(new THREE.BoxGeometry(caseL - 0.14, borderT, 0.036), borderMat);
    gBot.position.y = -(caseH - 0.18) / 2 + borderT / 2;
    const gLeft = new THREE.Mesh(new THREE.BoxGeometry(borderT, caseH - 0.18, 0.036), borderMat);
    gLeft.position.x = -(caseL - 0.18) / 2 + borderT / 2;
    const gRight = new THREE.Mesh(new THREE.BoxGeometry(borderT, caseH - 0.18, 0.036), borderMat);
    gRight.position.x = (caseL - 0.18) / 2 - borderT / 2;
    glassGroup.add(gTop, gBot, gLeft, gRight);

    glassGroup.position.set(0, 0, caseW / 2 - 0.025);
    this.glassBaseZ = caseW / 2 - 0.025;
    this.glassGroup = glassGroup;
    this.rootGroup.add(glassGroup);

    // ---------------------------------------------------------
    // 2. POWER SUPPLY (PSU)
    // ---------------------------------------------------------
    const psuGroup = new THREE.Group();
    const psuL = 1.48;
    const psuH = 0.78;
    const psuW = 1.25;
    const psuX = -caseL / 2 + wall + psuL / 2 + 0.04;
    const psuY = -caseH / 2 + wall + psuH / 2 + 0.02;
    const psuZ = 0.06;

    const psuAccent = psuPart.wattage >= 850 ? "#eab308" : psuPart.wattage >= 650 ? "#f59e0b" : "#94a3b8";
    const psuTex = this._makeBadgeTexture(`${psuPart.wattage}W`, psuPart.wattage >= 650 ? "80+ GOLD" : "80+ BRONZE", "#141820", psuAccent);
    const psuBodyMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.55, metalness: 0.45 });
    const psuLabelMat = new THREE.MeshStandardMaterial({ map: psuTex, roughness: 0.4, metalness: 0.2 });

    const psuMesh = new THREE.Mesh(new THREE.BoxGeometry(psuL, psuH, psuW), [
      psuBodyMat,
      psuBodyMat,
      psuBodyMat,
      psuBodyMat,
      psuLabelMat, // +Z face visible through shroud cutout
      psuBodyMat
    ]);
    psuMesh.position.set(psuX, psuY, psuZ);
    psuGroup.add(psuMesh);

    this._tagCategory(psuGroup, "psu");
    this.categoryGroups.psu = psuGroup;
    this.rootGroup.add(psuGroup);

    // ---------------------------------------------------------
    // 3. MOTHERBOARD
    // ---------------------------------------------------------
    const mbGroup = new THREE.Group();
    const isAtxBoard = mbPart.formFactor === "ATX";
    const mbW = 2.28;
    const mbH = isAtxBoard ? 2.68 : 2.12;
    const mbZ = trayZ + 0.085;
    const mbFrontZ = mbZ + 0.025;
    const mbLeftX = -caseL / 2 + 0.24;
    const mbCenterX = mbLeftX + mbW / 2;
    const mbTopY = caseH / 2 - (isCompactCase ? 0.48 : 0.56);
    const mbCenterY = mbTopY - mbH / 2;

    const isSilverBoard = mbPart.id === "mb-4" || mbPart.id === "mb-3";
    const pcbMat = new THREE.MeshStandardMaterial({
      color: mbPart.rgb ? 0x121620 : 0x19202c,
      roughness: 0.65,
      metalness: 0.28
    });
    const heatsinkMat = new THREE.MeshStandardMaterial({
      color: isSilverBoard ? 0xcbd5e1 : mbPart.id === "mb-5" ? 0x1e242d : 0x475569,
      roughness: 0.32,
      metalness: 0.78
    });

    const pcbMesh = new THREE.Mesh(new THREE.BoxGeometry(mbW, mbH, 0.05), pcbMat);
    pcbMesh.position.set(mbCenterX, mbCenterY, mbZ);
    pcbMesh.receiveShadow = true;
    mbGroup.add(pcbMesh);

    // Rear I/O Armor + VRM Heatsinks
    const ioArmor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.96, 0.22), heatsinkMat);
    ioArmor.position.set(mbLeftX + 0.22, mbTopY - 0.54, mbFrontZ + 0.11);
    mbGroup.add(ioArmor);

    const topVrm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.18), heatsinkMat);
    topVrm.position.set(mbLeftX + 0.92, mbTopY - 0.16, mbFrontZ + 0.09);
    mbGroup.add(topVrm);

    // Chipset heatsink (bottom right)
    const chipset = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.1), heatsinkMat);
    chipset.position.set(mbLeftX + mbW - 0.42, mbCenterY - mbH / 2 + 0.42, mbFrontZ + 0.05);
    mbGroup.add(chipset);

    // Motherboard RGB accent (ASUS ROG STRIX)
    if (mbPart.rgb) {
      const mbRgbMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xa855f7,
        emissiveIntensity: 1.8,
        roughness: 0.2
      });
      mbRgbMat.userData.rgbOffset = 0.8;
      this.rgbMaterials.push(mbRgbMat);
      const rgbStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.04), mbRgbMat);
      rgbStrip.position.set(mbLeftX + 0.24, mbTopY - 0.54, mbFrontZ + 0.23);
      mbGroup.add(rgbStrip);
    }

    // Reinforced PCIe x16 Slot
    const gpuY = mbTopY - 1.48;
    const pcieSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.09, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 })
    );
    pcieSlot.position.set(mbLeftX + 0.76, gpuY, mbFrontZ + 0.04);
    mbGroup.add(pcieSlot);

    // 24-pin ATX power cable curving cleanly into tray grommet
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.1 });
    const atx24Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(mbLeftX + mbW - 0.08, mbTopY - 0.85, mbFrontZ + 0.08),
      new THREE.Vector3(mbLeftX + mbW + 0.12, mbTopY - 0.85, mbFrontZ + 0.18),
      new THREE.Vector3(mbLeftX + mbW + 0.24, mbTopY - 0.88, trayZ + 0.02)
    ]);
    const atx24Tube = new THREE.Mesh(new THREE.TubeGeometry(atx24Curve, 14, 0.055, 8, false), cableMat);
    mbGroup.add(atx24Tube);

    this._tagCategory(mbGroup, "motherboard");
    this.categoryGroups.motherboard = mbGroup;
    this.rootGroup.add(mbGroup);

    // ---------------------------------------------------------
    // 4. CPU & COOLER (Air Tower or 240mm AIO Liquid Cooler)
    // ---------------------------------------------------------
    const cpuGroup = new THREE.Group();
    const cpuX = mbLeftX + 0.92;
    const cpuY = mbTopY - 0.72;
    const isAmdCpu = cpuPart.name.toLowerCase().includes("amd");
    const cpuBrandColor = isAmdCpu ? 0xef4444 : 0x3b82f6;

    // Socket & CPU IHS base
    const socketBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.46, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.85 })
    );
    socketBase.position.set(cpuX, cpuY, mbFrontZ + 0.025);
    cpuGroup.add(socketBase);

    if (cpuPart.tdp >= 105) {
      // High-TDP 240mm AIO Liquid Cooler
      const pumpMat = new THREE.MeshStandardMaterial({ color: 0x141822, roughness: 0.28, metalness: 0.65 });
      const pumpBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.28, 24), pumpMat);
      pumpBlock.rotation.x = Math.PI / 2;
      pumpBlock.position.set(cpuX, cpuY, mbFrontZ + 0.17);
      cpuGroup.add(pumpBlock);

      // Pump glowing accent ring
      const pumpRingMat = new THREE.MeshStandardMaterial({
        color: hasAnyRgb ? 0x38bdf8 : cpuBrandColor,
        emissive: hasAnyRgb ? 0x38bdf8 : cpuBrandColor,
        emissiveIntensity: 1.4,
        roughness: 0.2
      });
      if (hasAnyRgb) {
        pumpRingMat.userData.rgbOffset = 2.1;
        this.rgbMaterials.push(pumpRingMat);
      }
      const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 10, 28), pumpRingMat);
      pumpRing.position.set(cpuX, cpuY, mbFrontZ + 0.315);
      cpuGroup.add(pumpRing);

      // Top-mounted 240mm Radiator + Dual Fans
      const radW = 2.3;
      const radY = caseH / 2 - 0.2;
      const radMesh = new THREE.Mesh(
        new THREE.BoxGeometry(radW, 0.18, 0.96),
        new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.55, metalness: 0.5 })
      );
      radMesh.position.set(0.15, radY, 0.08);
      cpuGroup.add(radMesh);

      [-0.42, 0.72].forEach((fx, idx) => {
        const aioFan = this._createFan(0.44, 0.11, { rgb: hasAnyRgb, rgbOffset: 3.5 + idx });
        aioFan.rotation.x = Math.PI / 2;
        aioFan.position.set(fx, radY - 0.14, 0.08);
        cpuGroup.add(aioFan);
      });

      // Curved braided AIO coolant tubes
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.8, metalness: 0.15 });
      [-0.06, 0.06].forEach((offset, idx) => {
        const tubeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(cpuX + 0.22, cpuY + offset, mbFrontZ + 0.22),
          new THREE.Vector3(cpuX + 0.72 + idx * 0.08, cpuY + 0.42, mbFrontZ + 0.56 + idx * 0.05),
          new THREE.Vector3(1.12, radY - 0.12, 0.12 + offset * 2.2)
        ]);
        const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 22, 0.036, 8, false), tubeMat);
        cpuGroup.add(tubeMesh);
      });
    } else {
      // Sleek Tower Air Cooler with copper heatpipes & spinning fan
      const finStackMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.38, metalness: 0.78 });
      const towerCapMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.4, metalness: 0.6 });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.78, 0.72), finStackMat);
      tower.position.set(cpuX, cpuY, mbFrontZ + 0.42);
      tower.castShadow = true;
      cpuGroup.add(tower);

      // Matte black top cover plate + 4 copper heatpipe tips
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.79, 0.04), towerCapMat);
      cap.position.set(cpuX, cpuY, mbFrontZ + 0.785);
      cpuGroup.add(cap);

      const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.88 });
      [-0.22, -0.07, 0.07, 0.22].forEach((py) => {
        const pipeTip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 10), copperMat);
        pipeTip.rotation.x = Math.PI / 2;
        pipeTip.position.set(cpuX, cpuY + py, mbFrontZ + 0.8);
        cpuGroup.add(pipeTip);
      });

      // Brand indicator dot on top cover
      const brandDot = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.05, 0.02),
        new THREE.MeshStandardMaterial({ color: cpuBrandColor, emissive: cpuBrandColor, emissiveIntensity: 0.8 })
      );
      brandDot.position.set(cpuX + 0.06, cpuY - 0.28, mbFrontZ + 0.81);
      cpuGroup.add(brandDot);

      // Side-mounted cooling fan on the tower
      const coolerFan = this._createFan(0.36, 0.11, { rgb: false });
      coolerFan.rotation.y = Math.PI / 2;
      coolerFan.position.set(cpuX + 0.29, cpuY, mbFrontZ + 0.44);
      cpuGroup.add(coolerFan);
    }

    this._tagCategory(cpuGroup, "cpu");
    this.categoryGroups.cpu = cpuGroup;
    this.rootGroup.add(cpuGroup);

    // ---------------------------------------------------------
    // 5. MEMORY (RAM — 2 DIMM STICKS)
    // ---------------------------------------------------------
    const ramGroup = new THREE.Group();
    const ramHeight = ramPart.id === "ram-1" ? 0.24 : ramPart.rgb ? 0.36 : 0.31;
    const ramBodyMat = new THREE.MeshStandardMaterial({
      color: ramPart.capacity >= 64 ? 0x1e293b : 0x151922,
      roughness: 0.35,
      metalness: 0.65
    });

    const ramXStart = mbLeftX + 1.62;
    [0, 0.14].forEach((dx, idx) => {
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.84, ramHeight), ramBodyMat);
      stick.position.set(ramXStart + dx, cpuY, mbFrontZ + ramHeight / 2 + 0.02);
      ramGroup.add(stick);

      if (ramPart.rgb) {
        const ramRgbMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.7,
          roughness: 0.15
        });
        ramRgbMat.userData.rgbOffset = 1.3 + idx * 0.5;
        this.rgbMaterials.push(ramRgbMat);
        const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.82, 0.055), ramRgbMat);
        lightBar.position.set(ramXStart + dx, cpuY, mbFrontZ + ramHeight + 0.035);
        ramGroup.add(lightBar);
      }
    });

    this._tagCategory(ramGroup, "ram");
    this.categoryGroups.ram = ramGroup;
    this.rootGroup.add(ramGroup);

    // ---------------------------------------------------------
    // 6. STORAGE (M.2 NVMe SSD)
    // ---------------------------------------------------------
    const ssdGroup = new THREE.Group();
    const ssdAccent = ssdPart.id === "ssd-3" ? "#ef4444" : ssdPart.id === "ssd-2" ? "#f97316" : "#38bdf8";
    const ssdLabel = ssdPart.capacity >= 2000 ? "2TB NVMe" : "1TB NVMe";
    const ssdTex = this._makeBadgeTexture(ssdLabel, "PCIe 4.0", "#111827", ssdAccent);
    const ssdMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.18, 0.04),
      [
        new THREE.MeshStandardMaterial({ color: 0x1e293b }),
        new THREE.MeshStandardMaterial({ color: 0x1e293b }),
        new THREE.MeshStandardMaterial({ color: 0x1e293b }),
        new THREE.MeshStandardMaterial({ color: 0x1e293b }),
        new THREE.MeshStandardMaterial({ map: ssdTex, roughness: 0.35 }),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      ]
    );
    ssdMesh.position.set(mbLeftX + 0.88, gpuY + 0.28, mbFrontZ + 0.035);
    ssdGroup.add(ssdMesh);

    this._tagCategory(ssdGroup, "storage");
    this.categoryGroups.storage = ssdGroup;
    this.rootGroup.add(ssdGroup);

    // ---------------------------------------------------------
    // 7. GRAPHICS CARD (GPU)
    // ---------------------------------------------------------
    const gpuGroup = new THREE.Group();
    if (gpuPart.length > 0) {
      const gpuLen = Math.min(gpuPart.length / 112, caseL - 0.92);
      const gpuThick = gpuPart.length >= 315 ? 0.44 : gpuPart.length >= 280 ? 0.38 : 0.3;
      const gpuDepth = 0.96;
      const isNvidia = gpuPart.name.toLowerCase().includes("nvidia");
      const overLength = gpuPart.length > casePart.maxGpuLength;

      const shroudMat = new THREE.MeshStandardMaterial({
        color: overLength ? 0x991b1b : isNvidia ? 0x262c36 : 0x1c2028,
        roughness: 0.36,
        metalness: 0.68
      });
      const backplateMat = new THREE.MeshStandardMaterial({
        color: isNvidia ? 0x333b48 : 0x1f242d,
        roughness: 0.3,
        metalness: 0.75
      });

      const gpuStartX = mbLeftX + 0.02;
      const gpuCenterX = gpuStartX + gpuLen / 2;
      const gpuCenterZ = mbFrontZ + gpuDepth / 2 + 0.06;

      // Main GPU cooler shroud body
      const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(gpuLen, gpuThick, gpuDepth), shroudMat);
      gpuBody.position.set(gpuCenterX, gpuY - gpuThick * 0.28, gpuCenterZ);
      gpuBody.castShadow = true;
      gpuGroup.add(gpuBody);

      // Brushed metal backplate on top (+Y)
      const backplate = new THREE.Mesh(new THREE.BoxGeometry(gpuLen - 0.02, 0.03, gpuDepth - 0.02), backplateMat);
      backplate.position.set(gpuCenterX, gpuY - gpuThick * 0.28 + gpuThick / 2 + 0.015, gpuCenterZ);
      gpuGroup.add(backplate);

      // Side branding / RGB accent bar facing the tempered glass (+Z)
      const accentColor = overLength ? 0xf87171 : isNvidia ? 0x22c55e : 0xef4444;
      const gpuAccentMat = new THREE.MeshStandardMaterial({
        color: gpuPart.rgb ? 0x38bdf8 : accentColor,
        emissive: gpuPart.rgb ? 0x38bdf8 : accentColor,
        emissiveIntensity: gpuPart.rgb ? 1.8 : 0.95,
        roughness: 0.2
      });
      if (gpuPart.rgb) {
        gpuAccentMat.userData.rgbOffset = 2.7;
        this.rgbMaterials.push(gpuAccentMat);
      }
      const sideBar = new THREE.Mesh(new THREE.BoxGeometry(gpuLen * 0.62, 0.055, 0.025), gpuAccentMat);
      sideBar.position.set(gpuCenterX + 0.06, gpuY - gpuThick * 0.25, gpuCenterZ + gpuDepth / 2 + 0.008);
      gpuGroup.add(sideBar);

      // Spinning GPU fans on underside (-Y)
      const fanCount = gpuPart.length >= 280 ? 3 : 2;
      const fanRadius = Math.min(0.36, (gpuLen - 0.24) / (fanCount * 2.15));
      for (let i = 0; i < fanCount; i++) {
        const fx = gpuStartX + 0.22 + (i + 0.5) * ((gpuLen - 0.44) / fanCount);
        const gpuFan = this._createFan(fanRadius, 0.06, { rgb: false, bladeColor: 0x161a22 });
        gpuFan.rotation.x = Math.PI / 2;
        gpuFan.position.set(fx, gpuY - gpuThick * 0.28 - gpuThick / 2 - 0.01, gpuCenterZ);
        gpuGroup.add(gpuFan);
      }

      // Braided PCIe Power Cable from GPU down into PSU shroud
      const pcieCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(gpuStartX + gpuLen * 0.72, gpuY - gpuThick * 0.28, gpuCenterZ + gpuDepth / 2 - 0.08),
        new THREE.Vector3(gpuStartX + gpuLen * 0.74, gpuY - gpuThick - 0.35, gpuCenterZ + gpuDepth / 2 + 0.1),
        new THREE.Vector3(gpuStartX + gpuLen * 0.68, shroudTopY - 0.02, gpuCenterZ + 0.05)
      ]);
      const pcieCable = new THREE.Mesh(new THREE.TubeGeometry(pcieCurve, 14, 0.036, 8, false), cableMat);
      gpuGroup.add(pcieCable);
    }

    this._tagCategory(gpuGroup, "gpu");
    this.categoryGroups.gpu = gpuGroup;
    this.rootGroup.add(gpuGroup);
  }

  _bindInteractions() {
    const el = this.canvas;

    const onDown = (clientX, clientY) => {
      this.pointer.isDown = true;
      this.pointer.moved = false;
      this.pointer.startX = clientX;
      this.pointer.startY = clientY;
      this.pointer.lastX = clientX;
      this.pointer.lastY = clientY;
    };

    const onMove = (clientX, clientY) => {
      if (this.pointer.isDown) {
        const dx = clientX - this.pointer.lastX;
        const dy = clientY - this.pointer.lastY;
        if (Math.hypot(clientX - this.pointer.startX, clientY - this.pointer.startY) > 4) {
          this.pointer.moved = true;
          this.autoRotate = false;
        }
        this.orbit.targetTheta -= dx * 0.009;
        this.orbit.targetPhi = Math.max(0.45, Math.min(2.25, this.orbit.targetPhi - dy * 0.008));
        this.pointer.lastX = clientX;
        this.pointer.lastY = clientY;
      } else if (this.useThree) {
        this._updateRaycastHover(clientX, clientY);
      }
    };

    const onUp = (clientX, clientY) => {
      const wasClick = this.pointer.isDown && !this.pointer.moved;
      this.pointer.isDown = false;
      if (wasClick && this.useThree) {
        const hitCat = this._raycastCategory(clientX, clientY);
        if (hitCat) {
          this.onPartClick(hitCat);
        }
      }
    };

    el.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", (e) => onUp(e.clientX, e.clientY));

    el.addEventListener("mouseleave", () => {
      if (this.hoveredCategory) {
        this.hoveredCategory = null;
        this.canvas.style.cursor = "grab";
        this.onPartHover(null);
      }
    });

    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.orbit.targetRadius = Math.max(5.2, Math.min(14.0, this.orbit.targetRadius + e.deltaY * 0.005));
      },
      { passive: false }
    );

    // Touch support
    el.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          onDown(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    el.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1) {
          onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );
    el.addEventListener("touchend", () => {
      this.pointer.isDown = false;
    });
  }

  _raycastCategory(clientX, clientY) {
    if (!this.useThree || !this.camera || !this.rootGroup) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    // Prioritize internal components over outer case so users can easily click GPU/CPU/RAM/SSD/MB
    const priorityOrder = ["gpu", "cpu", "ram", "storage", "psu", "motherboard", "case"];
    for (const cat of priorityOrder) {
      const grp = this.categoryGroups[cat];
      if (!grp) continue;
      const hits = this.raycaster.intersectObject(grp, true);
      if (hits.length > 0) return cat;
    }
    return null;
  }

  _updateRaycastHover(clientX, clientY) {
    const cat = this._raycastCategory(clientX, clientY);
    if (cat !== this.hoveredCategory) {
      this.hoveredCategory = cat;
      this.canvas.style.cursor = cat ? "pointer" : "grab";
      this.onPartHover(cat);
    }
  }

  _applyHighlightEffect() {
    const activeCat = this.externalHighlight || this.hoveredCategory;
    const pulse = 0.26 + Math.sin(this.clock * 6) * 0.14;

    Object.entries(this.categoryGroups).forEach(([cat, group]) => {
      const isHighlighted = activeCat === cat;
      const highlightStrength = cat === "case" ? pulse * 0.3 : pulse;
      group.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (mat.userData && mat.userData.rgbOffset !== undefined) return; // keep RGB animations intact
          if (!mat.emissive) return;
          if (mat.userData._origEmissive === undefined) {
            mat.userData._origEmissive = mat.emissive.getHex();
            mat.userData._origEmissiveIntensity = mat.emissiveIntensity;
          }
          if (isHighlighted) {
            mat.emissive.setHex(0x3b82f6);
            mat.emissiveIntensity = highlightStrength;
          } else {
            mat.emissive.setHex(mat.userData._origEmissive);
            mat.emissiveIntensity = mat.userData._origEmissiveIntensity;
          }
        });
      });
    });
  }

  _startLoop() {
    let lastTime = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      this.clock += dt;

      if (this.autoRotate && !this.pointer.isDown) {
        this.orbit.targetTheta += dt * 0.28;
      }

      // Smoothly damp orbit camera
      this.orbit.theta += (this.orbit.targetTheta - this.orbit.theta) * 0.1;
      this.orbit.phi += (this.orbit.targetPhi - this.orbit.phi) * 0.1;
      this.orbit.radius += (this.orbit.targetRadius - this.orbit.radius) * 0.1;

      if (this.useThree) {
        // Update camera position from spherical coordinates
        const r = this.orbit.radius;
        this.camera.position.set(
          r * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta),
          r * Math.cos(this.orbit.phi) + this.orbit.targetY,
          r * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta)
        );
        this.camera.lookAt(0, this.orbit.targetY, 0);

        // Spin all fans smoothly
        for (const f of this.fans) {
          f.rotor.rotation.z -= dt * f.speed;
        }

        // Cycle RGB LEDs smoothly
        for (const mat of this.rgbMaterials) {
          const hue = ((this.clock * 0.16 + (mat.userData.rgbOffset || 0) * 0.15) % 1 + 1) % 1;
          mat.color.setHSL(hue, 0.9, 0.6);
          mat.emissive.setHSL(hue, 0.95, 0.55);
        }

        // Smooth tempered glass open/close slide
        if (this.glassGroup) {
          const targetOpen = this.glassOpen ? 1 : 0;
          this.glassProgress += (targetOpen - this.glassProgress) * 0.12;
          this.glassGroup.position.z = this.glassBaseZ + this.glassProgress * 1.15;
          this.glassGroup.position.x = -this.glassProgress * 0.35;
          this.glassGroup.visible = this.glassProgress < 0.96;
        }

        this._applyHighlightEffect();
        this.renderer.render(this.scene, this.camera);
      } else {
        this._renderFallback2D();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /**
   * Pure-Canvas 3D projection fallback if Three.js CDN or WebGL is unavailable.
   */
  _renderFallback2D() {
    if (!this.ctx || !this.currentBuild) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + h * 0.03;
    const scale = Math.min(w, h) * 0.115;
    const cosT = Math.cos(this.orbit.theta);
    const sinT = Math.sin(this.orbit.theta);
    const cosP = Math.cos(this.orbit.phi - Math.PI / 2);
    const sinP = Math.sin(this.orbit.phi - Math.PI / 2);

    const project = (x, y, z) => {
      const rx = x * cosT - z * sinT;
      const rz = x * sinT + z * cosT;
      const ry = y * cosP - rz * sinP;
      const fz = y * sinP + rz * cosP;
      const p = 9 / (9 - fz);
      return { x: cx + rx * scale * p, y: cy - ry * scale * p, z: fz };
    };

    const drawBox = (x, y, z, sx, sy, sz, fill, stroke = "rgba(148,163,184,0.35)") => {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const pts = [
        project(x - hx, y - hy, z - hz), project(x + hx, y - hy, z - hz),
        project(x + hx, y + hy, z - hz), project(x - hx, y + hy, z - hz),
        project(x - hx, y - hy, z + hz), project(x + hx, y - hy, z + hz),
        project(x + hx, y + hy, z + hz), project(x - hx, y + hy, z + hz)
      ];
      const faces = [
        [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
        [2, 3, 7, 6], [0, 3, 7, 4], [1, 2, 6, 5]
      ];
      faces.forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
        f.slice(1).forEach((idx) => ctx.lineTo(pts[idx].x, pts[idx].y));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    };

    const isCompact = !this.currentBuild.case.formFactors.includes("ATX");
    const cL = isCompact ? 3.6 : 4.2;
    const cH = isCompact ? 3.8 : 4.4;
    const cW = 2.0;

    drawBox(0, 0, 0, cL, cH, cW, "rgba(30, 41, 59, 0.42)", "rgba(148, 163, 184, 0.55)");
    drawBox(-0.35, 0.25, -0.72, 2.2, isCompact ? 2.1 : 2.6, 0.1, "rgba(30, 58, 95, 0.85)");
    drawBox(-0.55, 0.85, -0.35, 0.55, 0.65, 0.55, "rgba(148, 163, 184, 0.9)");
    if (this.currentBuild.gpu.length > 0) {
      const gLen = Math.min(this.currentBuild.gpu.length / 115, cL - 1.0);
      drawBox(-0.4 + gLen * 0.2, -0.1, -0.1, gLen, 0.36, 0.9, "rgba(59, 130, 246, 0.85)");
    }
    drawBox(-0.8, -cH / 2 + 0.45, 0, 1.5, 0.75, 1.2, "rgba(15, 23, 42, 0.92)");
  }
}
