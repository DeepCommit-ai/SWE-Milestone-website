import React from 'react';
import { Shield, Layers, Database, AlertTriangle, Activity, PenTool } from 'lucide-react';
import { Category } from '../types';

// Dark palette — matches the SWE-Milestone site (GitHub dark-dimmed). Cards use the
// site's box black; borders are gray-white so cards read on the dark canvas.
export const T = {
  card: '#1c2128',       // milestone box — GitHub dark
  band: '#171b21',       // header / footer band (slightly darker than card)
  border: '#444c56',     // soft GitHub border
  borderSoft: '#2d333b', // inner dividers
  head: '#ecf2f8',
  text: '#cdd9e5',
  muted: '#98a5b3',
  faint: '#768390',
  accent: '#57ab5a',
} as const;

// Category badge colors, toned down for dark (dark tint bg + light text).
export const CAT: Record<Category, { bg: string; fg: string; icon: React.ReactNode }> = {
  [Category.SECURITY_FIX]:           { bg: '#3a2c12', fg: '#e6c47a', icon: <Shield size={12} /> },
  [Category.ARCHITECTURAL_REFACTOR]: { bg: '#12362a', fg: '#6bd6a6', icon: <Layers size={12} /> },
  [Category.PLATFORM_SUPPORT]:       { bg: '#3a2517', fg: '#e0a878', icon: <Database size={12} /> },
  [Category.BREAKING_CHANGE]:        { bg: '#123230', fg: '#5fd0c4', icon: <AlertTriangle size={12} /> },
  [Category.MAJOR_FEATURE]:          { bg: '#152a42', fg: '#79b8f2', icon: <Activity size={12} /> },
  [Category.MAINTENANCE]:            { bg: '#26301a', fg: '#a6c96a', icon: <PenTool size={12} /> },
};
