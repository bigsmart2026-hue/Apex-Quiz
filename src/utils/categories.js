import { Lightbulb, FlaskConical, Clapperboard, Music, Gamepad2, Globe, ScrollText, Cpu, Code, Server, Newspaper, Heart, Shield, Megaphone, Palette, BarChart3, Smartphone } from 'lucide-react';

/**
 * Category definitions.
 * - `apiId` categories are served by the Open Trivia DB API (with local/Firestore fallback).
 * - Categories without `apiId` are served by the local question bank (or Firestore).
 */
export const categories = [
  { id: 'general-knowledge', name: 'General Knowledge', apiId: 9, icon: Lightbulb },
  { id: 'science', name: 'Science', apiId: 17, icon: FlaskConical },
  { id: 'movies', name: 'Movies', apiId: 11, icon: Clapperboard },
  { id: 'music', name: 'Music', apiId: 12, icon: Music },
  { id: 'video-games', name: 'Video Games', apiId: 15, icon: Gamepad2 },
  { id: 'geography', name: 'Geography', apiId: 22, icon: Globe },
  { id: 'history', name: 'History', apiId: 23, icon: ScrollText },
  { id: 'technology', name: 'Technology', apiId: 18, icon: Cpu },
  { id: 'frontend', name: 'Front-end Development', icon: Code },
  { id: 'backend', name: 'Back-end Development', icon: Server },
  { id: 'current-affairs', name: 'Current Affairs', icon: Newspaper },
  { id: 'relationships', name: 'Relationship Quiz', icon: Heart },
  { id: 'cybersecurity', name: 'Cybersecurity', icon: Shield },
  { id: 'digital-marketing', name: 'Digital Marketing', icon: Megaphone },
  { id: 'product-design', name: 'Product Design', icon: Palette },
  { id: 'data-analytics', name: 'Data Analytics', icon: BarChart3 },
  { id: 'mobile-app-dev', name: 'Mobile App Development', icon: Smartphone },
];