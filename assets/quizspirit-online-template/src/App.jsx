import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BackgroundMusic } from './music';
import CompanionPanel from './CompanionPanel';
import {api} from './api.js';
import {canUseSpirit} from '../shared/ownership.js';
import { canCapture, captureSucceeds } from './capture';
import { loadSave, saveProgress, chooseStarter, evolve, partnerFor, familyFor, levelFor, recordAnswer } from './growth';
import QuestionBankPanel from './QuestionBankPanel';
import { AUTO_BANK_ID, STORAGE_KEY, validateBank, activeQuestions, drawQuestion, readStoredBanks, writeStoredBanks } from './question-bank';
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
import { 
  Volume2, VolumeX, Sparkles, RefreshCw, Trophy, Shield, 
  Flame, Droplets, Zap, Leaf, Heart, Search, HelpCircle, 
  ChevronRight, Award, Crosshair, CheckCircle2, XCircle, ArrowLeft, Star,
  Clock, AlertTriangle, Music2, Music, X
} from 'lucide-react';

// ==========================================
// 8-Bit Web Audio 合成音效引擎 (無需外部音訊檔)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, delay = 0) {
    if (!this.enabled) return;
    this.init();
    setTimeout(() => {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }, delay);
  }

  tick() {
    this.playTone(800, 'square', 0.05);
  }

  urgentTick() {
    this.playTone(950, 'square', 0.08);
  }

  attack() {
    this.playTone(440, 'square', 0.1);
    this.playTone(220, 'sawtooth', 0.15, 60);
  }

  hit() {
    this.playTone(150, 'triangle', 0.2);
    this.playTone(80, 'sine', 0.25, 40);
  }

  critical() {
    this.playTone(523.25, 'square', 0.08);
    this.playTone(659.25, 'square', 0.08, 70);
    this.playTone(783.99, 'square', 0.12, 140);
    this.playTone(1046.50, 'square', 0.2, 210);
  }

  ballThrow() {
    this.playTone(300, 'sine', 0.1);
    this.playTone(600, 'sine', 0.15, 80);
    this.playTone(900, 'sine', 0.2, 160);
  }

  ballShake() {
    this.playTone(400, 'triangle', 0.08);
    this.playTone(350, 'triangle', 0.1, 90);
  }

  catchSuccess() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 987.77, 1046.50];
    const times = [0, 100, 200, 300, 420, 560];
    notes.forEach((n, i) => this.playTone(n, 'square', 0.18, times[i]));
  }

  faint() {
    this.playTone(400, 'sawtooth', 0.15);
    this.playTone(300, 'sawtooth', 0.15, 120);
    this.playTone(200, 'sawtooth', 0.2, 240);
    this.playTone(120, 'sawtooth', 0.3, 360);
  }

  error() {
    this.playTone(220, 'sawtooth', 0.15);
    this.playTone(180, 'sawtooth', 0.25, 100);
  }
}

const sfx = new SoundFX();

// ==========================================
// 預設與熱門題靈資料庫 (各區域中英名稱與屬性)
// ==========================================
const GENERATIONS = [
  { gen: 1, name: '第一區 (晨光草原)', range: [1, 151] },
  { gen: 2, name: '第二區 (星砂海岸)', range: [152, 251] },
  { gen: 3, name: '第三區 (雲霧山谷)', range: [252, 386] },
  { gen: 4, name: '第四區 (古書森林)', range: [387, 493] },
  { gen: 5, name: '第五區 (機關城)', range: [494, 649] },
  { gen: 6, name: '第六區 (彩虹湖)', range: [650, 721] },
  { gen: 7, name: '第七區 (熔岩島)', range: [722, 809] },
  { gen: 8, name: '第八區 (極光雪原)', range: [810, 898] },
  { gen: 9, name: '第九區 (星空神殿)', range: [899, 1010] },
];

const POPULAR_SPIRIT = [
  // Gen 1
  { id: 25, name: 'Zappip', zhName: '雷啾啾', type: 'electric', gen: 1 },
  { id: 6, name: 'Pyrelord', zhName: '赤焰狐王', type: 'fire', gen: 1 },
  { id: 9, name: 'Abyssail', zhName: '滄海鯨帆', type: 'water', gen: 1 },
  { id: 3, name: 'Grovecrown', zhName: '森冠獸', type: 'grass', gen: 1 },
  { id: 94, name: 'Gloomwisp', zhName: '幽燈靈', type: 'ghost', gen: 1 },
  { id: 130, name: 'Surgefang', zhName: '怒濤牙', type: 'water', gen: 1 },
  { id: 131, name: 'Melodrift', zhName: '歌帆獸', type: 'water', gen: 1 },
  { id: 143, name: 'Dozebun', zhName: '瞌睡糰', type: 'normal', gen: 1 },
  { id: 150, name: 'Mindrune', zhName: '心紋獸', type: 'psychic', gen: 1 },
  { id: 151, name: 'Bubbleseer', zhName: '泡泡占星', type: 'psychic', gen: 1 },
  // Gen 2
  { id: 157, name: 'Cindermane', zhName: '燼鬃獸', type: 'fire', gen: 2 },
  { id: 160, name: 'Snapjaw', zhName: '鉗顎獸', type: 'water', gen: 2 },
  { id: 154, name: 'Petalune', zhName: '花月獸', type: 'grass', gen: 2 },
  { id: 196, name: 'Solmira', zhName: '日輝靈', type: 'psychic', gen: 2 },
  { id: 197, name: 'Lunashade', zhName: '月影靈', type: 'dark', gen: 2 },
  { id: 248, name: 'Boulderhorn', zhName: '岩角王', type: 'rock', gen: 2 },
  { id: 249, name: 'Gustseer', zhName: '風語者', type: 'psychic', gen: 2 },
  { id: 250, name: 'Sunplume', zhName: '日羽鳳', type: 'fire', gen: 2 },
  // Gen 3
  { id: 254, name: 'Thornblade', zhName: '棘刃獸', type: 'grass', gen: 3 },
  { id: 257, name: 'Flarestrike', zhName: '焰踢鬥士', type: 'fire', gen: 3 },
  { id: 260, name: 'Mudmarsh', zhName: '泥沼獸', type: 'water', gen: 3 },
  { id: 282, name: 'Veilmuse', zhName: '紗靈繆斯', type: 'psychic', gen: 3 },
  { id: 373, name: 'Skyscale', zhName: '天鱗龍', type: 'dragon', gen: 3 },
  { id: 376, name: 'Gearhulk', zhName: '齒輪巨像', type: 'steel', gen: 3 },
  { id: 384, name: 'Stormcoil', zhName: '雲渦龍', type: 'dragon', gen: 3 },
  // Gen 4
  { id: 392, name: 'Emberleap', zhName: '躍焰猿', type: 'fire', gen: 4 },
  { id: 395, name: 'Frostfin', zhName: '霜鰭帝', type: 'water', gen: 4 },
  { id: 389, name: 'Mossback', zhName: '苔背龜', type: 'grass', gen: 4 },
  { id: 448, name: 'Auraknight', zhName: '氣勁騎士', type: 'fighting', gen: 4 },
  { id: 445, name: 'Dunefang', zhName: '沙鋸龍', type: 'dragon', gen: 4 },
  { id: 470, name: 'Leaflet', zhName: '葉語靈', type: 'grass', gen: 4 },
  { id: 471, name: 'Snowveil', zhName: '雪紗靈', type: 'ice', gen: 4 },
  { id: 483, name: 'Chronogear', zhName: '時軸獸', type: 'steel', gen: 4 },
  { id: 484, name: 'Rifttide', zhName: '裂潮獸', type: 'water', gen: 4 },
  // Gen 5
  { id: 497, name: 'Verdantcoil', zhName: '翠環蛇', type: 'grass', gen: 5 },
  { id: 500, name: 'Forgehog', zhName: '熔鐵豬', type: 'fire', gen: 5 },
  { id: 503, name: 'Shellblade', zhName: '貝刃士', type: 'water', gen: 5 },
  { id: 571, name: 'Shadetrick', zhName: '幻影狐', type: 'dark', gen: 5 },
  { id: 609, name: 'Candlewisp', zhName: '燭火靈', type: 'ghost', gen: 5 },
  { id: 635, name: 'Tripleroar', zhName: '三吼龍', type: 'dragon', gen: 5 },
  { id: 643, name: 'Blazewyrm', zhName: '白焰龍', type: 'dragon', gen: 5 },
  { id: 644, name: 'Thunderwyrm', zhName: '黑雷龍', type: 'dragon', gen: 5 },
  // Gen 6
  { id: 658, name: 'Mistninja', zhName: '霧隱蛙', type: 'water', gen: 6 },
  { id: 655, name: 'Wandfox', zhName: '杖焰狐', type: 'fire', gen: 6 },
  { id: 652, name: 'Bramblewall', zhName: '棘盾獸', type: 'grass', gen: 6 },
  { id: 700, name: 'Ribbonette', zhName: '緞帶靈', type: 'fairy', gen: 6 },
  { id: 716, name: 'Prismstag', zhName: '虹角鹿', type: 'fairy', gen: 6 },
  { id: 717, name: 'Duskwing', zhName: '暮翼鳥', type: 'dark', gen: 6 },
  // Gen 7
  { id: 724, name: 'Arrowl', zhName: '箭羽梟', type: 'grass', gen: 7 },
  { id: 727, name: 'Ringblaze', zhName: '擂焰虎', type: 'fire', gen: 7 },
  { id: 730, name: 'Seasong', zhName: '海詠者', type: 'water', gen: 7 },
  { id: 778, name: 'Patchling', zhName: '布偶靈', type: 'ghost', gen: 7 },
  { id: 785, name: 'Sparkguard', zhName: '雷守靈', type: 'electric', gen: 7 },
  // Gen 8
  { id: 815, name: 'Kickflare', zhName: '焰球兔', type: 'fire', gen: 8 },
  { id: 818, name: 'Agentide', zhName: '潛水蜥', type: 'water', gen: 8 },
  { id: 812, name: 'Drumgrove', zhName: '鼓林猩', type: 'grass', gen: 8 },
  { id: 887, name: 'Phantomglide', zhName: '幽滑龍', type: 'dragon', gen: 8 },
  { id: 888, name: 'Swordbloom', zhName: '劍華狼', type: 'fairy', gen: 8 },
  // Gen 9
  { id: 908, name: 'Maskbloom', zhName: '花面貓', type: 'grass', gen: 9 },
  { id: 911, name: 'Bonechant', zhName: '骨歌鱷', type: 'fire', gen: 9 },
  { id: 914, name: 'Dancewave', zhName: '浪舞鴨', type: 'water', gen: 9 },
  { id: 954, name: 'Rollbeetle', zhName: '滾珠蟲', type: 'bug', gen: 9 },
  { id: 1007, name: 'Rumbleclaw', zhName: '轟爪獸', type: 'fighting', gen: 9 },
  { id: 1008, name: 'Circuitwing', zhName: '電路翼', type: 'electric', gen: 9 }
];

const TYPE_COLORS = {
  normal: { bg: 'bg-stone-500', text: 'text-stone-100', border: 'border-stone-600', zh: '一般' },
  fire: { bg: 'bg-orange-600', text: 'text-orange-100', border: 'border-orange-700', zh: '火' },
  water: { bg: 'bg-blue-600', text: 'text-blue-100', border: 'border-blue-700', zh: '水' },
  grass: { bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-700', zh: '草' },
  electric: { bg: 'bg-amber-500', text: 'text-amber-950', border: 'border-amber-600', zh: '電' },
  ice: { bg: 'bg-cyan-500', text: 'text-cyan-950', border: 'border-cyan-600', zh: '冰' },
  fighting: { bg: 'bg-red-700', text: 'text-red-100', border: 'border-red-800', zh: '格鬥' },
  poison: { bg: 'bg-purple-600', text: 'text-purple-100', border: 'border-purple-700', zh: '毒' },
  ground: { bg: 'bg-yellow-700', text: 'text-yellow-100', border: 'border-yellow-800', zh: '地面' },
  flying: { bg: 'bg-indigo-400', text: 'text-indigo-950', border: 'border-indigo-500', zh: '飛行' },
  psychic: { bg: 'bg-pink-600', text: 'text-pink-100', border: 'border-pink-700', zh: '超能力' },
  bug: { bg: 'bg-lime-600', text: 'text-lime-100', border: 'border-lime-700', zh: '蟲' },
  rock: { bg: 'bg-stone-600', text: 'text-stone-100', border: 'border-stone-700', zh: '岩石' },
  ghost: { bg: 'bg-purple-900', text: 'text-purple-100', border: 'border-purple-950', zh: '幽靈' },
  dragon: { bg: 'bg-indigo-700', text: 'text-indigo-100', border: 'border-indigo-800', zh: '龍' },
  dark: { bg: 'bg-zinc-800', text: 'text-zinc-100', border: 'border-zinc-900', zh: '惡' },
  steel: { bg: 'bg-slate-500', text: 'text-slate-100', border: 'border-slate-600', zh: '鋼' },
  fairy: { bg: 'bg-rose-400', text: 'text-rose-950', border: 'border-rose-500', zh: '妖精' }
};

// ==========================================
// 輔助工具：取得原創題靈角色圖（public/assets/<id>.png）
// ==========================================
const getSpriteUrl = (id) => `./assets/${id}.png`;

const getStaticSpriteFallback = (id) => `./assets/${id}.png`;

// ==========================================
// 數學題目生成器
// ==========================================
const generateMathProblem = (difficulty = 'medium', type = 'attack') => {
  let question = '';
  let answer = 0;
  let options = [];

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  if (difficulty === 'easy') {
    // 基礎加減法 (1~30)
    const op = Math.random() > 0.4 ? '+' : '-';
    if (op === '+') {
      const a = rand(3, 30);
      const b = rand(3, 30);
      question = `${a} + ${b}`;
      answer = a + b;
    } else {
      const a = rand(15, 60);
      const b = rand(2, a - 1);
      question = `${a} - ${b}`;
      answer = a - b;
    }
  } else if (difficulty === 'medium') {
    // 乘除法與雙位數運算
    const mode = rand(1, 3);
    if (mode === 1) {
      // 九九乘法表或二位數乘法
      const a = rand(3, 12);
      const b = rand(3, 12);
      question = `${a} × ${b}`;
      answer = a * b;
    } else if (mode === 2) {
      // 整除法
      const b = rand(3, 9);
      const ans = rand(3, 12);
      const a = b * ans;
      question = `${a} ÷ ${b}`;
      answer = ans;
    } else {
      // 兩位數混合運算
      const a = rand(20, 80);
      const b = rand(15, 60);
      question = `${a} + ${b}`;
      answer = a + b;
    }
  } else if (difficulty === 'hard') {
    // 混合四則運算 (先乘除後加減 / 括號)
    const mode = rand(1, 3);
    if (mode === 1) {
      const a = rand(3, 9);
      const b = rand(3, 8);
      const c = rand(5, 30);
      question = `${a} × ${b} + ${c}`;
      answer = (a * b) + c;
    } else if (mode === 2) {
      const a = rand(30, 80);
      const b = rand(2, 6);
      const c = rand(2, 6);
      question = `${a} - ${b} × ${c}`;
      answer = a - (b * c);
    } else {
      const a = rand(4, 12);
      const b = rand(3, 8);
      const c = rand(2, 5);
      question = `(${a} + ${b}) × ${c}`;
      answer = (a + b) * c;
    }
  } else {
    // 大師級 (Champion)：代數方程式或快速連續運算
    const x = rand(3, 20);
    const m = rand(2, 7);
    const c = rand(4, 25);
    const total = m * x + c;
    question = `${m}x + ${c} = ${total}，求 x = ?`;
    answer = x;
  }

  // 產生 4 個不重複的干擾選項
  const optSet = new Set([answer]);
  while (optSet.size < 4) {
    const delta = rand(-12, 12);
    const wrong = answer + delta;
    if (wrong !== answer && wrong >= 0) {
      optSet.add(wrong);
    } else {
      optSet.add(answer + rand(1, 15) * (Math.random() > 0.5 ? 1 : -1));
    }
  }
  options = Array.from(optSet).sort(() => Math.random() - 0.5);

  return { question, answer, options };
};

// ==========================================
// 主應用程式 Component
// ==========================================
export default function App({cloud,act,user,cloudBanks,refreshBanks,cloudBusy}) {
  // 畫面模式: 'select' (挑選題靈) | 'battle' (對戰) | 'box' (題靈盒)
  const [initialSave] = useState(() => ({growth:cloud.growth,captured:cloud.captured,selected:cloud.selected,notice:""}));
  const combatResult = useRef(null);
  const [retryChoice,setRetryChoice] = useState(null);
  const [growth, setGrowth] = useState(initialSave.growth);
  const growthRef = useRef(growth);
  const answerLock = useRef(false);
  const [saveNotice, setSaveNotice] = useState(initialSave.notice);
  const [growthReward, setGrowthReward] = useState('');
  const [view, setView] = useState('select');
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [musicPanel, setMusicPanel] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const musicRef = useRef(null);
  const [difficulty, setDifficulty] = useState('medium');
  const questionBanks = cloudBanks;
  const [selectedBankId, setSelectedBankId] = useState(AUTO_BANK_ID);
  const [bankNotice, setBankNotice] = useState('');
  const [questionFeedback, setQuestionFeedback] = useState(null);
  const questionDecks = useRef({});
  const importing = useRef(false);
  const selectedBank = questionBanks.find(bank => bank.bankId === selectedBankId);
  const changeBank = async (id) => { try { await act('/bank/change'); setSelectedBankId(id); setQuestionFeedback(null); } catch {} };
  const importBanks = async event => {
    const files=Array.from(event.target.files||[]); event.target.value='';
    if(importing.current||!files.length)return; importing.current=true;
    const messages=[];
    try { for(const file of files) { try { if(file.size>5*1024*1024)throw Error('檔案超過 5 MB。');const bank=JSON.parse((await file.text()).replace(/^\uFEFF/,''));const r=await api('/admin/banks',{bank});messages.push(file.name+'：已匯入 '+r.count+' 題'); }catch(e){messages.push(file.name+'：'+e.message);} }await refreshBanks();setBankNotice(messages.join('。')); }finally{importing.current=false;}
  };
  const [activeGen, setActiveGen] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // 玩家與對手
  const [playerSpirit, setPlayerSpirit] = useState(initialSave.selected || partnerFor(initialSave.growth) || POPULAR_SPIRIT[0]);
  const [potionNotice,setPotionNotice]=useState('');
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const combatLevel = 25; // Preserve the original battle balance.
  const isGrowingPartner = familyFor(growth)?.some(p => p.id === playerSpirit.id);
  const playerLevel = isGrowingPartner ? levelFor(growth.xp) : combatLevel;

  const [enemySpirit, setEnemySpirit] = useState(POPULAR_SPIRIT[1]); // Pyrelord
  const [enemyHp, setEnemyHp] = useState(120);
  const [enemyMaxHp, setEnemyMaxHp] = useState(120);
  const [enemyLevel, setEnemyLevel] = useState(24);

  // 捕獲清單 (背包/圖鑑)
  const [capturedList, setCapturedList] = useState(initialSave.captured || [POPULAR_SPIRIT[0]]);

  const updateGrowth = next => { growthRef.current=next;setGrowth(next); };
  useEffect(()=>{updateGrowth(cloud.growth);setCapturedList(cloud.captured);setPlayerSpirit(cloud.selected||partnerFor(cloud.growth)||POPULAR_SPIRIT[0]);},[cloud]);
  const selectStarter = async id => {try {const r=await act('/starter',{id});updateGrowth(r.state.growth);setPlayerSpirit(partnerFor(r.state.growth));setGrowthReward('相遇的第一天！一起開始新的旅程。');}catch{}};
  const evolvePartner = async () => {try {const r=await act('/evolve');updateGrowth(r.state.growth);setGrowthReward(r.event.message);sfx.catchSuccess();}catch{}};
  // 對戰狀態
  const [battleState, setBattleState] = useState('ready'); // 'ready', 'playerTurn', 'mathPending', 'animating', 'enemyTurn', 'catching', 'won', 'lost', 'caught'
  const [battleLogs, setBattleLogs] = useState([]);
  const [selectedMove, setSelectedMove] = useState(null);
  const [currentMath, setCurrentMath] = useState(null);
  const [mathTimer, setMathTimer] = useState(15);
  const [maxMathTimer, setMaxMathTimer] = useState(15);
  const [winStreak, setWinStreak] = useState(0);

  const musicTheme = view !== 'battle' ? 'adventure' : ['won', 'caught'].includes(battleState) ? 'victory' : battleState === 'lost' ? 'rest' : 'battle';
  const musicTitles = { adventure: '輕快出發', battle: '腦力交鋒', victory: '勝利時刻', rest: '再次啟程' };

  useEffect(() => {
    const music = new BackgroundMusic();
    musicRef.current = music;
    const unlock = async () => {
      const ready = await music.unlock();
      setMusicReady(ready);
    };
    const visibility = () => music.configure({ hidden: document.hidden });
    const escape = (event) => { if (event.key === 'Escape') setMusicPanel(false); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('visibilitychange', visibility);
      music.dispose();
      musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    musicRef.current?.configure({ enabled: musicOn, volume: musicVolume, theme: musicTheme, hidden: document.hidden });
  }, [musicOn, musicVolume, musicTheme]);

  // 動畫視覺狀態
  const [playerAnim, setPlayerAnim] = useState(''); // 'shake', 'attack', 'faint'
  const [enemyAnim, setEnemyAnim] = useState('');
  const [catchShakeStep, setCatchShakeStep] = useState(0); // 0, 1, 2, 3, 4 (Success)
  const [damagePopup, setDamagePopup] = useState(null); // { target: 'enemy'|'player', text: string, type: string }

  // 額外加入的自訂題靈（預設為空）
  const [customSpiritList, setCustomSpiritList] = useState([]);

  // 計時器倒數邏輯
  useEffect(() => {
    let timerId = null;
    if (battleState === 'mathPending' && mathTimer > 0) {
      timerId = setInterval(() => {
        setMathTimer((prev) => {
          if (prev <= 4 && prev > 1) {
            sfx.urgentTick();
          } else if (prev > 4) {
            sfx.tick();
          }
          return prev - 1;
        });
      }, 1000);
    } else if (battleState === 'mathPending' && mathTimer === 0 && !answerLock.current) {
      handleAnswerSubmit(null);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [battleState, mathTimer]);

  // 切換音效開關
  useEffect(() => {
    sfx.enabled = soundOn;
  }, [soundOn]);

  // 加入對戰日誌
  const addLog = (text) => {
    setBattleLogs((prev) => [text, ...prev.slice(0, 7)]);
  };

  // 隨機挑選野生地圖對手
  const spawnEnemy = async (chosenId=playerSpirit.id,heal=false) => {
    setBattleState('loading');setEnemyAnim('');setPlayerAnim('');setDamagePopup(null);
    try { const r=await act('/battle/start',{playerId:chosenId,heal});const b=r.state.battle;setPlayerSpirit(r.state.selected);
      setEnemySpirit(b.enemy);setEnemyMaxHp(b.maxHp);setEnemyHp(b.hp);setEnemyLevel(b.level);setPlayerHp(b.playerHp);setPlayerMaxHp(b.playerMaxHp);setBattleState('ready');setCatchShakeStep(0);setBattleLogs(['野生的 '+b.enemy.zhName+' 出現了！']);
    } catch {setBattleState('ready');setView('select');}
  };
  const startBattle = async (chosenPlayer=playerSpirit) => {
    if(!growthRef.current.starter){setSaveNotice('先選一位養成夥伴，再一起出發吧！');document.querySelector('[aria-label="夥伴養成"]')?.scrollIntoView({behavior:'smooth'});return;}
    if(!canUseSpirit(cloud,chosenPlayer.id)){setSaveNotice('尚未成功收服這個角色，請先收服再選擇出戰。');return;}setSaveNotice('');setPlayerSpirit(chosenPlayer);setView('battle');window.scrollTo({top:0,behavior:'instant'});await spawnEnemy(chosenPlayer.id,true);
  };

  // 技能定義
  const moves = useMemo(() => {
    const typeInfo = TYPE_COLORS[playerSpirit.type] || TYPE_COLORS.normal;
    return [
      {
        id: 'quick',
        name: '快速電擊 / 衝撞',
        type: 'normal',
        power: '低威力 (20-30)',
        diff: 'easy',
        desc: '難度：初級加減法。出手穩定！',
        color: 'from-amber-400 to-amber-500'
      },
      {
        id: 'special',
        name: `${typeInfo.zh}屬性特攻`,
        type: playerSpirit.type,
        power: '高威力 (45-60)',
        diff: 'medium',
        desc: '難度：中級乘除法。屬性重擊！',
        color: 'from-blue-500 to-indigo-600'
      },
      {
        id: 'critical',
        name: '全力暴擊奧義',
        type: 'fighting',
        power: '超絕大傷害 (75-95)',
        diff: 'hard',
        desc: '難度：混合四則。高風險超高傷害！',
        color: 'from-red-500 to-rose-700'
      },
      {
        id: 'catch',
        name: '丟出晶球 (收服)',
        type: 'catch',
        power: '收服目標',
        diff: 'easy',
        desc: canCapture(enemyHp, enemyMaxHp) ? 'HP 已剩 5% 以下，可以收服！' : 'HP 須剩 5% 以下才能收服。',
        color: 'from-emerald-500 to-teal-600'
      }
    ];
  }, [playerSpirit, enemyHp, enemyMaxHp]);

  // 選擇動作 -> 啟動算術題
  const handleSelectMove = async move => {
    if(!['ready','playerTurn'].includes(battleState)||cloudBusy)return;
    setBattleState('loading');setSelectedMove(move);setQuestionFeedback(null);
    try { const r=await act('/question',{bankId:selectedBankId,move:move.id});const q=r.event.question;
      answerLock.current=false;setMaxMathTimer(q.timeLimit);setMathTimer(Math.max(0,Math.ceil((q.expires-Date.now())/1000)));setCurrentMath(q);setBattleState('mathPending');sfx.attack();
    } catch {setBattleState('ready');}
  };
  const handleAnswerSubmit = async selectedOption => {
    if(!currentMath||!['mathPending','answerError'].includes(battleState)||answerLock.current)return;
    answerLock.current=true;setBattleState('submitting');
    try {const r=await act('/answer',{questionId:currentMath.id,choice:selectedOption});const e=r.event;combatResult.current=e.combat;updateGrowth(r.state.growth);
      setQuestionFeedback({correct:e.correct,question:e.question,answer:e.answerText,explanation:e.explanation,sourceRef:e.sourceRef});
      setGrowthReward((e.correct?'答對了！':'這次也累積了一次練習。')+' ＋'+e.reward.gained+' XP'+(e.reward.complete?' · 完成一輪，獲得 1 份食物！':''));
      if(e.correct){sfx.critical();addLog('答對了！正確答案：'+e.answerText);if(selectedMove.id==='catch')executeCatchAttempt();else executePlayerAttack(selectedMove);}
      else{sfx.error();addLog((e.timedOut?'時間到！':'再試一次！')+'正確答案：'+e.answerText);setBattleState('animating');setTimeout(()=>executeEnemyTurn(),1200);}
    }catch {setRetryChoice({choice:selectedOption});setBattleState('answerError');answerLock.current=false;}
  };

  // 玩家執行攻擊
  const executePlayerAttack = (move) => {
    setBattleState('animating');
    setPlayerAnim('translate-x-6 -translate-y-3 scale-105');

    setTimeout(() => {
      setPlayerAnim('');
      setEnemyAnim('animate-bounce brightness-150');

      const baseDmg = combatResult.current.damage;
      const newEnemyHp = combatResult.current.hp;
      setEnemyHp(newEnemyHp);
      sfx.hit();

      setDamagePopup({ target: 'enemy', text: `-${baseDmg}`, type: 'player' });
      addLog(`💥 ${playerSpirit.zhName || playerSpirit.name} 使用了【${move.name}】！造成 ${baseDmg} 點傷害！`);

      setTimeout(() => {
        setEnemyAnim('');
        setDamagePopup(null);

        if (newEnemyHp <= 0) {
          handleVictory();
        } else {
          executeEnemyTurn();
        }
      }, 1000);
    }, 400);
  };

  // 執行收服邏輯
  const executeCatchAttempt = () => {
    if (!canCapture(enemyHp, enemyMaxHp)) {
      addLog('對手 HP 未符合 5% 以下的條件，無法收服。');
      setBattleState('ready');
      return;
    }
    setBattleState('catching');
    sfx.ballThrow();
    addLog(`🔴 丟出了晶球！去吧！`);

    const isSuccess = combatResult.current.caught;

    // 晃動動畫 (1, 2, 3 次)
    setCatchShakeStep(1);
    setTimeout(() => {
      sfx.ballShake();
      setCatchShakeStep(2);
      setTimeout(() => {
        sfx.ballShake();
        setCatchShakeStep(3);
        setTimeout(() => {
          if (isSuccess) {
            sfx.catchSuccess();
            setCatchShakeStep(4); // 捕捉成功
            handleCatchSuccess();
          } else {
            sfx.faint();
            setCatchShakeStep(0);
            addLog(`💨 可惜！野生的 ${enemySpirit.zhName || enemySpirit.name} 掙脫了晶球！`);
            setTimeout(() => {
              executeEnemyTurn();
            }, 1000);
          }
        }, 800);
      }, 800);
    }, 800);
  };

  // 收服成功結算
  const handleCatchSuccess = () => {
    addLog(`🎉 太棒了！成功收服了野生的 ${enemySpirit.zhName || enemySpirit.name}！已存入圖鑑箱子！`);
    setWinStreak((prev) => prev + 1);
    setBattleState('caught');
  };

  // 玩家戰勝
  const handleVictory = () => {
    sfx.catchSuccess();
    setEnemyAnim('opacity-0 scale-50 transition-all duration-700');
    addLog(`🏆 對手的 ${enemySpirit.zhName || enemySpirit.name} 倒下了！你獲得了勝利！`);
    setWinStreak((prev) => prev + 1);
    setBattleState('won');
  };

  // 對手反擊回合
  const executeEnemyTurn = () => {
    setBattleState('enemyTurn');
    addLog(`⚡ 野生的 ${enemySpirit.zhName || enemySpirit.name} 正在凝聚力量進行反擊！`);

    setTimeout(() => {
      setEnemyAnim('-translate-x-6 translate-y-3 scale-105');
      setTimeout(() => {
        setEnemyAnim('');
        setPlayerAnim('animate-bounce brightness-150');

        const enemyDmg = combatResult.current.enemyDamage;
        const newPlayerHp = combatResult.current.playerHp;
        setPlayerHp(newPlayerHp);
        sfx.hit();
        setDamagePopup({ target: 'player', text: `-${enemyDmg}`, type: 'enemy' });
        addLog(`💥 ${enemySpirit.zhName || enemySpirit.name} 反擊命中！受到 ${enemyDmg} 點傷害！`);

        setTimeout(() => {
          setPlayerAnim('');
          setDamagePopup(null);

          if (newPlayerHp <= 0) {
            sfx.faint();
            addLog(`💔 你的 ${playerSpirit.zhName || playerSpirit.name} 眼前一片漆黑...`);
            setWinStreak(0);
            setBattleState('lost');
          } else {
            setBattleState('ready');
          }
        }, 900);
      }, 400);
    }, 1000);
  };

  // 篩選區域題靈
  const filteredSpirit = useMemo(() => {
    return POPULAR_SPIRIT.filter((p) => {
      const matchGen = activeGen === 'all' || p.gen === activeGen;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.zhName.includes(searchQuery);
      return matchGen && matchSearch;
    });
  }, [activeGen, searchQuery]);

  // 搜尋只在本機名冊中篩選（名稱或編號），不連外部服務
  const submitSearch = (e) => { e.preventDefault(); };

  // 計算血條百分比與顏色
  const getHpColor = (current, max) => {
    const ratio = current / max;
    if (ratio > 0.5) return 'bg-emerald-500';
    if (ratio > 0.2) return 'bg-amber-400 animate-pulse';
    return 'bg-red-500 animate-pulse';
  };

  const artwork = (id) => `./assets/${id}.png`;
  const typeLabel = (spirit) => TYPE_COLORS[spirit.type]?.zh || spirit.type;
  const difficultyNames = {easy:'初級冒險者', medium:'精英冒險者', hard:'守關大師', champion:'冒險冠軍'};
  const available = [...customSpiritList.filter(p=>!POPULAR_SPIRIT.some(x=>x.id===p.id)), ...filteredSpirit];
  const busy = !['ready','playerTurn','won','lost','caught'].includes(battleState);
  const renderCard = (spirit, inBox=false) => <button key={spirit.id} className={`spirit-card ${playerSpirit.id===spirit.id?'selected':''} ${canUseSpirit(cloud,spirit.id)?'':'is-locked'} type-${spirit.type}`} disabled={!canUseSpirit(cloud,spirit.id)} onClick={()=>{if(canUseSpirit(cloud,spirit.id))setPlayerSpirit(spirit);}} aria-pressed={playerSpirit.id===spirit.id&&canUseSpirit(cloud,spirit.id)} aria-label={`選擇${spirit.zhName || spirit.name}${canUseSpirit(cloud,spirit.id)?'':'（尚未收服）'}`}>
    <div className="card-top"><span>No. {String(spirit.id).padStart(3,'0')}</span>{playerSpirit.id===spirit.id ? <CheckCircle2 size={19}/> : <span className="mini-ball"/>}</div>
    <div className="card-image"><img loading="lazy" src={artwork(spirit.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=getStaticSpriteFallback(spirit.id);}} alt={spirit.zhName || spirit.name}/></div>
    <div className="card-name">{spirit.zhName || spirit.name}</div><div className="card-en">{spirit.name}</div><span className={`type-badge type-${spirit.type}`}>{typeLabel(spirit)}</span>
    <div className="card-bottom">{!canUseSpirit(cloud,spirit.id)?'🔒 尚未收服':playerSpirit.id===spirit.id?'目前出戰夥伴':inBox?'點選設為夥伴':'已解鎖 · 點選出戰'}<ChevronRight size={14}/></div>
  </button>;
  const hpPanel = (spirit, hp, max, level, enemy=false) => <div className={`hp-panel ${enemy?'enemy-hp':'player-hp'}`}>
    <div className="hp-name"><strong>{spirit.zhName || spirit.name}</strong><span>{!enemy && isGrowingPartner ? '養成 ' : ''}Lv. {level}</span></div><div className="hp-meta"><span className={`type-badge type-${spirit.type}`}>{typeLabel(spirit)}</span><span>{enemy?'野生題靈':'你的冒險夥伴'}</span></div>
    <div className="hp-track"><span style={{width:`${hp/max*100}%`,background:hp/max>.5?'#4de0a6':hp/max>.2?'#f5cc55':'#ff6a79'}}/></div><div className="hp-numbers"><span>{enemy && canCapture(hp, max)?'可嘗試收服':'HP 生命值'}</span><b>{hp} <small>/ {max}</small></b></div>
  </div>;
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><button className="brand" onClick={()=>{if(!busy || view!=='battle')setView('select')}} aria-label="QuizSpirit 首頁"><span className="brand-ball"/><span>QUIZ<span className="yellow">SPIRIT</span><small>題 靈 冒 險</small></span></button>
      <nav aria-label="主要選單"><button className={view==='select'?'active':''} disabled={view==='battle'&&busy} onClick={()=>setView('select')}><Crosshair size={17}/><span>冒險準備</span></button><button className={view==='battle'?'active':''} disabled={view!=='battle'} onClick={()=>setView('battle')}><Zap size={17}/><span>對戰場</span></button><button className={view==='box'?'active':''} disabled={view==='battle'&&busy} onClick={()=>setView('box')}><Award size={17}/><span>我的圖鑑</span><b>{capturedList.length}</b></button></nav>
      <div className="audio-controls"><div className="music-control"><button className={`sound-button music-button ${musicOn?'music-enabled':''}`} onClick={()=>setMusicPanel(!musicPanel)} aria-label="配樂設定" aria-expanded={musicPanel} aria-controls="music-settings" title="配樂設定"><Music2 size={19}/>{musicOn&&musicReady&&<span className="music-status-dot"/>}</button>
      {musicPanel && <section id="music-settings" className="music-settings" aria-label="配樂設定面板"><div className="music-settings-heading"><strong><Music size={17}/> 冒險配樂</strong><button className="music-close" aria-label="關閉配樂設定" onClick={()=>setMusicPanel(false)}><X size={17}/></button></div><p className="music-now">{!musicOn?'配樂已暫停':!musicReady?'點擊操作後，音樂就會開始':`正在播放 · ${musicTitles[musicTheme]}`}</p><button className={`music-toggle ${musicOn?'is-on':''}`} role="switch" aria-checked={musicOn} aria-label="背景配樂" onClick={()=>setMusicOn(!musicOn)}><span>{musicOn?'配樂開啟':'配樂關閉'}</span><span className="toggle-track"><span/></span></button><label className="music-volume-label" htmlFor="music-volume">配樂音量 <b>{Math.round(musicVolume*100)}%</b></label><input id="music-volume" className="music-volume" type="range" min="0" max="100" step="1" value={Math.round(musicVolume*100)} onChange={e=>setMusicVolume(Number(e.target.value)/100)} aria-label="配樂音量"/><small className="music-note">原創 8-bit 旋律，隨場景切換。<br/>右側喇叭可獨立開關遊戲音效。</small></section>}</div>
      <button className="sound-button" onClick={()=>setSoundOn(!soundOn)} aria-label={soundOn?'關閉音效':'開啟音效'} title={soundOn?'關閉音效':'開啟音效'}>{soundOn?<Volume2 size={19}/>:<VolumeX size={19}/>}</button></div>
    </div></header>
    <main className="main-wrap">
      {view !== 'battle' && <CompanionPanel cloud={cloud} act={act} bankId={selectedBankId} artwork={artwork} onChoose={selectStarter} onEvolve={evolvePartner} onStart={()=>startBattle(playerSpirit)} notice={saveNotice} reward={growthReward} busy={cloudBusy}/>}
      {view === 'battle' && <div className="growth-status" role="status">{partnerFor(growth)?.zhName} · 養成 Lv. {levelFor(growth.xp)} · {growthReward || '答題累積經驗值，回到冒險準備即可查看進化。'}{saveNotice && <p role="alert">{saveNotice}</p>}</div>}
      {view==='select' && <>
        <div className="page-eyebrow"><span className="live-dot"/> ADVENTURE AWAITS <span className="eyebrow-line"/> 每一道題，都是冒險的開始</div>
        <QuestionBankPanel canImport={user.role==='teacher'} banks={questionBanks} selectedId={selectedBankId} onChange={changeBank} onImport={importBanks} notice={bankNotice}/>
        <section className="hero"><div className="hero-copy"><span className="section-label">算出你的超能力</span><h1>腦力全開，<br/>冒險<span className="yellow">就位。</span></h1><p>與你的題靈一起迎戰。<br/>用數學發動招式，把每一次思考變成力量。</p><button className="primary-button" onClick={()=>startBattle(playerSpirit)}><Crosshair size={21}/>開始冒險<ChevronRight size={20}/></button><div className="hero-hint"><Shield size={14}/> 答題對戰 <span>·</span> 野生收服 <span>·</span> 圖鑑收藏</div></div>
          <div className={`hero-art type-${playerSpirit.type}`}><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-index">#{String(playerSpirit.id).padStart(3,'0')}</span><span className="art-star star-one">✦</span><span className="art-star star-two">✧</span><img key={playerSpirit.id} className="hero-spirit" src={artwork(playerSpirit.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=getStaticSpriteFallback(playerSpirit.id)}} alt={playerSpirit.zhName || playerSpirit.name}/><div className="partner-tag"><span className="live-dot"/> 目前出戰夥伴</div><div className="hero-name"><h2>{playerSpirit.zhName || playerSpirit.name}</h2><span className={`type-badge type-${playerSpirit.type}`}>{typeLabel(playerSpirit)}</span><span>{isGrowingPartner ? "養成" : "對戰"} Lv. {playerLevel}</span></div></div>
          <aside className="mission-panel"><div className="panel-kicker"><Trophy size={17}/> TRAINER STATUS</div><h3>準備好迎接挑戰？</h3><div className="stats-row"><div><b>{String(winStreak).padStart(2,'0')}</b><span>目前連勝</span></div><div><b>{String(capturedList.length).padStart(2,'0')}</b><span>已收服夥伴</span></div></div><div className="mission-divider"/><div className="mini-heading">你的冒險指南</div><ol className="steps"><li><span>01</span><div><strong>選一位夥伴</strong><small>選擇固定夥伴或已收服角色</small></div></li><li><span>02</span><div><strong>答題，發動招式</strong><small>選擇招式，挑戰不同算式</small></div></li><li><span>03</span><div><strong>收服新朋友</strong><small>對手 HP 剩 5% 以下，再答題收服</small></div></li></ol><div className="mission-tip"><Sparkles size={17}/><span>答錯也沒關係，下個回合再試一次。</span></div></aside>
        </section>
        <section className="roster-section"><div className="section-heading"><div><span className="section-label">CHOOSE YOUR PARTNER</span><h2>你的冒險，誰來同行？<span className="count-label">{available.length} 位夥伴</span></h2></div><form className="search-form" onSubmit={submitSearch}><Search size={18}/><input aria-label="搜尋題靈" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="搜尋名稱或圖鑑編號…"/><button type="submit" aria-label="搜尋"><ChevronRight size={18}/></button></form></div>
          <div className="generation-tabs" role="group" aria-label="題靈區域"><button className={activeGen==='all'?'selected':''} onClick={()=>setActiveGen('all')}>全部區域</button>{GENERATIONS.map(g=><button key={g.gen} className={activeGen===g.gen?'selected':''} onClick={()=>setActiveGen(g.gen)}>{['','晨光草原','星砂海岸','雲霧山谷','古書森林','機關城','彩虹湖','熔岩島','極光雪原','星空神殿'][g.gen]}<small>AREA {String(g.gen).padStart(2,'0')}</small></button>)}</div>
          <div className="spirit-grid">{available.map(p=>renderCard(p))}</div>{available.length===0 && <div className="empty-state"><Search size={32}/><h3>這裡還沒有找到夥伴</h3><p>換個區域或名稱，或輸入英文名稱／編號後按右側箭頭搜尋。</p><button className="secondary-button" onClick={()=>{setSearchQuery('');setActiveGen('all')}}>顯示所有夥伴</button></div>}
        </section>
      </>}
      {view==='battle' && <>
        <div className="active-bank-label">目前題庫：{selectedBank?.title || '自動數學練習'}{selectedBank ? ' · 題庫題型與倒數以匯入資料為準' : ''}</div>
        <div className="battle-heading"><div><span className="section-label">WILD ENCOUNTER</span><h1>常青之森<span>野生遭遇戰</span></h1></div><div className="battle-streak"><Trophy size={17}/> {winStreak} 連勝</div></div>
        <div className="battle-layout"><section className="battle-main"><div className={`arena ${damagePopup?'impact':''}`}>
          <Forest/><div className="arena-caption"><span className="live-dot"/> 常青之森 · 晴朗 <Leaf size={14}/></div>
          {hpPanel(enemySpirit,enemyHp,enemyMaxHp,enemyLevel,true)}{hpPanel(playerSpirit,playerHp,playerMaxHp,playerLevel)}
          <div className="arena-platform enemy-platform"/><div className="arena-platform player-platform"/>
          <div className={`fighter enemy-fighter ${enemyAnim}`}>
            {battleState==='catching'||battleState==='caught'?<div className={`catch-ball step-${catchShakeStep}`}><span/></div>:<img src={getSpriteUrl(enemySpirit.id)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=artwork(enemySpirit.id)}} alt={`野生的${enemySpirit.zhName || enemySpirit.name}`}/>}
          </div><div className={`fighter player-fighter ${playerAnim}`}><img src={getSpriteUrl(playerSpirit.id,true)} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=artwork(playerSpirit.id)}} alt={`出戰的${playerSpirit.zhName || playerSpirit.name}`}/></div>
          {damagePopup && <span className={`damage-popup damage-${damagePopup.target}`}>{damagePopup.text}</span>}
          <div className="arena-bottom-fade"/>
        </div>
        <div className="action-panel">
          {questionFeedback && <div className={`question-feedback ${questionFeedback.correct ? 'correct' : 'incorrect'}`} role="status"><strong>{questionFeedback.correct ? '答對了！' : '一起看解答'}</strong><p>{questionFeedback.question}</p><p>正確答案：{questionFeedback.answer}</p><p>{questionFeedback.explanation}</p><small>來源：{questionFeedback.sourceRef}</small></div>}
          {battleState==='mathPending' && currentMath ? <div className="math-panel"><div className="math-top"><span><Zap size={17}/> 答題，發動{selectedMove?.id==='catch'?'收服':'招式'}</span><strong className={mathTimer<=3?'urgent':''}><Clock size={18}/> {mathTimer} 秒</strong></div><div className="timer-track"><span style={{width:`${mathTimer/maxMathTimer*100}%`,background:mathTimer<=3?'#ff6a79':'#f7d65c'}}/></div><div className={`math-question ${currentMath.optionTexts ? 'bank-stem' : ''}`}>{currentMath.question}{currentMath.optionTexts || currentMath.question.includes('=') ? '' : ' = ?'}</div><div className={`answer-grid ${currentMath.optionTexts ? 'bank-options' : ''}`}>{currentMath.options.map((opt,i)=><button key={i} onClick={()=>handleAnswerSubmit(opt)}><small>{String.fromCharCode(65+i)}</small><b>{currentMath.optionTexts ? currentMath.optionTexts[opt] : opt}</b><ChevronRight size={18}/></button>)}</div><p className="math-footnote">讀清題目，選出正確答案。</p></div> : ['ready','playerTurn'].includes(battleState) ? <><div className="solo-potion"><button disabled={cloudBusy||!['ready','playerTurn'].includes(battleState)||playerHp>=playerMaxHp||!(cloud.bag?.potion>0)} onClick={async()=>{try{const r=await act('/bag/use',{itemId:'potion'});setPlayerHp(r.state.battle.playerHp);setPotionNotice(r.event.message);}catch(e){setPotionNotice(e.message);}}}>💊 使用傷藥（{cloud.bag?.potion||0} 個）</button><span role="status">{potionNotice||'每個回復 30 HP，可連續使用；滿血不消耗。'}</span></div><div className="action-heading"><div><span className="live-dot"/> 你的回合</div><span>選擇招式，用答案發動力量</span></div><div className="move-grid">{moves.map((m,i)=><button key={m.id} className={`move-button move-${m.id} ${m.id==='catch'&&canCapture(enemyHp,enemyMaxHp)?'catch-ready':''}`} disabled={m.id==='catch'&&!canCapture(enemyHp,enemyMaxHp)} onClick={()=>handleSelectMove(m)}><span className="move-icon">{[<Zap size={23}/>,<Flame size={23}/>,<Sparkles size={23}/>,<span className="mini-ball"/>][i]}</span><div><strong>{['快速衝擊',`${typeLabel(playerSpirit)}屬性特攻`,'全力暴擊','丟出晶球'][i]}</strong><small>{selectedBank && i < 3 ? ['題庫練習 · 穩定出招','題庫練習 · 強力一擊','題庫練習 · 高傷害'][i] : ['加減法 · 穩定出招','乘除與加法 · 強力一擊','混合四則 · 高傷害',canCapture(enemyHp,enemyMaxHp)?'可以收服 · 成功率 92%':'HP 須剩 5% 以下才能收服'][i]}</small></div><ChevronRight size={17}/></button>)}</div></> : ['won','caught','lost'].includes(battleState)?<div className={`result-panel result-${battleState}`}><span className="result-icon">{battleState==='lost'?<Heart size={32}/>:<Trophy size={32}/>}</span><h2>{battleState==='won'?'漂亮的一戰！':battleState==='caught'?'新的冒險夥伴！':'休息一下，再出發。'}</h2><p>{battleState==='caught'?`${enemySpirit.zhName || enemySpirit.name} 已加入你的圖鑑。`:battleState==='won'?'你的思考，成了最強的力量。':'每一次練習，都讓你更靠近勝利。'}</p><div className="result-actions"><button className="primary-button" onClick={()=>{if(battleState==='lost')startBattle(playerSpirit);else spawnEnemy();}}>{battleState==='lost'?'恢復體力再挑戰':'探索下一場對戰'}<ChevronRight size={18}/></button><button className="secondary-button" onClick={()=>setView('box')}>查看圖鑑</button></div></div>:battleState==='answerError'?<div className="answer-retry"><p>這次作答尚未確認保存，請檢查連線後重試。</p><button className="primary-button" disabled={cloudBusy} onClick={()=>handleAnswerSubmit(retryChoice.choice)}>重試保存這次答案</button></div>:<div className="turn-message" role="status"><span className="loading-orb"/><strong>{battleLogs[0]?.replace(/^[^\u4e00-\u9fff]+/,'') || '對戰進行中…'}</strong></div>}
        </div></section>
        <aside className="battle-sidebar"><div className="log-panel"><div className="panel-kicker"><Shield size={17}/> BATTLE LOG</div><h3>每一回合，都在進步。</h3><div className="battle-logs" aria-live="polite">{battleLogs.map((log,i)=><div key={`${i}-${log}`} className={i===0?'latest':''}><span className="log-dot"/><p>{log.replace(/^[^\u4e00-\u9fff]+/,'')}</p></div>)}</div></div><div className="battle-guide"><HelpCircle size={20}/><h4>冒險者的小提醒</h4><p>{selectedBank ? '目前依匯入題庫出題；若有難度分級，會優先選取對應招式的題目。' : '快速衝擊練加減法，屬性特攻練乘除與加法，全力暴擊挑戰混合四則。'}</p><p>對手 HP 剩餘 5% 以下（含 5%）且尚未倒下，才能丟球；答對後有 92% 機率收服。</p></div></aside></div>
      </>}
      {view==='box' && <section className="collection"><div className="page-eyebrow"><span className="live-dot"/> YOUR ADVENTURE JOURNAL</div><div className="collection-heading"><div><span className="section-label">每一次相遇，都值得收藏</span><h1>我的夥伴圖鑑<span className="yellow">。</span></h1><p>這些夥伴，見證了你的每一次成長。點選卡片就能更換出戰夥伴。</p></div><div className="collection-count"><Award size={24}/><b>{capturedList.length}</b><span>位冒險夥伴</span></div></div><div className="spirit-grid collection-grid">{capturedList.map(p=>renderCard(p,true))}</div><div className="collection-cta"><div><h3>下一位夥伴，正在等你。</h3><p>回到冒險準備，繼續用數學探索世界。</p></div><button className="primary-button" onClick={()=>setView('select')}>繼續冒險<ChevronRight size={18}/></button></div></section>}
    </main><footer className="site-footer"><span>QUIZSPIRIT <span className="footer-separator">/</span> 讓思考，成為冒險的力量。</span><small>原創角色教學作品 · 養成與圖鑑登入後自動保存</small></footer>
  </div>;
}

function Forest(){return <svg className="forest" viewBox="0 0 1000 550" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#8bd3be"/><stop offset=".65" stopColor="#cae8af"/><stop offset="1" stopColor="#6eac75"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stopColor="#70b184"/><stop offset="1" stopColor="#164a48"/></linearGradient><radialGradient id="sun"><stop stopColor="#fff5bd" stopOpacity=".7"/><stop offset="1" stopColor="#fff5bd" stopOpacity="0"/></radialGradient></defs><rect width="1000" height="550" fill="url(#sky)"/><circle cx="650" cy="100" r="220" fill="url(#sun)"/><path d="M0 310Q170 205 350 285T750 260T1000 250V550H0" fill="#9bc8a0"/><g fill="#629d88" opacity=".5">{[20,125,240,370,500,650,780,920].map((x,i)=><g key={x}><rect x={x} y={60+i%3*30} width="18" height="300"/><ellipse cx={x+9} cy={90+i%3*30} rx="74" ry="95"/></g>)}</g><path d="M0 355Q250 275 500 330T1000 320V550H0" fill="url(#ground)"/><path d="M600 310Q460 360 570 550H900Q550 380 680 310" fill="#b6c78a" opacity=".25"/><g fill="#286958">{[-50,80,925,1050].map((x,i)=><g key={x}><path d={`M${x} 0L${x+20} 370L${x+65} 370L${x+70} 0Z`} fill="#29554c"/><ellipse cx={x+30} cy={60} rx="150" ry="130"/><ellipse cx={x+90} cy={0} rx="170" ry="120"/></g>)}</g><g fill="#163f3b"><path d="M0 470Q80 420 170 500L220 550H0Z"/><path d="M1000 390Q940 410 880 550H1000Z"/><path d="M30 550L4 435L70 505L65 455L110 540L120 480L160 550Z"/><path d="M900 550L920 480L940 520L980 440L970 530L1000 480V550Z"/></g><g fill="#eaf6b2" opacity=".75"><circle cx="270" cy="220" r="3"/><circle cx="590" cy="120" r="2"/><circle cx="720" cy="280" r="3"/><circle cx="420" cy="340" r="2"/><circle cx="800" cy="180" r="2"/></g></svg>}
