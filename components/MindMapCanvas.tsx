
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode, MindMapTheme } from '../types';

interface Props {
  data: MindMapNode;
  selectedId: string | null;
  theme: MindMapTheme;
  onSelect: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}

export interface MindMapCanvasHandle {
  startEditing: (id: string) => void;
}

const getTextWidth = (text: string, font: string): number => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = font;
    return context.measureText(text).width;
  }
  return text.length * 10;
};

const MindMapCanvas = forwardRef<MindMapCanvasHandle, Props>(({ data, selectedId, theme, onSelect, onTextChange, onPositionChange }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const zoomRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    startEditing: (id: string) => {
      setEditingId(id);
    }
  }));

  useEffect(() => {
    if (!svgRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const fontStyle = "500 16px 'Inter', sans-serif";

    const svg = d3.select(svgRef.current);
    
    // 初回のみズーム設定を行う
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 5])
        .on("zoom", (event) => {
          svg.select(".main-container").attr("transform", event.transform);
        });
      svg.call(zoomRef.current);
      
      // 完全な中央配置: root(0,0)が画面の真ん中に来るように
      // ノードは(0, -rectHeight/2)から描画されるので、厳密には少し左にずらして調整
      const initialTransform = d3.zoomIdentity.translate(width / 2 - 50, height / 2).scale(1);
      svg.call(zoomRef.current.transform, initialTransform);
    }

    // 既存の内容をクリアして再描画（状態変更に対応）
    svg.selectAll(".main-container").remove();
    const g = svg.append("g").attr("class", "main-container");

    // 現在のズーム状態を適用
    const currentTransform = d3.zoomTransform(svgRef.current);
    g.attr("transform", currentTransform.toString());

    const root = d3.hierarchy(data);
    const nodes = root.descendants();
    const links = root.links();

    // 線の描画
    const linkGroup = g.append("g")
      .attr("fill", "none")
      .attr("stroke", theme.linkColor)
      .attr("stroke-width", 2);

    const renderLinks = () => {
      linkGroup.selectAll("path")
        .data(links)
        .join("path")
        .attr("d", (d: any) => {
          const sX = d.source.data.x ?? 0;
          const sY = d.source.data.y ?? 0;
          const tX = d.target.data.x ?? 0;
          const tY = d.target.data.y ?? 0;
          
          const sWidth = getTextWidth(d.source.data.text, fontStyle) + 20;
          
          const linkGen = d3.linkHorizontal()
            .x((d: any) => d.x)
            .y((d: any) => d.y);
            
          return linkGen({
            source: { x: sX + sWidth, y: sY },
            target: { x: tX, y: tY }
          } as any);
        });
    };

    // ノードの描画
    const nodeGroup = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", d => `translate(${d.data.x ?? 0},${d.data.y ?? 0})`)
      .style("cursor", "grab")
      .on("mousedown", (event, d) => {
        onSelect(d.data.id);
      });

    // ドラッグ挙動
    const drag = d3.drag<SVGGElement, any>()
      .on("start", function() {
        d3.select(this).raise().style("cursor", "grabbing");
      })
      .on("drag", function(event, d) {
        d.data.x += event.dx;
        d.data.y += event.dy;
        d3.select(this).attr("transform", `translate(${d.data.x},${d.data.y})`);
        renderLinks();
      })
      .on("end", function(event, d) {
        d3.select(this).style("cursor", "grab");
        onPositionChange(d.data.id, d.data.x, d.data.y);
      });

    nodeGroup.call(drag as any);

    nodeGroup.each(function(d: any) {
      const textWidth = getTextWidth(d.data.text, fontStyle);
      const rectWidth = Math.max(80, textWidth + 40);
      const rectHeight = 44;

      const group = d3.select(this);

      group.append("rect")
        .attr("rx", 12)
        .attr("ry", 12)
        .attr("y", -rectHeight / 2)
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("fill", d.data.id === selectedId ? theme.accentColor : theme.nodeColor)
        .attr("stroke", d.data.id === selectedId ? theme.nodeTextColor : theme.linkColor)
        .attr("stroke-width", d.data.id === selectedId ? 3 : 1)
        .attr("class", "shadow-sm transition-colors duration-150");

      group.append("text")
        .attr("dy", "0.35em")
        .attr("x", 20)
        .attr("fill", d.data.id === selectedId ? '#fff' : theme.nodeTextColor)
        .attr("style", `font: ${fontStyle}`)
        .attr("class", "pointer-events-none select-none font-medium")
        .text(d.data.text);
    });

    renderLinks();

  }, [data, selectedId, theme]);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: theme.backgroundColor }}>
      <svg ref={svgRef} className="w-full h-full" />
      
      {editingId && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-500/10 backdrop-blur-[2px] z-50">
           <div 
             className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 animate-in zoom-in duration-200 flex flex-col items-center"
             onMouseDown={(e) => e.stopPropagation()} 
           >
             <label className="block text-xs font-black text-indigo-500 uppercase mb-4 tracking-[0.2em] self-start">トピックを更新</label>
             <input
                autoFocus
                className="text-2xl font-bold bg-slate-50 border-2 border-indigo-400 rounded-2xl px-6 py-4 outline-none focus:ring-8 focus:ring-indigo-500/10 min-w-[400px] text-slate-800"
                defaultValue={findNodeById(data, editingId)?.text}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    onTextChange(editingId, (e.target as HTMLInputElement).value);
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => setEditingId(null)}
             />
             <div className="flex gap-4 mt-4 self-end text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Enter で保存</span>
                <span>•</span>
                <span>Esc でキャンセル</span>
             </div>
           </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 flex items-center gap-3">
        <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200 flex gap-1">
          <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">自由配置モード</div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 text-[11px] text-slate-500 bg-white/90 p-4 rounded-xl border border-slate-200 backdrop-blur-md shadow-lg">
        <div className="flex justify-between gap-6"><span>ドラッグ</span> <span className="text-indigo-500 font-bold">移動</span></div>
        <div className="flex justify-between gap-6"><span>子ノード追加</span> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded shadow-sm">Tab</kbd></div>
        <div className="flex justify-between gap-6"><span>兄弟ノード追加</span> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded shadow-sm">Enter</kbd></div>
        <div className="flex justify-between gap-6"><span>編集モード</span> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded shadow-sm">E</kbd></div>
        <div className="flex justify-between gap-6"><span>ノード削除</span> <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded shadow-sm">Del</kbd></div>
      </div>
    </div>
  );
});

function findNodeById(node: MindMapNode, id: string): MindMapNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export default MindMapCanvas;
