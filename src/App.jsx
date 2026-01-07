import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, Video, Camera, FileText, Trash2, Send, 
  Sparkles, AlertCircle, Link, Upload, Copy, Check, 
  Image as ImageIcon, ClipboardCopy, Wand2, MessageSquare, Zap,
  Clapperboard, Music, Layout, Maximize, Download, RotateCcw
} from 'lucide-react';

const App = () => {
  // ==========================================
  // 1. SISTEM KEAMANAN (LOCK SCREEN)
  // ==========================================
  const [accessCode, setAccessCode] = useState('');
  const [isLocked, setIsLocked] = useState(true);

  // Daftar kode akses lo. Edit di sini untuk menambah user.
  const validCodes = ["LAB-PREMIUM-01", "MARCHO-SPECIAL-99", "COBA-AI-123"]; 
  
  // Pengaturan WhatsApp lo
  const myWhatsAppNumber = "628979768590"; // <--- GANTI NOMOR ASLI LO DI SINI
  const waMessage = encodeURIComponent("Halo Marcho, saya mau beli kode akses AI Visual Lab. Berapa harganya?");

  const handleUnlock = () => {
    if (validCodes.includes(accessCode.trim())) {
      setIsLocked(false);
    } else {
      alert("Kode akses salah!");
    }
  };

  // ==========================================
  // 2. STATE APLIKASI UTAMA (VERSI TERLENGKAP)
  // ==========================================
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('video');
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [refinedPrompt, setRefinedPrompt] = useState('');
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [refineProgress, setRefineProgress] = useState(0);
  const [imageResolution, setImageResolution] = useState('1:1');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // ==========================================
  // 3. FUNGSI LOGIKA (API & HANDLERS)
  // ==========================================
  const callGemini = async (prompt, base64Image = null, retryCount = 0) => {
    // Menggunakan model yang ada di kode terbaru lo
    const model = "gemini-2.5-flash-preview-09-2025"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const parts = [{ text: prompt }];
    if (base64Image) { parts.push({ inlineData: { mimeType: "image/png", data: base64Image } }); }
    const payload = { contents: [{ parts }] };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon.";
    } catch (err) { throw err; }
  };

  const addMediaToScenes = (type, url) => {
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
        status: 'pending',
        progress: 0
      }]);
    };
    img.src = url;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setMediaUrl(objectUrl);
      setScenes([]);
      setError(null);
      if (file.type.startsWith('image/')) {
        setMediaType('image');
        addMediaToScenes('image', objectUrl);
      } else {
        setMediaType('video');
      }
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
      setScenes(prev => [...prev, {
        id: Date.now(),
        timestamp: video.currentTime.toFixed(2),
        thumbnail: canvas.toDataURL('image/png'),
        base64: imageData,
        prompt: "Siap dianalisa...",
        status: 'pending',
        progress: 0
      }]);
    } catch (err) { setError("Gagal mengambil snapshot."); }
  };

  const analyzeScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || scene.status === 'analyzing') return;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'analyzing', progress: 10 } : s));
    try {
      const sysPrompt = "Analyze this image and generate a high-quality image generation prompt. Return ONLY text.";
      const result = await callGemini(sysPrompt, scene.base64);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, prompt: result, status: 'completed', progress: 100 } : s));
    } catch (err) { 
      setError(err.message);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'error' } : s));
    }
  };

  const generateRefinedPrompt = async () => {
    const completed = scenes.filter(s => s.status === 'completed');
    if (completed.length === 0) return alert("Butuh analisa scene dulu!");
    setIsRefiningPrompt(true);
    setRefineProgress(10);
    try {
      const base = completed[completed.length - 1].prompt;
      const req = `Base Prompt: "${base}". Aspect Ratio: ${imageResolution}. Instructions: "${aiInstruction || 'Improve lighting'}". Return ONLY refined prompt with --ar ${imageResolution.replace(':', '/')}.`;
      const res = await callGemini(req);
      setRefinedPrompt(res);
      setRefineProgress(100);
    } catch (err) { setError(err.message); } finally { setIsRefiningPrompt(false); }
  };

  const processWithGemini = async (mode) => {
    if (scenes.length === 0) return alert("Belum ada media!");
    setIsGeneratingAi(true);
    setAiProgress(20);
    try {
      const allP = scenes.filter(s => s.status === 'completed').map(s => s.prompt).join("\n\n");
      const p = `Visual Analysis:\n${allP}\n\nTask: ${mode === 'narasi' ? 'Dramatize story' : 'Professional Story Arc'}. User: ${aiInstruction}`;
      const res = await callGemini(p);
      setAiResponse(res);
      setAiProgress(100);
    } catch (err) { setError(err.message); } finally { setIsGeneratingAi(false); }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const downloadAsTxt = () => {
    const blob = new Blob([aiResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_analysis_${Date.now()}.txt`;
    a.click();
  };

  // ==========================================
  // 4. LOGIKA RENDERING
  // ==========================================

  // JIKA WEBSITE MASIH TERKUNCI
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-800 shadow-2xl w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
             <div className="bg-indigo-500/20 p-4 rounded-3xl">
                <Zap size={48} className="text-yellow-400 fill-yellow-400" />
             </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">AI Visual Lab</h2>
            <p className="text-slate-400 text-sm">Masukkan kode akses unik lo untuk mulai bedah media!</p>
          </div>
          <input 
            type="text" 
            className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-4 text-center text-lg font-mono tracking-widest outline-none focus:border-indigo-500 transition-all"
            placeholder="KODE-AKSES-LO"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
          />
          <button onClick={handleUnlock} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
            Buka Akses Sekarang ✨
          </button>
          <div className="pt-4 border-t border-slate-800 text-sm">
            <a href={`https://wa.me/${myWhatsAppNumber}?text=${waMessage}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-green-400 hover:text-green-300 transition-colors">
              <MessageSquare size={18} />
              <span>Beli Kode via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // JIKA WEBSITE SUDAH TERBUKA (ISI UTAMA)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-3">
            <Zap className="text-yellow-400 fill-yellow-400" /> AI Visual Lab
          </h1>
          <p className="text-slate-400 text-sm tracking-wide">Bedah visual media lo jadi prompt AI & narasi kreatif.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sisi Kiri: Media Manager */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload size={20} className="text-indigo-400" /> Media Upload</h3>
              <label className="cursor-pointer group w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-all p-8 rounded-2xl flex flex-col items-center gap-4">
                <Send size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <div className="text-center"><span className="block text-sm font-bold mb-1">Upload File</span><span className="text-xs text-slate-500">Video atau Gambar</span></div>
                <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
              </label>

              {mediaUrl && (
                <div className="mt-6 relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-700 shadow-inner group">
                  {mediaType === 'video' ? <video ref={videoRef} key={mediaUrl} src={mediaUrl} controls className="w-full h-full" /> : <img src={mediaUrl} className="w-full h-full object-contain" alt="Preview" />}
                  {mediaType === 'video' && (
                    <button onClick={captureFromVideo} className="absolute top-4 right-4 bg-cyan-500 hover:bg-cyan-400 p-4 rounded-2xl shadow-xl text-white active:scale-90 transition-all z-10 opacity-0 group-hover:opacity-100"><Camera size={20} /></button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl h-[550px] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><FileText className="text-cyan-400" /> Scene Manager ({scenes.length})</h2>
                {scenes.length > 0 && <button onClick={() => setScenes([])} className="text-xs text-slate-500 hover:text-red-400">Hapus Semua</button>}
              </div>
              <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {scenes.map((scene) => (
                  <div key={scene.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 group transition-all">
                    <div className="w-full sm:w-28 flex-shrink-0 relative">
                      <img src={scene.thumbnail} className="w-full aspect-video object-cover rounded-xl border border-slate-700 shadow-sm" alt="Thumb" />
                      <div className="absolute -bottom-1 -right-1 bg-black/90 px-1.5 py-0.5 rounded text-[8px] text-cyan-400 font-mono border border-slate-800">{scene.timestamp === "Static" ? "IMG" : `${scene.timestamp}s`}</div>
                    </div>
                    <div className="flex-grow min-w-0 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${scene.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{scene.status}</span>
                        <div className="flex gap-1">
                          <button onClick={() => analyzeScene(scene.id)} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-cyan-600 transition-all"><Sparkles size={14} /></button>
                          <button onClick={() => copyToClipboard(scene.prompt, scene.id)} className={`p-1.5 rounded-lg transition-all ${copyStatus === scene.id ? 'bg-green-600' : 'bg-slate-700/50'}`}>{copyStatus === scene.id ? <Check size={14} /> : <Copy size={14} />}</button>
                          <button onClick={() => setScenes(prev => prev.filter(s => s.id !== scene.id))} className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-red-600 transition-all"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-300 italic line-clamp-2">{scene.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
              {scenes.length > 0 && <button onClick={() => scenes.forEach(s => s.status !== 'completed' && analyzeScene(s.id))} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-2xl font-bold text-sm shadow-lg active:scale-95">Analisa Semua</button>}
            </div>
          </div>

          {/* Sisi Kanan: Gemini Studio */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-3xl p-6 border border-indigo-500/30 shadow-2xl space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-300"><Wand2 size={22} /> Gemini Studio</h2>
              <textarea placeholder="Instruksi tambahan (Gaya Pixar, Cyberpunk, Malam hari...)" className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-4 text-sm outline-none min-h-[110px] resize-none" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} />
              
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Maximize size={14} /> Pilih Aspek Rasio</span>
                <div className="flex gap-2">
                  {['1:1', '16:9', '9:16'].map((res) => (
                    <button key={res} onClick={() => setImageResolution(res)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${imageResolution === res ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{res}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => processWithGemini('narasi')} disabled={isGeneratingAi || scenes.length === 0} className="bg-indigo-600 hover:bg-indigo-500 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-xs relative overflow-hidden">
                  {isGeneratingAi ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                  <span>{isGeneratingAi ? `${aiProgress}%` : 'Buat Narasi ✨'}</span>
                </button>
                <button onClick={() => processWithGemini('storyboard')} disabled={isGeneratingAi || scenes.length === 0} className="bg-cyan-600 hover:bg-cyan-500 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-xs">
                  <Layout size={16} /> <span>Story Arc ✨</span>
                </button>
              </div>

              <button onClick={generateRefinedPrompt} disabled={isRefiningPrompt || scenes.length === 0} className="w-full bg-indigo-500/20 border border-indigo-500/40 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500/30 active:scale-95 transition-all">
                {isRefiningPrompt ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                <span>{isRefiningPrompt ? `Refining ${refineProgress}%` : 'Generate Master Prompt ✨'}</span>
              </button>

              {refinedPrompt && (
                <div className="bg-slate-900/60 p-5 rounded-2xl border border-indigo-500/30 space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center border-b border-indigo-500/10 pb-2">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Refined Final Prompt</span>
                    <button onClick={() => {setRefinedPrompt(''); setAiInstruction('');}} className="text-slate-500 hover:text-red-400"><RotateCcw size={16} /></button>
                  </div>
                  <div className="text-[11px] text-slate-300 leading-relaxed italic pr-2">{refinedPrompt}</div>
                  <button onClick={() => copyToClipboard(refinedPrompt, 'final')} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 ${copyStatus === 'final' ? 'bg-green-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-indigo-900/20'}`}>
                    {copyStatus === 'final' ? <Check size={18} /> : <ClipboardCopy size={18} />}
                    <span>{copyStatus === 'final' ? 'Disalin!' : 'Copy Prompt Akhir ✨'}</span>
                  </button>
                </div>
              )}
            </div>

            {aiResponse && (
              <div className="bg-slate-900/80 rounded-2xl p-5 border border-indigo-500/20 max-h-[350px] overflow-y-auto text-sm animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2 sticky top-0 bg-slate-900/80 z-20">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Analysis Result</span>
                  <div className="flex gap-3">
                    <button onClick={downloadAsTxt} className="text-slate-500 hover:text-white flex items-center gap-1 text-[10px] transition-colors"><Download size={14} /> TXT</button>
                    <button onClick={() => copyToClipboard(aiResponse, 'ai-res')} className="text-slate-500 hover:text-white transition-colors">{copyStatus === 'ai-res' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{aiResponse}</div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-md border border-red-700 text-red-100 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
            <AlertCircle size={20} className="text-red-300" />
            <div className="flex flex-col"><span className="text-sm font-bold">Error</span><span className="text-[10px] opacity-90">{error}</span></div>
            <button onClick={() => setError(null)} className="ml-4 hover:bg-red-800 p-1 rounded-full transition-colors">✕</button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 5px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }` }} />
    </div>
  );
};

export default App;