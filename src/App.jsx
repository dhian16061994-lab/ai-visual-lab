import React, { useState, useRef } from 'react';
import { 
  Loader2, Video, Camera, FileText, Trash2, Send, 
  Sparkles, AlertCircle, Upload, Copy, Check, 
  ImageIcon, ClipboardCopy, Wand2, MessageSquare, Zap,
  Layout, Maximize, Download
} from 'lucide-react';

const App = () => {
  // ==========================================
  // 1. SISTEM KEAMANAN (LOCK SCREEN)
  // ==========================================
  const [accessCode, setAccessCode] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [copyStatus, setCopyStatus] = useState(null);

  // Daftar kode unik lo. Tambahin di sini kalau ada pembeli baru!
  const validCodes = ["LAB-PREMIUM-01", "MARCHO-SPECIAL-99", "COBA-AI-123"]; 
  
  // Setting WhatsApp lo
  const myWhatsAppNumber = "628xxxxxxxxxx"; // Ganti dengan nomor asli lo
  const waMessage = encodeURIComponent("Halo Marcho, saya mau beli kode akses AI Visual Lab. Berapa harganya?");

  const handleUnlock = () => {
    if (validCodes.includes(accessCode.trim())) {
      setIsLocked(false);
    } else {
      alert("Kode akses salah atau sudah tidak berlaku!");
    }
  };

  // ==========================================
  // 2. STATE APLIKASI UTAMA
  // ==========================================
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('video');
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [imageResolution, setImageResolution] = useState('1:1');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // API Key dari Vercel Environment
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // ==========================================
  // 3. FUNGSI HELPER & API
  // ==========================================
  const callGemini = async (prompt, base64Image = null, retryCount = 0) => {
    const model = "gemini-2.0-flash-exp";
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
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mendapatkan respon.";
    } catch (err) { throw err; }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
      setMediaUrl(URL.createObjectURL(file));
      setScenes([]);
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
    return {
      id: Date.now(),
      timestamp: video.currentTime.toFixed(2),
      thumbnail: canvas.toDataURL('image/png'),
      base64: canvas.toDataURL('image/png').split(',')[1],
      prompt: "Siap dianalisa...",
      status: 'pending'
    };
  };

  const analyzeScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, status: 'analyzing' } : s));
    try {
      const result = await callGemini("Analyze this image and generate a high-quality prompt. ONLY text.", scene.base64);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, prompt: result, status: 'completed' } : s));
    } catch (err) { setError(err.message); }
  };

  const copyFinalPrompt = () => {
    const completedScenes = scenes.filter(s => s.status === 'completed');
    if (completedScenes.length === 0) return alert("Belum ada analisa!");
    const basePrompt = completedScenes[completedScenes.length - 1].prompt;
    const finalPrompt = aiInstruction ? `${basePrompt}. Style: ${aiInstruction}` : basePrompt;
    navigator.clipboard.writeText(finalPrompt).then(() => {
      setCopyStatus('master');
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  // ==========================================
  // 4. LOGIKA TAMPILAN
  // ==========================================

  // JIKA MASIH TERKUNCI
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
            <p className="text-slate-400 text-sm">Masukkan kode akses unik lo untuk mulai!</p>
          </div>
          <input 
            type="text" 
            className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-4 text-center text-lg font-mono outline-none focus:border-indigo-500"
            placeholder="KODE-AKSES-LO"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
          />
          <button onClick={handleUnlock} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold transition-all">
            Buka Akses Sekarang ✨
          </button>
          <div className="pt-4 border-t border-slate-800">
            <a href={`https://wa.me/${myWhatsAppNumber}?text=${waMessage}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-green-400 hover:text-green-300">
              <MessageSquare size={18} />
              <span>Beli Kode via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // JIKA SUDAH TERBUKA (APLIKASI UTAMA)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center justify-center gap-3">
            <Zap className="text-yellow-400 fill-yellow-400" /> AI Visual Lab
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* KOLOM KIRI: MEDIA & SCENES */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
              <label className="cursor-pointer group w-full bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4">
                <Upload size={32} className="text-indigo-400" />
                <span className="text-sm">Upload Video atau Gambar</span>
                <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              {mediaUrl && (
                <div className="mt-6 relative rounded-2xl overflow-hidden bg-black border border-slate-700">
                  {mediaType === 'video' ? (
                    <video ref={videoRef} key={mediaUrl} src={mediaUrl} controls className="w-full" />
                  ) : (
                    <img src={mediaUrl} className="w-full" />
                  )}
                  <button onClick={() => setScenes(prev => [...prev, captureFromVideo()])} className="absolute top-4 right-4 bg-cyan-500 p-4 rounded-2xl text-white">
                    <Camera size={20} />
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 h-[400px] overflow-y-auto space-y-4">
               <h3 className="font-bold flex items-center gap-2"><FileText size={18}/> Scene List</h3>
               {scenes.map(s => (
                 <div key={s.id} className="bg-slate-800/50 p-3 rounded-xl flex gap-4 items-center">
                   <img src={s.thumbnail} className="w-20 rounded-lg" />
                   <div className="flex-grow text-xs truncate">{s.prompt}</div>
                   <button onClick={() => analyzeScene(s.id)} className="bg-indigo-600 p-2 rounded-lg"><Sparkles size={14}/></button>
                 </div>
               ))}
            </div>
          </div>

          {/* KOLOM KANAN: GEMINI STUDIO */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-3xl p-6 border border-indigo-500/30 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><Wand2 size={22} /> Gemini Studio</h2>
              <textarea 
                placeholder="Instruksi tambahan (Gaya Pixar, Cyberpunk, dll)..."
                className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-4 text-sm outline-none min-h-[100px]"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
              />
              <button 
                onClick={copyFinalPrompt}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {copyStatus === 'master' ? <Check size={18}/> : <ClipboardCopy size={18} />}
                <span>{copyStatus === 'master' ? 'Berhasil Di-copy!' : 'Copy Master Prompt ✨'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;