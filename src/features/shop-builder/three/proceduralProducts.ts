import * as THREE from 'three';
import { ShopBuilderProduct, ShopBuilderWall } from '../types';

export const MAX_AUTO_HUNG_PRODUCTS = 1600;

// ─── Expanded Procedural Catalog ─────────────────────────────────────────────

export const PROCEDURAL_CATALOG: Record<string, Array<{
  key: string;
  name: string;
  type: 'box' | 'can' | 'bottle' | 'pouch' | 'hanger_pack' | 'clothes_hanger' | 'jar' | 'tube' | 'carton';
  color: string;
  dimensions: { width: number; height: number; depth: number };
}>> = {
  shelf: [
    { key: 'box-cereal', name: 'علبة حبوب', type: 'box', color: '#dbeafe', dimensions: { width: 0.22, height: 0.30, depth: 0.08 } },
    { key: 'box-small', name: 'عبوة صغيرة', type: 'box', color: '#e0e7ff', dimensions: { width: 0.16, height: 0.22, depth: 0.10 } },
    { key: 'box-tea', name: 'علبة شاي', type: 'box', color: '#fef3c7', dimensions: { width: 0.12, height: 0.18, depth: 0.08 } },
    { key: 'box-detergent', name: 'علبة منظف', type: 'carton', color: '#bfdbfe', dimensions: { width: 0.20, height: 0.32, depth: 0.12 } },
    { key: 'pouch-snack', name: 'كيس سناكس', type: 'pouch', color: '#fde68a', dimensions: { width: 0.18, height: 0.24, depth: 0.06 } },
    { key: 'pouch-rice', name: 'كيس أرز', type: 'pouch', color: '#f5f5f4', dimensions: { width: 0.22, height: 0.28, depth: 0.10 } },
    { key: 'bottle-water', name: 'زجاجة مياه', type: 'bottle', color: '#bae6fd', dimensions: { width: 0.07, height: 0.28, depth: 0.07 } },
    { key: 'bottle-juice', name: 'عصير', type: 'bottle', color: '#fed7aa', dimensions: { width: 0.09, height: 0.26, depth: 0.09 } },
    { key: 'bottle-oil', name: 'زيت', type: 'bottle', color: '#d9f99d', dimensions: { width: 0.08, height: 0.30, depth: 0.08 } },
    { key: 'can-beans', name: 'علبة فول', type: 'can', color: '#e2e8f0', dimensions: { width: 0.08, height: 0.12, depth: 0.08 } },
    { key: 'can-tuna', name: 'علبة تونة', type: 'can', color: '#c7d2fe', dimensions: { width: 0.10, height: 0.06, depth: 0.10 } },
    { key: 'can-soda', name: 'مشروب غازي', type: 'can', color: '#fecaca', dimensions: { width: 0.06, height: 0.13, depth: 0.06 } },
    { key: 'jar-jam', name: 'مربى', type: 'jar', color: '#fca5a5', dimensions: { width: 0.08, height: 0.14, depth: 0.08 } },
    { key: 'jar-honey', name: 'عسل', type: 'jar', color: '#fbbf24', dimensions: { width: 0.09, height: 0.16, depth: 0.09 } },
    { key: 'tube-toothpaste', name: 'معجون أسنان', type: 'tube', color: '#a5f3fc', dimensions: { width: 0.04, height: 0.20, depth: 0.04 } },
    { key: 'carton-milk', name: 'حليب', type: 'carton', color: '#f0fdf4', dimensions: { width: 0.08, height: 0.22, depth: 0.08 } },
  ],
  hook_single: [
    { key: 'hang-pack', name: 'منتج معلق', type: 'hanger_pack', color: '#fecaca', dimensions: { width: 0.11, height: 0.18, depth: 0.04 } },
    { key: 'hang-pouch', name: 'كيس معلق', type: 'pouch', color: '#fde68a', dimensions: { width: 0.10, height: 0.16, depth: 0.04 } },
    { key: 'hang-box', name: 'علبة خفيفة', type: 'box', color: '#ddd6fe', dimensions: { width: 0.10, height: 0.14, depth: 0.05 } },
    { key: 'hang-clip', name: 'عبوة مشبك', type: 'hanger_pack', color: '#fbcfe8', dimensions: { width: 0.09, height: 0.15, depth: 0.03 } },
  ],
  hook_waterfall: [
    // Clothes hangers ONLY for waterfall hooks (خطاف ملابس)
    { key: 'wf-tshirt', name: 'تيشيرت', type: 'clothes_hanger', color: '#bfdbfe', dimensions: { width: 0.38, height: 0.40, depth: 0.04 } },
    { key: 'wf-shirt', name: 'قميص', type: 'clothes_hanger', color: '#f0fdf4', dimensions: { width: 0.40, height: 0.45, depth: 0.04 } },
    { key: 'wf-dress', name: 'فستان', type: 'clothes_hanger', color: '#fce7f3', dimensions: { width: 0.36, height: 0.65, depth: 0.04 } },
    { key: 'wf-jacket', name: 'جاكيت', type: 'clothes_hanger', color: '#1e293b', dimensions: { width: 0.42, height: 0.50, depth: 0.06 } },
    { key: 'wf-blouse', name: 'بلوزة', type: 'clothes_hanger', color: '#fef3c7', dimensions: { width: 0.36, height: 0.42, depth: 0.03 } },
    { key: 'wf-pants', name: 'بنطلون', type: 'clothes_hanger', color: '#334155', dimensions: { width: 0.30, height: 0.70, depth: 0.04 } },
  ],
  basket: [
    { key: 'basket-box', name: 'منتج سلة', type: 'box', color: '#bbf7d0', dimensions: { width: 0.16, height: 0.18, depth: 0.10 } },
    { key: 'basket-can', name: 'علبة سلة', type: 'can', color: '#bfdbfe', dimensions: { width: 0.08, height: 0.14, depth: 0.08 } },
    { key: 'basket-pouch', name: 'عبوة سلة', type: 'pouch', color: '#fde68a', dimensions: { width: 0.13, height: 0.16, depth: 0.07 } },
  ],
  // Supermarket shelves (built-in shelves, no accessories)
  supermarket_shelf: [
    { key: 'sm-cereal', name: 'حبوب إفطار', type: 'box', color: '#fef08a', dimensions: { width: 0.22, height: 0.30, depth: 0.08 } },
    { key: 'sm-pasta', name: 'معكرونة', type: 'box', color: '#bae6fd', dimensions: { width: 0.10, height: 0.26, depth: 0.10 } },
    { key: 'sm-can-large', name: 'علبة كبيرة', type: 'can', color: '#e2e8f0', dimensions: { width: 0.10, height: 0.16, depth: 0.10 } },
    { key: 'sm-can-small', name: 'علبة صغيرة', type: 'can', color: '#fecaca', dimensions: { width: 0.06, height: 0.12, depth: 0.06 } },
    { key: 'sm-bottle', name: 'زجاجة عصير', type: 'bottle', color: '#fed7aa', dimensions: { width: 0.08, height: 0.28, depth: 0.08 } },
    { key: 'sm-water', name: 'مياه', type: 'bottle', color: '#bae6fd', dimensions: { width: 0.07, height: 0.24, depth: 0.07 } },
    { key: 'sm-oil', name: 'زيت طبخ', type: 'bottle', color: '#d9f99d', dimensions: { width: 0.09, height: 0.32, depth: 0.09 } },
    { key: 'sm-milk', name: 'حليب', type: 'carton', color: '#f0fdf4', dimensions: { width: 0.08, height: 0.22, depth: 0.08 } },
    { key: 'sm-chips', name: 'شيبس', type: 'pouch', color: '#fde68a', dimensions: { width: 0.20, height: 0.28, depth: 0.08 } },
    { key: 'sm-detergent', name: 'منظف', type: 'carton', color: '#93c5fd', dimensions: { width: 0.14, height: 0.28, depth: 0.10 } },
    { key: 'sm-jar', name: 'مربى', type: 'jar', color: '#fca5a5', dimensions: { width: 0.08, height: 0.14, depth: 0.08 } },
    { key: 'sm-tube', name: 'معجون', type: 'tube', color: '#a5f3fc', dimensions: { width: 0.04, height: 0.18, depth: 0.04 } },
    { key: 'sm-sauce', name: 'صلصة', type: 'bottle', color: '#f87171', dimensions: { width: 0.06, height: 0.22, depth: 0.06 } },
    { key: 'sm-rice', name: 'أرز', type: 'pouch', color: '#f5f5f4', dimensions: { width: 0.22, height: 0.30, depth: 0.12 } },
  ],
};

// ─── 3D Shape Generators ─────────────────────────────────────────────────────

export const createProceduralHangGroup = (product: ShopBuilderProduct): THREE.Group => {
  const meta = (product.metadata || {}) as Record<string, unknown>;
  const type = String(meta.proceduralType || 'box');
  const colorHex = String(meta.proceduralColor || product.color || '#dbeafe');
  const sizeMeta = (meta.proceduralSize || {}) as Record<string, unknown>;
  
  const w = Math.max(0.04, Number(sizeMeta.w) || 0.12);
  const h = Math.max(0.05, Number(sizeMeta.h) || 0.16);
  const d = Math.max(0.02, Number(sizeMeta.d) || 0.06);

  const root = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.66,
    metalness: 0.08,
  });

  const isHanging = type === 'hanger_pack' || type === 'clothes_hanger' || (meta.proceduralKey && String(meta.proceduralKey).includes('hang'));

  if (type === 'clothes_hanger') {
    // ── Clean clothes hanger: hook + shoulder bar + fabric body ──
    const hangerW = Math.min(w, 0.36);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.25 });

    // 1) Small hook at top (anchor point at y=0)
    const hookGeo = new THREE.TorusGeometry(0.008, 0.002, 6, 10, Math.PI);
    hookGeo.rotateZ(Math.PI);
    hookGeo.translate(0, 0.008, 0);
    root.add(new THREE.Mesh(hookGeo, metalMat));

    // 2) Horizontal shoulder bar
    const barGeo = new THREE.BoxGeometry(hangerW, 0.006, 0.012);
    barGeo.translate(0, -0.01, 0);
    root.add(new THREE.Mesh(barGeo, metalMat));

    // 3) Fabric body hanging below the bar
    const bodyH = h * 0.82;
    const bodyW = hangerW * 0.92;
    const bodyD = Math.max(0.015, d * 0.5);
    const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    bodyGeo.translate(0, -0.01 - bodyH / 2 - 0.005, 0);
    const garment = new THREE.Mesh(bodyGeo, baseMat.clone());
    garment.castShadow = true;
    root.add(garment);

    // 4) Collar accent line
    const collarGeo = new THREE.BoxGeometry(bodyW * 0.28, 0.008, bodyD + 0.004);
    collarGeo.translate(0, -0.018, 0);
    root.add(new THREE.Mesh(collarGeo, new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })));

  } else if (type === 'can') {
    const radius = Math.max(0.02, Math.min(w, d) * 0.5);
    const geo = new THREE.CylinderGeometry(radius, radius, h, 20);
    if (!isHanging) geo.translate(0, h / 2, 0);
    const body = new THREE.Mesh(geo, baseMat.clone());
    // Lid ring
    const lidGeo = new THREE.TorusGeometry(radius * 0.92, radius * 0.06, 6, 18);
    lidGeo.rotateX(Math.PI / 2);
    if (!isHanging) lidGeo.translate(0, h, 0);
    else lidGeo.translate(0, h / 2, 0);
    const lid = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.5 }));
    body.castShadow = lid.castShadow = true;
    root.add(body, lid);

  } else if (type === 'bottle') {
    const bodyRadius = Math.max(0.02, Math.min(w, d) * 0.42);
    const bodyHeight = h * 0.68;
    const neckHeight = h * 0.2;
    
    const bodyGeo = new THREE.CylinderGeometry(bodyRadius, bodyRadius * 0.95, bodyHeight, 20);
    bodyGeo.translate(0, bodyHeight / 2, 0);
    const body = new THREE.Mesh(bodyGeo, baseMat.clone());
    
    const neckRadius = Math.max(0.01, bodyRadius * 0.4);
    const neckGeo = new THREE.CylinderGeometry(neckRadius, bodyRadius * 0.65, neckHeight, 16);
    neckGeo.translate(0, bodyHeight + neckHeight / 2, 0);
    const neck = new THREE.Mesh(neckGeo, baseMat.clone());
    
    const capHeight = h * 0.08;
    const capGeo = new THREE.CylinderGeometry(neckRadius * 1.1, neckRadius * 1.1, capHeight, 14);
    capGeo.translate(0, bodyHeight + neckHeight + capHeight / 2, 0);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x334155 }));
    
    body.castShadow = neck.castShadow = cap.castShadow = true;
    root.add(body, neck, cap);

  } else if (type === 'jar') {
    // Short wide jar with lid
    const radius = Math.max(0.025, Math.min(w, d) * 0.48);
    const jarH = h * 0.75;
    const jarGeo = new THREE.CylinderGeometry(radius, radius * 0.98, jarH, 22);
    jarGeo.translate(0, jarH / 2, 0);
    const jarMat = baseMat.clone();
    jarMat.transparent = true;
    jarMat.opacity = 0.85;
    const jar = new THREE.Mesh(jarGeo, jarMat);
    
    const lidH = h * 0.15;
    const lidGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, lidH, 22);
    lidGeo.translate(0, jarH + lidH / 2, 0);
    const lid = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.4 }));
    
    jar.castShadow = lid.castShadow = true;
    root.add(jar, lid);

  } else if (type === 'tube') {
    // Tube (toothpaste/cream)
    const radius = Math.max(0.012, Math.min(w, d) * 0.4);
    const tubeH = h * 0.82;
    const tubeGeo = new THREE.CylinderGeometry(radius, radius * 0.85, tubeH, 16);
    tubeGeo.translate(0, tubeH / 2, 0);
    const tube = new THREE.Mesh(tubeGeo, baseMat.clone());
    
    // Cap
    const capR = radius * 0.55;
    const capH = h * 0.14;
    const capGeo = new THREE.CylinderGeometry(capR, capR, capH, 12);
    capGeo.translate(0, tubeH + capH / 2, 0);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    
    tube.castShadow = cap.castShadow = true;
    root.add(tube, cap);

  } else if (type === 'carton') {
    // Milk/juice carton with angled top
    const boxH = h * 0.82;
    const boxGeo = new THREE.BoxGeometry(w, boxH, d);
    boxGeo.translate(0, boxH / 2, 0);
    const box = new THREE.Mesh(boxGeo, baseMat.clone());
    
    // Triangle roof top
    const roofH = h * 0.14;
    const roofGeo = new THREE.CylinderGeometry(0, Math.min(w, d) * 0.5, roofH, 4);
    roofGeo.translate(0, boxH + roofH / 2, 0);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, baseMat.clone());
    
    box.castShadow = roof.castShadow = true;
    root.add(box, roof);

  } else if (type === 'hanger_pack') {
    const bodyH = h * 0.84;
    const bodyGeo = new THREE.BoxGeometry(w, bodyH, Math.max(0.02, d * 0.9));
    
    const headerH = h * 0.2;
    const headerGeo = new THREE.BoxGeometry(w * 0.86, headerH, Math.max(0.015, d * 0.55));
    
    const holeRadius = Math.max(0.01, w * 0.14);
    const holeGeo = new THREE.TorusGeometry(holeRadius, Math.max(0.002, w * 0.025), 8, 14);
    holeGeo.rotateX(Math.PI / 2);
    
    headerGeo.translate(0, -headerH * 0.1, 0); 
    bodyGeo.translate(0, -headerH - bodyH / 2 + 0.01, 0);
    
    const pack = new THREE.Mesh(bodyGeo, baseMat.clone());
    const header = new THREE.Mesh(headerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const hole = new THREE.Mesh(holeGeo, new THREE.MeshStandardMaterial({ color: 0x475569 }));
    
    pack.castShadow = header.castShadow = hole.castShadow = true;
    root.add(pack, header, hole);

  } else if (type === 'pouch') {
    const geo = new THREE.BoxGeometry(w, h, Math.max(0.02, d * 0.65));
    const topGeo = new THREE.BoxGeometry(w * 0.98, Math.max(0.006, h * 0.08), Math.max(0.02, d * 0.75));
    
    if (isHanging) {
      topGeo.translate(0, 0, 0);
      geo.translate(0, -h / 2, 0);
    } else {
      geo.translate(0, h / 2, 0);
      topGeo.translate(0, h + h * 0.04, 0);
    }

    const pouch = new THREE.Mesh(geo, baseMat.clone());
    const topSeal = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    pouch.castShadow = topSeal.castShadow = true;
    root.add(pouch, topSeal);

  } else {
    // Default Box
    const geo = new THREE.BoxGeometry(w, h, d);
    if (!isHanging) geo.translate(0, h / 2, 0);
    else geo.translate(0, -h / 2, 0);
    
    // Color stripe accent
    const stripeH = h * 0.2;
    const stripeGeo = new THREE.BoxGeometry(w + 0.001, stripeH, d + 0.001);
    if (!isHanging) stripeGeo.translate(0, h * 0.65, 0);
    else stripeGeo.translate(0, -h * 0.65, 0);
    
    const box = new THREE.Mesh(geo, baseMat.clone());
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex).offsetHSL(0, 0.1, -0.15),
      roughness: 0.5,
    }));
    box.castShadow = stripe.castShadow = true;
    root.add(box, stripe);
  }

  root.name = product.name || `procedural-${product.id}`;
  return root;
};

// ─── Auto-Hung Product List Generator ────────────────────────────────────────

export const generateAutoHungProductsList = (
  walls: ShopBuilderWall[],
  existingProducts: ShopBuilderProduct[],
  toWorldFromSlatLocal: (wall: any, slat: any, localX: number, localY: number, localZ: number) => { x: number; y: number; z: number; rotY: number },
  isAutoHungHidden: boolean
): ShopBuilderProduct[] => {
  const generated: ShopBuilderProduct[] = [];
  const rnd = (min: number, max: number) => min + Math.random() * (max - min);
  const existingManualCount = existingProducts.filter((p) => !(p.metadata as any)?.autoHangFill).length;
  const maxGenerated = Math.max(300, MAX_AUTO_HUNG_PRODUCTS - Math.min(800, existingManualCount));

  let systemsCount = 0;
  let accessoryCount = 0;
  walls.forEach((wall) => {
    const slatSystems = wall.slatWalls || [];
    const primoSystems = ((wall.primoStands as any[] | undefined) || []);
    systemsCount += slatSystems.length + primoSystems.length;
    slatSystems.forEach((s: any) => { accessoryCount += (s.accessories || []).length; });
    primoSystems.forEach((s: any) => { accessoryCount += (s.accessories || []).length; });
  });

  const complexityScore = systemsCount * 10 + accessoryCount * 6;
  const densityScale =
    complexityScore > 4000 ? 0.35 :
    complexityScore > 2500 ? 0.5 :
    complexityScore > 1500 ? 0.65 :
    complexityScore > 900 ? 0.8 : 1;
  const scaleCount = (base: number, min = 1) => Math.max(min, Math.floor(base * densityScale));
  const canPushMore = () => generated.length < maxGenerated;

  walls.forEach((wall) => {
    if (!canPushMore()) return;
    // Combine slatWalls (includes primo via systemType) and primoStands
    const systems: any[] = [
      ...(wall.slatWalls || []),
      ...(((wall.primoStands as any[] | undefined) || []).map((p) => ({ ...p, systemType: 'primo' }))),
    ];

    systems.forEach((slat) => {
      if (!canPushMore()) return;
      const slatHeight = slat.height || 2;
      const wallLength = Math.max(0.001, Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y));
      const slatWidth = slat.fillType === 'full' ? wallLength : (slat.width || 1);
      const slatPosCenter = slat.fillType === 'full' ? 0.5 : (slat.position || 0.5);

      // ─────────────────────────────────────────────────────────────
      // SUPERMARKET SHELVES — built-in shelves, NO accessories needed
      // ─────────────────────────────────────────────────────────────
      if (slat.systemType === 'supermarket_shelves') {
        const shelfCount = slat.shelfCount || 5;
        const shelfDepth = slat.shelfDepth || 0.4;
        const uprightSpacing = slat.uprightSpacing || 1.0;
        const sysHeight = slatHeight;

        // Calculate segments matching createSupermarketShelvesMesh
        let segments = [{
          start: (slatPosCenter * wallLength) - (slatWidth / 2),
          end: (slatPosCenter * wallLength) + (slatWidth / 2),
          protrusion: 0,
        }];
        if (wall.columns) {
          wall.columns.forEach((col: any) => {
            const colStart = (col.position || 0.5) * wallLength - ((col.width || 0.4) / 2) - 0.005;
            const colEnd = (col.position || 0.5) * wallLength + ((col.width || 0.4) / 2) + 0.005;
            let protrusion = 0;
            const wThickness = wall.thickness || 0.1;
            const slatAnchorOffset = wThickness / 2 + 0.01;
            if ((col as any).side === slat.side) {
              protrusion = Math.max(0, (col.depth || 0.4) - slatAnchorOffset) + 0.005;
            }
            if (protrusion > 0.01) {
              const newSegs: any[] = [];
              segments.forEach(seg => {
                if (colEnd > seg.start && colStart < seg.end) {
                  if (seg.start < colStart) newSegs.push({ start: seg.start, end: colStart, protrusion: seg.protrusion });
                  newSegs.push({ start: Math.max(seg.start, colStart), end: Math.min(seg.end, colEnd), protrusion });
                  if (seg.end > colEnd) newSegs.push({ start: colEnd, end: seg.end, protrusion: seg.protrusion });
                } else {
                  newSegs.push(seg);
                }
              });
              segments = newSegs;
            }
          });
        }

        const smCatalog = PROCEDURAL_CATALOG.supermarket_shelf;
        const sideFlip = slat.side === 'back' ? -1 : 1;

        segments.forEach(seg => {
          if (!canPushMore()) return;
          const segWidth = seg.end - seg.start;
          if (segWidth < 0.1) return;
          const baysCount = Math.ceil(segWidth / uprightSpacing);
          const bayWidth = segWidth / baysCount;
          const segCenter = (seg.start + seg.end) / 2;
          const segLocalX = (segCenter - (slatPosCenter * wallLength)) * sideFlip;

          for (let bay = 0; bay < baysCount; bay++) {
            if (!canPushMore()) break;
            const bayCenterX = -segWidth / 2 + (bay + 0.5) * bayWidth;
            const worldBayCenterX = segLocalX + bayCenterX * sideFlip;

            for (let shelf = 0; shelf < shelfCount; shelf++) {
              if (!canPushMore()) break;
              // Match shelf Y position from createSupermarketShelvesMesh
              const shelfY = 0.15 + shelf * ((sysHeight - 0.3) / Math.max(1, shelfCount - 1));
              const localY = shelfY - sysHeight / 2;
              const isBaseShelf = shelf === 0;
              const sDepth = isBaseShelf ? shelfDepth + 0.05 : shelfDepth;

              // Fill each shelf bay with 3-6 products
              const baseProductsOnShelf = Math.floor(rnd(3, 7));
              const productsOnShelf = scaleCount(baseProductsOnShelf, 1);
              for (let p = 0; p < productsOnShelf; p++) {
                if (!canPushMore()) break;
                const picked = smCatalog[Math.floor(Math.random() * smCatalog.length)];
                if (!picked) continue;

                const itemX = worldBayCenterX + (((p + 1) / (productsOnShelf + 1)) - 0.5) * (bayWidth * 0.85) * sideFlip + rnd(-0.01, 0.01);
                const itemY = localY + 0.01; // sit on shelf surface (shelf is 0.02 thick)
                const itemZ = sDepth / 2 + 0.01 + seg.protrusion + rnd(-sDepth * 0.2, sDepth * 0.15);

                const world = toWorldFromSlatLocal(wall, slat, itemX, itemY, itemZ);
                const dims = picked.dimensions;

                generated.push({
                  id: crypto.randomUUID(),
                  name: picked.name,
                  description: '',
                  modelUrl: 'procedural://hang-item',
                  position: { x: world.x, y: world.y, z: world.z },
                  rotation: { x: 0, y: world.rotY + rnd(-0.12, 0.12), z: 0 },
                  scale: { x: 1, y: 1, z: 1 },
                  metadata: {
                    autoHangFill: true,
                    hiddenByGlobalToggle: isAutoHungHidden,
                    proceduralHang: true,
                    proceduralType: picked.type,
                    proceduralKey: picked.key,
                    proceduralColor: picked.color,
                    proceduralSize: { w: dims.width, h: dims.height, d: dims.depth },
                    sourceSystemId: slat.id,
                    sourceWallId: wall.id,
                    sourceSide: slat.side,
                    category: 'procedural-hanging',
                    dimensions: dims,
                  },
                } as any);
              }
            }
          }
        });
        return; // Done with supermarket shelves
      }

      // ─────────────────────────────────────────────────────────────
      // ACCESSORY-BASED SYSTEMS — Slat Wall / Primo
      // ─────────────────────────────────────────────────────────────
      const accessories = (slat.accessories || []) as any[];

      accessories.forEach((acc) => {
        if (!canPushMore()) return;
        let count = 1;
        if (acc.type === 'shelf') {
          const maxByWidth = Math.max(1, Math.floor((acc.width || 0.5) / 0.22));
          count = scaleCount(Math.max(2, Math.min(6, maxByWidth + Math.floor(rnd(0, 2)))), 1);
        } else if (acc.type === 'hook_single') {
          count = scaleCount(Math.floor(rnd(1, 3)), 1);
        } else if (acc.type === 'hook_waterfall') {
          // Clothes hangers: fewer items, spaced along the rod
          const maxByDepth = Math.max(2, Math.floor((acc.depth || 0.4) / 0.06));
          count = scaleCount(Math.max(2, Math.min(7, maxByDepth)), 1);
        } else {
          count = scaleCount(Math.floor(rnd(2, 5)), 1);
        }

        for (let i = 0; i < count; i++) {
          if (!canPushMore()) break;
          const accCatalog = PROCEDURAL_CATALOG[acc.type] || PROCEDURAL_CATALOG.shelf;
          const picked = accCatalog[Math.floor(Math.random() * accCatalog.length)];
          if (!picked) continue;

          // Accessory center in local slat space (same formula as 3D renderer)
          const accLocalX = ((acc.position?.x ?? 0.5) - 0.5) * slatWidth;
          const accLocalY = ((acc.position?.y ?? 0.5) - 0.5) * slatHeight;

          // Protrusion when accessory sits over a column
          const absoluteX = slatPosCenter * wallLength - (slatWidth / 2) + (acc.position?.x ?? 0.5) * slatWidth;
          let protrusion = 0;
          (wall.columns || []).forEach((col: any) => {
            const colStart = (col.position || 0.5) * wallLength - ((col.width || 0.4) / 2);
            const colEnd = colStart + (col.width || 0.4);
            if (absoluteX >= colStart && absoluteX <= colEnd && (col as any).side === slat.side) {
              const slatAnchorOffset = (wall.thickness || 0.1) / 2 + 0.01;
              protrusion = Math.max(0, (col.depth || 0.4) - slatAnchorOffset) + 0.005;
            }
          });

          const accCenterZ = (acc.depth || 0.3) / 2 + 0.01 + protrusion;

          let localX = accLocalX;
          let localY = accLocalY;
          let localZ = accCenterZ;

          if (acc.type === 'shelf') {
            const shelfSurfaceY = accLocalY + 0.01;
            const span = Math.max(0.04, (acc.width || 0.5) * 0.82);
            localX = accLocalX + (((i + 1) / (count + 1)) - 0.5) * span + rnd(-0.008, 0.008);
            localY = shelfSurfaceY;
            localZ = accCenterZ + rnd(-(acc.depth || 0.3) * 0.3, (acc.depth || 0.3) * 0.25);
          } else if (acc.type === 'hook_single') {
            localX = accLocalX + rnd(-0.006, 0.006);
            localY = accLocalY;
            localZ = accCenterZ + rnd(-0.02, (acc.depth || 0.2) * 0.2);
          } else if (acc.type === 'hook_waterfall') {
            // Clothes hangers spaced evenly along the rod
            localX = accLocalX + rnd(-0.003, 0.003);
            const step = Math.max(0.04, (acc.depth || 0.3) / Math.max(2, count));
            const zOffset = -((acc.depth || 0.3) / 2) + 0.04 + i * step;
            localZ = accCenterZ + Math.min((acc.depth || 0.3) * 0.4, zOffset);
            // Waterfall rod angles down slightly
            localY = accLocalY - Math.abs(zOffset) * 0.12;
          } else {
            localX = accLocalX + rnd(-0.04, 0.04);
            localY = accLocalY;
            localZ = accCenterZ + rnd(-0.03, 0.03);
          }

          // Clamp within slat bounds
          localX = Math.max(-slatWidth / 2 + 0.03, Math.min(slatWidth / 2 - 0.03, localX));
          localY = Math.max(-slatHeight / 2 + 0.03, Math.min(slatHeight / 2 - 0.03, localY));

          const world = toWorldFromSlatLocal(wall, slat, localX, localY, localZ);
          const dims = picked.dimensions || { width: 0.2, height: 0.2, depth: 0.1 };

          generated.push({
            id: crypto.randomUUID(),
            name: picked.name,
            description: '',
            modelUrl: 'procedural://hang-item',
            position: { x: world.x, y: world.y, z: world.z },
            rotation: { x: 0, y: world.rotY + rnd(-0.12, 0.12), z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            metadata: {
              autoHangFill: true,
              hiddenByGlobalToggle: isAutoHungHidden,
              proceduralHang: true,
              proceduralType: picked.type,
              proceduralKey: picked.key,
              proceduralColor: picked.color,
              proceduralSize: { w: dims.width, h: dims.height, d: dims.depth },
              sourceAccessoryId: acc.id,
              sourceSystemId: slat.id,
              sourceWallId: wall.id,
              sourceSide: slat.side,
              category: 'procedural-hanging',
              dimensions: dims,
            },
          } as any);
        }
      });
    });
  });

  return generated;
};
