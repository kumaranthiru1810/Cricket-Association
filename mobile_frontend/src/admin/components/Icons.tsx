/**
 * src/admin/components/Icons.tsx
 * Crisp SVG Icon components for the Professional Cricket Association Admin Panel.
 */

import React from 'react';

import Svg, { Rect, Path, Circle, Line, Polyline, Polygon } from 'react-native-svg';


interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: any;
}

export const DashboardIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Rect x="3" y="3" width="7" height="9" rx="1" />
    <Rect x="14" y="3" width="7" height="5" rx="1" />
    <Rect x="14" y="12" width="7" height="9" rx="1" />
    <Rect x="3" y="16" width="7" height="5" rx="1" />
  </Svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="9" cy="7" r="4" />
    <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

export const PlayersIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Circle cx="12" cy="5" r="3" />
    <Path d="M12 12c-3.5 0-6 2-6 5v2h12v-2c0-3-2.5-5-6-5z" />
    <Path d="M18 9l3 3-1.5 1.5-3-3" />
  </Svg>
);

export const TeamsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <Path d="M4 22h16" />
    <Path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
    <Path d="M14 14.66V17c0 .55.45 1 1 1h2" />
    <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </Svg>
);

export const TournamentsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M8 21h8" />
    <Path d="M12 17v4" />
    <Path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <Path d="M7 6H4a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h1" />
    <Path d="M17 6h3a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1" />
  </Svg>
);

export const MatchesIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Circle cx="12" cy="12" r="10" />
    <Path d="m4.93 4.93 4.24 4.24" />
    <Path d="m14.83 9.17 4.24-4.24" />
    <Path d="m14.83 14.83 4.24 4.24" />
    <Path d="m9.17 14.83-4.24 4.24" />
    <Circle cx="12" cy="12" r="4" />
  </Svg>
);

export const ApprovalsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="m9 12 2 2 4-4" />
    <Path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
  </Svg>
);

export const LiveScoringIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
    <Path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
    <Circle cx="12" cy="12" r="2" fill={color} />
    <Path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
    <Path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
  </Svg>
);

export const StatisticsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Line x1="18" y1="20" x2="18" y2="10" />
    <Line x1="12" y1="20" x2="12" y2="4" />
    <Line x1="6" y1="20" x2="6" y2="14" />
    <Line x1="2" y1="20" x2="22" y2="20" />
  </Svg>
);

export const NotificationsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

export const ContentIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <Path d="M6 6h10" />
    <Path d="M6 10h10" />
    <Path d="M6 14h6" />
  </Svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Circle cx="11" cy="11" r="8" />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

export const BellIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <Polyline points="16 17 21 12 16 7" />
    <Line x1="21" y1="12" x2="9" y2="12" />
  </Svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Line x1="3" y1="12" x2="21" y2="12" />
    <Line x1="3" y1="6" x2="21" y2="6" />
    <Line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="15 18 9 12 15 6" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 18, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const EditIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polyline points="23 4 23 10 17 10" />
    <Polyline points="1 20 1 14 7 14" />
    <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </Svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <Polyline points="15 3 21 3 21 9" />
    <Line x1="10" y1="14" x2="21" y2="3" />
  </Svg>
);

export const CricketBatIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="m14 7 3-3a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-3 3" />
    <Path d="m14 7-9.5 9.5a2 2 0 0 0-.5 1.5v2a1 1 0 0 0 1 1h2a2 2 0 0 0 1.5-.5L17 11" />
  </Svg>
);

export const AwardIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Circle cx="12" cy="8" r="6" />
    <Path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </Svg>
);

export const LawsIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    <Path d="M6 6h10" />
    <Path d="M6 10h10" />
    <Path d="M6 14h6" />
  </Svg>
);

export const CalculatorIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Rect width="16" height="20" x="4" y="2" rx="2" />
    <Line x1="8" x2="16" y1="6" y2="6" />
    <Line x1="16" x2="16" y1="14" y2="18" />
    <Path d="M16 10h.01" />
    <Path d="M12 10h.01" />
    <Path d="M8 10h.01" />
    <Path d="M12 14h.01" />
    <Path d="M8 14h.01" />
    <Path d="M12 18h.01" />
    <Path d="M8 18h.01" />
  </Svg>
);

