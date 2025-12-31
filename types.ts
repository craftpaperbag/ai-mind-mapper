
export interface MindMapNode {
  id: string;
  text: string;
  children: MindMapNode[];
  parentId?: string;
  x?: number;
  y?: number;
}

export interface SlideContent {
  title: string;
  bullets: string[];
  imagePrompt?: string;
  imageUrl?: string;
}

export interface MindMapTheme {
  id: string;
  name: string;
  backgroundColor: string;
  nodeColor: string;
  nodeTextColor: string;
  linkColor: string;
  accentColor: string;
  thumbnailPrompt: string;
  thumbnailUrl?: string;
}

export type ViewMode = 'map' | 'slides';
