
import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode, ViewMode, SlideContent, MindMapTheme } from './types';
import MindMapCanvas, { MindMapCanvasHandle } from './components/MindMapCanvas';
import SlidePreview from './components/SlidePreview';
import { generateSlideContent, generateThemeSuggestions, generateSlideImage } from './services/geminiService';

const STORAGE_KEY = 'ai-mind-mapper-data-v2'; // 座標データを含む新バージョン

const defaultTheme: MindMapTheme = {
  id: 'default',
  name: 'デフォルト',
  backgroundColor: '#f8fafc',
  nodeColor: '#ffffff',
  nodeTextColor: '#334155',
  linkColor: '#cbd5e1',
  accentColor: '#4f46e5',
  thumbnailPrompt: 'clean professional blue and white design'
};

const initialData: MindMapNode = {
  id: 'root',
  text: 'メインアイデア',
  x: 0,
  y: 0,
  children: [
    { id: '1', text: '構造', parentId: 'root', x: 250, y: -100, children: [] },
    { id: '2', text: 'デザイン', parentId: 'root', x: 250, y: 100, children: [] },
  ]
};

const App: React.FC = () => {
  const [mapData, setMapData] = useState<MindMapNode>(initialData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<MindMapTheme>(defaultTheme);
  const [themeSuggestions, setThemeSuggestions] = useState<MindMapTheme[]>([]);
  const [isSuggestingThemes, setIsSuggestingThemes] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const canvasRef = useRef<MindMapCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ローカルストレージからの読み込み
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { mapData: savedMap, theme: savedTheme } = JSON.parse(saved);
        if (savedMap) setMapData(savedMap);
        if (savedTheme) setCurrentTheme(savedTheme);
      } catch (e) {
        console.error("Failed to load saved data", e);
      }
    }
  }, []);

  // ローカルストレージへの保存
  useEffect(() => {
    const dataToSave = JSON.stringify({ mapData, theme: currentTheme });
    localStorage.setItem(STORAGE_KEY, dataToSave);
  }, [mapData, currentTheme]);

  const updateTree = (node: MindMapNode, targetId: string, action: (node: MindMapNode) => void): MindMapNode => {
    if (node.id === targetId) {
      const newNode = { ...node };
      action(newNode);
      return newNode;
    }
    return {
      ...node,
      children: node.children.map(child => updateTree(child, targetId, action))
    };
  };

  const findNode = (node: MindMapNode, id: string): MindMapNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };

  const findParent = (node: MindMapNode, childId: string): MindMapNode | null => {
    if (node.children.some(c => c.id === childId)) return node;
    for (const child of node.children) {
      const p = findParent(child, childId);
      if (p) return p;
    }
    return null;
  };

  const handleAddChild = useCallback(() => {
    if (!selectedId) return;
    const parentNode = findNode(mapData, selectedId);
    if (!parentNode) return;

    const newId = Math.random().toString(36).substr(2, 9);
    const newX = (parentNode.x ?? 0) + 300;
    const newY = (parentNode.y ?? 0) + (parentNode.children.length * 80 - (parentNode.children.length * 40));

    setMapData(prev => updateTree(prev, selectedId, (node) => {
      node.children.push({ id: newId, text: '新しいトピック', parentId: selectedId, x: newX, y: newY, children: [] });
    }));
    setSelectedId(newId);
    setTimeout(() => canvasRef.current?.startEditing(newId), 0);
  }, [selectedId, mapData]);

  const handleAddSibling = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    const parent = findParent(mapData, selectedId);
    if (!parent) return;

    const newId = Math.random().toString(36).substr(2, 9);
    const newX = (parent.x ?? 0) + 300;
    const newY = (parent.y ?? 0) + (parent.children.length * 80);

    setMapData(prev => updateTree(prev, parent.id, (node) => {
      node.children.push({ id: newId, text: '新しいトピック', parentId: parent.id, x: newX, y: newY, children: [] });
    }));
    setSelectedId(newId);
    setTimeout(() => canvasRef.current?.startEditing(newId), 0);
  }, [selectedId, mapData]);

  const handleDelete = useCallback(() => {
    if (!selectedId || selectedId === 'root') return;
    const parent = findParent(mapData, selectedId);
    if (!parent) return;

    setMapData(prev => updateTree(prev, parent.id, (node) => {
      node.children = node.children.filter(c => c.id !== selectedId);
    }));
    setSelectedId(parent.id);
  }, [selectedId, mapData]);

  const handleTextChange = useCallback((id: string, text: string) => {
    setMapData(prev => updateTree(prev, id, (node) => {
      node.text = text;
    }));
  }, []);

  const handlePositionChange = useCallback((id: string, x: number, y: number) => {
    setMapData(prev => updateTree(prev, id, (node) => {
      node.x = x;
      node.y = y;
    }));
  }, []);

  const handleAutoAlign = () => {
    const newData = JSON.parse(JSON.stringify(mapData));
    const newRoot = d3.hierarchy(newData);
    const treeLayout = d3.tree<MindMapNode>().nodeSize([100, 300]);
    treeLayout(newRoot);
    
    const finalData = { ...newData };
    const traverse = (n: any, dn: any) => {
        // ルートを(0,0)基準にする
        n.x = dn.y;
        n.y = dn.x;
        if(n.children) {
            n.children.forEach((c: any, i: number) => traverse(c, dn.children[i]));
        }
    };
    traverse(finalData, newRoot);
    setMapData(finalData);
  };

  const handleGenerateSlides = async () => {
    setIsGenerating(true);
    try {
      const generatedSlides = await generateSlideContent(mapData);
      setSlides(generatedSlides);
      setViewMode('slides');
    } catch (error) {
      alert("スライドの生成に失敗しました。APIキーを確認してください。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestThemes = async () => {
    setIsSuggestingThemes(true);
    setShowThemePanel(true);
    try {
      const suggestions = await generateThemeSuggestions(mapData);
      const themesWithImages = await Promise.all(suggestions.map(async (theme) => {
        const url = await generateSlideImage(theme.thumbnailPrompt);
        return { ...theme, thumbnailUrl: url || undefined };
      }));
      setThemeSuggestions(themesWithImages);
    } catch (error) {
      console.error("Theme suggestion failed", error);
    } finally {
      setIsSuggestingThemes(false);
    }
  };

  const applyTheme = (theme: MindMapTheme) => {
    setCurrentTheme(theme);
    setShowThemePanel(false);
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({ mapData, theme: currentTheme }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'mindmap.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = event.target.files?.[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (content.mapData) setMapData(content.mapData);
        if (content.theme) setCurrentTheme(content.theme);
        alert("インポートが完了しました。");
      } catch (err) {
        alert("JSONファイルの形式が正しくありません。");
      }
    };
    fileReader.readAsText(file);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'map') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAddChild();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSibling();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDelete();
      } else if (e.key.toLowerCase() === 'e') {
        if (selectedId) {
          e.preventDefault();
          canvasRef.current?.startEditing(selectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, selectedId, handleAddChild, handleAddSibling, handleDelete]);

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <i className="fa-solid fa-sitemap text-xl"></i>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">AI マインドマッパー</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border-r border-slate-200 pr-3 mr-3 gap-2">
            <button onClick={handleAutoAlign} className="flex items-center gap-2 px-4 py-2 rounded-full font-bold border border-slate-200 hover:bg-slate-50 transition-all text-indigo-600" title="自動で整列">
              <i className="fa-solid fa-wand-magic"></i>
              <span>整列</span>
            </button>
            <button onClick={exportJSON} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title="JSONを書き出し">
              <i className="fa-solid fa-file-export"></i>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-indigo-600 transition-colors" title="JSONを読み込み">
              <i className="fa-solid fa-file-import"></i>
            </button>
            <input type="file" ref={fileInputRef} onChange={importJSON} accept=".json" className="hidden" />
          </div>

          <button 
            onClick={handleSuggestThemes}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold border border-slate-200 hover:bg-slate-50 transition-all text-slate-600"
          >
            <i className="fa-solid fa-palette"></i>
            <span>テーマ提案</span>
          </button>
          
          <button 
            onClick={handleGenerateSlides}
            disabled={isGenerating}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all
              ${isGenerating 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
              }
            `}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>生成中...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>スライド生成</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 relative">
        {viewMode === 'map' ? (
          <MindMapCanvas 
            ref={canvasRef}
            data={mapData} 
            selectedId={selectedId} 
            theme={currentTheme}
            onSelect={setSelectedId} 
            onTextChange={handleTextChange}
            onPositionChange={handlePositionChange}
          />
        ) : (
          <SlidePreview slides={slides} onBack={() => setViewMode('map')} />
        )}

        {showThemePanel && (
          <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <h2 className="font-bold text-lg flex items-center gap-2">
                 <i className="fa-solid fa-sparkles text-indigo-500"></i>
                 AI テーマ提案
               </h2>
               <button onClick={() => setShowThemePanel(false)} className="text-slate-400 hover:text-slate-600">
                 <i className="fa-solid fa-xmark"></i>
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isSuggestingThemes ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="text-slate-500 text-sm animate-pulse">テーマをデザイン中...</p>
                </div>
              ) : themeSuggestions.length > 0 ? (
                themeSuggestions.map((theme) => (
                  <div 
                    key={theme.id}
                    onClick={() => applyTheme(theme)}
                    className="group cursor-pointer bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden hover:border-indigo-400 hover:shadow-xl transition-all"
                  >
                    <div className="aspect-[2/1] bg-slate-200 relative">
                       {theme.thumbnailUrl ? (
                         <img src={theme.thumbnailUrl} className="w-full h-full object-cover" alt={theme.name} />
                       ) : (
                         <div className="absolute inset-0 flex items-center justify-center" style={{ background: theme.backgroundColor }}>
                           <div className="w-8 h-8 rounded-full" style={{ background: theme.accentColor }}></div>
                         </div>
                       )}
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800">{theme.name}</span>
                        <div className="flex gap-1">
                          <div className="w-3 h-3 rounded-full border border-slate-300" style={{ background: theme.backgroundColor }} />
                          <div className="w-3 h-3 rounded-full border border-slate-300" style={{ background: theme.nodeColor }} />
                          <div className="w-3 h-3 rounded-full border border-slate-300" style={{ background: theme.accentColor }} />
                        </div>
                      </div>
                      <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                        テーマを適用
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 px-6">
                   <p className="text-slate-400 text-sm">テーマがまだありません。「テーマ提案」をクリックしてください。</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
            <div className="text-center p-12 bg-white rounded-3xl shadow-2xl border border-indigo-100 flex flex-col items-center max-w-sm animate-in fade-in zoom-in duration-300">
              <div className="relative mb-8">
                <div className="w-24 h-24 border-8 border-indigo-50/50 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 border-t-8 border-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <i className="fa-solid fa-sparkles text-3xl"></i>
                </div>
              </div>
              <h3 className="text-2xl font-black mb-3 text-slate-800 tracking-tight">AI プレゼンター準備中</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                トピックを分析し、最適な構成のスライドと高品質な画像を生成しています。
              </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
