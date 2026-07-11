import { Lightbulb, FlaskConical, Clapperboard, Music, Gamepad2, Globe, ScrollText, Cpu, Code, Server, Newspaper, Heart } from 'lucide-react';

export const categories = [
  { id: 'general-knowledge', name: 'General Knowledge', apiId: 9, icon: Lightbulb },
  { id: 'science', name: 'Science', apiId: 17, icon: FlaskConical },
  { id: 'movies', name: 'Movies', apiId: 11, icon: Clapperboard },
  { id: 'music', name: 'Music', apiId: 12, icon: Music },
  { id: 'video-games', name: 'Video Games', apiId: 15, icon: Gamepad2 },
  { id: 'geography', name: 'Geography', apiId: 22, icon: Globe },
  { id: 'history', name: 'History', apiId: 23, icon: ScrollText },
  { id: 'technology', name: 'Technology', apiId: 18, icon: Cpu },
  { id: 'frontend', name: 'Front-end Development', apiId: 18, icon: Code },
  { id: 'backend', name: 'Back-end Development', apiId: 18, icon: Server },
  { id: 'current-affairs', name: 'Current Affairs', apiId: 9, icon: Newspaper },
  { id: 'relationships', name: 'Relationship Quiz', icon: Heart },
];
