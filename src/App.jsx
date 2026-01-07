import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Video, Camera, FileText, Trash2, Send, 
  Sparkles, AlertCircle, Link, Upload, Copy, Check, 
  Image as ImageIcon, ClipboardCopy, Wand2, MessageSquare, Zap
} from 'lucide-react';

const App = () => {
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('video'); // 'video' or 'image'
  const [inputUrl, setInputUrl] = useState('');
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  
  // Gemini Studio States
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const apiKey = "AIzaSyCaARU1HUAkW1Jc8AlHFb4zFl6Rkb8mJ-c"; // API key disediakan oleh environment

  // Fungsi pemanggil API Gemini dengan penanganan error & retry
  const callGemini = async (prompt, base64Image = null, retryCount = 0) => {
    const model = "gemini-2.5-flash-preview-09-2025";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const parts = [{ text: prompt }];
    if (base64Image) {
      parts.push({ inlineData: { mimeType: "image/png", data: base64Image } });
    }

    const payload = { contents: [{ parts }] };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429 && retryCount < 5) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return callGemini(prompt, base64Image, retryCount + 1);
        }
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon.";
    } catch (err) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return callGemini(prompt, base64Image, retryCount + 1);
      }
      throw err;
    }
  };

  // Fungsi pemanggil Imagen 4.0 untuk generate gambar
  const callImagen = async (promptText, retryCount = 0) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
    const payload = {
      instances: [{ prompt: promptText }],
      parameters: { sampleCount: 1 }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429 && retryCount < 5) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return callImagen(promptText, retryCount + 1);
        }
        throw new Error(`Imagen Error: ${response.statusText}`);
      }

      const data = await response.json();
      return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    } catch (err) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return callImagen(promptText, retryCount + 1);
      }
      throw err;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (isImage) setMediaType('image');
      else if (isVideo) setMediaType('video');
      setMediaUrl(URL.createObjectURL(file));
      setScenes([]);
      setError(null);
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    try {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      return {
        id: Date.now(),
        timestamp: video.currentTime.toFixed(2),
        thumbnail: canvas.toDataURL('image/png'),
        base64: imageData,
        prompt: "Siap dianalisa...",
        status: 'pending',
        progress: 0
      };
    } catch (err) {
      setError("CORS Error: Gunakan file lokal untuk fitur snapshot.");
      return null;
    }
  };

  const handleAddMedia = () => {
    if (mediaType === 'video') {
      const newScene = captureFromVideo();
      if (newScene) setScenes(prev => [...prev, newScene]);
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = mediaUrl;
      img.onload = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        context.drawImage(img, 0, 0);
        const imageData = canvas.toDataURL('image/png').split(',')[1];
        setScenes(prev => [...prev, {
          id: Date.now(),
          timestamp: "Static",
          thumbnail: canvas.toDataURL('image/png'),
          base64: imageData,
          prompt: "Siap dianalisa...",
          status: 'pending',
          progress: 0
        }]);
      };
    }
  };

  const analyzeScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || scene.status === 'analyzing') return;
    
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'analyzing', progress: 0 } : s));
    
    // Mulai simulasi progress
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 10;
      if (currentProgress > 92) currentProgress = 92; // Mentok di 92% sebelum API selesai
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, progress: Math.floor(currentProgress) } : s));
    }, 400);

    try {
      const systemPrompt = "Analyze this image and generate a high-quality image generation prompt. Provide ONLY the prompt text.";
      const result = await callGemini(systemPrompt, scene.base64);
      
      clearInterval(progressInterval);
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, prompt: result, status: 'completed', progress: 100 } : s
      ));
    } catch (err) {
      clearInterval(progressInterval);
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, prompt: "Error analisa.", status: 'error', progress: 0 } : s
      ));
    }
  };

  // Gemini Studio Actions
  const processWithGemini = async () => {
    if (scenes.length === 0) {
      setError("Belum ada scene yang di-analisa!");
      return;
    }
    setIsGeneratingAi(true);
    setAiResponse('');
    setAiProgress(0);

    const progInterval = setInterval(() => {
      setAiProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 300);

    const allPrompts = scenes.filter(s => s.status === 'completed').map(s => s.prompt).join("\n\n");
    const fullPrompt = `Berikut adalah hasil analisa scene video/gambar:\n${allPrompts}\n\nPerintah User: ${aiInstruction || "Gabungkan semua analisa ini menjadi sebuah narasi cerita pendek yang menarik."}`;
    
    try {
      const result = await callGemini(fullPrompt);
      setAiResponse(result);
      setAiProgress(100);
    } catch (err) {
      setError("Gagal memproses dengan Gemini.");
    } finally {
      clearInterval(progInterval);
      setIsGeneratingAi(false);
    }
  };

  const generateNewImage = async () => {
    const completedScenes = scenes.filter(s => s.status === 'completed');
    if (completedScenes.length === 0) {
      setError("Butuh setidaknya satu analisa yang selesai!");
      return;
    }
    setIsGeneratingImage(true);
    setGeneratedImageUrl('');
    setImageProgress(0);

    const progInterval = setInterval(() => {
      setImageProgress(prev => (prev < 95 ? prev + 2 : prev));
    }, 400);

    const basePrompt = completedScenes[completedScenes.length - 1].prompt;
    const finalPrompt = aiInstruction ? `${basePrompt}. Additional context: ${aiInstruction}` : basePrompt;

    try {
      const imageUrl = await callImagen(finalPrompt);
      setGeneratedImageUrl(imageUrl);
      setImageProgress(100);
    } catch (err) {
      setError("Gagal membuat gambar dengan Imagen.");
    } finally {
      clearInterval(progInterval);
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = (text, id) => {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-3">
            <Zap className="text-yellow-400 fill-yellow-400" /> AI Visual Lab
          </h1>
          <p className="text-slate-400 text-sm md:text-base">Bedah visual video lo jadi prompt AI dengan Gemini 2.5 Flash.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sisi Kiri: Input & Gemini Studio */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
              <div className="flex bg-slate-800 p-1 rounded-2xl mb-6">
                <button onClick={() => setUploadMode('file')} className={`flex-1 py-2.5 rounded-xl transition-all font-medium ${uploadMode === 'file' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>File Lokal</button>
                <button onClick={() => setUploadMode('url')} className={`flex-1 py-2.5 rounded-xl transition-all font-medium ${uploadMode === 'url' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Link URL</button>
              </div>

              {uploadMode === 'file' ? (
                <label className="cursor-pointer group w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-all p-8 rounded-2xl flex flex-col items-center gap-2">
                  <Upload size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Upload Video atau Gambar</span>
                  <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setMediaUrl(inputUrl); }} className="flex gap-2">
                  <input type="text" placeholder="Paste link video/gambar..." className="flex-grow bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-sm focus:border-indigo-500 outline-none transition-all" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} />
                  <button type="submit" className="bg-indigo-600 px-6 rounded-2xl font-bold hover:bg-indigo-500 transition-colors">Load</button>
                </form>
              )}

              {mediaUrl && (
                <div className="mt-6 relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-700 shadow-inner group">
                  {mediaType === 'video' ? <video ref={videoRef} key={mediaUrl} src={mediaUrl} controls crossOrigin="anonymous" className="w-full h-full" /> : <img src={mediaUrl} className="w-full h-full object-contain" alt="Preview" />}
                  <button onClick={handleAddMedia} className="absolute top-4 right-4 bg-cyan-500 hover:bg-cyan-400 p-4 rounded-2xl shadow-xl text-white active:scale-90 transition-all z-10 opacity-0 group-hover:opacity-100"><Camera size={20} /></button>
                </div>
              )}
            </div>
            
            {/* Gemini Studio */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-3xl p-6 border border-indigo-500/30 shadow-2xl space-y-4 relative overflow-hidden">
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                <Wand2 size={22} /> Gemini Studio
              </h2>
              <textarea 
                placeholder="Mau dibikinin apa? (Contoh: 'Buat script iklan dari semua scene ini' atau 'Bikin versi futuristik')"
                className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none min-h-[100px] resize-none transition-all placeholder:text-slate-600"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={processWithGemini}
                  disabled={isGeneratingAi || scenes.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all overflow-hidden relative"
                >
                  <div className="flex items-center gap-2 z-10">
                    {isGeneratingAi ? <Loader2 className="animate-spin" size={18} /> : <MessageSquare size={18} />}
                    <span>{isGeneratingAi ? `${aiProgress}%` : 'Buat Narasi'}</span>
                  </div>
                  {isGeneratingAi && <div className="absolute left-0 top-0 h-full bg-indigo-400/30 transition-all duration-300" style={{ width: `${aiProgress}%` }} />}
                </button>
                <button 
                  onClick={generateNewImage}
                  disabled={isGeneratingImage || scenes.length === 0}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 py-3 rounded-xl font-bold flex flex-col items-center justify-center transition-all overflow-hidden relative"
                >
                  <div className="flex items-center gap-2 z-10">
                    {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                    <span>{isGeneratingImage ? `${imageProgress}%` : 'Buat Gambar'}</span>
                  </div>
                  {isGeneratingImage && <div className="absolute left-0 top-0 h-full bg-purple-400/30 transition-all duration-300" style={{ width: `${imageProgress}%` }} />}
                </button>
              </div>

              {aiResponse && (
                <div className="bg-slate-900/90 rounded-2xl p-4 border border-indigo-500/20 max-h-[200px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2 sticky top-0 bg-slate-900/90">
                    <span className="text-[10px] uppercase font-bold text-indigo-400">Hasil Narasi Gemini</span>
                    <button onClick={() => copyToClipboard(aiResponse, 'ai-res')} className="text-slate-500 hover:text-white transition-colors">
                      {copyStatus === 'ai-res' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {aiResponse}
                </div>
              )}

              {generatedImageUrl && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] uppercase font-bold text-purple-400">Hasil lukisan Imagen 4.0</p>
                  <img src={generatedImageUrl} className="w-full rounded-2xl border border-purple-500/30 shadow-lg" alt="Generated" />
                </div>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Daftar Scene & Progress */}
          <div className="flex flex-col h-[calc(100vh-14rem)]">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl flex-grow flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Daftar Analisa ({scenes.length})
                </h2>
                {scenes.length > 0 && <button onClick={() => setScenes([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Hapus Semua</button>}
              </div>

              <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {scenes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50 space-y-3">
                    <ImageIcon size={64} strokeWidth={1} />
                    <p className="text-sm font-medium">Belum ada scene. Ambil snapshot dulu ya!</p>
                  </div>
                ) : (
                  scenes.map((scene) => (
                    <div key={scene.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 group transition-all hover:bg-slate-800/50">
                      <div className="flex gap-4">
                        <div className="w-24 flex-shrink-0 relative">
                          <img src={scene.thumbnail} className="w-full aspect-video object-cover rounded-xl border border-slate-700 shadow-sm" alt="Thumbnail" />
                          <div className="absolute -bottom-1 -right-1 bg-black/90 px-1.5 py-0.5 rounded text-[8px] text-cyan-400 font-mono border border-slate-800">
                            {scene.timestamp === "Static" ? "IMG" : `${scene.timestamp}s`}
                          </div>
                        </div>
                        <div className="flex-grow min-w-0 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                scene.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                scene.status === 'analyzing' ? 'bg-blue-500/20 text-blue-400' : 
                                'bg-slate-700 text-slate-400'
                              }`}>
                                {scene.status === 'analyzing' ? `Analisa ${scene.progress}%` : scene.status}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {scene.status === 'completed' && (
                                <button onClick={() => copyToClipboard(scene.prompt, scene.id)} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-indigo-600 transition-all">
                                  {copyStatus === scene.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                </button>
                              )}
                              <button 
                                onClick={() => analyzeScene(scene.id)} 
                                disabled={scene.status === 'analyzing'} 
                                className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-cyan-600 transition-all disabled:opacity-30"
                              >
                                {scene.status === 'analyzing' ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                              </button>
                              <button onClick={() => removeScene(scene.id)} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-red-600 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {/* Progress Bar Mini */}
                          {scene.status === 'analyzing' && (
                            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-300" 
                                style={{ width: `${scene.progress}%` }}
                              />
                            </div>
                          )}

                          <div className={`text-[11px] leading-relaxed bg-slate-900/40 p-2.5 rounded-xl border border-slate-700/50 text-slate-300 ${scene.status === 'completed' ? 'line-clamp-3 group-hover:line-clamp-none' : 'italic'} transition-all`}>
                            {scene.prompt}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {scenes.length > 0 && (
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => scenes.forEach(s => s.status !== 'completed' && analyzeScene(s.id))} 
                    className="flex-grow bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Sparkles size={18} /> Analisa Semua
                  </button>
                  <button 
                    onClick={() => copyToClipboard(scenes.filter(s => s.status === 'completed').map(s => s.prompt).join('\n\n'), 'all')} 
                    className="bg-slate-800 px-6 rounded-2xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    {copyStatus === 'all' ? <Check className="text-green-400" size={20} /> : <ClipboardCopy size={20} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifikasi Error */}
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-md border border-red-700 text-red-100 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
            <AlertCircle size={20} className="text-red-300" />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:bg-red-800 p-1 rounded-full">✕</button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}} />
    </div>
  );
};
export default App;