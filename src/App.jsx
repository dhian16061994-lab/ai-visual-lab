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
  const myWhatsAppNumber = "628979768590"; // <--- Ganti dengan nomor asli lo (awalan 62)
  const waMessage = encodeURIComponent("Halo Marcho, saya mau beli kode akses AI Visual Lab. Berapa harganya?");

  const handleUnlock = () => {
    if (validCodes.includes(accessCode.trim())) {
      setIsLocked(false);
    } else {
      alert("Kode akses salah atau sudah tidak berlaku!");
    }
  };

  // ==========================================
  // 2. STATE APLIKASI UTAMA (VERSI TERBARU)
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
    const model = "gemini-2.0-flash-exp"; // Menggunakan model terbaru yang stabil
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
      if (!response.ok) throw new Error("API Error");
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
      setScenes(prev => [...prev, {
        id: Date.now(),
        timestamp: "Static",
        thumbnail: canvas.toDataURL('image/png'),
        base64: canvas.toDataURL('image/png').split(',')[1],
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
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setScenes(prev => [...prev, {
      id: Date.now(),
      timestamp: video.currentTime.toFixed(2),
      thumbnail: canvas.toDataURL('image/png'),
      base64: canvas.toDataURL('image/png').split(',')[1],
      prompt: "Siap dianalisa...",
      status: 'pending',
      progress: 0
    }]);
  };

  const analyzeScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'analyzing', progress: 10 } : s));
    try {
      const result = await callGemini("Analyze this image and generate a high-quality AI prompt. Return ONLY the text.", scene.base64);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, prompt: result, status: 'completed', progress: 100 } : s));
    } catch (err) { setError(err.message); }
  };

  const generateRefinedPrompt = async () => {
    const completed = scenes.filter(s => s.status === 'completed');
    if (completed.length === 0) return alert("Analisa scene dulu!");
    setIsRefiningPrompt(true);
    try {
      const base = completed[completed.length - 1].prompt;
      const request = `Refine this prompt for AI Image Gen: "${base}". Aspect Ratio: ${imageResolution}. Extra: ${aiInstruction}. Return ONLY the final prompt with --ar ${imageResolution.replace(':', '/')}`;
      const res = await callGemini(request);
      setRefinedPrompt(res);
    } catch (err) { setError(err.message); } finally { setIsRefiningPrompt(false); }
  };

  const processWithGemini = async (mode) => {
    if (scenes.length === 0) return;
    setIsGeneratingAi(true);
    try {
      const allPrompts = scenes.filter(s => s.status === 'completed').map(s => s.prompt).join("\n");
      const prompt = `Visual context: ${allPrompts}. Task: ${mode === 'narasi' ? 'Create dramatic story' : 'Professional Story Arc'}. User Instruction: ${aiInstruction}`;
      const res = await callGemini(prompt);
      setAiResponse(res);
    } catch (err) { setError(err.message); } finally { setIsGeneratingAi(false); }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  // ==========================================
  // 4. RENDERING LOGIC
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
          <button onClick={handleUnlock} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
            Buka Akses Sekarang ✨
          </button>
          <div className="pt-4 border-t border-slate-800">
            <a href={`https://wa.me/${myWhatsAppNumber}?text=${waMessage}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-green-400 hover:text-green-300 transition-colors">
              <MessageSquare size={18} />
              <span>Beli Kode via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // JIKA WEBSITE SUDAH TERBUKA
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
          {/* Kolom Kiri: Media Manager */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload size={20} className="text-indigo-400" /> Media Upload</h3>
              <label className="cursor-pointer group w-full bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-all p-8 rounded-2xl flex flex-col items-center gap-4">
                <Send size={32} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <div className="text-center"><span className="block text-sm font-bold">Klik untuk Upload</span><span className="text-xs text-slate-500">Video atau Gambar</span></div>
                <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
              </label>

              {mediaUrl && (
                <div className="mt-6 relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-700 group">
                  {mediaType === 'video' ? <video ref={videoRef} key={mediaUrl} src={mediaUrl} controls className="w-full h-full" /> : <img src={mediaUrl} className="w-full h-full object-contain" />}
                  {mediaType === 'video' && <button onClick={captureFromVideo} className="absolute top-4 right-4 bg-cyan-500 p-4 rounded-2xl text-white opacity-0 group-hover:opacity-100 transition-all"><Camera size={20} /></button>}
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl h-[500px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2"><FileText size={20} className="text-cyan-400" /> Scene Manager ({scenes.length})</h2>
                {scenes.length > 0 && <button onClick={() => setScenes([])} className="text-xs text-red-400">Hapus Semua</button>}
              </div>
              <div className="flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {scenes.map(s => (
                  <div key={s.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex gap-4">
                    <img src={s.thumbnail} className="w-24 aspect-video object-cover rounded-xl border border-slate-700" />
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full">{s.status}</span>
                         <div className="flex gap-1">
                            <button onClick={() => analyzeScene(s.id)} className="p-1.5 bg-slate-700 rounded-lg hover:bg-cyan-600"><Sparkles size={12}/></button>
                            <button onClick={() => copyToClipboard(s.prompt, s.id)} className="p-1.5 bg-slate-700 rounded-lg hover:bg-indigo-600">{copyStatus === s.id ? <Check size={12}/> : <Copy size={12}/>}</button>
                         </div>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 italic">{s.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Gemini Studio */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-3xl p-6 border border-indigo-500/30 shadow-2xl space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-300"><Wand2 size={22} /> Gemini Studio</h2>
              <textarea placeholder="Instruksi tambahan (Gaya Pixar, Cyberpunk, Malam hari...)" className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-4 text-sm min-h-[100px] outline-none" value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} />
              
              <div className="flex gap-2">
                 {['1:1', '16:9', '9:16'].map(r => (
                   <button key={r} onClick={() => setImageResolution(r)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${imageResolution === r ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{r}</button>
                 ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => processWithGemini('narasi')} className="bg-indigo-600 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"><MessageSquare size={16}/> Narasi ✨</button>
                 <button onClick={() => processWithGemini('storyboard')} className="bg-cyan-600 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"><Layout size={16}/> Story Arc ✨</button>
              </div>

              <button onClick={generateRefinedPrompt} className="w-full bg-indigo-500/20 border border-indigo-500/40 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500/30 transition-all">
                {isRefiningPrompt ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>}
                <span>{isRefiningPrompt ? 'Refining...' : 'Generate Master Prompt ✨'}</span>
              </button>

              {refinedPrompt && (
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-indigo-500/30 space-y-4">
                   <div className="text-[11px] text-slate-300 italic">{refinedPrompt}</div>
                   <button onClick={() => copyToClipboard(refinedPrompt, 'final')} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 ${copyStatus === 'final' ? 'bg-green-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600'}`}>
                      {copyStatus === 'final' ? <Check size={18}/> : <ClipboardCopy size={18}/>}
                      <span>{copyStatus === 'final' ? 'Disalin!' : 'Copy Prompt Akhir'}</span>
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; }` }} />
    </div>
  );
};

export default App;