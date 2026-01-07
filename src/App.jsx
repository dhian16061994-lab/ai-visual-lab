import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Video, Camera, FileText, Trash2, Send, 
  Sparkles, AlertCircle, Link, Upload, Copy, Check, 
  Image as ImageIcon, ClipboardCopy, Wand2, MessageSquare, Zap,
  Clapperboard, Music, Layout, Maximize, Download
} from 'lucide-react';

const App = () => {
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('video'); // 'video' or 'image'
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
  const [imageResolution, setImageResolution] = useState('1:1'); // Default resolution

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon.";
    } catch (err) {
      if (retryCount < 5 && err.message.includes('429')) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return callGemini(prompt, base64Image, retryCount + 1);
      }
      throw err;
    }
  };

  const callImagen = async (promptText, aspectRatio, retryCount = 0) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
    const payload = {
      instances: [{ prompt: promptText }],
      parameters: { 
        sampleCount: 1,
        aspectRatio: aspectRatio 
      }
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
          return callImagen(promptText, aspectRatio, retryCount + 1);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Imagen Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.predictions || !data.predictions[0]) {
        throw new Error("Imagen tidak mengembalikan gambar. Cek filter keamanan.");
      }
      return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
    } catch (err) {
      if (retryCount < 5 && err.message.includes('429')) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return callImagen(promptText, aspectRatio, retryCount + 1);
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
      else {
        setError("Format file tidak didukung! Gunakan Video atau Gambar.");
        return;
      }
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
        directorNotes: "",
        audioSuggestions: "",
        status: 'pending',
        progress: 0
      };
    } catch (err) {
      setError("Gagal mengambil snapshot. Pastikan file video valid.");
      return null;
    }
  };

  const handleAddMedia = () => {
    if (mediaType === 'video') {
      const newScene = captureFromVideo();
      if (newScene) setScenes(prev => [...prev, newScene]);
    } else {
      const img = new Image();
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
          directorNotes: "",
          audioSuggestions: "",
          status: 'pending',
          progress: 0
        }]);
      };
      img.src = mediaUrl;
    }
  };

  const removeScene = (id) => {
    setScenes(prev => prev.filter(s => s.id !== id));
  };

  const analyzeScene = async (sceneId, type = 'prompt') => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || scene.status === 'analyzing') return;
    
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'analyzing', progress: 0 } : s));
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 90) currentProgress = 90;
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, progress: Math.floor(currentProgress) } : s));
    }, 300);

    try {
      let systemPrompt = "";
      let fieldToUpdate = "prompt";

      if (type === 'prompt') {
        systemPrompt = "Analyze this image and generate a high-quality image generation prompt. Provide ONLY the prompt text.";
      } else if (type === 'director') {
        systemPrompt = "Analyze this visual scene. Provide cinematic advice: suggest improvements for camera angles, lighting setup, and color grading. Keep it as short bullet points.";
        fieldToUpdate = "directorNotes";
      } else if (type === 'audio') {
        systemPrompt = "Analyze this visual scene. Suggest a matching background music genre and 3 specific sound effects (SFX) that would enhance the immersion.";
        fieldToUpdate = "audioSuggestions";
      }

      const result = await callGemini(systemPrompt, scene.base64);
      
      clearInterval(progressInterval);
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, [fieldToUpdate]: result, status: 'completed', progress: 100 } : s
      ));
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, status: 'error', progress: 0 } : s
      ));
    }
  };

  const processWithGemini = async (mode = 'narasi') => {
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

    const allPrompts = scenes.filter(s => s.status === 'completed').map(s => `[Time: ${s.timestamp}] ${s.prompt}`).join("\n\n");
    
    let fullPrompt = "";
    if (mode === 'narasi') {
      fullPrompt = `Gunakan analisa scene berikut untuk membuat narasi cerita pendek yang dramatis:\n${allPrompts}\n\nInstruksi Tambahan: ${aiInstruction}`;
    } else if (mode === 'storyboard') {
      fullPrompt = `Gunakan analisa scene berikut untuk menyusun struktur 'Hero's Journey' atau arc cerita profesional. Tentukan mana yang menjadi Inciting Incident, Climax, dll:\n${allPrompts}\n\nInstruksi Tambahan: ${aiInstruction}`;
    }
    
    try {
      const result = await callGemini(fullPrompt);
      setAiResponse(result);
      setAiProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(progInterval);
      setIsGeneratingAi(false);
    }
  };

  const generateNewImage = async () => {
    const completedScenes = scenes.filter(s => s.status === 'completed');
    if (completedScenes.length === 0) {
      setError("Butuh setidaknya satu analisa prompt yang selesai!");
      return;
    }
    setIsGeneratingImage(true);
    setGeneratedImageUrl('');
    setImageProgress(0);
    setError(null);

    const progInterval = setInterval(() => {
      setImageProgress(prev => (prev < 95 ? prev + 2 : prev));
    }, 400);

    const basePrompt = completedScenes[completedScenes.length - 1].prompt;
    const finalPrompt = aiInstruction ? `${basePrompt}. Additional context: ${aiInstruction}` : basePrompt;

    try {
      const imageUrl = await callImagen(finalPrompt, imageResolution);
      setGeneratedImageUrl(imageUrl);
      setImageProgress(100);
    } catch (err) {
      setError(`Gagal Imagen: ${err.message}`);
    } finally {
      clearInterval(progInterval);
      setIsGeneratingImage(false);
    }
  };

  const copyToClipboard = (text, id) => {
    if (!text || text === "Siap dianalisa...") return;
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const downloadAsTxt = () => {
    if (!aiResponse) return;
    const blob = new Blob([aiResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_analysis_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-3">
            <Zap className="text-yellow-400 fill-yellow-400" /> AI Visual Lab
          </h1>
          <p className="text-slate-400 text-sm md:text-base">Upload file lokal untuk bedah visual video lo jadi prompt AI & aset kreatif.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sisi Kiri: Upload & Scene Manager (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Upload Section */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload size={20} className="text-indigo-400" /> Media Upload
              </h3>
              
              <label className="cursor-pointer group w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-all p-8 rounded-2xl flex flex-col items-center gap-4">
                <div className="bg-indigo-500/10 p-3 rounded-full group-hover:bg-indigo-500/20 transition-all">
                  <Send size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-center">
                  <span className="block text-sm font-bold mb-1">Klik atau Drag & Drop</span>
                  <span className="text-xs text-slate-500">Video (MP4, WEBM) atau Gambar (JPG, PNG)</span>
                </div>
                <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
              </label>

              {mediaUrl && (
                <div className="mt-6 relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-700 shadow-inner group">
                  {mediaType === 'video' ? (
                    <video ref={videoRef} key={mediaUrl} src={mediaUrl} controls className="w-full h-full" />
                  ) : (
                    <img src={mediaUrl} className="w-full h-full object-contain" alt="Preview" />
                  )}
                  <button 
                    onClick={handleAddMedia} 
                    className="absolute top-4 right-4 bg-cyan-500 hover:bg-cyan-400 p-4 rounded-2xl shadow-xl text-white active:scale-90 transition-all z-10 opacity-0 group-hover:opacity-100"
                    title="Ambil Snapshot/Tambah Gambar"
                  >
                    <Camera size={20} />
                  </button>
                </div>
              )}
            </div>

            {/* Scene Manager Section */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl h-[600px] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="text-cyan-400" /> Scene Manager ({scenes.length})
                </h2>
                {scenes.length > 0 && <button onClick={() => setScenes([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Hapus Semua</button>}
              </div>

              <div className="flex-grow overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {scenes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50 space-y-3 text-center">
                    <div className="bg-slate-800 p-6 rounded-full inline-block mb-2">
                      <Video size={48} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-medium">Capture scene video lo buat mulai bedah!</p>
                  </div>
                ) : (
                  scenes.map((scene) => (
                    <div key={scene.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 group transition-all hover:bg-slate-800/50 relative">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-32 flex-shrink-0 relative">
                          <img src={scene.thumbnail} className="w-full aspect-video object-cover rounded-xl border border-slate-700 shadow-sm" alt="Thumbnail" />
                          <div className="absolute -bottom-1 -right-1 bg-black/90 px-2 py-1 rounded text-[10px] text-cyan-400 font-mono border border-slate-800 shadow-lg">
                            {scene.timestamp === "Static" ? "IMG" : `${scene.timestamp}s`}
                          </div>
                        </div>
                        
                        <div className="flex-grow min-w-0 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${
                              scene.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                              scene.status === 'analyzing' ? 'bg-blue-500/20 text-blue-400' : 
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {scene.status === 'analyzing' ? `${scene.progress}%` : scene.status}
                            </span>
                            <div className="flex gap-1">
                              {/* Tombol Analyze Prompt */}
                              <button 
                                onClick={() => analyzeScene(scene.id, 'prompt')} 
                                disabled={scene.status === 'analyzing'} 
                                className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-cyan-600 transition-all"
                                title="Analisa Prompt"
                              >
                                <Sparkles size={14} />
                              </button>
                              
                              {/* Tombol Copy Prompt (Menggantikan Director's Cut) */}
                              <button 
                                onClick={() => copyToClipboard(scene.prompt, scene.id)} 
                                className={`p-1.5 rounded-lg transition-all ${
                                  copyStatus === scene.id ? 'bg-green-600 text-white' : 'bg-slate-700/50 hover:bg-indigo-600'
                                }`}
                                title="Copy Hasil Prompt"
                                disabled={scene.status !== 'completed'}
                              >
                                {copyStatus === scene.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>

                              {/* Tombol Delete */}
                              <button onClick={() => removeScene(scene.id)} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-red-600 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {scene.status === 'analyzing' && (
                            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scene.progress}%` }} />
                            </div>
                          )}

                          <div className="text-[10px] leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-700/50 text-slate-300 line-clamp-2 group-hover:line-clamp-none transition-all">
                            {scene.prompt}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {scenes.length > 0 && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => scenes.forEach(s => s.status !== 'completed' && analyzeScene(s.id))} className="flex-grow bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg">Analisa Semua</button>
                </div>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Gemini Studio */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-3xl p-6 border border-indigo-500/30 shadow-2xl space-y-6 relative overflow-hidden">
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                <Wand2 size={22} /> Gemini Studio
              </h2>
              
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instruksi Tambahan</span>
                  <textarea 
                    placeholder="Misal: 'Ubah jadi kartun Pixar', 'Gaya 3D futuristik', 'Vibe gelap Noir'"
                    className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none min-h-[120px] resize-none transition-all"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                  />
                </label>

                {/* RESOLUTION SELECTOR */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Maximize size={14} /> Resolusi Gambar
                  </span>
                  <div className="flex gap-2">
                    {['1:1', '16:9', '9:16'].map((res) => (
                      <button
                        key={res}
                        onClick={() => setImageResolution(res)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          imageResolution === res 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {res === '1:1' ? 'Square (1:1)' : res === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => processWithGemini('narasi')}
                    disabled={isGeneratingAi || scenes.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3.5 rounded-2xl font-bold flex flex-col items-center justify-center transition-all overflow-hidden relative text-sm"
                  >
                    <div className="flex items-center gap-2 z-10">
                      {isGeneratingAi ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                      <span>{isGeneratingAi ? `${aiProgress}%` : 'Buat Narasi ✨'}</span>
                    </div>
                    {isGeneratingAi && <div className="absolute left-0 top-0 h-full bg-indigo-400/30 transition-all duration-300" style={{ width: `${aiProgress}%` }} />}
                  </button>
                  <button 
                    onClick={() => processWithGemini('storyboard')}
                    disabled={isGeneratingAi || scenes.length === 0}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-3.5 rounded-2xl font-bold flex flex-col items-center justify-center transition-all overflow-hidden relative text-sm"
                  >
                    <div className="flex items-center gap-2 z-10">
                      <Layout size={16} />
                      <span>Story Arc ✨</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  onClick={generateNewImage}
                  disabled={isGeneratingImage || scenes.length === 0}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all overflow-hidden relative shadow-xl active:scale-95"
                >
                  <div className="flex items-center gap-2 z-10">
                    {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} className="text-yellow-400" />}
                    <span>{isGeneratingImage ? `Melukis ${imageProgress}%` : 'Generate Gambar Baru ✨'}</span>
                  </div>
                  {isGeneratingImage && <div className="absolute left-0 top-0 h-full bg-white/10 transition-all duration-300" style={{ width: `${imageProgress}%` }} />}
                </button>
              </div>

              {aiResponse && (
                <div className="bg-slate-900/90 rounded-2xl p-5 border border-indigo-500/20 max-h-[400px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2 sticky top-0 bg-slate-900/90 z-10">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Hasil Olahan Gemini</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={downloadAsTxt}
                        className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                        title="Download .txt"
                      >
                        <Download size={14} /> Simpan .txt
                      </button>
                      <button onClick={() => copyToClipboard(aiResponse, 'ai-res')} className="text-slate-500 hover:text-white transition-colors">
                        {copyStatus === 'ai-res' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  {aiResponse}
                </div>
              )}

              {generatedImageUrl && (
                <div className="space-y-3 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] uppercase font-bold text-purple-400 tracking-widest flex items-center gap-2"><Sparkles size={12}/> Imagen Result ({imageResolution})</p>
                    <a href={generatedImageUrl} download={`ai-visual-${imageResolution}.png`} className="text-[10px] text-slate-400 hover:text-white underline">Simpan</a>
                  </div>
                  <img src={generatedImageUrl} className="w-full rounded-2xl border border-purple-500/30 shadow-2xl" alt="Generated" />
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-md border border-red-700 text-red-100 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
            <AlertCircle size={20} className="text-red-300" />
            <div className="flex flex-col">
              <span className="text-sm font-bold">Terjadi Kesalahan</span>
              <span className="text-xs opacity-90">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="ml-4 hover:bg-red-800 p-1 rounded-full transition-colors">✕</button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}} />
    </div>
  );
};

export default App;