import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { useShopBuilder } from '../store';
import type { ShopBuilderProduct, ShopBuilderWall, ShopBuilderColumn, ShopBuilderSlatWall } from '../types';
import type { CameraMode } from '../store';
import { createProceduralHangGroup } from './proceduralProducts';
import { createWallMesh, updateWallMesh, createColumnMesh, updateColumnMesh, createSlatWallMesh } from './wall-system';

// Texture loader
const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

// Wall texture URLs - Using embedded SVG data URLs (100% reliable, no external dependencies)
export const WALL_TEXTURES = {
  painted_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y1RjVGNSIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y1RjVGNSIvPjwvc3ZnPg==',
  },
  painted_beige: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y1RjBFMCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y1RjBFMCIvPjwvc3ZnPg==',
  },
  painted_rough: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0UwRTBFMCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0UwRTBFMCIvPjwvc3ZnPg==',
  },
  wallpaper_damask: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkJGMCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkJGMCIvPjwvc3ZnPg==',
  },
  brick_red: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYnJpY2siIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjQjI0QTNEIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjMyIiB5PSIwIiB3aWR0aD0iMjgiIGhlaWdodD0iMTQiIGZpbGw9IiNDOTVBNEIiIHN0cm9rZT0iIzhBMzMyOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iLTE0IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYnJpY2spIi8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYnJpY2siIHdpZHRoPSI2MCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjQjI0QTNEIi8+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjMyIiB5PSIwIiB3aWR0aD0iMjgiIGhlaWdodD0iMTQiIGZpbGw9IiNDOTVBNEIiIHN0cm9rZT0iIzhBMzMyOCIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iLTE0IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxNiIgd2lkdGg9IjI4IiBoZWlnaHQ9IjE0IiBmaWxsPSIjQzk1QTRCIiBzdHJva2U9IiM4QTMzMjgiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYnJpY2spIi8+PC9zdmc+',
  },
  brick_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y4RjhGOCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0Y4RjhGOCIvPjwvc3ZnPg==',
  },
  concrete_smooth: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iY29uY3JldGUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjQTBBMEEwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0iIzg4ODg4OCIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0iIzk1OTU5NSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iNDAiIHI9IjIiIGZpbGw9IiM4ODg4ODgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjM1IiByPSIxIiBmaWxsPSIjOTU5NTk1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNjb25jcmV0ZSkiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iY29uY3JldGUiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjQTBBMEEwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMiIgZmlsbD0iIzg4ODg4OCIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjAiIHI9IjEuNSIgZmlsbD0iIzk1OTU5NSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iNDAiIHI9IjIiIGZpbGw9IiM4ODg4ODgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjM1IiByPSIxIiBmaWxsPSIjOTU5NTk1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0idXJsKCNjb25jcmV0ZSkiLz48L3N2Zz4=',
  },
  concrete_panels: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk1OTU5NSIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk1OTU5NSIvPjwvc3ZnPg==',
  },
  wood_planks: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id29vZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiM4QjczNTIiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjEwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjxyZWN0IHg9IjIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjMwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjd29vZCkiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0id29vZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiM4QjczNTIiLz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjEwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjxyZWN0IHg9IjIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0iIzZBNTQzRCIvPjxyZWN0IHg9IjMwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSI0MCIgZmlsbD0iIzc1NUI0NCIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjd29vZCkiLz48L3N2Zz4=',
  },
  wood_panels: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk2N0I1QSIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk2N0I1QSIvPjwvc3ZnPg==',
  },
  marble_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWFyYmxlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMCw1MCBRMjUsMzAgNTAsNTAgVDEwMCw1MCIgc3Ryb2tlPSIjREREIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCw3MCBRMzAsNjAgNjAsNzAgVDEwMCw3MCIgc3Ryb2tlPSIjRTBFMEUwIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ1cmwoI21hcmJsZSkiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ibWFyYmxlIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMCw1MCBRMjUsMzAgNTAsNTAgVDEwMCw1MCIgc3Ryb2tlPSIjREREIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCw3MCBRMzAsNjAgNjAsNzAgVDEwMCw3MCIgc3Ryb2tlPSIjRTBFMEUwIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiBmaWxsPSJ1cmwoI21hcmJsZSkiLz48L3N2Zz4=',
  },
  tiles_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==',
  },
  tiles_ceramic: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0YwRjBGMCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0YwRjBGMCIvPjwvc3ZnPg==',
  },
  stone_wall: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0FBQUFBQSIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iI0FBQUFBQSIvPjwvc3ZnPg==',
  },
  stone_blocks: {
    map: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk4OTg5OCIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzk4OTg5OCIvPjwvc3ZnPg==',
  },
};

// Floor texture URLs - Seamless tileable textures
export const FLOOR_TEXTURES = {
  tiles_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxwYXRoIGQ9Ik0xMDAgMEwwIDAgMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RlZTJlNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxwYXRoIGQ9Ik0xMDAgMEwwIDAgMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RlZTJlNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
  },
  tiles_black: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzIxMjUyOSIvPjxwYXRoIGQ9Ik0xMDAgMEwwIDAgMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzM0M2E0MCIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzIxMjUyOSIvPjxwYXRoIGQ9Ik0xMDAgMEwwIDAgMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzM0M2E0MCIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
  },
  tiles_checker: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjxyZWN0IHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzFhMWExYSIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMWExYTFhIi8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjxyZWN0IHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iIzFhMWExYSIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMWExYTFhIi8+PC9zdmc+',
  },
  wood_light: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U2YzI4ZiIvPjxwYXRoIGQ9Ik0wIDEwIEwxMDAgMTAgTTAgMzAgTDEwMCAzMCBNMCA1NSBMMTAwIDU1IE0wIDgwIEwxMDAgODAgTTAgOTUgTDEwMCA5NSIgc3Ryb2tlPSIjZDRhMzczIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iMTAsMiw1LDIiLz48cGF0aCBkPSJNNTAgMCBMNTAgMTAwIE0yMCAwIEwyMCAxMDAiIHN0cm9rZT0iI2Q0YTM3MyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U2YzI4ZiIvPjxwYXRoIGQ9Ik0wIDEwIEwxMDAgMTAgTTAgMzAgTDEwMCAzMCBNMCA1NSBMMTAwIDU1IE0wIDgwIEwxMDAgODAgTTAgOTUgTDEwMCA5NSIgc3Ryb2tlPSIjZDRhMzczIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWRhc2hhcnJheT0iMTAsMiw1LDIiLz48cGF0aCBkPSJNNTAgMCBMNTAgMTAwIE0yMCAwIEwyMCAxMDAiIHN0cm9rZT0iI2Q0YTM3MyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3N2Zz4=',
  },
  wood_dark: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzNlMjcyMyIvPjxwYXRoIGQ9Ik0wIDE1IEwxMDAgMTUgTTAgNDAgTDEwMCA0MCBNMCA2NSBMMTAwIDY1IE0wIDg1IEwxMDAgODUiIHN0cm9rZT0iIzJiMWExNiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIxNSw0LDgsMyIvPjxwYXRoIGQ9Ik00MCAwIEw0MCAxMDAgTTc1IDAgTDc1IDEwMCIgc3Ryb2tlPSIjMmIxYTE2IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzNlMjcyMyIvPjxwYXRoIGQ9Ik0wIDE1IEwxMDAgMTUgTTAgNDAgTDEwMCA0MCBNMCA2NSBMMTAwIDY1IE0wIDg1IEwxMDAgODUiIHN0cm9rZT0iIzJiMWExNiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIxNSw0LDgsMyIvPjxwYXRoIGQ9Ik00MCAwIEw0MCAxMDAgTTc1IDAgTDc1IDEwMCIgc3Ryb2tlPSIjMmIxYTE2IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=',
  },
  wood_parquet: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Q0YTM3MyIvPjxyZWN0IHdpZHRoPSI1MCIgaGVpZ2h0PSIyNSIgZmlsbD0iI2U2YzI4ZiIgc3Ryb2tlPSIjYmM4MzUxIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSI1MCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjI1IiBmaWxsPSIjZmFlZGNlIiBzdHJva2U9IiNiYzgzNTEiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHk9IjI1IiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjUiIHk9IjI1IiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNmYWVkY2UiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNTAiIHk9IjI1IiB3aWR0aD0iNTAiIGhlaWdodD0iMjUiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNTAiIHk9IjUwIiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNmYWVkY2UiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNzUiIHk9IjUwIiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeT0iNzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIyNSIgZmlsbD0iI2ZhZWRjZSIgc3Ryb2tlPSIjYmM4MzUxIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Q0YTM3MyIvPjxyZWN0IHdpZHRoPSI1MCIgaGVpZ2h0PSIyNSIgZmlsbD0iI2U2YzI4ZiIgc3Ryb2tlPSIjYmM4MzUxIiBzdHJva2Utd2lkdGg9IjEiLz48cmVjdCB4PSI1MCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjI1IiBmaWxsPSIjZmFlZGNlIiBzdHJva2U9IiNiYzgzNTEiIHN0cm9rZS13aWR0aD0iMSIvPjxyZWN0IHk9IjI1IiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iMjUiIHk9IjI1IiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNmYWVkY2UiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNTAiIHk9IjI1IiB3aWR0aD0iNTAiIGhlaWdodD0iMjUiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNTAiIHk9IjUwIiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNmYWVkY2UiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeD0iNzUiIHk9IjUwIiB3aWR0aD0iMjUiIGhlaWdodD0iNTAiIGZpbGw9IiNlNmMyOGYiIHN0cm9rZT0iI2JjODM1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+PHJlY3QgeT0iNzUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIyNSIgZmlsbD0iI2ZhZWRjZSIgc3Ryb2tlPSIjYmM4MzUxIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=',
  },
  marble_white: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjxwYXRoIGQ9Ik0wIDIwIFEgMjUgNSwgNTAgMzAgVCAxMDAgMTAgTTAgNzAgUSAzMCA1MCwgNjAgODAgVCAxMDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UyZThmMCIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjciLz48cGF0aCBkPSJNMjAgMTAwIFEgNDAgNzAsIDcwIDgwIFQgMTAwIDEwMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2JkNWUxIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjxwYXRoIGQ9Ik0wIDIwIFEgMjUgNSwgNTAgMzAgVCAxMDAgMTAgTTAgNzAgUSAzMCA1MCwgNjAgODAgVCAxMDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UyZThmMCIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIwLjciLz48cGF0aCBkPSJNMjAgMTAwIFEgNDAgNzAsIDcwIDgwIFQgMTAwIDEwMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2JkNWUxIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==',
  },
  marble_black: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzExMTExMSIvPjxwYXRoIGQ9Ik0wIDMwIFEgMzAgMTAsIDYwIDQwIFQgMTAwIDIwIE0xMCAxMDAgUSA0MCA3MCwgODAgOTAgVCAxMDAgODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y1OWUwYiIgc3Ryb2tlLXdpZHRoPSIxLjUiIG9wYWNpdHk9IjAuNiIvPjxwYXRoIGQ9Ik0wIDgwIFEgMjAgNjAsIDUwIDY1IFQgMTAwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzExMTExMSIvPjxwYXRoIGQ9Ik0wIDMwIFEgMzAgMTAsIDYwIDQwIFQgMTAwIDIwIE0xMCAxMDAgUSA0MCA3MCwgODAgOTAgVCAxMDAgODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y1OWUwYiIgc3Ryb2tlLXdpZHRoPSIxLjUiIG9wYWNpdHk9IjAuNiIvPjxwYXRoIGQ9Ik0wIDgwIFEgMjAgNjAsIDUwIDY1IFQgMTAwIDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4=',
  },
  concrete: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzk0YTNiOCIvPjxmaWx0ZXIgaWQ9Im5vaXNlIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHN0eWxlPSJmaWx0ZXI6dXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMTUiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzk0YTNiOCIvPjxmaWx0ZXIgaWQ9Im5vaXNlIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC44IiBudW1PY3RhdmVzPSIzIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHN0eWxlPSJmaWx0ZXI6dXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMTUiLz48L3N2Zz4=',
  },
  terrazzo: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YxZjVmOSIvPjxwb2x5Z29uIHBvaW50cz0iMTAsMTAgMTUsNSAyMCwxMiAxMiwxOCIgZmlsbD0iIzk0YTNiOCIvPjxwb2x5Z29uIHBvaW50cz0iNDAsMjAgNDgsMTUgNTAsMjUgNDIsMjgiIGZpbGw9IiNmY2QzNGQiLz48cG9seWdvbiBwb2ludHM9IjgwLDEwIDg4LDggODUsMTggNzgsMTUiIGZpbGw9IiNmODcxNzEiLz48cG9seWdvbiBwb2ludHM9IjIwLDUwIDI4LDQ1IDI1LDU1IDE4LDUyIiBmaWxsPSIjNjQ3NDhiIi8+PHBvbHlnb24gcG9pbnRzPSI2MCw2MCA2NSw1NSA3MCw2MiA2Miw2OCIgZmlsbD0iIzM0ZDM5OSIvPjxwb2x5Z29uIHBvaW50cz0iODUsODAgOTIsNzUgOTAsODUgODIsODgiIGZpbGw9IiNmYmJmMjQiLz48cG9seWdvbiBwb2ludHM9IjMwLDg1IDM4LDgwIDM1LDkwIDI4LDg4IiBmaWxsPSIjYTc4YmZhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI0MCIgcj0iMyIgZmlsbD0iIzQ3NTU2OSIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iNzUiIHI9IjIiIGZpbGw9IiM5NGEzYjgiLz48Y2lyY2xlIGN4PSI4MCIgY3k9IjQwIiByPSIyLjUiIGZpbGw9IiNjYmQ1ZTEiLz48L3N2Zz4=',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2YxZjVmOSIvPjxwb2x5Z29uIHBvaW50cz0iMTAsMTAgMTUsNSAyMCwxMiAxMiwxOCIgZmlsbD0iIzk0YTNiOCIvPjxwb2x5Z29uIHBvaW50cz0iNDAsMjAgNDgsMTUgNTAsMjUgNDIsMjgiIGZpbGw9IiNmY2QzNGQiLz48cG9seWdvbiBwb2ludHM9IjgwLDEwIDg4LDggODUsMTggNzgsMTUiIGZpbGw9IiNmODcxNzEiLz48cG9seWdvbiBwb2ludHM9IjIwLDUwIDI4LDQ1IDI1LDU1IDE4LDUyIiBmaWxsPSIjNjQ3NDhiIi8+PHBvbHlnb24gcG9pbnRzPSI2MCw2MCA2NSw1NSA3MCw2MiA2Miw2OCIgZmlsbD0iIzM0ZDM5OSIvPjxwb2x5Z29uIHBvaW50cz0iODUsODAgOTIsNzUgOTAsODUgODIsODgiIGZpbGw9IiNmYmJmMjQiLz48cG9seWdvbiBwb2ludHM9IjMwLDg1IDM4LDgwIDM1LDkwIDI4LDg4IiBmaWxsPSIjYTc4YmZhIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI0MCIgcj0iMyIgZmlsbD0iIzQ3NTU2OSIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iNzUiIHI9IjIiIGZpbGw9IiM5NGEzYjgiLz48Y2lyY2xlIGN4PSI4MCIgY3k9IjQwIiByPSIyLjUiIGZpbGw9IiNjYmQ1ZTEiLz48L3N2Zz4=',
  },
  epoxy_grey: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNjYmQ1ZTEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzk0YTNiOCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzY0NzQ4YiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNjYmQ1ZTEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzk0YTNiOCIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzY0NzQ4YiIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+',
  },
  carpet_grey: {
    map: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzM0MTU1Ii8+PHBhdGggZD0iTTAgMEwxMCAxMCBNMTAgMEwwIDEwIiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC41Ii8+PC9zdmc+',
    normalMap: null,
    preview: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzM0MTU1Ii8+PHBhdGggZD0iTTAgMEwxMCAxMCBNMTAgMEwwIDEwIiBzdHJva2U9IiM0NzU1NjkiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC41Ii8+PC9zdmc+',
  },
};

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface ThreeSceneHandle {
  resetCamera: () => void;
  snapshot: () => string | null;
  toggleFullscreen: () => void;
  focusOnProduct: (productId: string) => void;
  focusOnWall: (wallId: string, side?: 'front' | 'back') => void;
}

interface ProductEntry {
  group: THREE.Group;
  mixer?: THREE.AnimationMixer;
}

const CAMERA_START = new THREE.Vector3(10, 8, 10);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

const ThreeScene = forwardRef<ThreeSceneHandle, { transformMode: TransformMode; cameraMode: CameraMode }>((props, ref) => {
  const { transformMode, cameraMode } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  const pointerLockControlsRef = useRef<PointerLockControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const frameRef = useRef<number | null>(null);
  const cameraResetAnimRef = useRef<number | null>(null);
  const zoomTargetDistanceRef = useRef<number | null>(null);
  const wheelZoomHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const objLoaderRef = useRef<OBJLoader | null>(null);
  const fbxLoaderRef = useRef<FBXLoader | null>(null);
  const productMapRef = useRef<Map<string, ProductEntry>>(new Map());
  const wallMeshRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const columnMeshRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const slatWallMeshRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const primoStandMeshRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const cachedModelsRef = useRef<Map<string, THREE.Group>>(new Map());
  const mixersRef = useRef<THREE.AnimationMixer[]>([]);
  const texturesCache = useRef<Map<string, THREE.Texture>>(new Map());
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  
  // First-person movement state
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const moveStateRef = useRef({ forward: false, backward: false, left: false, right: false, up: false, down: false });
  const prevTimeRef = useRef(performance.now());
  const cameraModeRef = useRef<CameraMode>(cameraMode);

  const {
    layout,
    selectedProductId,
    selectProduct,
    selectWall,
    selectColumn,
    selectSlatWall,
    selectPrimoStand,
    upsertProduct,
  } = useShopBuilder();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const ensureRenderer = useCallback(() => {
    if (rendererRef.current && cameraRef.current && sceneRef.current && orbitControlsRef.current) {

      return;
    }
    


    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    // Sky blue gradient background for realistic environment
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    
    // Add fog for depth perception (optional, subtle)
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    
    console.log('🌤️ DEBUG: Scene initialized', {
      background: scene.background,
      fog: scene.fog,
      fogNear: 50,
      fogFar: 200
    });

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.copy(CAMERA_START);
    camera.lookAt(CAMERA_TARGET);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    // Disable built-in wheel zoom so we can drive a smoother custom zoom interpolation.
    orbit.enableZoom = false;
    orbit.zoomSpeed = 0.6;
    orbit.minDistance = 1.5;
    orbit.maxDistance = 120;
    orbit.enablePan = true;
    orbit.panSpeed = 0.9;
    orbit.screenSpacePanning = true;
    // Improves zoom precision toward pointer when supported by current three version
    if ('zoomToCursor' in orbit) {
      (orbit as OrbitControls & { zoomToCursor: boolean }).zoomToCursor = true;
    }
    orbit.maxPolarAngle = Math.PI / 2.1;
    orbit.target.copy(CAMERA_TARGET);

    const transformControls = new TransformControls(camera, renderer.domElement);
    
    // Enhanced rotation gizmo settings
    transformControls.setSize(1.2); // Larger gizmo for better visibility
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(1)); // 1° snap angle
    transformControls.setTranslationSnap(0.1); // 10cm snap for translation
    transformControls.setScaleSnap(0.1); // 10% snap for scaling
    
    // Make rotation rings more visible
    transformControls.addEventListener('change', () => {
      // Update product rotation in store when gizmo is used
      if (transformControls.object && transformControls.dragging) {
        const productId = selectedProductId;
        if (productId) {
          const rotation = transformControls.object.rotation;
          upsertProduct({
            id: productId,
            rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
          });
        }
      }
    });
    
    transformControls.addEventListener('dragging-changed', (event) => {
      orbit.enabled = !event.value;
    });

    const handleSmoothWheelZoom = (event: WheelEvent) => {
      if (cameraModeRef.current !== 'orbit') return;
      const currentCamera = cameraRef.current;
      const currentOrbit = orbitControlsRef.current;
      if (!currentCamera || !currentOrbit) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof (event as WheelEvent & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === 'function') {
        (event as WheelEvent & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
      }

      const offset = currentCamera.position.clone().sub(currentOrbit.target);
      const currentDistance = offset.length();
      const baseDistance = zoomTargetDistanceRef.current ?? currentDistance;
      const zoomFactor = Math.exp(event.deltaY * 0.0012);
      const nextDistance = THREE.MathUtils.clamp(
        baseDistance * zoomFactor,
        currentOrbit.minDistance,
        currentOrbit.maxDistance
      );
      zoomTargetDistanceRef.current = nextDistance;
    };
    wheelZoomHandlerRef.current = handleSmoothWheelZoom;
    renderer.domElement.addEventListener('wheel', handleSmoothWheelZoom, { passive: false });

    // Add click handler to renderer canvas for object selection
    let mouseDownPos = { x: 0, y: 0 };
    
    const handleCanvasMouseDown = (event: MouseEvent) => {
      mouseDownPos = { x: event.clientX, y: event.clientY };
    };
    
    const handleCanvasClick = (event: MouseEvent) => {

      
      // Ignore if it was a drag (OrbitControls)
      const distance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      

      
      // Treat only true pointer movement as drag; long press should still count as click.
      if (distance > 8) {

        return;
      }

      const bounds = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);

      // Check if clicking on TransformControls gizmo
      if (transformControls.object) {
        const gizmoIntersects = raycaster.intersectObjects((transformControls as any).children, true);
        if (gizmoIntersects.length > 0) {

          return;
        }
      }

      // Get all scene objects
      const wallMeshes = Array.from(wallMeshRef.current.values());
      const columnMeshes = Array.from(columnMeshRef.current.values());
      const slatMeshes = Array.from(slatWallMeshRef.current.values());
      const primoMeshes = Array.from(primoStandMeshRef.current.values());
      const productGroups = [...productMapRef.current.values()].map((entry) => entry.group);
      

      
      const allIntersects = raycaster.intersectObjects(
        [...productGroups, ...columnMeshes, ...slatMeshes, ...primoMeshes, ...wallMeshes],
        true
      );
      

      
      if (allIntersects.length === 0) {

        selectProduct(null);
        selectWall(null);
        selectColumn(null);
        selectSlatWall(null);
        selectPrimoStand(null);
        return;
      }

      for (const hit of allIntersects) {
        const productEntry = Array.from(productMapRef.current.entries())
          .find(([, entry]) => {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj === entry.group) return true;
              obj = obj.parent;
            }
            return false;
          });
        if (productEntry) {
          const [productId] = productEntry;
          const clickedProduct = layout.products.find((p) => p.id === productId);
          if ((clickedProduct?.metadata as Record<string, unknown> | undefined)?.autoHangFill) {
            continue;
          }
          selectProduct(productId);
          return;
        }

        const columnEntry = Array.from(columnMeshRef.current.entries())
          .find(([, mesh]) => {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj === mesh) return true;
              obj = obj.parent;
            }
            return false;
          });
        if (columnEntry) {
          const columnKey = columnEntry[0];
          const matchedColumn = layout.walls
            .flatMap((wall) => (wall.columns || []).map((column) => ({ wallId: wall.id, column })))
            .find(({ wallId, column }) => {
              const key = `${wallId}-${column.id}`;
              return key === columnKey;
            });
          selectColumn(matchedColumn?.column.id || null);
          return;
        }

        const slatEntry = Array.from(slatWallMeshRef.current.entries())
          .find(([, mesh]) => {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj === mesh) return true;
              obj = obj.parent;
            }
            return false;
          });
        if (slatEntry) {
          const slatKey = slatEntry[0];
          const matchedSlat = layout.walls
            .flatMap((wall) => (wall.slatWalls || []).map((slat) => ({ wallId: wall.id, slat })))
            .find(({ wallId, slat }) => {
              const key = `${wallId}-${slat.id}`;
              return key === slatKey;
            });
          selectSlatWall(matchedSlat?.slat.id || null);
          return;
        }

        const primoEntry = Array.from(primoStandMeshRef.current.entries())
          .find(([, mesh]) => {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj === mesh) return true;
              obj = obj.parent;
            }
            return false;
          });
        if (primoEntry) {
          const primoKey = primoEntry[0];
          const matchedPrimo = layout.walls
            .flatMap((wall) => (wall.primoStands || []).map((primo) => ({ wallId: wall.id, primo })))
            .find(({ wallId, primo }) => {
              const key = `primo-${wallId}-${primo.id}`;
              return key === primoKey;
            });
          selectPrimoStand(matchedPrimo?.primo.id || null);
          return;
        }

        const wallEntry = Array.from(wallMeshRef.current.entries())
          .find(([, mesh]) => {
            let obj: THREE.Object3D | null = hit.object;
            while (obj) {
              if (obj === mesh) return true;
              obj = obj.parent;
            }
            return false;
          });
        if (wallEntry) {
          const [wallId] = wallEntry;
          selectWall(wallId);
          return;
        }
      }


      selectProduct(null);
      selectWall(null);
      selectColumn(null);
      selectSlatWall(null);
      selectPrimoStand(null);
    };
    
    // Right-click handler to deselect all
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault(); // Prevent default context menu

      selectProduct(null);
      selectWall(null);
      selectColumn(null);
      selectSlatWall(null);
      selectPrimoStand(null);
    };
    
    renderer.domElement.addEventListener('mousedown', handleCanvasMouseDown);
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    transformControls.addEventListener('objectChange', () => {
      const object = transformControls.object as THREE.Object3D | null;
      if (!object) return;
      const productEntry = [...productMapRef.current.entries()].find(([, entry]) => entry.group === object);
      if (!productEntry) return;
      const [productId] = productEntry;
      
      // Calculate bounding box to prevent object from going below floor
      const box = new THREE.Box3().setFromObject(object);
      const minY = box.min.y;
      
      // If object would go below floor, constrain it
      if (minY < 0) {
        const correction = -minY + 0.01; // Slightly above floor
        object.position.y += correction;
        // Prevented object from going below floor
      }
      
      const { position, rotation, scale } = object;
      upsertProduct({
        id: productId,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
        scale: { x: scale.x, y: scale.y, z: scale.z },
      });
    });

    scene.add(transformControls as unknown as THREE.Object3D);

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const directional = new THREE.DirectionalLight(0xffffff, 1.5);
    directional.position.set(12, 18, 10);
    
    // Add additional fill lights for better brightness
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight1.position.set(-12, 15, -10);
    
    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight2.position.set(0, 20, 0);

    scene.add(ambient, directional, fillLight1, fillLight2);

    // Create a thick floor using BoxGeometry - Use dynamic size from layout
    const FLOOR_SIZE = layout.floorSize || 24; // Get from layout or default to 24
    const floorThickness = 0.5; // 0.5 meters thick
    const floorGeometry = new THREE.BoxGeometry(FLOOR_SIZE, floorThickness, FLOOR_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -floorThickness / 2; // Position so top is at y=0
    floor.receiveShadow = true;
    floor.castShadow = true;
    scene.add(floor);
    floorMeshRef.current = floor;
    
    console.log('🟫 DEBUG: Floor created', {
      size: FLOOR_SIZE,
      thickness: floorThickness,
      position: floor.position,
      texture: layout.floorTexture || 'none',
      material: {
        color: floorMaterial.color,
        roughness: floorMaterial.roughness,
        metalness: floorMaterial.metalness
      }
    });

    // Keep grid calibrated to real-world units: 1 division = 1 meter.
    const gridDivisions = Math.max(1, Math.round(FLOOR_SIZE));
    const grid = new THREE.GridHelper(FLOOR_SIZE, gridDivisions, 0x94a3b8, 0xcbd5e1);
    scene.add(grid);

    // Initialize all loaders
    gltfLoaderRef.current = new GLTFLoader();
    objLoaderRef.current = new OBJLoader();
    fbxLoaderRef.current = new FBXLoader();

    rendererRef.current = renderer;
    cameraRef.current = camera;
    sceneRef.current = scene;
    orbitControlsRef.current = orbit;
    transformControlsRef.current = transformControls;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);
    }

    // Cleanup function
    return () => {
      renderer.domElement.removeEventListener('mousedown', handleCanvasMouseDown);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      if (wheelZoomHandlerRef.current) {
        renderer.domElement.removeEventListener('wheel', wheelZoomHandlerRef.current);
      }
    };
  }, [upsertProduct, selectProduct, selectWall, selectColumn, selectSlatWall, selectPrimoStand]);

  const resizeRenderer = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!renderer || !camera || !container) return;

    const { width, height } = container.getBoundingClientRect();
    
    // DEBUG: Log container and canvas dimensions

    console.log('🔍 DEBUG: Canvas dimensions:', { 
      canvasWidth: renderer.domElement.width, 
      canvasHeight: renderer.domElement.height,
      canvasStyle: renderer.domElement.style.cssText
    });
    console.log('🔍 DEBUG: Container style:', {
      containerWidth: container.style.width,
      containerHeight: container.style.height,
      containerClasses: container.className
    });
    
    if (width === 0 || height === 0) {
      console.warn('⚠️ Container has zero dimensions!');
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // Force canvas to fill container by removing inline size styles
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    


  }, [rendererRef, cameraRef, containerRef]);

  const animate = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const orbit = orbitControlsRef.current;
    const pointerLockControls = pointerLockControlsRef.current;
    if (!renderer || !scene || !camera) return;

    frameRef.current = requestAnimationFrame(animate);
    
    // Get current camera mode from ref to avoid stale closure
    const currentMode = cameraModeRef.current;
    
    // Update free move movement
    if (currentMode === 'freeMove' && pointerLockControls?.isLocked) {
      const time = performance.now();
      const delta = (time - prevTimeRef.current) / 1000; // seconds
      prevTimeRef.current = time;
      
      const velocity = velocityRef.current;
      const direction = directionRef.current;
      const moveState = moveStateRef.current;
      
      // Damping
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;
      velocity.y -= velocity.y * 10.0 * delta;
      
      // Movement direction
      direction.z = Number(moveState.forward) - Number(moveState.backward);
      direction.x = Number(moveState.right) - Number(moveState.left);
      direction.y = Number(moveState.up) - Number(moveState.down);
      direction.normalize();
      
      // Movement speed (fast for free flying)
      const speed = 50; // Fast movement for free flying
      
      if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
      if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;
      if (moveState.up || moveState.down) velocity.y += direction.y * speed * delta;
      
      // Apply movement
      pointerLockControls.moveRight(-velocity.x * delta);
      pointerLockControls.moveForward(-velocity.z * delta);
      
      // Vertical movement (free flying - no restrictions)
      camera.position.y += velocity.y * delta;
    }
    
    // Smooth zoom interpolation + orbit update
    if (orbit && currentMode === 'orbit') {
      if (zoomTargetDistanceRef.current !== null) {
        const offset = camera.position.clone().sub(orbit.target);
        const currentDistance = offset.length();
        const nextDistance = THREE.MathUtils.lerp(currentDistance, zoomTargetDistanceRef.current, 0.18);
        if (offset.lengthSq() > 0) {
          offset.setLength(nextDistance);
          camera.position.copy(orbit.target).add(offset);
        }
        if (Math.abs(nextDistance - zoomTargetDistanceRef.current) < 0.01) {
          zoomTargetDistanceRef.current = null;
        }
      }
      orbit.update();
    }
    
    mixersRef.current.forEach((mixer) => mixer.update(1 / 60));
    renderer.render(scene, camera);
  }, []); // Empty deps - uses refs for latest values

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const orbit = orbitControlsRef.current;
    if (!camera || !orbit) return;

    if (cameraResetAnimRef.current) {
      cancelAnimationFrame(cameraResetAnimRef.current);
      cameraResetAnimRef.current = null;
    }

    const startPosition = camera.position.clone();
    const startTarget = orbit.target.clone();
    const endPosition = CAMERA_START.clone();
    const endTarget = CAMERA_TARGET.clone();
    const durationMs = 520;
    const startTime = performance.now();

    const animateReset = (time: number) => {
      const elapsed = time - startTime;
      const rawT = Math.min(1, elapsed / durationMs);
      // cubic ease-out for a smooth finish
      const t = 1 - Math.pow(1 - rawT, 3);

      camera.position.lerpVectors(startPosition, endPosition, t);
      orbit.target.lerpVectors(startTarget, endTarget, t);
      orbit.update();

      if (rawT < 1) {
        cameraResetAnimRef.current = requestAnimationFrame(animateReset);
      } else {
        cameraResetAnimRef.current = null;
      }
    };

    cameraResetAnimRef.current = requestAnimationFrame(animateReset);
  }, []);

  const snapshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return null;
    // Force render to ensure the buffer has the latest frame
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png', 0.92);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      void container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const focusOnProduct = useCallback((productId: string) => {
    const camera = cameraRef.current;
    const controls = orbitControlsRef.current;
    const productEntry = productMapRef.current.get(productId);
    
    if (!camera || !controls || !productEntry) return;
    
    // Get product position and bounding box
    const productGroup = productEntry.group;
    const box = new THREE.Box3().setFromObject(productGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Calculate optimal camera distance
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
    
    // Position camera at a nice angle
    const cameraOffset = new THREE.Vector3(
      cameraDistance * 0.7,
      cameraDistance * 0.5,
      cameraDistance * 0.7
    );
    
    const newCameraPosition = center.clone().add(cameraOffset);
    
    // Smoothly animate camera
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000; // 1 second
    const startTime = Date.now();
    
    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      // Interpolate camera position
      camera.position.lerpVectors(startPosition, newCameraPosition, eased);
      
      // Interpolate target
      controls.target.lerpVectors(startTarget, center, eased);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };
    
    animateCamera();
  }, []);

  const focusOnWall = useCallback((wallId: string, side: 'front' | 'back' = 'front') => {
    const camera = cameraRef.current;
    const controls = orbitControlsRef.current;
    const walls = layout.walls || [];
    const wall = walls.find(w => w.id === wallId);
    
    if (!camera || !controls || !wall) return;
    
    const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
    const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
    
    const wallDir = end.clone().sub(start).normalize();
    const normal = new THREE.Vector3(-wallDir.z, 0, wallDir.x);
    if (side === 'back') {
       normal.negate();
    }
    
    const center = start.clone().lerp(end, 0.5);
    center.y = wall.height / 2;
    
    const wallLength = start.distanceTo(end);
    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.max(wallLength, wall.height) / (2 * Math.tan(fov / 2)) * 1.5; // 1.5 padding to see comfortably
    
    // Position straight out from the wall
    const newCameraPosition = center.clone().add(normal.multiplyScalar(dist));
    
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000;
    const startTime = Date.now();
    
    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      camera.position.lerpVectors(startPosition, newCameraPosition, eased);
      controls.target.lerpVectors(startTarget, center, eased);
      controls.update();
      
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };
    
    animateCamera();
  }, [layout.walls]);

  useImperativeHandle(
    ref,
    () => ({
      resetCamera,
      snapshot,
      toggleFullscreen,
      focusOnProduct,
      focusOnWall,
    }),
    [resetCamera, snapshot, toggleFullscreen, focusOnProduct, focusOnWall]
  );

  useEffect(() => {

    ensureRenderer();
    resizeRenderer();
    animate();

    const handleResize = () => {
      resizeRenderer();
    };
    window.addEventListener('resize', handleResize);

    return () => {

      window.removeEventListener('resize', handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (cameraResetAnimRef.current) cancelAnimationFrame(cameraResetAnimRef.current);
      zoomTargetDistanceRef.current = null;
      if (rendererRef.current?.domElement && wheelZoomHandlerRef.current) {
        rendererRef.current.domElement.removeEventListener('wheel', wheelZoomHandlerRef.current);
      }
      transformControlsRef.current?.dispose();
      orbitControlsRef.current?.dispose();
      pointerLockControlsRef.current?.disconnect();
      rendererRef.current?.dispose();
      sceneRef.current?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
      sceneRef.current = null;
      rendererRef.current = null;
      orbitControlsRef.current = null;
      pointerLockControlsRef.current = null;
      transformControlsRef.current = null;
    };
  }, []); // EMPTY DEPS - only run once on mount!

  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;
    
    transformControls.setMode(transformMode);
    
    // Enhanced visual feedback for rotation mode
    if (transformMode === 'rotate') {
      // Make rotation gizmo more visible
      transformControls.setSize(1.5);
      
      // Enable rotation snap for precise control
      transformControls.setRotationSnap(THREE.MathUtils.degToRad(1));
    } else {
      // Normal size for other modes
      transformControls.setSize(1.2);
    }
  }, [transformMode]);

  // Camera mode switching
  useEffect(() => {
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    const orbitControls = orbitControlsRef.current;
    
    // Update ref so animate function can access latest value
    cameraModeRef.current = cameraMode;
    

    
    if (!camera || !renderer) return;
    
    // Click handler for pointer lock
    const handleClick = () => {
      if (cameraMode === 'freeMove' && pointerLockControlsRef.current) {
        try {
          pointerLockControlsRef.current.lock();
        } catch (error) {
          console.warn('Failed to lock pointer:', error);
        }
      }
    };
    
    if (cameraMode === 'orbit') {
      console.log('📷 DEBUG: Switching to Orbit mode', {
        cameraPosition: camera.position,
        orbitEnabled: orbitControls?.enabled
      });
      // Enable orbit controls
      if (orbitControls) {
        orbitControls.enabled = true;
      }
      
      // Disable pointer lock
      if (pointerLockControlsRef.current) {
        pointerLockControlsRef.current.unlock();
      }
      
      // Remove click listener to prevent accidental pointer lock
      renderer.domElement.removeEventListener('click', handleClick);
      
    } else if (cameraMode === 'freeMove') {
      console.log('📷 DEBUG: Switching to Free Move mode', {
        cameraPosition: camera.position,
        orbitEnabled: orbitControls?.enabled
      });
      
      // Disable orbit controls
      if (orbitControls) {
        orbitControls.enabled = false;
      }
      
      // Initialize pointer lock controls if not exists
      if (!pointerLockControlsRef.current) {
        pointerLockControlsRef.current = new PointerLockControls(camera, renderer.domElement);
        
        // Set camera to elevated position for free flying
        camera.position.set(0, 5, 10);
        console.log('📷 DEBUG: PointerLockControls initialized', {
          startPosition: { x: 0, y: 5, z: 10 }
        });
      }
      
      // Add click listener for pointer lock
      renderer.domElement.addEventListener('click', handleClick);
    }
    
    // Cleanup: remove click listener when mode changes or component unmounts
    return () => {
      renderer.domElement.removeEventListener('click', handleClick);
    };
  }, [cameraMode]);

  // Keyboard controls for first-person mode
  useEffect(() => {
    if (cameraMode === 'orbit') return;
    
    const onKeyDown = (event: KeyboardEvent) => {
      const moveState = moveStateRef.current;
      
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.right = true;
          break;
        case 'Space':
          moveState.up = true;
          event.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.down = true;
          break;
      }
    };
    
    const onKeyUp = (event: KeyboardEvent) => {
      const moveState = moveStateRef.current;
      
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          moveState.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          moveState.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          moveState.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          moveState.right = false;
          break;
        case 'Space':
          moveState.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          moveState.down = false;
          break;
      }
    };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [cameraMode]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (!renderer || !scene) return;

    const wallMeshMap = wallMeshRef.current;
    const activeIds = new Set(layout.walls.map((wall) => wall.id));

    // Remove stale walls
    wallMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });

    // Limit to 20 walls max for performance
    console.log('🧱 DEBUG: Processing walls', {
      totalWalls: layout.walls.length,
      processing: Math.min(layout.walls.length, 20),
      defaultWallTexture: layout.defaultWallTexture || 'none'
    });
    
    layout.walls.slice(0, 20).forEach((wall, index) => {
      const existing = wallMeshMap.get(wall.id);
      if (existing) {
        updateWallMesh(existing, wall, texturesCache.current);
      } else {
        const mesh = createWallMesh(wall, texturesCache.current);
        wallMeshMap.set(wall.id, mesh);
        scene.add(mesh);
        console.log(`🧱 DEBUG: Wall ${index + 1} created`, {
          id: wall.id,
          start: wall.start,
          end: wall.end,
          height: wall.height,
          texture: wall.texture || 'default',
          color: wall.color
        });
      }

      // Render slat walls for this wall
      if (wall.slatWalls && wall.slatWalls.length > 0) {
        wall.slatWalls.forEach((slat) => {
          const slatKey = `${wall.id}-${slat.id}`;
          const existingSlat = slatWallMeshRef.current.get(slatKey);
          
          if (existingSlat) {
            scene.remove(existingSlat);
            existingSlat.traverse((child) => {
               if (child instanceof THREE.Mesh) {
                  child.geometry?.dispose();
                  if (child.material?.map) child.material.map.dispose();
                  child.material?.dispose();
               }
            });
            slatWallMeshRef.current.delete(slatKey);
          }
          
          const slatMesh = createSlatWallMesh(wall, slat);
          slatWallMeshRef.current.set(slatKey, slatMesh);
          scene.add(slatMesh);
        });
      }

      // Render Primo stands for this wall
      if (wall.primoStands && wall.primoStands.length > 0) {
        wall.primoStands.forEach((primo) => {
          const primoKey = `primo-${wall.id}-${primo.id}`;
          const existing = primoStandMeshRef.current.get(primoKey);
          if (existing) {
            scene.remove(existing);
            existing.traverse((child) => {
               if (child instanceof THREE.Mesh) {
                  child.geometry?.dispose();
                  if (child.material?.map) child.material.map.dispose();
                  child.material?.dispose();
               }
            });
            primoStandMeshRef.current.delete(primoKey);
          }
          // Cast primo to ShopBuilderSlatWall shape since createSlatWallMesh is generic
          const slatLike = {
            ...primo,
            systemType: 'primo' as const,
            fillType: primo.fillType,
            slatSpacing: undefined,
            shelfCount: undefined,
            shelfDepth: undefined,
          };
          const primoMesh = createSlatWallMesh(wall, slatLike as any);
          primoStandMeshRef.current.set(primoKey, primoMesh);
          scene.add(primoMesh);
        });
      }

      // Render columns for this wall
      if (wall.columns && wall.columns.length > 0) {
        wall.columns.forEach((column) => {
          const columnKey = `${wall.id}-${column.id}`;
          const existingColumn = columnMeshRef.current.get(columnKey);
          
          if (existingColumn) {
            // Update existing column
            updateColumnMesh(existingColumn, wall, column, texturesCache.current);
          } else {
            // Create new column
            const columnMesh = createColumnMesh(wall, column, texturesCache.current);
            columnMeshRef.current.set(columnKey, columnMesh);
            scene.add(columnMesh);
          }
        });
      }
    });

    // Remove columns that no longer exist
    const currentColumnKeys = new Set<string>();
    layout.walls.forEach((wall) => {
      if (wall.columns) {
        wall.columns.forEach((column) => {
          currentColumnKeys.add(`${wall.id}-${column.id}`);
        });
      }
    });

    columnMeshRef.current.forEach((mesh, key) => {
      if (!currentColumnKeys.has(key)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        columnMeshRef.current.delete(key);
      }
    });

    // Remove slat walls that no longer exist
    const currentSlatKeys = new Set<string>();
    layout.walls.forEach((wall) => {
      if (wall.slatWalls) {
        wall.slatWalls.forEach((slat) => {
          currentSlatKeys.add(`${wall.id}-${slat.id}`);
        });
      }
    });

    slatWallMeshRef.current.forEach((mesh, key) => {
      if (!currentSlatKeys.has(key)) {
        scene.remove(mesh);
        mesh.traverse((child) => {
           if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (child.material?.map) child.material.map.dispose();
              child.material?.dispose();
           }
        });
        slatWallMeshRef.current.delete(key);
      }
    });

    // Remove primo stands that no longer exist
    const currentPrimoKeys = new Set<string>();
    layout.walls.forEach((wall) => {
      if (wall.primoStands) {
        wall.primoStands.forEach((p) => {
          currentPrimoKeys.add(`primo-${wall.id}-${p.id}`);
        });
      }
    });
    primoStandMeshRef.current.forEach((mesh, key) => {
      if (!currentPrimoKeys.has(key)) {
        scene.remove(mesh);
        mesh.traverse((child) => {
           if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (child.material?.map) child.material.map.dispose();
              child.material?.dispose();
           }
        });
        primoStandMeshRef.current.delete(key);
      }
    });
  }, [layout.walls]);

  // Update floor size when it changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !floorMeshRef.current) return;

    const newFloorSize = layout.floorSize || 24;
    
    // Remove old floor
    scene.remove(floorMeshRef.current);
    floorMeshRef.current.geometry.dispose();
    if (floorMeshRef.current.material instanceof THREE.Material) {
      floorMeshRef.current.material.dispose();
    }
    
    // Create new floor with updated size
    const floorThickness = 0.5;
    const floorGeometry = new THREE.BoxGeometry(newFloorSize, floorThickness, newFloorSize);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    const newFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    newFloor.position.y = -floorThickness / 2;
    newFloor.receiveShadow = true;
    newFloor.castShadow = true;
    scene.add(newFloor);
    floorMeshRef.current = newFloor;
    
    // Find and remove old grid
    const oldGrid = scene.children.find(child => child instanceof THREE.GridHelper);
    if (oldGrid) {
      scene.remove(oldGrid);
      if (oldGrid instanceof THREE.GridHelper) {
        oldGrid.geometry.dispose();
        if (oldGrid.material instanceof THREE.Material) {
          oldGrid.material.dispose();
        } else if (Array.isArray(oldGrid.material)) {
          (oldGrid.material as THREE.Material[]).forEach(mat => mat.dispose());
        }
      }
    }
    
    // Keep updated grid calibrated to real-world units: 1 division = 1 meter.
    const gridDivisions = Math.max(1, Math.round(newFloorSize));
    const newGrid = new THREE.GridHelper(newFloorSize, gridDivisions, 0x94a3b8, 0xcbd5e1);
    scene.add(newGrid);
    
    // Reapply floor texture if it exists
    const floorTexture = layout.floorTexture || 'tiles_white';
    const textureConfig = FLOOR_TEXTURES[floorTexture as keyof typeof FLOOR_TEXTURES] || FLOOR_TEXTURES.tiles_white;
    
    if (textureConfig && textureConfig.map) {
      loadTexture(textureConfig.map, texturesCache.current).then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        
        if (floorMeshRef.current && floorMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
          floorMeshRef.current.material.map = texture;
          floorMeshRef.current.material.needsUpdate = true;
        }
      }).catch(err => console.error('Failed to load floor texture:', err));
    }
  }, [layout.floorSize, layout.floorTexture]);

  // Update floor texture when it changes
  useEffect(() => {
    if (!floorMeshRef.current) return;
    
    const floorTexture = layout.floorTexture || 'tiles_white';
    const textureConfig = FLOOR_TEXTURES[floorTexture as keyof typeof FLOOR_TEXTURES] || FLOOR_TEXTURES.tiles_white;
    
    // Load and apply floor texture
    if (textureConfig && textureConfig.map) {
      loadTexture(textureConfig.map, texturesCache.current).then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10); // Tile 10x10 times
        
        if (floorMeshRef.current && floorMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
          floorMeshRef.current.material.map = texture;
          floorMeshRef.current.material.needsUpdate = true;
        }
      }).catch(err => console.error('Failed to load floor texture:', err));
    }
    
    if (textureConfig && textureConfig.normalMap) {
      loadTexture(textureConfig.normalMap, texturesCache.current).then(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        
        if (floorMeshRef.current && floorMeshRef.current.material instanceof THREE.MeshStandardMaterial) {
          floorMeshRef.current.material.normalMap = texture;
          floorMeshRef.current.material.needsUpdate = true;
        }
      }).catch(err => console.error('Failed to load floor normal map:', err));
    }
  }, [layout.floorTexture]);

  const detachTransform = useCallback(() => {
    transformControlsRef.current?.detach();
  }, []);

  const applyProductTransform = useCallback((group: THREE.Group, product: ShopBuilderProduct) => {
    // Apply position, rotation, scale
    group.position.set(product.position.x, product.position.y, product.position.z);
    group.rotation.set(product.rotation.x, product.rotation.y, product.rotation.z);
    group.scale.set(product.scale.x, product.scale.y, product.scale.z);
    
    // Applying transform to product
    
    // Apply color and texture to all meshes
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        meshCount++;
        
        // Clone material if it's shared to avoid affecting other instances
        if (mesh.material && !Array.isArray(mesh.material) && !mesh.material.userData.isCloned) {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material = mesh.material.clone();
            mesh.material.userData.isCloned = true;
            // Cloned material
          } else if (mesh.material instanceof THREE.MeshBasicMaterial || 
                     mesh.material instanceof THREE.MeshPhongMaterial ||
                     mesh.material instanceof THREE.MeshLambertMaterial) {
            // Convert to MeshStandardMaterial for better texture support
            const oldMat = mesh.material;
            mesh.material = new THREE.MeshStandardMaterial({
              color: oldMat.color,
              map: oldMat.map,
              transparent: oldMat.transparent,
              opacity: oldMat.opacity,
            });
            mesh.material.userData.isCloned = true;
            // Converted material to MeshStandardMaterial
          }
        }
        
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          // Apply texture if specified
          if (product.texture) {
            // Loading texture for mesh
            loadTexture(product.texture, texturesCache.current).then(texture => {
              if (mesh.material instanceof THREE.MeshStandardMaterial) {
                // Apply texture with enhanced visibility
                mesh.material.map = texture;
                
                // ALWAYS set base color to white when texture is applied (so texture shows clearly)
                mesh.material.color.set(0xffffff);
                
                // Enhance texture visibility
                mesh.material.roughness = 0.8; // More matte finish shows texture better
                mesh.material.metalness = 0.1; // Less metallic shows texture better
                
                // Enable texture wrapping and repeat for better coverage
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(3, 3);  // Increased from 1,1 to 3,3 for more visible tiling
                
                // Add high-quality texture filtering
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.anisotropy = 16;  // Maximum anisotropic filtering for best quality
                texture.needsUpdate = true;
                
                // Use emissive color for color overlay (separate channel)
                if (product.color) {
                  mesh.material.emissive.set(product.color);
                  mesh.material.emissiveIntensity = 0.25; // Subtle color overlay
                  // Applied color as emissive overlay
                } else {
                  // Reset emissive if no color
                  mesh.material.emissive.set(0x000000);
                  mesh.material.emissiveIntensity = 0;
                }
                
                mesh.material.needsUpdate = true;
                // Applied texture to mesh
              }
            }).catch(err => {
              console.error('  ❌ Failed to load texture:', err);
              console.error('  📍 Texture URL:', product.texture);
            });
          } else if (!product.texture && mesh.material.map) {
            // Remove texture if not specified
            mesh.material.map = null;
            
            // Reset emissive when no texture
            mesh.material.emissive.set(0x000000);
            mesh.material.emissiveIntensity = 0;
            
            // Apply color directly to base color (no texture)
            if (product.color) {
              mesh.material.color.set(product.color);
              // Applied color to base
            } else {
              mesh.material.color.set(0xffffff);
            }
            
            mesh.material.needsUpdate = true;
            // Removed texture from mesh
          } else if (!product.texture) {
            // No texture - apply color directly to base color
            if (product.color) {
              mesh.material.color.set(product.color);
              mesh.material.emissive.set(0x000000);
              mesh.material.emissiveIntensity = 0;
              mesh.material.needsUpdate = true;
              // Applied color to mesh
            }
          }
        }
      }
    });
    // Total meshes processed
  }, []);

  const loadModel = useCallback(async (product: ShopBuilderProduct): Promise<THREE.Group | null> => {
    // Validate model URL
    if (!product.modelUrl || product.modelUrl.trim() === '') {
      console.error('❌ Product has no model URL:', product.name);
      return null;
    }

    // Check cache first
    if (cachedModelsRef.current.has(product.modelUrl)) {
      return cachedModelsRef.current.get(product.modelUrl)!.clone(true);
    }

    // Detect file format from URL
    const url = product.modelUrl.toLowerCase();
    const isGLTF = url.endsWith('.gltf') || url.endsWith('.glb');
    const isOBJ = url.endsWith('.obj');
    const isFBX = url.endsWith('.fbx');

    return new Promise((resolve) => {
      if (isGLTF && gltfLoaderRef.current) {
        // Load GLTF/GLB
        gltfLoaderRef.current.load(
          product.modelUrl,
          (gltf) => {
            const root = gltf.scene || new THREE.Group();
            cachedModelsRef.current.set(product.modelUrl, root);
            resolve(root.clone(true));
          },
          undefined,
          (error) => {
            console.error('Failed to load GLTF model', product.modelUrl, error);
            resolve(null);
          }
        );
      } else if (isOBJ && objLoaderRef.current) {
        // Load OBJ
        objLoaderRef.current.load(
          product.modelUrl,
          (obj) => {
            const root = obj;
            cachedModelsRef.current.set(product.modelUrl, root);
            resolve(root.clone(true));
          },
          undefined,
          (error) => {
            console.error('Failed to load OBJ model', product.modelUrl, error);
            resolve(null);
          }
        );
      } else if (isFBX && fbxLoaderRef.current) {
        // Load FBX
        fbxLoaderRef.current.load(
          product.modelUrl,
          (fbx) => {
            const root = fbx;
            cachedModelsRef.current.set(product.modelUrl, root);
            resolve(root.clone(true));
          },
          undefined,
          (error) => {
            console.error('Failed to load FBX model', product.modelUrl, error);
            resolve(null);
          }
        );
      } else {
        console.error('Unsupported model format:', product.modelUrl);
        resolve(null);
      }
    });
  }, []);



  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Loading products

    const productMap = productMapRef.current;
    const visibleProducts = layout.products.filter(
      (product) => !(product.metadata as Record<string, unknown> | undefined)?.hiddenByGlobalToggle
    );
    const activeIds = new Set(visibleProducts.map((product) => product.id));

    // Remove stale products
    productMap.forEach((entry, id) => {
      if (!activeIds.has(id)) {
        // Removing product
        scene.remove(entry.group);
        productMap.delete(id);
      }
    });

    // Load products properly with Promise.all
    const loadProducts = async () => {
      for (const product of visibleProducts) {
        const entry = productMap.get(product.id);
        if (entry) {
          // Updating existing product
          applyProductTransform(entry.group, product);
          continue;
        }

        // Loading new product
        try {
          const meta = (product.metadata || {}) as Record<string, unknown>;
          const isProcedural = Boolean(meta.proceduralHang) || String(product.modelUrl || '').startsWith('procedural://');
          const model = isProcedural ? createProceduralHangGroup(product) : await loadModel(product);
          if (!model) {
            console.error('❌ Model loading returned null for:', product.name);
            continue;
          }
          
          // Model loaded successfully
          
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          
          model.name = product.name || `product-${product.id}`;
          
          // Calculate bounding box to get object height
          const box = new THREE.Box3().setFromObject(model);
          const height = box.max.y - box.min.y;
          const bottomOffset = Math.abs(box.min.y);
          
          // Never auto-place procedural/auto-hung products on the floor;
          // they have precise Y positions from accessory coordinates.
          if (isProcedural) {
            applyProductTransform(model, product);
          } else if (product.position.y === 0.5) {
            const smartY = bottomOffset + 0.01; // Slightly above floor
            upsertProduct({ id: product.id, position: { ...product.position, y: smartY } });
            applyProductTransform(model, { ...product, position: { ...product.position, y: smartY } });
          } else {
            applyProductTransform(model, product);
          }
          scene.add(model);
          productMap.set(product.id, { group: model });
          console.log(`✅ DEBUG: Product added to scene (total: ${productMap.size})`)
        } catch (error) {
          console.error(`❌ Failed to load product ${product.id}:`, error);
        }
      }
    };

    loadProducts();
  }, [applyProductTransform, createProceduralHangGroup, layout.products, loadModel, upsertProduct]);

  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;
    if (!selectedProductId) {
      detachTransform();
      return;
    }
    const selectedProduct = layout.products.find((p) => p.id === selectedProductId);
    if ((selectedProduct?.metadata as Record<string, unknown> | undefined)?.autoHangFill) {
      detachTransform();
      return;
    }
    const productEntry = productMapRef.current.get(selectedProductId);
    if (!productEntry) {
      detachTransform();
      return;
    }
    transformControls.attach(productEntry.group);
  }, [detachTransform, layout.products, selectedProductId]);


  const canvasClasses = useMemo(
    () =>
      `relative h-full w-full rounded-2xl overflow-hidden transition-shadow duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-black' : 'bg-gradient-to-b from-sky-100 to-slate-50'
      }`,
    [isFullscreen]
  );

  return (
    <div 
      ref={containerRef} 
      className={canvasClasses}
    />
  );
});

export default ThreeScene;

// Helper function to load texture
function loadTexture(url: string, cache: Map<string, THREE.Texture>): Promise<THREE.Texture> {
  if (cache.has(url)) {
    return Promise.resolve(cache.get(url)!);
  }
  
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 1);
        cache.set(url, texture);
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

function createWallMesh(wall: ShopBuilderWall, texturesCache: Map<string, THREE.Texture>): THREE.Mesh {
  const start = new THREE.Vector3(wall.start.x, wall.height / 2, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, wall.height / 2, wall.end.y);
  const length = start.clone().setY(0).distanceTo(end.clone().setY(0));
  const geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
  
  const textureType = wall.texture || 'painted_white';
  const textureConfig = WALL_TEXTURES[textureType as keyof typeof WALL_TEXTURES] || WALL_TEXTURES.painted_white;
  
  // Create material
  const material = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(wall.color),
    roughness: 0.8,
    metalness: 0.0,
  });
  
  // Load textures asynchronously
  if (textureConfig && textureConfig.map) {
    loadTexture(textureConfig.map, texturesCache).then(texture => {
      material.map = texture;
      material.needsUpdate = true;
    }).catch(err => console.error('Failed to load texture:', err));
  }
  
  if (textureConfig && textureConfig.normalMap) {
    loadTexture(textureConfig.normalMap, texturesCache).then(texture => {
      material.normalMap = texture;
      material.needsUpdate = true;
    }).catch(err => console.error('Failed to load normal map:', err));
  }
  
  const mesh = new THREE.Mesh(geometry, material);

  const mid = start.clone().lerp(end, 0.5);
  mesh.position.set(mid.x, wall.height / 2, mid.z);

  // Calculate angle: atan2(deltaZ, deltaX) for proper orientation
  const angle = Math.atan2(end.z - start.z, end.x - start.x);
  mesh.rotation.y = -angle;
  return mesh;
}

function updateWallMesh(mesh: THREE.Mesh, wall: ShopBuilderWall, texturesCache: Map<string, THREE.Texture>) {
  const start = new THREE.Vector3(wall.start.x, wall.height / 2, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, wall.height / 2, wall.end.y);
  const length = start.clone().setY(0).distanceTo(end.clone().setY(0));

  // Store current position and rotation before updates
  const currentPosition = mesh.position.clone();
  const currentRotation = mesh.rotation.clone();

  // Only update geometry if dimensions changed
  const currentGeometry = mesh.geometry as THREE.BoxGeometry;
  const needsGeometryUpdate = !currentGeometry.parameters || 
    Math.abs(currentGeometry.parameters.width - length) > 0.001 ||
    Math.abs(currentGeometry.parameters.height - wall.height) > 0.001 ||
    Math.abs(currentGeometry.parameters.depth - wall.thickness) > 0.001;

  if (needsGeometryUpdate) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
  }

  // Update material only if color or texture changed
  const currentMaterial = mesh.material as THREE.MeshStandardMaterial;
  const textureType = wall.texture || 'painted_white';
  const textureConfig = WALL_TEXTURES[textureType as keyof typeof WALL_TEXTURES] || WALL_TEXTURES.painted_white;
  
  const needsColorUpdate = !currentMaterial.color.equals(new THREE.Color(wall.color));
  const currentTextureUrl = currentMaterial.map?.userData?.url;
  const needsTextureUpdate = currentTextureUrl !== textureConfig.map;

  if (needsTextureUpdate) {
    // Texture changed - need to recreate material
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose());
    } else {
      mesh.material.dispose();
    }
    
    // Create new material
    mesh.material = new THREE.MeshStandardMaterial({ 
      color: new THREE.Color(wall.color),
      roughness: 0.8,
      metalness: 0.0,
    });
    
    // Load textures asynchronously
    if (textureConfig && textureConfig.map) {
      loadTexture(textureConfig.map, texturesCache).then(texture => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          texture.userData = { url: textureConfig.map }; // Store URL for comparison
          mesh.material.map = texture;
          mesh.material.needsUpdate = true;
        }
      }).catch(err => console.error('Failed to load texture:', err));
    }
    
    if (textureConfig && textureConfig.normalMap) {
      loadTexture(textureConfig.normalMap, texturesCache).then(texture => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.normalMap = texture;
          mesh.material.needsUpdate = true;
        }
      }).catch(err => console.error('Failed to load normal map:', err));
    }
  } else if (needsColorUpdate) {
    // Just update color without recreating material
    currentMaterial.color.set(wall.color);
    currentMaterial.needsUpdate = true;
  }

  // Calculate new position and rotation
  const mid = start.clone().lerp(end, 0.5);
  const angle = Math.atan2(end.z - start.z, end.x - start.x);
  const newRotation = -angle;

  // Only update position if it actually changed
  if (!currentPosition.equals(mid) || Math.abs(currentRotation.y - newRotation) > 0.001) {
    mesh.position.set(mid.x, wall.height / 2, mid.z);
    mesh.rotation.y = newRotation;
  }
}

function createColumnMesh(wall: ShopBuilderWall, column: ShopBuilderColumn, texturesCache: Map<string, THREE.Texture>): THREE.Mesh {
  // Calculate column position along wall
  const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
  const baseColumnPos = start.clone().lerp(end, column.position);

  // Calculate wall direction and perpendicular
  const wallDir = end.clone().sub(start).normalize();
  const perpDir = new THREE.Vector3(-wallDir.z, 0, wallDir.x); // Perpendicular in XZ plane

  // Apply side offset (match slat wall: front = +perp, back = -perp)
  let sideOffset = 0;
  if (column.side === 'front') {
    sideOffset = (column.depth || 0.4) / 2;
  } else if (column.side === 'back') {
    sideOffset = -(column.depth || 0.4) / 2;
  }

  const columnPos = baseColumnPos.clone().add(perpDir.multiplyScalar(sideOffset));

  let geometry: THREE.BufferGeometry;
  
  if (column.shape === 'round') {
    // Cylinder for round columns
    geometry = new THREE.CylinderGeometry((column.width || 0.4) / 2, (column.width || 0.4) / 2, column.height, 16);
  } else {
    // Box for square/rectangular columns
    geometry = new THREE.BoxGeometry(column.width || 0.4, column.height || 3, column.depth || 0.4);
  }

  // Use wall texture for column
  const textureType = wall.texture || 'painted_white';
  const textureConfig = WALL_TEXTURES[textureType as keyof typeof WALL_TEXTURES] || WALL_TEXTURES.painted_white;
  
  const material = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(column.color),
    roughness: 0.7,
    metalness: 0.0,
  });
  
  // Load textures asynchronously
  if (textureConfig && textureConfig.map) {
    loadTexture(textureConfig.map, texturesCache).then(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 2);
      material.map = texture;
      material.needsUpdate = true;
    }).catch(err => console.error('Failed to load column texture:', err));
  }
  
  if (textureConfig && textureConfig.normalMap) {
    loadTexture(textureConfig.normalMap, texturesCache).then(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 2);
      material.normalMap = texture;
      material.needsUpdate = true;
    }).catch(err => console.error('Failed to load column normal map:', err));
  }
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(columnPos.x, column.height / 2, columnPos.z);

  // Rotate box columns to align with wall
  if (column.shape !== 'round') {
    const angle = Math.atan2(end.z - start.z, end.x - start.x);
    mesh.rotation.y = -angle;
  }

  return mesh;
}

function createSlatGeometry(width: number, height: number, spacing: number = 0.15): THREE.BufferGeometry {
  const thickness = 0.02; // 2cm thick
  return new THREE.BoxGeometry(width, height, thickness);
}

function updateSlatWallPosition(mesh: THREE.Object3D, wall: ShopBuilderWall, slat: ShopBuilderSlatWall, start: THREE.Vector3, end: THREE.Vector3, slatPos: number) {
  const basePos = start.clone().lerp(end, slatPos);
  
  // Wall direction
  const wallDir = end.clone().sub(start).normalize();
  const perpDir = new THREE.Vector3(-wallDir.z, 0, wallDir.x);
  
  const sideMultiplier = slat.side === 'front' ? 1 : -1;
  // Offset by half wall thickness + half slat thickness
  const offsetDist = (wall.thickness / 2 + 0.01) * sideMultiplier;
  
  const finalPos = basePos.add(perpDir.multiplyScalar(offsetDist));
  
  mesh.position.set(finalPos.x, slat.bottomOffset + (slat.height / 2), finalPos.z);
  
  const angle = Math.atan2(end.z - start.z, end.x - start.x);
  // If it's on the front, face outward (rotate 90 deg from wall). If back, rotate -90.
  mesh.rotation.y = -angle + (slat.side === 'back' ? Math.PI : 0);
}

const slatTextureCache = new Map<string, THREE.Texture>();

function createSlatTexture(color: string, spacing: number): THREE.Texture {
  const key = `${color}-${spacing}`;
  if (slatTextureCache.has(key)) {
     return slatTextureCache.get(key)!.clone();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Fill base color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 512);

    // Draw groove at the bottom
    const grooveHeight = 512 * 0.15; // 15% of slat for realistic tight groove
    
    const gradient = ctx.createLinearGradient(0, 512 - grooveHeight, 0, 512);
    gradient.addColorStop(0, 'rgba(0,0,0,0.7)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.9)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 512 - grooveHeight, 512, grooveHeight);
    
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, 512, 512 * 0.05);

    // Subtle bottom shadow leading into the groove
    const subtleGrad = ctx.createLinearGradient(0, 512 - grooveHeight * 1.5, 0, 512 - grooveHeight);
    subtleGrad.addColorStop(0, 'rgba(0,0,0,0)');
    subtleGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = subtleGrad;
    ctx.fillRect(0, 512 - grooveHeight * 1.5, 512, grooveHeight * 0.5);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  slatTextureCache.set(key, texture);
  return texture.clone();
}

function syncPrimoAccessories(mesh: THREE.Object3D, slat: ShopBuilderSlatWall, wallLength: number, wallThickness: number, wallColumns?: ShopBuilderColumn[]) {
  // First, find and remove all existing accessories
  const toRemove = mesh.children.filter(c => c.name.startsWith('accessory_'));
  toRemove.forEach(c => {
    mesh.remove(c);
    if (c instanceof THREE.Mesh) {
       c.geometry.dispose();
       if (Array.isArray(c.material)) c.material.forEach((m:any) => m.dispose());
       else (c.material as any).dispose();
    }
  });

  if (!slat.accessories?.length) return;

  const slatWidth = slat.fillType === 'full' ? wallLength : (slat.width || 1);
  const slatHeight = slat.height || 2;

  // Primo Stand Layout calculations
  const uprightSpacing = slat.uprightSpacing || 0.8;
  const baysCount = Math.max(1, Math.ceil(slatWidth / uprightSpacing));
  const bayWidth = slatWidth / baysCount;

  slat.accessories.forEach(acc => {
     const accGroup = new THREE.Group();
     accGroup.name = `accessory_${acc.id}`;
     
     const localX = (acc.position.x - 0.5) * slatWidth;

     let visualWidth = acc.width;
     if (acc.type === 'shelf') {
        const widthInBays = Math.max(1, Math.round(acc.width / bayWidth));
        visualWidth = widthInBays * bayWidth;
     }

     if (acc.type === 'shelf') {
        const geom = new THREE.BoxGeometry(visualWidth - 0.01, 0.02, acc.depth);
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#cccccc' });
        const accMesh = new THREE.Mesh(geom, mat);
        
        // Add shelf brackets right under the shelf
        const bracketGeom = new THREE.BoxGeometry(0.01, 0.1, acc.depth * 0.8);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const leftBracket = new THREE.Mesh(bracketGeom, bracketMat);
        leftBracket.position.set(-visualWidth/2 + 0.005, -0.05, 0); 
        const rightBracket = new THREE.Mesh(bracketGeom, bracketMat);
        rightBracket.position.set(visualWidth/2 - 0.005, -0.05, 0);

        accGroup.add(accMesh);
        accGroup.add(leftBracket);
        accGroup.add(rightBracket);
     } else if (acc.type === 'hook_single') {
        const geom = new THREE.CylinderGeometry(0.005, 0.005, acc.depth, 8);
        geom.rotateX(Math.PI / 2); // Make cylinder protrude along Z local axis
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#cccccc', metalness: 0.7, roughness: 0.2 });
        const hookMesh = new THREE.Mesh(geom, mat);
        
        // small base plate against the wall
        const baseGeom = new THREE.BoxGeometry(0.04, 0.04, 0.01);
        const baseMesh = new THREE.Mesh(baseGeom, mat);
        baseMesh.position.set(0, 0, -acc.depth / 2);
        
        accGroup.add(hookMesh);
        accGroup.add(baseMesh);
     } else if (acc.type === 'hook_waterfall') {
        const geom = new THREE.CylinderGeometry(0.012, 0.012, acc.depth, 16);
        geom.rotateX(Math.PI / 2); 
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#aaaaaa', metalness: 0.6, roughness: 0.3 });
        const tube = new THREE.Mesh(geom, mat);
        tube.rotation.x = Math.PI / 16; // slightly angles downward
        
        // add dividing balls for clothes hangers
        const sphereGeom = new THREE.SphereGeometry(0.018, 12, 12);
        const ballCount = Math.floor(acc.depth / 0.08); // ball every 8cm
        for(let i=1; i<=ballCount; i++) {
           const zPos = - (acc.depth / 2) + (i * 0.08);
           const ball = new THREE.Mesh(sphereGeom, mat);
           ball.position.set(0, 0, zPos);
           tube.add(ball);
        }
        
        const baseGeom = new THREE.BoxGeometry(0.05, 0.08, 0.01);
        const baseMesh = new THREE.Mesh(baseGeom, mat);
        baseMesh.position.set(0, 0, -acc.depth / 2);
        
        accGroup.add(tube);
        accGroup.add(baseMesh);
     } else {
        // Fallback for hook/basket
        const geom = new THREE.BoxGeometry(visualWidth, 0.1, acc.depth);
        const mat = new THREE.MeshStandardMaterial({ color: acc.color });
        const accMesh = new THREE.Mesh(geom, mat);
        accGroup.add(accMesh);
     }

     const localY = (acc.position.y - 0.5) * slatHeight;
     
     // Determine if it is over a column to protrude it
     let protrusion = 0;
     const absoluteX = (slat.fillType === 'full' ? 0.5 : (slat.position || 0.5)) * wallLength - (slatWidth / 2) + acc.position.x * slatWidth;
     
     if (wallColumns) {
        wallColumns.forEach(col => {
           const colStart = (col.position || 0.5) * wallLength - ((col.width || 0.4) / 2);
           const colEnd = colStart + (col.width || 0.4);
           if (absoluteX >= colStart && absoluteX <= colEnd) {
               const wThickness = wallThickness || 0.1;
               const slatAnchorOffset = wThickness / 2 + 0.01;
               const totalDepth = col.depth || 0.4;
               
               if ((col as any).side === slat.side) {
                   protrusion = Math.max(0, totalDepth - slatAnchorOffset) + 0.005;
               }
           }
        });
     }

     const localZ = acc.depth / 2 + 0.01 + protrusion;

     accGroup.position.set(localX, localY, localZ);
     
     mesh.add(accGroup);
  });
}

function syncSlatWallAccessories(mesh: THREE.Object3D, slat: ShopBuilderSlatWall, wallLength: number, wallThickness: number, wallColumns?: ShopBuilderColumn[]) {
  // First, find and remove all existing accessories
  const toRemove = mesh.children.filter(c => c.name.startsWith('accessory_'));
  toRemove.forEach(c => {
    mesh.remove(c);
    if (c instanceof THREE.Mesh) {
       c.geometry.dispose();
       // Note: complex materials or children disposal omitted for brevity
    }
  });

  if (!slat.accessories || slat.accessories.length === 0) return;

  const slatWidth = slat.fillType === 'full' ? wallLength : (slat.width || 1);
  const slatHeight = slat.height; // local Y from -height/2 to height/2

  slat.accessories.forEach(acc => {
     let accGroup = new THREE.Group();
     accGroup.name = `accessory_${acc.id}`;
     
     if (acc.type === 'shelf') {
        const geom = new THREE.BoxGeometry(acc.width, 0.02, acc.depth); // thin shelf
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#d97706', roughness: 0.6 });
        const accMesh = new THREE.Mesh(geom, mat);
        
        // Add tiny white brackets underneath
        const bracketGeom = new THREE.BoxGeometry(0.01, 0.1, acc.depth * 0.8);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const leftBracket = new THREE.Mesh(bracketGeom, bracketMat);
        leftBracket.position.set(Math.max(-acc.width / 2 + 0.1, -acc.width/2), -0.05, 0); 
        const rightBracket = new THREE.Mesh(bracketGeom, bracketMat);
        rightBracket.position.set(Math.min(acc.width / 2 - 0.1, acc.width/2), -0.05, 0);

        accGroup.add(accMesh);
        accGroup.add(leftBracket);
        accGroup.add(rightBracket);
     } else if (acc.type === 'hook_single') {
        const geom = new THREE.CylinderGeometry(0.005, 0.005, acc.depth, 8);
        geom.rotateX(Math.PI / 2); // Make cylinder protrude along Z local axis
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#cccccc', metalness: 0.7, roughness: 0.2 });
        const hookMesh = new THREE.Mesh(geom, mat);
        
        // small base plate against the wall
        const baseGeom = new THREE.BoxGeometry(0.04, 0.04, 0.01);
        const baseMesh = new THREE.Mesh(baseGeom, mat);
        baseMesh.position.set(0, 0, -acc.depth / 2);
        
        accGroup.add(hookMesh);
        accGroup.add(baseMesh);
     } else if (acc.type === 'hook_waterfall') {
        const geom = new THREE.CylinderGeometry(0.012, 0.012, acc.depth, 16);
        geom.rotateX(Math.PI / 2); 
        const mat = new THREE.MeshStandardMaterial({ color: acc.color || '#aaaaaa', metalness: 0.6, roughness: 0.3 });
        const tube = new THREE.Mesh(geom, mat);
        tube.rotation.x = Math.PI / 16; // slightly angles downward
        
        // add dividing balls for clothes hangers
        const sphereGeom = new THREE.SphereGeometry(0.018, 12, 12);
        const ballCount = Math.floor(acc.depth / 0.08); // ball every 8cm
        for(let i=1; i<=ballCount; i++) {
           const zPos = - (acc.depth / 2) + (i * 0.08);
           const ball = new THREE.Mesh(sphereGeom, mat);
           ball.position.set(0, 0, zPos);
           tube.add(ball);
        }
        
        const baseGeom = new THREE.BoxGeometry(0.05, 0.08, 0.01);
        const baseMesh = new THREE.Mesh(baseGeom, mat);
        baseMesh.position.set(0, 0, -acc.depth / 2);
        
        accGroup.add(tube);
        accGroup.add(baseMesh);
     } else {
        // Fallback for hook/basket
        const geom = new THREE.BoxGeometry(acc.width, 0.1, acc.depth);
        const mat = new THREE.MeshStandardMaterial({ color: acc.color });
        const accMesh = new THREE.Mesh(geom, mat);
        accGroup.add(accMesh);
     }

     // acc.position.x/y is 0-1, so map 0-1 to -width/2 -> width/2
     const localX = (acc.position.x - 0.5) * slatWidth;
     const localY = (acc.position.y - 0.5) * slatHeight;
     
     // Determine if it is over a column to protrude it
     let protrusion = 0;
     const absoluteX = (slat.fillType === 'full' ? 0.5 : (slat.position || 0.5)) * wallLength - (slatWidth / 2) + acc.position.x * slatWidth;
     
     if (wallColumns) {
        wallColumns.forEach(col => {
           const colStart = (col.position || 0.5) * wallLength - ((col.width || 0.4) / 2);
           const colEnd = colStart + (col.width || 0.4);
           if (absoluteX >= colStart && absoluteX <= colEnd) {
               const wThickness = wallThickness || 0.1;
               const slatAnchorOffset = wThickness / 2 + 0.01;
               const totalDepth = col.depth || 0.4;
               
               // Protrude the accessory over the column if they are on the same side
               if (col.side === slat.side) {
                   protrusion = Math.max(0, totalDepth - slatAnchorOffset) + 0.005;
               }
           }
        });
     }

     const localZ = acc.depth / 2 + 0.01 + protrusion;

     accGroup.position.set(localX, localY, localZ);
     
     mesh.add(accGroup);
  });
}

function createPrimoStandMesh(group: THREE.Group, slat: ShopBuilderSlatWall, segments: any[], wallLength: number, slatPosCenter: number) {
   const uprightSpacing = slat.uprightSpacing || 0.8; // default 80cm
   const sysHeight = slat.height || 2.4;
   
   // Metallic chrome look for the standards
   const uprightMaterial = new THREE.MeshStandardMaterial({ 
      color: slat.color || '#dddddd', 
      metalness: 0.8, 
      roughness: 0.2 
   });
   
   const sideFlip = slat.side === 'back' ? -1 : 1;

   segments.forEach(seg => {
      const segWidth = seg.end - seg.start;
      if (segWidth < 0.05) return; // Too small
      
      const baysCount = Math.max(1, Math.ceil(segWidth / uprightSpacing));
      const bayWidth = segWidth / baysCount;
      
      const segCenter = (seg.start + seg.end) / 2;
      const segLocalX = (segCenter - (slatPosCenter * wallLength)) * sideFlip;

      const segGroup = new THREE.Group();
      segGroup.position.set(segLocalX, 0, seg.protrusion);
      group.add(segGroup);
      
      const uprightWidth = 0.03; // thin 3cm visible strip
      const uprightDepth = 0.015; // 1.5 cm thick
      const uprightGeom = new THREE.BoxGeometry(uprightWidth, sysHeight, uprightDepth);
      
      for(let i = 0; i <= baysCount; i++) {
         const upX = -segWidth/2 + i * bayWidth;
         const upright = new THREE.Mesh(uprightGeom, uprightMaterial);
         
         upright.position.set(upX, 0, uprightDepth / 2 + 0.001);
         
         // Add tiny slot details using dark narrow boxes running down the sides
         const slotGeom = new THREE.BoxGeometry(0.003, sysHeight, 0.002);
         const slotMat = new THREE.MeshBasicMaterial({ color: '#111111' }); // dark
         const slot1 = new THREE.Mesh(slotGeom, slotMat);
         slot1.position.set(-0.006, 0, uprightDepth / 2 + 0.001);
         const slot2 = new THREE.Mesh(slotGeom, slotMat);
         slot2.position.set(0.006, 0, uprightDepth / 2 + 0.001);
         
         upright.add(slot1);
         upright.add(slot2);

         segGroup.add(upright);
      }
   });
}

function createSupermarketShelvesMesh(group: THREE.Group, slat: ShopBuilderSlatWall, segments: any[], wallLength: number, slatPosCenter: number) {
   const shelfCount = slat.shelfCount || 5;
   const shelfDepth = slat.shelfDepth || 0.4;
   const uprightSpacing = slat.uprightSpacing || 1.0;
   const sysHeight = slat.height || 2;
   const color = slat.color || '#e11d48'; // default to red/pink accent
   
   const uprightMaterial = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.6, metalness: 0.1 });
   const shelfMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
   const accentMaterial = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
   const backPanelMaterial = new THREE.MeshStandardMaterial({ color: '#fcfcfc', roughness: 0.9 });
   
   const sideFlip = slat.side === 'back' ? -1 : 1;

   segments.forEach(seg => {
      const segWidth = seg.end - seg.start;
      if (segWidth < 0.1) return;
      
      const baysCount = Math.ceil(segWidth / uprightSpacing);
      const bayWidth = segWidth / baysCount;
      
      const segCenter = (seg.start + seg.end) / 2;
      const segLocalX = (segCenter - (slatPosCenter * wallLength)) * sideFlip;

      const segGroup = new THREE.Group();
      segGroup.position.set(segLocalX, 0, seg.protrusion);
      group.add(segGroup);
      
      const backGeom = new THREE.BoxGeometry(segWidth, sysHeight, 0.01);
      const backMesh = new THREE.Mesh(backGeom, backPanelMaterial);
      backMesh.position.set(0, 0, 0.005);
      segGroup.add(backMesh);
      
      const uprightWidth = 0.04;
      const uprightDepth = 0.04;
      const uprightGeom = new THREE.BoxGeometry(uprightWidth, sysHeight, uprightDepth);
      
      for(let i = 0; i <= baysCount; i++) {
         const upX = -segWidth/2 + i * bayWidth;
         const upright = new THREE.Mesh(uprightGeom, uprightMaterial);
         upright.position.set(upX, 0, 0.02 + 0.01);
         segGroup.add(upright);
      }
      
      for(let i = 0; i < baysCount; i++) {
         const bayCenterX = -segWidth/2 + (i + 0.5) * bayWidth;
         
         for(let j = 0; j < shelfCount; j++) {
             const isBaseShelf = j === 0;
             const sDepth = isBaseShelf ? shelfDepth + 0.05 : shelfDepth;
             const shelfY = 0.15 + j * ((sysHeight - 0.3) / Math.max(1, shelfCount - 1));
             
             const shelfGeom = new THREE.BoxGeometry(bayWidth - 0.01, 0.02, sDepth);
             const shelfMesh = new THREE.Mesh(shelfGeom, shelfMaterial);
             shelfMesh.position.set(bayCenterX, shelfY - sysHeight/2, sDepth/2 + 0.01);
             segGroup.add(shelfMesh);
             
             const accentGeom = new THREE.BoxGeometry(bayWidth - 0.01, 0.03, 0.01);
             const accentMesh = new THREE.Mesh(accentGeom, accentMaterial);
             accentMesh.position.set(bayCenterX, shelfY - sysHeight/2 - 0.005, sDepth + 0.015);
             segGroup.add(accentMesh);
             
             if (!isBaseShelf) {
                 const bracketGeom = new THREE.BoxGeometry(0.01, 0.1, sDepth - 0.02);
                 const leftBracket = new THREE.Mesh(bracketGeom, uprightMaterial);
                 leftBracket.position.set(bayCenterX - bayWidth/2 + 0.02, shelfY - sysHeight/2 - 0.05, sDepth/2 + 0.01);
                 const rightBracket = new THREE.Mesh(bracketGeom, uprightMaterial);
                 rightBracket.position.set(bayCenterX + bayWidth/2 - 0.02, shelfY - sysHeight/2 - 0.05, sDepth/2 + 0.01);
                 segGroup.add(leftBracket);
                 segGroup.add(rightBracket);
             } else {
                 const legGeom = new THREE.BoxGeometry(0.04, 0.14, sDepth);
                 const legLeft = new THREE.Mesh(legGeom, uprightMaterial);
                 legLeft.position.set(bayCenterX - bayWidth/2 + 0.02, -sysHeight/2 + 0.07, sDepth/2 + 0.01);
                 const legRight = new THREE.Mesh(legGeom, uprightMaterial);
                 legRight.position.set(bayCenterX + bayWidth/2 - 0.02, -sysHeight/2 + 0.07, sDepth/2 + 0.01);
                 segGroup.add(legLeft);
                 segGroup.add(legRight);
             }
         }
      }
   });
}

function createSlatWallMesh(wall: ShopBuilderWall, slat: ShopBuilderSlatWall): THREE.Group {
  const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
  const wallLength = start.distanceTo(end);

  const slatWidth = slat.fillType === 'full' ? wallLength : (slat.width || 1);
  const slatPosCenter = slat.fillType === 'full' ? 0.5 : (slat.position || 0.5);

  const group = new THREE.Group();
  
  const texture = createSlatTexture(slat.color || '#f5f5f5', slat.slatSpacing || 0.15);
  texture.repeat.set(1, (slat.height || 2) / Math.max(0.01, slat.slatSpacing || 0.15));

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: new THREE.Color(0xffffff),
    roughness: 0.7,
    metalness: 0.1,
  });

  // Calculate segments (incorporating columns!)
  let segments = [{ 
     start: (slatPosCenter * wallLength) - (slatWidth / 2), 
     end: (slatPosCenter * wallLength) + (slatWidth / 2),
     protrusion: 0 
  }];
  
  if (wall.columns && wall.columns.length > 0) {
    wall.columns.forEach(col => {
      const colStart = (col.position || 0.5) * wallLength - ((col.width || 0.4) / 2) - 0.005;
      const colEnd = (col.position || 0.5) * wallLength + ((col.width || 0.4) / 2) + 0.005;
      
      let protrusion = 0;
      const wThickness = wall.thickness || 0.1;
      const slatAnchorOffset = wThickness / 2 + 0.01;
      const totalDepth = col.depth || 0.4;
      
      // Protrude the slat wall over the column if they are on the same side
      if (col.side === slat.side) {
          protrusion = Math.max(0, totalDepth - slatAnchorOffset) + 0.005;
      }
      
      if (protrusion > 0.01) {
          const newSegments: {start: number, end: number, protrusion: number}[] = [];
          segments.forEach(seg => {
             if (colEnd > seg.start && colStart < seg.end) {
                if (seg.start < colStart) newSegments.push({ start: seg.start, end: colStart, protrusion: seg.protrusion });
                
                // Add the protruding over-column segment
                newSegments.push({ 
                   start: Math.max(seg.start, colStart), 
                   end: Math.min(seg.end, colEnd), 
                   protrusion: protrusion 
                });
                
                if (seg.end > colEnd) newSegments.push({ start: colEnd, end: seg.end, protrusion: seg.protrusion });
             } else {
                newSegments.push(seg);
             }
          });
          segments = newSegments;
      }
    });
  }

  if (slat.systemType === 'supermarket_shelves') {
     createSupermarketShelvesMesh(group, slat, segments, wallLength, slatPosCenter);
  } else if (slat.systemType === 'primo') {
     createPrimoStandMesh(group, slat, segments, wallLength, slatPosCenter);
     syncPrimoAccessories(group, slat, wallLength, wall.thickness || 0.1, wall.columns);
  } else {
     const sideFlip = slat.side === 'back' ? -1 : 1;
     segments.forEach(seg => {
       const segWidth = seg.end - seg.start;
       if (segWidth <= 0.01) return;
       
       const geometry = createSlatGeometry(segWidth, slat.height || 2, slat.slatSpacing || 0.15);
       const mesh = new THREE.Mesh(geometry, material);
       
       const segCenter = (seg.start + seg.end) / 2;
       const localX = (segCenter - (slatPosCenter * wallLength)) * sideFlip;
       // localZ offsets it forwards from the wall mesh
       mesh.position.set(localX, 0, seg.protrusion);
       group.add(mesh);
     });
     
     syncSlatWallAccessories(group, slat, wallLength, wall.thickness || 0.1, wall.columns);
  }
  
  updateSlatWallPosition(group, wall, slat, start, end, slatPosCenter);
  
  return group;
}

function updateColumnMesh(mesh: THREE.Mesh, wall: ShopBuilderWall, column: ShopBuilderColumn, texturesCache: Map<string, THREE.Texture>) {
  // Calculate column position along wall
  const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
  const baseColumnPos = start.clone().lerp(end, column.position);

  // Calculate wall direction and perpendicular
  const wallDir = end.clone().sub(start).normalize();
  const perpDir = new THREE.Vector3(-wallDir.z, 0, wallDir.x); // Perpendicular in XZ plane

  // Apply side offset (match slat wall: front = +perp, back = -perp)
  let sideOffset = 0;
  if (column.side === 'front') {
    sideOffset = (column.depth || 0.4) / 2;
  } else if (column.side === 'back') {
    sideOffset = -(column.depth || 0.4) / 2;
  }

  const columnPos = baseColumnPos.clone().add(perpDir.multiplyScalar(sideOffset));

  // Update geometry
  mesh.geometry.dispose();
  if (column.shape === 'round') {
    mesh.geometry = new THREE.CylinderGeometry((column.width || 0.4) / 2, (column.width || 0.4) / 2, column.height, 16);
  } else {
    mesh.geometry = new THREE.BoxGeometry(column.width || 0.4, column.height || 3, column.depth || 0.4);
  }

  // Update material with wall texture
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(m => m.dispose());
  } else {
    mesh.material.dispose();
  }
  
  const textureType = wall.texture || 'painted_white';
  const textureConfig = WALL_TEXTURES[textureType as keyof typeof WALL_TEXTURES] || WALL_TEXTURES.painted_white;
  
  mesh.material = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(column.color),
    roughness: 0.7,
    metalness: 0.0,
  });
  
  // Load textures asynchronously
  if (textureConfig && textureConfig.map) {
    loadTexture(textureConfig.map, texturesCache).then(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 2);
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    }).catch(err => console.error('Failed to load column texture:', err));
  }
  
  if (textureConfig && textureConfig.normalMap) {
    loadTexture(textureConfig.normalMap, texturesCache).then(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 2);
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.normalMap = texture;
        mesh.material.needsUpdate = true;
      }
    }).catch(err => console.error('Failed to load column normal map:', err));
  }

  // Update position
  mesh.position.set(columnPos.x, column.height / 2, columnPos.z);

  // Update rotation for box columns
  if (column.shape !== 'round') {
    const angle = Math.atan2(end.z - start.z, end.x - start.x);
    mesh.rotation.y = -angle;
  } else {
    mesh.rotation.y = 0;
  }
}
