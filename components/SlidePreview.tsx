
import React, { useState, useEffect } from 'react';
import { SlideContent } from '../types';
import { generateSlideImage } from '../services/geminiService';

interface Props {
  slides: SlideContent[];
  onBack: () => void;
}

const SlidePreview: React.FC<Props> = ({ slides, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const currentSlide = slides[currentIndex];

  useEffect(() => {
    const fetchImage = async () => {
      if (!currentSlide.imagePrompt || slideImages[currentIndex] || loading[currentIndex]) return;
      
      setLoading(prev => ({ ...prev, [currentIndex]: true }));
      const url = await generateSlideImage(currentSlide.imagePrompt);
      if (url) {
        setSlideImages(prev => ({ ...prev, [currentIndex]: url }));
      }
      setLoading(prev => ({ ...prev, [currentIndex]: false }));
    };
    fetchImage();
  }, [currentIndex, currentSlide, slideImages, loading]);

  const next = () => setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1));
  const prev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  if (slides.length === 0) {
      return (
          <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-white p-6">
              <p className="text-xl mb-6">スライドがまだ生成されていません。</p>
              <button onClick={onBack} className="bg-white text-slate-900 px-6 py-2 rounded-full font-bold">マインドマップに戻る</button>
          </div>
      )
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col overflow-hidden text-slate-100">
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <button 
          onClick={onBack}
          className="hover:bg-slate-800 p-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>編集に戻る</span>
        </button>
        <div className="text-sm font-medium text-slate-400">
          スライド {currentIndex + 1} / {slides.length}
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row p-8 gap-8 items-center justify-center max-w-7xl mx-auto w-full">
        <div className="flex-1 space-y-8">
          <h1 className="text-5xl md:text-6xl font-black leading-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {currentSlide.title}
          </h1>
          <ul className="space-y-4">
            {currentSlide.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3 text-xl md:text-2xl text-slate-300">
                <span className="mt-2 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 w-full max-w-2xl">
          <div className="aspect-video bg-slate-800 rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700">
            {loading[currentIndex] ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-800">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                <p className="text-slate-400 animate-pulse">AIが画像を生成中...</p>
              </div>
            ) : slideImages[currentIndex] ? (
              <img 
                src={slideImages[currentIndex]} 
                alt="AI generated visual" 
                className="w-full h-full object-cover animate-in fade-in zoom-in duration-500"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                <i className="fa-solid fa-image text-6xl"></i>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 flex justify-center gap-4">
        <button 
          onClick={prev}
          disabled={currentIndex === 0}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all"
        >
          <i className="fa-solid fa-chevron-left text-xl"></i>
        </button>
        <button 
          onClick={next}
          disabled={currentIndex === slides.length - 1}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 transition-all shadow-lg shadow-indigo-500/20"
        >
          <i className="fa-solid fa-chevron-right text-xl"></i>
        </button>
      </div>

      <div className="h-1.5 w-full bg-slate-800">
        <div 
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default SlidePreview;
