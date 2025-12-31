
import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, SlideContent, MindMapTheme } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transforms a mind map tree into structured slide content using Gemini Pro.
 */
export async function generateSlideContent(rootNode: MindMapNode): Promise<SlideContent[]> {
  const prompt = `
    マインドマップを元に、プレゼンテーション用のスライド構成を作成してください。
    マインドマップの構造: ${JSON.stringify(rootNode)}

    各スライドには以下を含めてください：
    - タイトル (title)
    - 箇条書きポイント (bullets)
    - そのスライドの内容を象徴する視覚的なイメージのプロンプト (imagePrompt) - 英語で生成してください。

    返り値は日本語のJSON形式の配列でお願いします。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
            imagePrompt: { type: Type.STRING }
          },
          required: ["title", "bullets", "imagePrompt"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}

/**
 * Generates theme suggestions based on the mind map's central topics.
 */
export async function generateThemeSuggestions(rootNode: MindMapNode): Promise<MindMapTheme[]> {
  const prompt = `
    マインドマップの内容を分析し、それにふさわしいデザインテーマを3つ提案してください。
    内容: ${JSON.stringify(rootNode)}

    各テーマには以下の属性を含めてください：
    - name: テーマ名 (例: 「サイバーパンク」「ナチュラル・オーガニック」など)
    - backgroundColor: 背景色 (Hex)
    - nodeColor: ノードの色 (Hex)
    - nodeTextColor: ノードのテキスト色 (Hex)
    - linkColor: 線の色 (Hex)
    - accentColor: アクセント色 (Hex)
    - thumbnailPrompt: このテーマの雰囲気を表す画像のプロンプト (英語)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            backgroundColor: { type: Type.STRING },
            nodeColor: { type: Type.STRING },
            nodeTextColor: { type: Type.STRING },
            linkColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            thumbnailPrompt: { type: Type.STRING }
          },
          required: ["name", "backgroundColor", "nodeColor", "nodeTextColor", "linkColor", "accentColor", "thumbnailPrompt"]
        }
      }
    }
  });

  try {
    const themes = JSON.parse(response.text);
    return themes.map((t: any, i: number) => ({ ...t, id: `theme-${i}-${Date.now()}` }));
  } catch (e) {
    console.error("Failed to parse theme response", e);
    return [];
  }
}

/**
 * Generates an image for a slide or theme thumbnail using the Gemini Flash Image model.
 */
export async function generateSlideImage(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `High-quality aesthetic illustration for: ${prompt}. Minimalistic, professional, 4k, artistic style.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation failed", e);
    return null;
  }
}
