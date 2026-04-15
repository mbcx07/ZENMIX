const express = require('express');
const path = require('path');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ dest: '/tmp/zenmix_uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Extended Hypnosis Scripts (Progressive Induction) ───────
const scripts = {
  insomnio: `Ahora... respira profundamente... Siente cómo el aire entra por tu nariz... lentamente... llenando tus pulmones... y luego... suéltalo suavemente... por la boca... Una vez más... inhala... y exhala... Con cada respiración... tu cuerpo se vuelve más pesado... más relajado... Siente cómo tus pies... se hunden en la cama... como si flotaras en agua tibia... La relajación sube por tus tobillos... tus pantorrillas... tus rodillas... como una ola cálida que recorre tu cuerpo... Tus muslos se relajan... tu abdomen se suaviza... siente cómo la tensión se derrite... como cera de vela... Tu espalda descansa contra la cama... tus hombros caen suavemente... el cuello se suelta... Y ahora... deja que tu mente descienda... como una pluma que cae... suavemente... lentamente... en un lugar de paz profunda... Estás bajando... un escalón... más profundo... dos escalones... más relajado... tres escalones... en el lugar más tranquilo de tu mente... Aquí... solo existe la paz... el silencio... la calma... Eres sueño... eres descanso... eres renovación... Deja que las imágenes del día se desvanezcan... como niebla que se levanta... Tu mente está vacía... serena... abierta al descanso... Y ahora... simplemente... duerme... duerme... duerme... Mañana despertarás renovado... lleno de energía... con una sonrisa en el alma... Duermes... profundamente... en paz...`,
  ansiedad: `Cierra los ojos... respira profundamente... Siente cómo el aire fresco entra... y el aire caliente sale... Llevando consigo... toda la tensión... todo el estrés... como hojas que el viento se lleva... Cuenta mentalmente... inhala en uno... sostén en dos... exhala en tres... Uno... dos... tres... Siente cómo tu corazón se calma... su ritmo se vuelve suave... constante... como las olas del mar... que van y vienen... sin prisa... sin pausa... La ansiedad es como una nube... que pasa por el cielo de tu mente... Tú eres el cielo... inmenso... sereno... eterno... Las nubes vienen y van... pero el cielo permanece... en calma... en paz... Ahora imagina una luz azul... que envuelve todo tu cuerpo... Esta luz es protección... es seguridad... es calma... Fluye por tu pecho... disolviendo el nudo... por tu estómago... relajando el vacío... por tu garganta... soltando las palabras no dichas... Eres fuerte... eres capaz... eres suficiente... Todo está bien... en este momento... todo está bien... Repite internamente... estoy en calma... estoy seguro... estoy en paz...`,
  migrania: `Respira suavemente... y con cada exhalación... imagina que el dolor... se hace más pequeño... más pequeño... como un globo que se desinfla lentamente... Ahora... visualiza una luz azul brillante... que entra por la parte superior de tu cabeza... Esta luz es fresca... como agua de manantial... como brisa de montaña... Fluye por tu frente... y siente cómo la presión se alivia... Por tus sienes... y la pulsación se suaviza... Por detrás de tus ojos... y la tensión se libera... La luz azul recorre tu cabeza entera... como un casco fresco y protector... Cada célula... cada fibra... se baña en esta luz curativa... El dolor se reduce... se reduce... hasta que es solo un recuerdo lejano... Tu cabeza está libre... ligera... fresca... como si la hubieras sumergido en agua fresca... Y ahora... la luz azul se convierte en dorada... y llena tu cuerpo de energía renovada... de vitalidad... de bienestar...`,
  autoestima: `Respira profundamente... y con cada respiración... siéntete más grande... más fuerte... más presente... Imagina que frente a ti... aparece un espejo... y en ese espejo... ves la mejor versión de ti mismo... esa versión que ya existe dentro... esperando ser reconocida... Mírate a los ojos... y dite... tú vales... tú importas... tú eres suficiente... exactamente como eres... Siente cómo esas palabras... resuenan en tu pecho... como un eco que se multiplica... cada vez más fuerte... más verdadero... Ahora... imagina una luz dorada... que emana de tu corazón... Esta luz es tu poder interior... tu confianza... tu valor... Se expande... te envuelve... te transforma... Eres decidido... eres auténtico... eres libre... No necesitas la aprobación de nadie... tú te apruebas... tú te aceptas... tú te amas... profundamente... sin condiciones... Cada día... te vuelves más seguro... más valiente... más tú...`,
  'dejar-fumar': `Respira profundo... y siente cómo tus pulmones se llenan... de aire puro... aire limpio... aire que te da vida... Ahora... imagina el humo del cigarro... como una cadena gris... que te mantiene atado... Pero mira tus manos... son libres... son tuyas... Y ahora... rompes esa cadena... con facilidad... con decisión... Siente la libertad... de respirar sin peso... sin ataduras... Cada vez que piensas en fumar... tu mente automáticamente... se enfoca en algo más... en algo mejor... El olor del cigarro... te resulta desagradable... El sabor... te desagrada... Tu cuerpo lo rechaza... como rechaza el veneno... Eres libre... libre del tabaco... libre de la nicotina... libre de la esclavitud... Eres dueño de tu respiración... dueño de tu salud... dueño de tu vida... Y cada día que pasa... te sientes más libre... más limpio... más vivo...`,
  peso: `Respira suavemente... y siéntete en control... Totalmente en control... Tú decides... qué entra a tu cuerpo... cuándo... y cuánto... Tu cuerpo es sabio... escúchalo... Cuando tiene hambre de verdad... te lo dice claramente... Cuando es solo un antojo... es solo una emoción disfrazada... Y tú... puedes distinguir la diferencia... fácilmente... Naturalmente... Imagina que frente a ti... hay dos caminos... Uno... es el de los hábitos que ya no te sirven... El otro... es el de la salud... la energía... la vida plena... Eliges el segundo... sin dudar... con convicción... Comes para nutrirte... para vivir... para brillar... Tu cuerpo es tu templo... y lo tratas con amor... con respeto... con cuidado... Cada decisión alimenticia... es un acto de amor propio...`,
  focus: `Respira profundo... y siente cómo tu mente se aquieta... como un lago que se calma... cuando cesa el viento... Ahora... imagina un rayo de luz... concentrado... preciso... poderoso... Ese rayo es tu atención... tu enfoque... tu mente en su máximo potencial... Cuando decides concentrarte... nada te distrae... nada te detiene... Tu cerebro trabaja con claridad cristalina... cada pensamiento es nítido... cada decisión es acertada... Ruido... distracciones... interrupciones... todo se desvanece... como estática de radio que apagas... Estás en la zona... en flujo... en tu mejor estado... Y cada vez que necesitas concentrarte... simplemente respiras... y ese rayo de luz se enciende... automáticamente... sin esfuerzo... Eres precisión... eres enfoque... eres poder mental...`
};

// ─── Induction levels (appended to scripts) ──────────────────
const inductionLevels = {
  superficial: `\n\nY ahora... poco a poco... vuelves a la superficie... como una burbuja que sube... suavemente... Abres los ojos lentamente... sintiéndote renovado... tranquilo... presente... Estás aquí... ahora... despierto... en paz...`,
  medio: `\n\nQuedate un momento más... en este estado de calma... dejando que las sugestiones se profundicen... se instalen... se conviertan en parte de ti... Cuando estés listo... regresa lentamente... cuenta del cinco al uno... cinco... sintiendo tus manos... cuatro... moviendo tus pies... tres... abriendo los ojos... dos... estirando tu cuerpo... uno... completamente despierto... renovado... en paz...`,
  profundo: `\n\nAhora... déjate ir aún más profundo... como si cayeras suavemente... en un sueño dentro del sueño... cada vez más abajo... más relajado... más en paz... Las sugestiones se graban profundamente... en tu subconsciente... se convierten en verdad... en realidad... en ti... Cuando tu mente esté lista... naturalmente... comenzarás a regresar... poco a poco... sin prisa... como quien despierta de un sueño reparador... lentamente... suavemente... abres los ojos... te sientes completamente renovado... transformado... en paz...`
};

// ─── All voices — Mexican + deep hypnotist voices ────────────
const allVoices = [
  // 🇲🇽 Mexican voices (primary)
  {id:'es-MX-JorgeNeural',name:'Jorge',lang:'México',gender:'Masculino',deep:true,icon:'🎙️'},
  {id:'es-MX-DaliaNeural',name:'Dalia',lang:'México',gender:'Femenino',deep:false,icon:'🗣️'},
  // 🎙️ Deep hypnotist voices (John Milton style)
  {id:'es-ES-AlvaroNeural',name:'Álvaro M.',lang:'España',gender:'Masculino',deep:true,icon:'🌙'},
  {id:'es-AR-TomasNeural',name:'Tomás M.',lang:'Argentina',gender:'Masculino',deep:true,icon:'🌑'},
  {id:'es-CO-GonzaloNeural',name:'Gonzalo M.',lang:'Colombia',gender:'Masculino',deep:true,icon:'🔮'},
  {id:'es-VE-SebastianNeural',name:'Sebastián M.',lang:'Venezuela',gender:'Masculino',deep:true,icon:'✨'},
  {id:'es-CL-LorenzoNeural',name:'Lorenzo M.',lang:'Chile',gender:'Masculino',deep:true,icon:'💫'},
  {id:'es-PE-AlexNeural',name:'Alex M.',lang:'Perú',gender:'Masculino',deep:true,icon:'⭐'},
  // Additional deep voices
  {id:'es-US-AlonsoNeural',name:'Alonso M.',lang:'EE.UU.',gender:'Masculino',deep:true,icon:'🌟'},
  {id:'es-BO-MarceloNeural',name:'Marcelo M.',lang:'Bolivia',gender:'Masculino',deep:true,icon:'🌀'},
  {id:'es-CR-JuanNeural',name:'Juan M.',lang:'Costa Rica',gender:'Masculino',deep:true,icon:'🌀'},
  {id:'es-DO-EmilioNeural',name:'Emilio M.',lang:'Rep. Dom.',gender:'Masculino',deep:true,icon:'🌀'},
  {id:'es-GQ-JavierNeural',name:'Javier M.',lang:'Guinea Eq.',gender:'Masculino',deep:true,icon:'🌀'},
  {id:'es-HN-CarlosNeural',name:'Carlos M.',lang:'Honduras',gender:'Masculino',deep:true,icon:'🌀'},
  {id:'es-PA-RobertoNeural',name:'Roberto M.',lang:'Panamá',gender:'Masculino',deep:true,icon:'🌀'},
  // Female voices
  {id:'es-ES-ElviraNeural',name:'Elvira',lang:'España',gender:'Femenino',deep:false,icon:'🗣️'},
  {id:'es-ES-XimenaNeural',name:'Ximena',lang:'España',gender:'Femenino',deep:false,icon:'🗣️'},
  {id:'es-AR-ElenaNeural',name:'Elena',lang:'Argentina',gender:'Femenino',deep:false,icon:'🗣️'},
  {id:'es-CO-SalomeNeural',name:'Salomé',lang:'Colombia',gender:'Femenino',deep:false,icon:'🗣️'},
];

// ─── Effect Presets ──────────────────────────────────────────
const presets = {
  estudio:{reverb:50,echo:10,bass:30,name:'Estudio'},
  cueva:{reverb:80,echo:40,bass:60,name:'Cueva'},
  bosque:{reverb:30,echo:5,bass:20,name:'Bosque'},
  radio:{reverb:15,echo:0,bass:10,name:'Radio'},
};

// ─── Session color themes ───────────────────────────────────
const sessionColors = {
  insomnio:{primary:'#4a6cf7',glow:'#4a6cf740',name:'Azul noche'},
  ansiedad:{primary:'#10b981',glow:'#10b98140',name:'Verde calma'},
  migrania:{primary:'#8b5cf6',glow:'#8b5cf640',name:'Violeta alivio'},
  autoestima:{primary:'#f59e0b',glow:'#f59e0b40',name:'Dorado confianza'},
  'dejar-fumar':{primary:'#ef4444',glow:'#ef444440',name:'Rojo libertad'},
  peso:{primary:'#06b6d4',glow:'#06b6d440',name:'Cyan salud'},
  focus:{primary:'#a855f7',glow:'#a855f740',name:'Púrpura enfoque'}
};

// ─── Stats storage ───────────────────────────────────────────
const STATS_FILE = '/tmp/zenmix_stats.json';
function loadStats(){try{return JSON.parse(fs.readFileSync(STATS_FILE,'utf8'));}catch(e){return{sessions:0,totalMinutes:0,streak:0,lastDate:null,perSession:{}};}}
function saveStats(s){try{fs.writeFileSync(STATS_FILE,JSON.stringify(s));}catch(e){}}

app.get('/api/voices',(req,res)=>res.json(allVoices));
app.get('/api/presets',(req,res)=>res.json(presets));
app.get('/api/colors',(req,res)=>res.json(sessionColors));
app.get('/api/stats',(req,res)=>{res.json(loadStats());});
app.post('/api/stats/record',(req,res)=>{
  const s=loadStats();const{session,minutes}=req.body;
  s.sessions++;s.totalMinutes+=(minutes||1);
  const today=new Date().toISOString().slice(0,10);
  if(s.lastDate!==today){
    const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
    s.streak=(s.lastDate===yesterday)?s.streak+1:1;
    s.lastDate=today;
  }
  s.perSession[session]=(s.perSession[session]||0)+1;
  saveStats(s);res.json(s);
});

// ─── Build audio filter array (NO compand — causes screech) ──
function buildAudioFilter(opts={}){
  const{echo=0,reverb=50,bassBoost=30,deEss=true,warm=true,normalize=true,fadeIn=0,fadeOut=0}=opts;
  const filters=[];
  // Clean rumble and harshness
  if(deEss){filters.push('highpass=f=60');filters.push('lowpass=f=10000');}
  // Warm EQ: deep bass + body, cut nasal and harsh
  if(warm){
    filters.push('equalizer=f=100:t=q:w=1.5:g=4');   // deep warmth
    filters.push('equalizer=f=200:t=q:w=1.5:g=3');   // body
    filters.push('equalizer=f=500:t=q:w=2:g=1');     // presence
    filters.push('equalizer=f=2500:t=q:w=2:g=-3');    // reduce nasal
    filters.push('equalizer=f=5000:t=q:w=2:g=-4');    // reduce harshness
    filters.push('equalizer=f=8000:t=q:w=2:g=-6');    // smooth top
  }
  // Bass boost for deep hypnotic voice
  if(bassBoost>0){
    const g=(2+(bassBoost/100)*6).toFixed(1);
    filters.push('equalizer=f=60:t=q:w=2:g='+g);
    filters.push('equalizer=f=100:t=q:w=2:g='+(g*0.8).toFixed(1));
    filters.push('equalizer=f=150:t=q:w=2:g='+(g*0.5).toFixed(1));
  }
  // Soft compressor instead of compand (prevents screech)
  filters.push('acompressor=threshold=-20dB:ratio=3:attack=5:release=50:makeup=2');
  // Studio reverb: multi-tap for professional sound
  if(reverb>0){
    const rv=reverb/100;
    filters.push('aecho=0.8:0.88:'+(20+Math.round(rv*25))+':'+(0.25+rv*0.4).toFixed(2));
    filters.push('aecho=0.7:0.85:'+(40+Math.round(rv*50))+':'+(0.2+rv*0.3).toFixed(2));
    filters.push('aecho=0.6:0.82:'+(70+Math.round(rv*90))+':'+(0.15+rv*0.2).toFixed(2));
  }
  if(echo>0){
    const ei=echo/100;const d=(0.3+ei*0.4).toFixed(2);
    filters.push('aecho='+d+':'+(parseFloat(d)+0.1).toFixed(2)+':'+(150+Math.round(ei*250))+':'+(ei*0.5).toFixed(2));
  }
  if(fadeIn>0)filters.push('afade=t=in:d='+fadeIn);
  // No fade-out — causes perceived cutoff in browser playback
  if(normalize)filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  return filters;
}

function runFfmpeg(args){
  return new Promise((resolve,reject)=>{
    const proc=spawn('ffmpeg',args,{timeout:180000});
    let stderr='';proc.stderr.on('data',d=>stderr+=d.toString());
    proc.on('close',code=>{if(code!==0)reject(new Error('ffmpeg exit '+code+': '+stderr.slice(-300)));else resolve();});
    proc.on('error',reject);
  });
}

function processAudio(inputFile,outputFile,filterArray){
  const af=Array.isArray(filterArray)?filterArray.join(','):filterArray;
  return runFfmpeg(['-y','-i',inputFile,'-af',af,'-ar','44100','-ac','2','-b:a','192k',outputFile]);
}

function getDuration(filePath){
  return new Promise(resolve=>{
    execFile('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',filePath],{timeout:10000},(err,stdout)=>{
      resolve(err?60:parseFloat(stdout.trim())||60);
    });
  });
}

// ─── Generate binaural WAV ───────────────────────────────────
function generateBinauralWav(type,duration,filePath){
  const freqs={delta:{base:100,beat:2},theta:{base:150,beat:6},alpha:{base:200,beat:10},sigma:{base:200,beat:14},gamma:{base:200,beat:40},beta:{base:250,beat:20}};
  const f=freqs[type]||freqs.theta;const sr=44100,n=duration*sr;
  const buf=Buffer.alloc(44+n*4);
  buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVE',8);
  buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);
  buf.writeUInt32LE(sr,24);buf.writeUInt32LE(sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);
  buf.write('data',36);buf.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++){
    const t=i/sr,fi=Math.min(1,i/(sr*3)),fo=Math.min(1,(n-i)/(sr*3)),v=0.25*fi*fo;
    const L=(Math.sin(2*Math.PI*f.base*t)*0.6+Math.sin(2*Math.PI*f.base*2*t)*0.25+Math.sin(2*Math.PI*f.base*0.5*t)*0.05)*v;
    const R=(Math.sin(2*Math.PI*(f.base+f.beat)*t)*0.6+Math.sin(2*Math.PI*(f.base+f.beat)*2*t)*0.25+Math.sin(2*Math.PI*(f.base+f.beat)*0.5*t)*0.05)*v;
    buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,L))*32767),44+i*4);
    buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,R))*32767),44+i*4+2);
  }
  fs.writeFileSync(filePath,buf);
}

// ─── Generate ambient sound WAV ──────────────────────────────
function generateAmbientWav(type,duration,filePath){
  const sr=44100,n=duration*sr;
  const buf=Buffer.alloc(44+n*4);
  buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVE',8);
  buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);
  buf.writeUInt32LE(sr,24);buf.writeUInt32LE(sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);
  buf.write('data',36);buf.writeUInt32LE(n*4,40);
  let seed=type.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  function rand(){seed=(seed*16807+0)%2147483647;return(seed&0x7fffffff)/2147483647;}
  for(let i=0;i<n;i++){
    const t=i/sr,fi=Math.min(1,i/(sr*2)),fo=Math.min(1,(n-i)/(sr*2)),vol=0.15*fi*fo;
    let sL=0,sR=0;
    if(type==='rain'){const noise=(rand()-0.5)*2;const lfo=Math.sin(2*Math.PI*0.3*t)*0.3+0.7;sL=noise*vol*lfo;sR=noise*vol*(1.3-lfo);}
    else if(type==='ocean'){const noise=(rand()-0.5)*2;const wave=Math.sin(2*Math.PI*0.08*t)*0.5+0.5;sL=noise*vol*wave*0.7;sR=noise*vol*wave*0.7;}
    else if(type==='forest'){const noise=(rand()-0.5)*0.5;const chirp=Math.sin(2*Math.PI*(2000+Math.sin(2*Math.PI*6*t)*500)*t)*(rand()>0.997?1:0);sL=(noise+chirp)*vol;sR=(noise+chirp*0.8)*vol;}
    else if(type==='fire'){const noise=(rand()-0.5)*2;const crackle=rand()>0.998?Math.sin(2*Math.PI*800*t)*0.5:0;sL=(noise*0.3+crackle)*vol;sR=(noise*0.3+crackle*0.8)*vol;}
    else if(type==='wind'){const noise=(rand()-0.5)*2;const lfo=Math.sin(2*Math.PI*0.05*t)*0.4+0.6;sL=noise*vol*lfo;sR=noise*vol*(1.4-lfo);}
    else if(type==='pad'){sL=(Math.sin(2*Math.PI*110*t)*0.4+Math.sin(2*Math.PI*165*t)*0.3+Math.sin(2*Math.PI*55*t)*0.3)*vol;sR=(Math.sin(2*Math.PI*111*t)*0.4+Math.sin(2*Math.PI*166*t)*0.3+Math.sin(2*Math.PI*55.5*t)*0.3)*vol;}
    buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sL))*32767),44+i*4);
    buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sR))*32767),44+i*4+2);
  }
  fs.writeFileSync(filePath,buf);
}

// ─── API: Hypnosis with induction level ─────────────────────
app.get('/api/hypnosis/:session',async(req,res)=>{
  try{
    const session=req.params.session;let text=scripts[session];
    if(!text)return res.status(404).json({error:'Sesión no encontrada'});
    const level=req.query.level||'medio';
    if(inductionLevels[level])text+=inductionLevels[level];
    const voice=req.query.voice||'es-MX-JorgeNeural',rate=req.query.rate||'-40%',pitch=req.query.pitch||'-12Hz';
    const echo=parseInt(req.query.echo)||0,reverb=parseInt(req.query.reverb)||50,bass=parseInt(req.query.bass)||30;
    const download=req.query.download==='true';
    const id='hyp_'+session+'_'+Date.now();
    const ttsFile='/tmp/zenmix_'+id+'.mp3',outFile='/tmp/zenmix_'+id+'_out.mp3';
    await new Promise((resolve,reject)=>{execFile('edge-tts',['--text',text,'--voice',voice,'--rate='+rate,'--pitch='+pitch,'--write-media',ttsFile],{timeout:120000},err=>err?reject(err):resolve());});
    const filters=buildAudioFilter({echo,reverb,bassBoost:bass,fadeIn:3});
    await processAudio(ttsFile,outFile,filters);
    try{fs.unlinkSync(ttsFile)}catch(e){}
    const result=fs.readFileSync(outFile);try{fs.unlinkSync(outFile)}catch(e){}
    res.set('Content-Type','audio/mpeg');
    if(download)res.set('Content-Disposition','attachment; filename="zenmix_'+session+'.mp3"');
    res.send(result);
  }catch(e){console.error('Hypnosis error:',e);res.status(500).json({error:e.message});}
});

// ─── API: AI-generated custom hypnosis ───────────────────────
app.post('/api/generate-script',async(req,res)=>{
  try{
    const{topic,level='medio'}=req.body;
    if(!topic)return res.status(400).json({error:'No topic'});
    // Generate hypnosis script using Ollama
    const prompt=`Eres un experto en hipnosis clínica y psicología frecuencial. Genera un guion completo de hipnosis subliminal en español sobre: "${topic}". El guion debe tener: 1) Relajación inicial con respiración guiada (usa ... para pausas largas), 2) Profundización, 3) Sugestiones terapéuticas específicas para "${topic}", 4) Cierre con ${level==='profundo'?'inducción profunda':level==='superficial'?'regreso suave':'regreso progresivo'}. Usa puntos suspensivos (...) entre frases para ritmo lento. NO uses formato markdown. Solo texto plano con pausas. Máximo 1500 palabras.`;
    const response=await fetch('http://localhost:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'glm-5.1:cloud',prompt,stream:false})});
    const data=await response.json();
    res.json({script:data.response||data.output||'Error generando guion'});
  }catch(e){res.status(500).json({error:e.message});}
});

// ─── API: Custom TTS ─────────────────────────────────────────
app.post('/api/tts',async(req,res)=>{
  try{
    const{text,voice,rate,pitch,echo,reverb,bass,download}=req.body;
    if(!text)return res.status(400).json({error:'No text'});
    const id='tts_'+Date.now(),ttsFile='/tmp/zenmix_'+id+'.mp3',outFile='/tmp/zenmix_'+id+'_out.mp3';
    await new Promise((resolve,reject)=>{execFile('edge-tts',['--text',text.substring(0,5000),'--voice',voice||'es-MX-JorgeNeural','--rate='+(rate||'-40%'),'--pitch='+(pitch||'-12Hz'),'--write-media',ttsFile],{timeout:120000},err=>err?reject(err):resolve());});
    const filters=buildAudioFilter({echo:parseInt(echo)||0,reverb:parseInt(reverb)||50,bassBoost:parseInt(bass)||30,fadeIn:2});
    await processAudio(ttsFile,outFile,filters);
    try{fs.unlinkSync(ttsFile)}catch(e){}
    const result=fs.readFileSync(outFile);try{fs.unlinkSync(outFile)}catch(e){}
    res.set('Content-Type','audio/mpeg');
    if(download)res.set('Content-Disposition','attachment; filename="zenmix_custom.mp3"');
    res.send(result);
  }catch(e){console.error('TTS error:',e);res.status(500).json({error:e.message});}
});

// ─── API: Voice upload/process ───────────────────────────────
app.post('/api/upload-voice',upload.single('audio'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'No audio'});
  res.json({id:req.file.filename,size:req.file.size});
});

app.get('/api/recordings',(req,res)=>{
  const dir='/tmp/zenmix_uploads';if(!fs.existsSync(dir))return res.json([]);
  res.json(fs.readdirSync(dir).filter(f=>!f.startsWith('.')).map(f=>({id:f,size:fs.statSync(path.join(dir,f)).size})));
});

app.delete('/api/recordings/:id',(req,res)=>{
  const f=path.join('/tmp/zenmix_uploads',req.params.id);
  if(fs.existsSync(f)){fs.unlinkSync(f);res.json({ok:true});}else res.status(404).json({error:'Not found'});
});

app.post('/api/process-voice',async(req,res)=>{
  try{
    const{fileId,echo,reverb,bass,pitch,download,trimStart,trimEnd}=req.body;
    if(!fileId)return res.status(400).json({error:'No fileId'});
    const inputPath=path.join('/tmp/zenmix_uploads',fileId);
    if(!fs.existsSync(inputPath))return res.status(404).json({error:'Not found'});
    const id='proc_'+Date.now(),trimmedFile='/tmp/zenmix_'+id+'_trim.mp3',outFile='/tmp/zenmix_'+id+'.mp3';
    let processFile=inputPath;
    const ts=parseFloat(trimStart)||0,te=parseFloat(trimEnd)||0;
    if(ts>0||te>0){
      const dur=await getDuration(inputPath);const endTime=te>0?te:dur;
      await runFfmpeg(['-y','-i',inputPath,'-ss',String(ts),'-to',String(endTime),'-c','copy',trimmedFile]);
      processFile=trimmedFile;
    }
    const filterArray=buildAudioFilter({echo:parseInt(echo)||0,reverb:parseInt(reverb)||50,bassBoost:parseInt(bass)||30,fadeIn:1});
    const pitchVal=parseFloat(pitch)||0;
    let fullFilter;
    if(pitchVal!==0){const pf=Math.pow(2,pitchVal/12);fullFilter=['asetrate=44100*'+pf.toFixed(4)+',aresample=44100',...filterArray];}
    else fullFilter=filterArray;
    await processAudio(processFile,outFile,fullFilter);
    try{fs.unlinkSync(trimmedFile)}catch(e){}
    if(!fs.existsSync(outFile)||fs.statSync(outFile).size===0)return res.status(500).json({error:'Processing failed'});
    const result=fs.readFileSync(outFile);try{fs.unlinkSync(outFile)}catch(e){}
    res.set('Content-Type','audio/mpeg');
    if(download)res.set('Content-Disposition','attachment; filename="zenmix_voz_editada.mp3"');
    res.send(result);
  }catch(e){console.error('Process voice error:',e);res.status(500).json({error:e.message});}
});

// ─── API: Binaural WAV ───────────────────────────────────────
app.get('/api/binaural/:type',(req,res)=>{
  const type=req.params.type,duration=parseInt(req.query.duration)||300;
  const tmpFile='/tmp/zenmix_bin_'+type+'_'+Date.now()+'.wav';
  generateBinauralWav(type,duration,tmpFile);
  const buffer=fs.readFileSync(tmpFile);try{fs.unlinkSync(tmpFile)}catch(e){}
  res.set('Content-Type','audio/wav');
  if(req.query.download==='true')res.set('Content-Disposition','attachment; filename="zenmix_'+type+'_binaural.wav"');
  res.send(buffer);
});

// ─── API: Ambient WAV ────────────────────────────────────────
app.get('/api/ambient/:type',(req,res)=>{
  const type=req.params.type,duration=parseInt(req.query.duration)||300;
  const tmpFile='/tmp/zenmix_amb_'+type+'_'+Date.now()+'.wav';
  generateAmbientWav(type,duration,tmpFile);
  const buffer=fs.readFileSync(tmpFile);try{fs.unlinkSync(tmpFile)}catch(e){}
  res.set('Content-Type','audio/wav');
  if(req.query.download==='true')res.set('Content-Disposition','attachment; filename="zenmix_'+type+'.wav"');
  res.send(buffer);
});

// ─── API: Full mix ───────────────────────────────────────────
app.post('/api/mix-final',upload.single('voiceAudio'),async(req,res)=>{
  try{
    const{binauralType='theta',ambientType='pad',binauralStart=10,binauralEnd=30,ambientStart=5,ambientEnd=30,voiceVolume=80,binauralVolume=40,ambientVolume=30,echo=0,reverb=50,bass=30,download=false}=req.body;
    const voiceFile=req.file?req.file.path:null;
    if(!voiceFile)return res.status(400).json({error:'No voice audio'});
    const id='mix_'+Date.now();
    const processedVoice='/tmp/zenmix_'+id+'_voice.mp3';
    const voiceFilter=buildAudioFilter({echo:parseInt(echo),reverb:parseInt(reverb),bassBoost:parseInt(bass),fadeIn:2});
    await processAudio(voiceFile,processedVoice,voiceFilter);
    const voiceDur=await getDuration(processedVoice);
    const binauralFile='/tmp/zenmix_'+id+'_bin.wav';
    generateBinauralWav(binauralType,parseInt(binauralStart)+voiceDur+parseInt(binauralEnd),binauralFile);
    const ambientFile='/tmp/zenmix_'+id+'_amb.wav';
    generateAmbientWav(ambientType,parseInt(ambientStart)+voiceDur+parseInt(ambientEnd),ambientFile);
    const outFile='/tmp/zenmix_'+id+'_final.mp3';
    const vv=(parseInt(voiceVolume)/100).toFixed(2),bv=(parseInt(binauralVolume)/100).toFixed(2),av=(parseInt(ambientVolume)/100).toFixed(2);
    await runFfmpeg(['-y','-i',binauralFile,'-i',ambientFile,'-i',processedVoice,
      '-filter_complex','[0:a]volume='+bv+'[bin];[1:a]volume='+av+'[amb];[2:a]adelay='+(parseInt(binauralStart)*1000)+'|'+(parseInt(binauralStart)*1000)+',volume='+vv+'[vox];[bin][amb]amix=inputs=2:duration=longest[bg];[bg][vox]amix=inputs=2:duration=longest',
      '-b:a','192k',outFile]);
    try{fs.unlinkSync(processedVoice)}catch(e){}
    try{fs.unlinkSync(binauralFile)}catch(e){}
    try{fs.unlinkSync(ambientFile)}catch(e){}
    if(!fs.existsSync(outFile)||fs.statSync(outFile).size===0)return res.status(500).json({error:'Mix failed'});
    const result=fs.readFileSync(outFile);try{fs.unlinkSync(outFile)}catch(e){}
    res.set('Content-Type','audio/mpeg');
    if(download==='true'||download===true)res.set('Content-Disposition','attachment; filename="zenmix_hipnosis_completa.mp3"');
    res.send(result);
  }catch(e){console.error('Mix error:',e);res.status(500).json({error:e.message});}
});

// ─── SPA ─────────────────────────────────────────────────────
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../public/index.html')));

const PORT=process.env.PORT||3003;
app.listen(PORT,'0.0.0.0',()=>console.log('🧘 ZENMIX server running on http://0.0.0.0:'+PORT));