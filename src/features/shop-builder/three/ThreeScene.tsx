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
import type { ShopBuilderProduct, ShopBuilderWall, ShopBuilderColumn } from '../types';
import type { CameraMode } from '../store';

// Texture loader
const textureLoader = new THREE.TextureLoader();

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
    map: 'https://cdn.pixabay.com/photo/2017/08/30/01/05/milky-way-2695569_960_720.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://cdn.pixabay.com/photo/2017/08/30/01/05/milky-way-2695569_960_720.jpg',
  },
  tiles_grey: {
    map: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  },
  tiles_black: {
    map: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
  },
  wood_light: {
    map: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  },
  wood_dark: {
    map: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://threejs.org/examples/textures/hardwood2_roughness.jpg',
  },
  wood_parquet: {
    map: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
    normalMap: 'https://threejs.org/examples/textures/hardwood2_bump.jpg',
    preview: 'https://threejs.org/examples/textures/hardwood2_diffuse.jpg',
  },
  marble_white: {
    map: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
    normalMap: 'https://threejs.org/examples/textures/terrain/grasslight-big-nm.jpg',
    preview: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
  },
  marble_black: {
    map: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
    normalMap: 'https://threejs.org/examples/textures/brick_bump.jpg',
    preview: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
  },
  vinyl_grey: {
    map: 'https://threejs.org/examples/textures/waterdudv.jpg',
    normalMap: 'https://threejs.org/examples/textures/waternormals.jpg',
    preview: 'https://threejs.org/examples/textures/waterdudv.jpg',
  },
  concrete: {
    map: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
    normalMap: 'https://threejs.org/examples/textures/brick_bump.jpg',
    preview: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
  },
};

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface ThreeSceneHandle {
  resetCamera: () => void;
  snapshot: () => string | null;
  toggleFullscreen: () => void;
  focusOnProduct: (productId: string) => void;
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
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const objLoaderRef = useRef<OBJLoader | null>(null);
  const fbxLoaderRef = useRef<FBXLoader | null>(null);
  const productMapRef = useRef<Map<string, ProductEntry>>(new Map());
  const wallMeshRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const columnMeshRef = useRef<Map<string, THREE.Mesh>>(new Map());
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
    upsertProduct,
  } = useShopBuilder();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const ensureRenderer = useCallback(() => {
    if (rendererRef.current && cameraRef.current && sceneRef.current && orbitControlsRef.current) {
      console.log('✅ DEBUG: Renderer already exists, skipping initialization');
      return;
    }
    
    console.log('🔄 DEBUG: Creating new renderer and scene');

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
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

    // Add click handler to renderer canvas for object selection
    let mouseDownTime = 0;
    let mouseDownPos = { x: 0, y: 0 };
    
    const handleCanvasMouseDown = (event: MouseEvent) => {
      mouseDownTime = Date.now();
      mouseDownPos = { x: event.clientX, y: event.clientY };
    };
    
    const handleCanvasClick = (event: MouseEvent) => {
      console.log('🖱️ Canvas click detected');
      
      // Ignore if it was a drag (OrbitControls)
      const timeDiff = Date.now() - mouseDownTime;
      const distance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      
      console.log('📏 Click metrics:', { distance, timeDiff });
      
      // If mouse moved more than 5px or took more than 200ms, it's a drag
      if (distance > 5 || timeDiff > 200) {
        console.log('⏭️ Ignoring - was a drag');
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
          console.log('🎯 Clicked on gizmo - ignoring');
          return;
        }
      }

      // Get all scene objects
      const wallMeshes = Array.from(wallMeshRef.current.values());
      const productGroups = [...productMapRef.current.values()].map((entry) => entry.group);
      
      console.log('📊 Available objects:', { walls: wallMeshes.length, products: productGroups.length });
      
      const allIntersects = raycaster.intersectObjects([...wallMeshes, ...productGroups], true);
      
      console.log('🔍 Intersections found:', allIntersects.length);
      
      if (allIntersects.length === 0) {
        console.log('⭕ Empty space - deselecting all');
        selectProduct(null);
        selectWall(null);
        selectColumn(null);
        return;
      }

      const closest = allIntersects[0];
      console.log('🎯 Closest object:', closest.object.type, closest.object.name);
      
      // Check if it's a wall
      const wallEntry = Array.from(wallMeshRef.current.entries())
        .find(([, mesh]) => mesh === closest.object || closest.object.parent === mesh);
      
      if (wallEntry) {
        const [wallId] = wallEntry;
        console.log('🧱 Wall selected:', wallId);
        // Only select wall without deselecting others
        selectWall(wallId);
        return;
      }

      // Check if it's a product
      const productEntry = Array.from(productMapRef.current.entries())
        .find(([, entry]) => {
          let obj: THREE.Object3D | null = closest.object;
          while (obj) {
            if (obj === entry.group) return true;
            obj = obj.parent;
          }
          return false;
        });
      
      if (productEntry) {
        const [productId] = productEntry;
        console.log('📦 Product selected:', productId);
        // Only select product without deselecting others
        selectProduct(productId);
        return;
      }

      console.log('❓ Unknown object - deselecting all');
      selectProduct(null);
      selectWall(null);
      selectColumn(null);
    };
    
    // Right-click handler to deselect all
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault(); // Prevent default context menu
      console.log('🖱️ Right-click detected - deselecting all');
      selectProduct(null);
      selectWall(null);
      selectColumn(null);
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

    // Grid helper with dynamic size - adjust divisions based on floor size
    const gridDivisions = Math.floor(FLOOR_SIZE / 2); // 2 meters per division
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
    };
  }, [upsertProduct, selectProduct, selectWall, selectColumn]);

  const resizeRenderer = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!renderer || !camera || !container) return;

    const { width, height } = container.getBoundingClientRect();
    
    // DEBUG: Log container and canvas dimensions
    console.log('🔍 DEBUG: Container dimensions:', { width, height });
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
    
    console.log('✅ Renderer resized to:', { width, height });
    console.log('✅ Canvas style updated to fill container');
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
    
    // Update orbit controls if in orbit mode
    if (orbit && currentMode === 'orbit') {
      orbit.update();
    }
    
    mixersRef.current.forEach((mixer) => mixer.update(1 / 60));
    renderer.render(scene, camera);
  }, []); // Empty deps - uses refs for latest values

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const orbit = orbitControlsRef.current;
    if (!camera || !orbit) return;
    camera.position.copy(CAMERA_START);
    orbit.target.copy(CAMERA_TARGET);
    orbit.update();
  }, []);

  const snapshot = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return null;
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

  useImperativeHandle(
    ref,
    () => ({
      resetCamera,
      snapshot,
      toggleFullscreen,
      focusOnProduct,
    }),
    [resetCamera, snapshot, toggleFullscreen, focusOnProduct]
  );

  useEffect(() => {
    console.log('🎬 DEBUG: Main useEffect running - initializing scene');
    ensureRenderer();
    resizeRenderer();
    animate();

    const handleResize = () => {
      resizeRenderer();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log('🧹 DEBUG: Cleanup - disposing scene');
      window.removeEventListener('resize', handleResize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
    
    console.log('📷 DEBUG: Camera mode changed to:', cameraMode);
    
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
          oldGrid.material.forEach(mat => mat.dispose());
        }
      }
    }
    
    // Create new grid with updated size
    const gridDivisions = Math.floor(newFloorSize / 2);
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
    const activeIds = new Set(layout.products.map((product) => product.id));

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
      for (const product of layout.products) {
        const entry = productMap.get(product.id);
        if (entry) {
          // Updating existing product
          applyProductTransform(entry.group, product);
          continue;
        }

        // Loading new product
        try {
          const model = await loadModel(product);
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
          
          // Smart spawn position: place object so its bottom is at floor level
          // Only adjust on first load (when position is exactly 0.5)
          if (product.position.y === 0.5) {
            const smartY = bottomOffset + 0.01; // Slightly above floor
            
            console.log(`📦 DEBUG: Product auto-placed on floor`, {
              id: product.id,
              name: product.name,
              modelUrl: product.modelUrl,
              boundingBox: { min: box.min, max: box.max },
              height,
              bottomOffset,
              calculatedY: smartY,
              position: { x: product.position.x, y: smartY, z: product.position.z }
            });
            
            // Update product position in store (only once)
            upsertProduct({ id: product.id, position: { ...product.position, y: smartY } });
            
            // Apply with adjusted position
            applyProductTransform(model, { ...product, position: { ...product.position, y: smartY } });
          } else {
            console.log(`📦 DEBUG: Product placed at existing position`, {
              id: product.id,
              name: product.name,
              position: product.position,
              scale: product.scale
            });
            // Use existing position
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
  }, [applyProductTransform, layout.products, loadModel, upsertProduct]);

  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;
    if (!selectedProductId) {
      detachTransform();
      return;
    }
    const productEntry = productMapRef.current.get(selectedProductId);
    if (!productEntry) {
      detachTransform();
      return;
    }
    transformControls.attach(productEntry.group);
  }, [detachTransform, selectedProductId]);


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

  // Apply side offset
  let sideOffset = 0;
  if (column.side === 'left') {
    sideOffset = -column.width / 2;
  } else if (column.side === 'right') {
    sideOffset = column.width / 2;
  }

  const columnPos = baseColumnPos.clone().add(perpDir.multiplyScalar(sideOffset));

  let geometry: THREE.BufferGeometry;
  
  if (column.shape === 'round') {
    // Cylinder for round columns
    geometry = new THREE.CylinderGeometry(column.width / 2, column.width / 2, column.height, 16);
  } else {
    // Box for square/rectangular columns
    geometry = new THREE.BoxGeometry(column.depth, column.height, column.width);
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

function updateColumnMesh(mesh: THREE.Mesh, wall: ShopBuilderWall, column: ShopBuilderColumn, texturesCache: Map<string, THREE.Texture>) {
  // Calculate column position along wall
  const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
  const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
  const baseColumnPos = start.clone().lerp(end, column.position);

  // Calculate wall direction and perpendicular
  const wallDir = end.clone().sub(start).normalize();
  const perpDir = new THREE.Vector3(-wallDir.z, 0, wallDir.x); // Perpendicular in XZ plane

  // Apply side offset
  let sideOffset = 0;
  if (column.side === 'left') {
    sideOffset = -column.width / 2;
  } else if (column.side === 'right') {
    sideOffset = column.width / 2;
  }

  const columnPos = baseColumnPos.clone().add(perpDir.multiplyScalar(sideOffset));

  // Update geometry
  mesh.geometry.dispose();
  if (column.shape === 'round') {
    mesh.geometry = new THREE.CylinderGeometry(column.width / 2, column.width / 2, column.height, 16);
  } else {
    mesh.geometry = new THREE.BoxGeometry(column.depth, column.height, column.width);
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
