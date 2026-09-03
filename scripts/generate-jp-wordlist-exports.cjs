/**
 * Generate downloadable Japanese word lists + frequency audit + proposed blocks 11-20.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const spoken = require(path.join(root, "src/data/spoken-english-frequency-5000.json"));
const supplement = require(path.join(__dirname, "jp-lemma-gloss-supplement.json"));
const outDir = path.join(root, "public/japanese");
fs.mkdirSync(outDir, { recursive: true });

function loadBlocks() {
  const blocks = [];
  for (let i = 1; i <= 10; i++) {
    blocks.push(
      JSON.parse(
        fs.readFileSync(path.join(root, "src/lib/japanese/blocks/block" + i + ".json"), "utf8"),
      ),
    );
  }
  return blocks;
}

function escCsv(s) {
  const t = String(s ?? "");
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function lemmasFromEnglish(en) {
  return String(en || "")
    .toLowerCase()
    .split(/[/;,()]+/)
    .map((p) =>
      p
        .replace(/^(to|a|an|the)\s+/, "")
        .replace(/[^a-z0-9\s'-]/g, "")
        .trim(),
    )
    .filter(Boolean);
}

function bestSpokenRank(en, spokenRank) {
  let best = null;
  for (const L of lemmasFromEnglish(en)) {
    for (const c of [L, L.split(/\s+/)[0]].filter(Boolean)) {
      const r = spokenRank.get(c);
      if (r != null && (best == null || r < best)) best = r;
    }
  }
  return best;
}

const SKIP_AS_HEADWORD = new Set([
  "the","a","an","of","to","and","or","but","in","on","at","for","with","by","from","as","into","about","up","out","if","than",
  "that","this","these","those","it","its","be","is","are","was","were","been","being","am","do","did","does","done","have","has",
  "had","will","would","shall","should","may","might","must","can","could","not","no","yes","oh","uh","um","ah","ha","hmm","mm",
  "ya","yeah","yep","nah","whoa","wow","hey","hi","okay","ok","mr","mrs","ms","dr","chang","george","york","joe","nam","lord",
  "gentlemen","darling","american","cannot","died","himself","herself","themselves","myself","yourself","itself","ours","yours",
  "theirs","mine","his","her","their","our","my","your","he","she","they","we","i","you","me","him","them","us",
  "sam","mike","charlie","tom","david","ray","ben","paul","peter","bob","mary","al","ls","th","c","l","mil","fir","sav","hop","ooh","dude","buddy","goddamn","christ","jam","buck","wed","meant","pop","caught","rid","longer","master","lovely","across","colonel","lieutenant","ma","till","unit","roll","track","amaze",
]);

/** High-confidence lemma -> Japanese. Prefer TBD over wrong glosses. */
const EN_TO_JP = Object.assign({}, supplement, {
  perfect: { jp: "完璧", romaji: "kanpeki", audio: "かんぺき", english: "perfect" },
  piece: { jp: "かけら", romaji: "kakera", audio: "かけら", english: "piece / fragment", flag: "also 一切れ hitokire" },
  report: { jp: "報告する", romaji: "houkoku suru", audio: "ほうこくする", english: "report" },
  able: { jp: "できる", romaji: "dekiru", audio: "できる", english: "able / can do", flag: "may overlap earlier dekiru" },
  surprise: { jp: "驚く", romaji: "odoroku", audio: "おどろく", english: "be surprised" },
  dress: { jp: "ドレス", romaji: "doresu", audio: "ドレス", english: "dress (noun)", flag: "verb sense = kiru" },
  hair: { jp: "髪", romaji: "kami", audio: "かみ", english: "hair" },
  company: { jp: "会社", romaji: "kaisha", audio: "かいしゃ", english: "company", flag: "check block 9 duplicate" },
  food: { jp: "食べ物", romaji: "tabemono", audio: "たべもの", english: "food" },
  train: { jp: "電車", romaji: "densha", audio: "でんしゃ", english: "train", flag: "check block 2 duplicate" },
  lie: { jp: "嘘", romaji: "uso", audio: "うそ", english: "lie (falsehood)", flag: "not lie-down" },
  parent: { jp: "親", romaji: "oya", audio: "おや", english: "parent" },
  paper: { jp: "紙", romaji: "kami (paper)", audio: "かみ", english: "paper", flag: "romaji clash with hair" },
  catch: { jp: "捕まえる", romaji: "tsukamaeru", audio: "つかまえる", english: "catch" },
  luck: { jp: "運", romaji: "un", audio: "うん", english: "luck" },
  star: { jp: "星", romaji: "hoshi", audio: "ほし", english: "star" },
  alive: { jp: "生きている", romaji: "ikiteiru", audio: "いきている", english: "alive" },
  grow: { jp: "育つ", romaji: "sodatsu", audio: "そだつ", english: "grow" },
  sex: { jp: "セックス", romaji: "sekkusu", audio: "セックス", english: "sex", flag: "optional for curriculum" },
  music: { jp: "音楽", romaji: "ongaku", audio: "おんがく", english: "music" },
  special: { jp: "特別", romaji: "tokubetsu", audio: "とくべつ", english: "special" },
  sing: { jp: "歌う", romaji: "utau", audio: "うたう", english: "sing" },
  red: { jp: "赤い", romaji: "akai", audio: "あかい", english: "red" },
  decide: { jp: "決める", romaji: "kimeru", audio: "きめる", english: "decide" },
  laugh: { jp: "笑う", romaji: "warau", audio: "わらう", english: "laugh" },
  control: { jp: "制御する", romaji: "seigyo suru", audio: "せいぎょする", english: "control" },
  fly: { jp: "飛ぶ", romaji: "tobu", audio: "とぶ", english: "fly" },
  record: { jp: "記録する", romaji: "kiroku suru", audio: "きろくする", english: "record" },
  arm: { jp: "腕", romaji: "ude", audio: "うで", english: "arm" },
  safe: { jp: "安全", romaji: "anzen", audio: "あんぜん", english: "safe" },
  serious: { jp: "真面目", romaji: "majime", audio: "まじめ", english: "serious" },
  cover: { jp: "覆う", romaji: "oou", audio: "おおう", english: "cover" },
  sweet: { jp: "甘い", romaji: "amai", audio: "あまい", english: "sweet" },
  ten: { jp: "十", romaji: "juu", audio: "じゅう", english: "ten" },
  coffee: { jp: "コーヒー", romaji: "koohii", audio: "コーヒー", english: "coffee", flag: "check earlier duplicate" },
  ball: { jp: "ボール", romaji: "booru", audio: "ボール", english: "ball" },
  sense: { jp: "感覚", romaji: "kankaku", audio: "かんかく", english: "sense" },
  lucky: { jp: "運がいい", romaji: "un ga ii", audio: "うんがいい", english: "lucky" },
  president: { jp: "大統領", romaji: "daitouryou", audio: "だいとうりょう", english: "president", flag: "or shachou for company" },
  step: { jp: "一歩", romaji: "ippo", audio: "いっぽ", english: "step" },
  million: { jp: "百万", romaji: "hyakuman", audio: "ひゃくまん", english: "million" },
  bill: { jp: "請求書", romaji: "seikyuusho", audio: "せいきゅうしょ", english: "bill (invoice)", flag: "multi-sense" },
  top: { jp: "上", romaji: "ue", audio: "うえ", english: "top" },
  date: { jp: "デート", romaji: "deeto", audio: "デート", english: "date (romantic)", flag: "or hizuke for calendar" },
  air: { jp: "空気", romaji: "kuuki", audio: "くうき", english: "air" },
  human: { jp: "人間", romaji: "ningen", audio: "にんげん", english: "human" },
  ring: { jp: "指輪", romaji: "yubiwa", audio: "ゆびわ", english: "ring (jewelry)", flag: "verb sense separate" },
  charge: { jp: "充電する", romaji: "juuden suru", audio: "じゅうでんする", english: "charge (battery)", flag: "multi-sense" },
  explain: { jp: "説明する", romaji: "setsumei suru", audio: "せつめいする", english: "explain" },
  key: { jp: "鍵", romaji: "kagi", audio: "かぎ", english: "key" },
  cry: { jp: "泣く", romaji: "naku", audio: "なく", english: "cry" },
  king: { jp: "王", romaji: "ou", audio: "おう", english: "king" },
  fast: { jp: "速い", romaji: "hayai", audio: "はやい", english: "fast", flag: "check early/hayai overlap" },
  burn: { jp: "燃える", romaji: "moeru", audio: "もえる", english: "burn" },
  sell: { jp: "売る", romaji: "uru", audio: "うる", english: "sell" },
  handle: { jp: "扱う", romaji: "atsukau", audio: "あつかう", english: "handle" },
  return: { jp: "戻る", romaji: "modoru", audio: "もどる", english: "return", flag: "kaeru already exists" },
  begin: { jp: "始める", romaji: "hajimeru", audio: "はじめる", english: "begin" },
  perhaps: { jp: "多分", romaji: "tabun", audio: "たぶん", english: "perhaps" },
  tire: { jp: "疲れる", romaji: "tsukareru", audio: "つかれる", english: "tire / get tired", flag: "noun tire = taiya" },
  ride: { jp: "乗る", romaji: "noru", audio: "のる", english: "ride" },
  secret: { jp: "秘密", romaji: "himitsu", audio: "ひみつ", english: "secret" },
  card: { jp: "カード", romaji: "kaado", audio: "カード", english: "card" },
  class: { jp: "授業", romaji: "jugyou", audio: "じゅぎょう", english: "class" },
  test: { jp: "テスト", romaji: "tesuto", audio: "テスト", english: "test" },
  law: { jp: "法律", romaji: "houritsu", audio: "ほうりつ", english: "law" },
  hat: { jp: "帽子", romaji: "boushi", audio: "ぼうし", english: "hat" },
  officer: { jp: "警官", romaji: "keikan", audio: "けいかん", english: "officer" },
  count: { jp: "数える", romaji: "kazoeru", audio: "かぞえる", english: "count" },
  blow: { jp: "吹く", romaji: "fuku", audio: "ふく", english: "blow" },
  form: { jp: "形", romaji: "katachi", audio: "かたち", english: "form / shape" },
  cold: { jp: "寒い", romaji: "samui", audio: "さむい", english: "cold (weather)", flag: "check earlier samui" },
  hospital: { jp: "病院", romaji: "byouin", audio: "びょういん", english: "hospital" },
  boss: { jp: "上司", romaji: "joushi", audio: "じょうし", english: "boss" },
  poor: { jp: "貧乏", romaji: "binbou", audio: "びんぼう", english: "poor" },
  ship: { jp: "船", romaji: "fune", audio: "ふね", english: "ship" },
  kick: { jp: "蹴る", romaji: "keru", audio: "ける", english: "kick" },
  uncle: { jp: "おじさん", romaji: "ojisan", audio: "おじさん", english: "uncle" },
  small: { jp: "小さい", romaji: "chiisai", audio: "ちいさい", english: "small", flag: "check earlier" },
  bag: { jp: "鞄", romaji: "kaban", audio: "かばん", english: "bag" },
  stick: { jp: "棒", romaji: "bou", audio: "ぼう", english: "stick" },
  fool: { jp: "馬鹿", romaji: "baka", audio: "ばか", english: "fool" },
  rule: { jp: "規則", romaji: "kisoku", audio: "きそく", english: "rule" },
  mistake: { jp: "間違い", romaji: "machigai", audio: "まちがい", english: "mistake" },
  past: { jp: "過去", romaji: "kako", audio: "かこ", english: "past" },
  power: { jp: "力", romaji: "chikara", audio: "ちから", english: "power" },
  fight: { jp: "戦う", romaji: "tatakau", audio: "たたかう", english: "fight" },
  death: { jp: "死", romaji: "shi", audio: "し", english: "death" },
  heart: { jp: "心", romaji: "kokoro", audio: "こころ", english: "heart / mind" },
  blood: { jp: "血", romaji: "chi", audio: "ち", english: "blood" },
  earth: { jp: "地球", romaji: "chikyuu", audio: "ちきゅう", english: "earth" },
  fire: { jp: "火", romaji: "hi", audio: "ひ", english: "fire" },
  water: { jp: "水", romaji: "mizu", audio: "みず", english: "water", flag: "check earlier" },
  world: { jp: "世界", romaji: "sekai", audio: "せかい", english: "world" },
  war: { jp: "戦争", romaji: "sensou", audio: "せんそう", english: "war" },
  peace: { jp: "平和", romaji: "heiwa", audio: "へいわ", english: "peace" },
  truth: { jp: "真実", romaji: "shinjitsu", audio: "しんじつ", english: "truth" },
  dream: { jp: "夢", romaji: "yume", audio: "ゆめ", english: "dream" },
  fear: { jp: "恐れ", romaji: "osore", audio: "おそれ", english: "fear" },
  hope: { jp: "希望", romaji: "kibou", audio: "きぼう", english: "hope" },
  trust: { jp: "信じる", romaji: "shinjiru", audio: "しんじる", english: "trust / believe" },
  promise: { jp: "約束", romaji: "yakusoku", audio: "やくそく", english: "promise" },
  plan: { jp: "計画", romaji: "keikaku", audio: "けいかく", english: "plan" },
  idea: { jp: "考え", romaji: "kangae", audio: "かんがえ", english: "idea" },
  reason: { jp: "理由", romaji: "riyuu", audio: "りゆう", english: "reason" },
  problem: { jp: "問題", romaji: "mondai", audio: "もんだい", english: "problem" },
  answer: { jp: "答え", romaji: "kotae", audio: "こたえ", english: "answer" },
  question: { jp: "質問", romaji: "shitsumon", audio: "しつもん", english: "question" },
  story: { jp: "話", romaji: "hanashi", audio: "はなし", english: "story" },
  number: { jp: "数字", romaji: "suuji", audio: "すうじ", english: "number" },
  color: { jp: "色", romaji: "iro", audio: "いろ", english: "color" },
  black: { jp: "黒い", romaji: "kuroi", audio: "くろい", english: "black" },
  white: { jp: "白い", romaji: "shiroi", audio: "しろい", english: "white" },
  blue: { jp: "青い", romaji: "aoi", audio: "あおい", english: "blue" },
  green: { jp: "緑", romaji: "midori", audio: "みどり", english: "green" },
  yellow: { jp: "黄色い", romaji: "kiiroi", audio: "きいろい", english: "yellow" },
  dark: { jp: "暗い", romaji: "kurai", audio: "くらい", english: "dark" },
  light: { jp: "光", romaji: "hikari", audio: "ひかり", english: "light" },
  heavy: { jp: "重い", romaji: "omoi", audio: "おもい", english: "heavy" },
  empty: { jp: "空", romaji: "kara", audio: "から", english: "empty" },
  full: { jp: "いっぱい", romaji: "ippai", audio: "いっぱい", english: "full" },
  clean: { jp: "きれい", romaji: "kirei", audio: "きれい", english: "clean / pretty" },
  dirty: { jp: "汚い", romaji: "kitanai", audio: "きたない", english: "dirty" },
  quiet: { jp: "静か", romaji: "shizuka", audio: "しずか", english: "quiet" },
  noisy: { jp: "うるさい", romaji: "urusai", audio: "うるさい", english: "noisy" },
  free: { jp: "無料 / 自由", romaji: "muryou / jiyuu", audio: "むりょう", english: "free", flag: "cost vs freedom" },
  busy: { jp: "忙しい", romaji: "isogashii", audio: "いそがしい", english: "busy", flag: "check earlier" },
  ready: { jp: "用意できた", romaji: "youi dekita", audio: "よういできた", english: "ready" },
  late: { jp: "遅い", romaji: "osoi", audio: "おそい", english: "late / slow" },
  early: { jp: "早い", romaji: "hayai", audio: "はやい", english: "early", flag: "check earlier" },
  tomorrow: { jp: "明日", romaji: "ashita", audio: "あした", english: "tomorrow" },
  yesterday: { jp: "昨日", romaji: "kinou", audio: "きのう", english: "yesterday", flag: "check earlier" },
  week: { jp: "週", romaji: "shuu", audio: "しゅう", english: "week" },
  month: { jp: "月", romaji: "tsuki", audio: "つき", english: "month", flag: "also moon" },
  year: { jp: "年", romaji: "toshi / nen", audio: "とし", english: "year" },
  hour: { jp: "時間", romaji: "jikan", audio: "じかん", english: "hour / time" },
  minute: { jp: "分", romaji: "fun / pun", audio: "ふん", english: "minute" },
  second: { jp: "秒", romaji: "byou", audio: "びょう", english: "second" },
  summer: { jp: "夏", romaji: "natsu", audio: "なつ", english: "summer" },
  winter: { jp: "冬", romaji: "fuyu", audio: "ふゆ", english: "winter" },
  spring: { jp: "春", romaji: "haru", audio: "はる", english: "spring" },
  autumn: { jp: "秋", romaji: "aki", audio: "あき", english: "autumn" },
  fall: { jp: "落ちる", romaji: "ochiru", audio: "おちる", english: "fall", flag: "also autumn" },
  rain: { jp: "雨", romaji: "ame", audio: "あめ", english: "rain" },
  snow: { jp: "雪", romaji: "yuki", audio: "ゆき", english: "snow" },
  wind: { jp: "風", romaji: "kaze", audio: "かぜ", english: "wind" },
  sun: { jp: "太陽", romaji: "taiyou", audio: "たいよう", english: "sun" },
  moon: { jp: "月", romaji: "tsuki", audio: "つき", english: "moon" },
  sky: { jp: "空", romaji: "sora", audio: "そら", english: "sky" },
  sea: { jp: "海", romaji: "umi", audio: "うみ", english: "sea" },
  mountain: { jp: "山", romaji: "yama", audio: "やま", english: "mountain" },
  river: { jp: "川", romaji: "kawa", audio: "かわ", english: "river" },
  tree: { jp: "木", romaji: "ki", audio: "き", english: "tree" },
  flower: { jp: "花", romaji: "hana", audio: "はな", english: "flower" },
  animal: { jp: "動物", romaji: "doubutsu", audio: "どうぶつ", english: "animal" },
  dog: { jp: "犬", romaji: "inu", audio: "いぬ", english: "dog" },
  cat: { jp: "猫", romaji: "neko", audio: "ねこ", english: "cat" },
  bird: { jp: "鳥", romaji: "tori", audio: "とり", english: "bird" },
  fish: { jp: "魚", romaji: "sakana", audio: "さかな", english: "fish", flag: "check earlier" },
  horse: { jp: "馬", romaji: "uma", audio: "うま", english: "horse" },
  body: { jp: "体", romaji: "karada", audio: "からだ", english: "body" },
  head: { jp: "頭", romaji: "atama", audio: "あたま", english: "head" },
  face: { jp: "顔", romaji: "kao", audio: "かお", english: "face" },
  eye: { jp: "目", romaji: "me", audio: "め", english: "eye" },
  ear: { jp: "耳", romaji: "mimi", audio: "みみ", english: "ear" },
  nose: { jp: "鼻", romaji: "hana", audio: "はな", english: "nose", flag: "romaji clash with flower" },
  mouth: { jp: "口", romaji: "kuchi", audio: "くち", english: "mouth" },
  hand: { jp: "手", romaji: "te", audio: "て", english: "hand" },
  foot: { jp: "足", romaji: "ashi", audio: "あし", english: "foot / leg" },
  finger: { jp: "指", romaji: "yubi", audio: "ゆび", english: "finger" },
  back: { jp: "背中", romaji: "senaka", audio: "せなか", english: "back (body)", flag: "also adverb" },
  skin: { jp: "肌", romaji: "hada", audio: "はだ", english: "skin" },
  bone: { jp: "骨", romaji: "hone", audio: "ほね", english: "bone" },
  voice: { jp: "声", romaji: "koe", audio: "こえ", english: "voice" },
  sound: { jp: "音", romaji: "oto", audio: "おと", english: "sound" },
  song: { jp: "歌", romaji: "uta", audio: "うた", english: "song" },
  movie: { jp: "映画", romaji: "eiga", audio: "えいが", english: "movie" },
  book: { jp: "本", romaji: "hon", audio: "ほん", english: "book" },
  letter: { jp: "手紙", romaji: "tegami", audio: "てがみ", english: "letter" },
  photo: { jp: "写真", romaji: "shashin", audio: "しゃしん", english: "photo" },
  phone: { jp: "電話", romaji: "denwa", audio: "でんわ", english: "phone" },
  computer: { jp: "コンピューター", romaji: "konpyuutaa", audio: "コンピューター", english: "computer" },
  internet: { jp: "インターネット", romaji: "intaanetto", audio: "インターネット", english: "internet" },
  car: { jp: "車", romaji: "kuruma", audio: "くるま", english: "car" },
  bus: { jp: "バス", romaji: "basu", audio: "バス", english: "bus" },
  plane: { jp: "飛行機", romaji: "hikouki", audio: "ひこうき", english: "plane" },
  bike: { jp: "自転車", romaji: "jitensha", audio: "じてんしゃ", english: "bike" },
  road: { jp: "道", romaji: "michi", audio: "みち", english: "road" },
  bridge: { jp: "橋", romaji: "hashi", audio: "はし", english: "bridge" },
  door: { jp: "ドア", romaji: "doa", audio: "ドア", english: "door" },
  window: { jp: "窓", romaji: "mado", audio: "まど", english: "window" },
  wall: { jp: "壁", romaji: "kabe", audio: "かべ", english: "wall" },
  floor: { jp: "床", romaji: "yuka", audio: "ゆか", english: "floor" },
  room: { jp: "部屋", romaji: "heya", audio: "へや", english: "room" },
  house: { jp: "家", romaji: "ie", audio: "いえ", english: "house" },
  building: { jp: "建物", romaji: "tatemono", audio: "たてもの", english: "building" },
  school: { jp: "学校", romaji: "gakkou", audio: "がっこう", english: "school" },
  teacher: { jp: "先生", romaji: "sensei", audio: "せんせい", english: "teacher" },
  student: { jp: "学生", romaji: "gakusei", audio: "がくせい", english: "student" },
  job: { jp: "仕事", romaji: "shigoto", audio: "しごと", english: "job" },
  money: { jp: "お金", romaji: "okane", audio: "おかね", english: "money" },
  price: { jp: "値段", romaji: "nedan", audio: "ねだん", english: "price" },
  market: { jp: "市場", romaji: "ichiba", audio: "いちば", english: "market" },
  shop: { jp: "店", romaji: "mise", audio: "みせ", english: "shop", flag: "check earlier" },
  store: { jp: "店", romaji: "mise", audio: "みせ", english: "store", flag: "duplicate mise" },
  buy: { jp: "買う", romaji: "kau", audio: "かう", english: "buy" },
  pay: { jp: "払う", romaji: "harau", audio: "はらう", english: "pay" },
  cost: { jp: "費用", romaji: "hiyou", audio: "ひよう", english: "cost" },
  gift: { jp: "贈り物", romaji: "okurimono", audio: "おくりもの", english: "gift" },
  party: { jp: "パーティー", romaji: "paatii", audio: "パーティー", english: "party" },
  game: { jp: "ゲーム", romaji: "geemu", audio: "ゲーム", english: "game" },
  sport: { jp: "スポーツ", romaji: "supootsu", audio: "スポーツ", english: "sport" },
  team: { jp: "チーム", romaji: "chiimu", audio: "チーム", english: "team" },
  win: { jp: "勝つ", romaji: "katsu", audio: "かつ", english: "win" },
  lose: { jp: "負ける", romaji: "makeru", audio: "まける", english: "lose" },
  play: { jp: "遊ぶ", romaji: "asobu", audio: "あそぶ", english: "play" },
  watch: { jp: "見る", romaji: "miru", audio: "みる", english: "watch", flag: "may overlap see/miru" },
  listen: { jp: "聞く", romaji: "kiku", audio: "きく", english: "listen" },
  read: { jp: "読む", romaji: "yomu", audio: "よむ", english: "read" },
  write: { jp: "書く", romaji: "kaku", audio: "かく", english: "write" },
  learn: { jp: "学ぶ", romaji: "manabu", audio: "まなぶ", english: "learn" },
  teach: { jp: "教える", romaji: "oshieru", audio: "おしえる", english: "teach" },
  study: { jp: "勉強する", romaji: "benkyou suru", audio: "べんきょうする", english: "study" },
  remember: { jp: "覚える", romaji: "oboeru", audio: "おぼえる", english: "remember" },
  forget: { jp: "忘れる", romaji: "wasureru", audio: "わすれる", english: "forget" },
  understand: { jp: "分かる", romaji: "wakaru", audio: "わかる", english: "understand" },
  believe: { jp: "信じる", romaji: "shinjiru", audio: "しんじる", english: "believe" },
  feel: { jp: "感じる", romaji: "kanjiru", audio: "かんじる", english: "feel" },
  seem: { jp: "ようだ", romaji: "you da", audio: "ようだ", english: "seem", flag: "grammar-ish" },
  become: { jp: "なる", romaji: "naru", audio: "なる", english: "become" },
  change: { jp: "変わる", romaji: "kawaru", audio: "かわる", english: "change" },
  open: { jp: "開ける", romaji: "akeru", audio: "あける", english: "open" },
  close: { jp: "閉める", romaji: "shimeru", audio: "しめる", english: "close" },
  start: { jp: "始める", romaji: "hajimeru", audio: "はじめる", english: "start", flag: "dup begin" },
  stop: { jp: "止まる", romaji: "tomaru", audio: "とまる", english: "stop" },
  finish: { jp: "終わる", romaji: "owaru", audio: "おわる", english: "finish" },
  continue: { jp: "続ける", romaji: "tsuzukeru", audio: "つづける", english: "continue" },
  wait: { jp: "待つ", romaji: "matsu", audio: "まつ", english: "wait" },
  stay: { jp: "泊まる", romaji: "tomaru", audio: "とまる", english: "stay", flag: "also stay=iru" },
  leave: { jp: "出発する", romaji: "shuppatsu suru", audio: "しゅっぱつする", english: "leave" },
  arrive: { jp: "着く", romaji: "tsuku", audio: "つく", english: "arrive" },
  enter: { jp: "入る", romaji: "hairu", audio: "はいる", english: "enter", flag: "check earlier" },
  exit: { jp: "出口", romaji: "deguchi", audio: "でぐち", english: "exit" },
  follow: { jp: "従う", romaji: "shitagau", audio: "したがう", english: "follow" },
  lead: { jp: "導く", romaji: "michibiku", audio: "みちびく", english: "lead" },
  send: { jp: "送る", romaji: "okuru", audio: "おくる", english: "send" },
  receive: { jp: "受け取る", romaji: "uketoru", audio: "うけとる", english: "receive" },
  bring: { jp: "持ってくる", romaji: "motte kuru", audio: "もってくる", english: "bring" },
  take: { jp: "取る", romaji: "toru", audio: "とる", english: "take" },
  put: { jp: "置く", romaji: "oku", audio: "おく", english: "put" },
  keep: { jp: "保つ", romaji: "tamotsu", audio: "たもつ", english: "keep" },
  break: { jp: "壊す", romaji: "kowasu", audio: "こわす", english: "break" },
  cut: { jp: "切る", romaji: "kiru", audio: "きる", english: "cut" },
  hit: { jp: "打つ", romaji: "utsu", audio: "うつ", english: "hit" },
  push: { jp: "押す", romaji: "osu", audio: "おす", english: "push" },
  pull: { jp: "引く", romaji: "hiku", audio: "ひく", english: "pull" },
  throw: { jp: "投げる", romaji: "nageru", audio: "なげる", english: "throw" },
  drop: { jp: "落とす", romaji: "otosu", audio: "おとす", english: "drop" },
  pick: { jp: "選ぶ", romaji: "erabu", audio: "えらぶ", english: "pick / choose" },
  choose: { jp: "選ぶ", romaji: "erabu", audio: "えらぶ", english: "choose" },
  build: { jp: "建てる", romaji: "tateru", audio: "たてる", english: "build" },
  create: { jp: "作る", romaji: "tsukuru", audio: "つくる", english: "create" },
  destroy: { jp: "壊す", romaji: "kowasu", audio: "こわす", english: "destroy" },
  save: { jp: "救う", romaji: "sukuu", audio: "すくう", english: "save" },
  kill: { jp: "殺す", romaji: "korosu", audio: "ころす", english: "kill" },
  die: { jp: "死ぬ", romaji: "shinu", audio: "しぬ", english: "die" },
  live: { jp: "住む", romaji: "sumu", audio: "すむ", english: "live" },
  sleep: { jp: "寝る", romaji: "neru", audio: "ねる", english: "sleep" },
  wake: { jp: "起きる", romaji: "okiru", audio: "おきる", english: "wake", flag: "check earlier" },
  sit: { jp: "座る", romaji: "suwaru", audio: "すわる", english: "sit" },
  stand: { jp: "立つ", romaji: "tatsu", audio: "たつ", english: "stand" },
  walk: { jp: "歩く", romaji: "aruku", audio: "あるく", english: "walk" },
  run: { jp: "走る", romaji: "hashiru", audio: "はしる", english: "run" },
  jump: { jp: "跳ぶ", romaji: "tobu", audio: "とぶ", english: "jump", flag: "romaji clash fly" },
  swim: { jp: "泳ぐ", romaji: "oyogu", audio: "およぐ", english: "swim" },
  drive: { jp: "運転する", romaji: "unten suru", audio: "うんてんする", english: "drive" },
  cook: { jp: "料理する", romaji: "ryouri suru", audio: "りょうりする", english: "cook" },
  eat: { jp: "食べる", romaji: "taberu", audio: "たべる", english: "eat", flag: "check earlier" },
  drink: { jp: "飲む", romaji: "nomu", audio: "のむ", english: "drink" },
  taste: { jp: "味", romaji: "aji", audio: "あじ", english: "taste" },
  smell: { jp: "匂い", romaji: "nioi", audio: "におい", english: "smell" },
  touch: { jp: "触る", romaji: "sawaru", audio: "さわる", english: "touch" },
  wear: { jp: "着る", romaji: "kiru", audio: "きる", english: "wear" },
  wash: { jp: "洗う", romaji: "arau", audio: "あらう", english: "wash" },
  clean_verb: { jp: "掃除する", romaji: "souji suru", audio: "そうじする", english: "clean (verb)" },
  help: { jp: "助ける", romaji: "tasukeru", audio: "たすける", english: "help" },
  thank: { jp: "感謝する", romaji: "kansha suru", audio: "かんしゃする", english: "thank" },
  sorry: { jp: "ごめん", romaji: "gomen", audio: "ごめん", english: "sorry" },
  please: { jp: "ください", romaji: "kudasai", audio: "ください", english: "please" },
  welcome: { jp: "ようこそ", romaji: "youkoso", audio: "ようこそ", english: "welcome" },
  hello: { jp: "こんにちは", romaji: "konnichiwa", audio: "こんにちは", english: "hello" },
  goodbye: { jp: "さようなら", romaji: "sayounara", audio: "さようなら", english: "goodbye" },
  love: { jp: "愛", romaji: "ai", audio: "あい", english: "love" },
  hate: { jp: "憎む", romaji: "nikumu", audio: "にくむ", english: "hate" },
  like: { jp: "好き", romaji: "suki", audio: "すき", english: "like", flag: "check earlier" },
  need: { jp: "必要", romaji: "hitsuyou", audio: "ひつよう", english: "need" },
  want: { jp: "欲しい", romaji: "hoshii", audio: "ほしい", english: "want", flag: "check earlier" },
  try: { jp: "試す", romaji: "tamesu", audio: "ためす", english: "try" },
  allow: { jp: "許可する", romaji: "kyoka suru", audio: "きょかする", english: "allow" },
  refuse: { jp: "断る", romaji: "kotowaru", audio: "ことわる", english: "refuse" },
  agree: { jp: "同意する", romaji: "doui suru", audio: "どういする", english: "agree" },
  disagree: { jp: "反対する", romaji: "hantai suru", audio: "はんたいする", english: "disagree" },
  decide_alt: { jp: "決める", romaji: "kimeru", audio: "きめる", english: "decide" },
  worry: { jp: "心配する", romaji: "shinpai suru", audio: "しんぱいする", english: "worry" },
  enjoy: { jp: "楽しむ", romaji: "tanoshimu", audio: "たのしむ", english: "enjoy" },
  prefer: { jp: "好む", romaji: "konomu", audio: "このむ", english: "prefer" },
  matter: { jp: "大事", romaji: "daiji", audio: "だいじ", english: "matter / important" },
  important: { jp: "大切", romaji: "taisetsu", audio: "たいせつ", english: "important" },
  possible: { jp: "可能", romaji: "kanou", audio: "かのう", english: "possible" },
  impossible: { jp: "不可能", romaji: "fukanou", audio: "ふかのう", english: "impossible" },
  true: { jp: "本当", romaji: "hontou", audio: "ほんとう", english: "true" },
  false: { jp: "嘘", romaji: "uso", audio: "うそ", english: "false" },
  wrong: { jp: "間違っている", romaji: "machigatteiru", audio: "まちがっている", english: "wrong" },
  right: { jp: "正しい", romaji: "tadashii", audio: "ただしい", english: "right / correct", flag: "also direction" },
  same: { jp: "同じ", romaji: "onaji", audio: "おなじ", english: "same" },
  different: { jp: "違う", romaji: "chigau", audio: "ちがう", english: "different" },
  next: { jp: "次", romaji: "tsugi", audio: "つぎ", english: "next" },
  last: { jp: "最後", romaji: "saigo", audio: "さいご", english: "last" },
  first: { jp: "最初", romaji: "saisho", audio: "さいしょ", english: "first" },
  last_time: { jp: "前回", romaji: "zenkai", audio: "ぜんかい", english: "last time" },
  often: { jp: "よく", romaji: "yoku", audio: "よく", english: "often" },
  sometimes: { jp: "時々", romaji: "tokidoki", audio: "ときどき", english: "sometimes", flag: "check earlier" },
  always: { jp: "いつも", romaji: "itsumo", audio: "いつも", english: "always", flag: "check earlier" },
  never: { jp: "決して", romaji: "kesshite", audio: "けっして", english: "never" },
  already: { jp: "もう", romaji: "mou", audio: "もう", english: "already" },
  still: { jp: "まだ", romaji: "mada", audio: "まだ", english: "still / yet" },
  again: { jp: "また", romaji: "mata", audio: "また", english: "again" },
  together: { jp: "一緒", romaji: "issho", audio: "いっしょ", english: "together" },
  alone: { jp: "一人で", romaji: "hitori de", audio: "ひとりで", english: "alone" },
  almost: { jp: "ほとんど", romaji: "hotondo", audio: "ほとんど", english: "almost" },
  enough: { jp: "十分", romaji: "juubun", audio: "じゅうぶん", english: "enough" },
  more: { jp: "もっと", romaji: "motto", audio: "もっと", english: "more" },
  less: { jp: "少ない", romaji: "sukunai", audio: "すくない", english: "less" },
  most: { jp: "一番", romaji: "ichiban", audio: "いちばん", english: "most" },
  both: { jp: "両方", romaji: "ryouhou", audio: "りょうほう", english: "both" },
  each: { jp: "それぞれ", romaji: "sorezore", audio: "それぞれ", english: "each" },
  every: { jp: "毎", romaji: "mai-", audio: "まい", english: "every" },
  other: { jp: "他の", romaji: "hoka no", audio: "ほかの", english: "other" },
  another: { jp: "もう一つ", romaji: "mou hitotsu", audio: "もうひとつ", english: "another" },
  such: { jp: "そのような", romaji: "sono you na", audio: "そのような", english: "such" },
  own: { jp: "自分の", romaji: "jibun no", audio: "じぶんの", english: "own" },
  side: { jp: "側", romaji: "gawa", audio: "がわ", english: "side" },
  place: { jp: "場所", romaji: "basho", audio: "ばしょ", english: "place" },
  end: { jp: "終わり", romaji: "owari", audio: "おわり", english: "end" },
  middle: { jp: "真ん中", romaji: "mannaka", audio: "まんなか", english: "middle" },
  front: { jp: "前", romaji: "mae", audio: "まえ", english: "front" },
  behind: { jp: "後ろ", romaji: "ushiro", audio: "うしろ", english: "behind" },
  under: { jp: "下", romaji: "shita", audio: "した", english: "under" },
  above: { jp: "上", romaji: "ue", audio: "うえ", english: "above" },
  between: { jp: "間", romaji: "aida", audio: "あいだ", english: "between" },
  near: { jp: "近い", romaji: "chikai", audio: "ちかい", english: "near" },
  far: { jp: "遠い", romaji: "tooi", audio: "とおい", english: "far" },
  inside: { jp: "中", romaji: "naka", audio: "なか", english: "inside" },
  outside: { jp: "外", romaji: "soto", audio: "そと", english: "outside" },
});

function writeCsv(filePath, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escCsv(row[h])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

function main() {
  const blocks = loadBlocks();
  const spokenRank = new Map(spoken.map((w, i) => [String(w).toLowerCase(), i + 1]));

  const first500 = blocks.flatMap((b, bi) =>
    b.map((w, wi) => ({
      block: bi + 1,
      wordIndex: wi,
      romaji: w.r,
      jp: w.jp,
      audio: w.audio,
      english: w.en,
      mnemonic: w.m || "",
      spokenRank: bestSpokenRank(w.en, spokenRank),
    })),
  );

  writeCsv(path.join(outDir, "blocks-1-10-words.csv"), first500, [
    "block","wordIndex","romaji","jp","audio","english","mnemonic","spokenRank",
  ]);
  fs.writeFileSync(path.join(outDir, "blocks-1-10-words.json"), JSON.stringify(first500, null, 2) + "\n", "utf8");

  const coveredRomaji = new Set(first500.map((w) => String(w.romaji).toLowerCase().trim()));
  const coveredEnglishKeys = new Set();
  for (const w of first500) {
    for (const L of lemmasFromEnglish(w.english)) {
      coveredEnglishKeys.add(L);
      coveredEnglishKeys.add(L.split(/\s+/)[0]);
    }
  }

  const withRank = first500.filter((w) => w.spokenRank != null);
  const coveredTop500Lemmas = new Set();
  for (const w of first500) {
    for (const L of lemmasFromEnglish(w.english)) {
      for (const c of [L, L.split(/\s+/)[0]]) {
        if (spokenRank.has(c) && spokenRank.get(c) <= 500) coveredTop500Lemmas.add(c);
      }
    }
  }
  const missingTop500 = spoken.slice(0, 500).filter((w) => !coveredTop500Lemmas.has(String(w).toLowerCase()));

  const questionable = first500.filter((w) => {
    const blob = (w.romaji + " " + w.english + " " + w.jp).toLowerCase();
    return /frank|furanku|mysterious|action \/ behavior|oneself|fushigi|koudou|jibun|sukunakutomo/.test(blob)
      || (w.spokenRank != null && w.spokenRank > 1500);
  });

  const audit = {
    honestVerdict:
      "NO — the spoken English frequency list was NOT used to select the Japanese words in blocks 1-10. It was converted to JSON and used only for curriculum scaffolding / rank labels (e.g. Ranks 1-50). Block content came from the HTML beginner list (blocks 1-2) and later curated Japanese learner vocab, not a lemma-to-Japanese map of ranks 1-500.",
    sourcesFound: {
      spokenEnglishXlsx: "C:/Users/Administrator/Downloads/top_5000_spoken_english_lemmatised.xlsx",
      spokenEnglishJson: "src/data/spoken-english-frequency-5000.json",
      writtenEnglishJson: "src/data/english-frequency-5000.json (older/general list; not the spoken xlsx)",
      japaneseFrequencyListInRepoOrDownloads: false,
      note: "No separate Japanese frequency spreadsheet found in Downloads/repo. Only the spoken-English xlsx was integrated as data.",
    },
    stats: {
      blockWordCount: first500.length,
      matchedAnySpokenLemma: withRank.length,
      matchedSpokenTop500: withRank.filter((w) => w.spokenRank <= 500).length,
      matchedSpokenTop1000: withRank.filter((w) => w.spokenRank <= 1000).length,
      unmatchedEnglishGloss: first500.length - withRank.length,
      beyondSpokenTop500: withRank.filter((w) => w.spokenRank > 500).length,
      beyondSpokenTop1000: withRank.filter((w) => w.spokenRank > 1000).length,
      uniqueSpokenTop500LemmasTouched: coveredTop500Lemmas.size,
      missingSpokenTop500Count: missingTop500.length,
    },
    missingSpokenTop500Sample: missingTop500.slice(0, 100),
    questionableOrJunkSample: questionable.slice(0, 40).map((w) => ({
      block: w.block, romaji: w.romaji, english: w.english, jp: w.jp, spokenRank: w.spokenRank,
    })),
    historical: [
      "Block 1 ported from japanese_block_1_five_rounds.html (beginner JP list).",
      "User asked subsequent blocks to follow spoken-English frequency.",
      "xlsx converted and frequency.ts switched to spoken list for labels only; playable JSON was left unchanged at that time.",
      "Blocks 3-10 filled with Japanese learner words; English glosses sometimes coincide with frequent lemmas, but order is not ranks 1-500.",
    ],
  };
  fs.writeFileSync(path.join(outDir, "blocks-1-10-frequency-audit.json"), JSON.stringify(audit, null, 2) + "\n", "utf8");

  const proposed = [];
  const usedEnglish = new Set(coveredEnglishKeys);
  const usedRomaji = new Set(coveredRomaji);

  for (let i = 0; i < spoken.length && proposed.length < 500; i++) {
    const lemma = String(spoken[i]).toLowerCase().trim();
    const rank = i + 1;
    if (!lemma) continue;
    if (SKIP_AS_HEADWORD.has(lemma)) continue;
    if (usedEnglish.has(lemma)) continue;

    const mapped = EN_TO_JP[lemma];
    let romaji = mapped ? mapped.romaji : "TBD";
    let jp = mapped ? mapped.jp : "TBD";
    let audio = mapped ? mapped.audio : "TBD";
    let english = mapped ? mapped.english : lemma;
    let flag = mapped && mapped.flag ? mapped.flag : "";
    let confidence = mapped ? (mapped.flag ? "medium" : "high") : "low";

    if (!mapped) {
      flag = "Japanese gloss TBD — do not invent";
      confidence = "low";
    }

    if (romaji !== "TBD") {
      const rKey = romaji.split("/")[0].trim().toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim();
      if (usedRomaji.has(rKey)) {
        usedEnglish.add(lemma);
        continue;
      }
      usedRomaji.add(rKey);
    }

    usedEnglish.add(lemma);
    const blockNumber = 11 + Math.floor(proposed.length / 50);
    const wordIndex = proposed.length % 50;
    proposed.push({
      block: blockNumber,
      wordIndex,
      spokenRank: rank,
      englishLemma: lemma,
      english,
      jp,
      romaji,
      audio,
      confidence,
      flag: flag || "",
      mnemonic: "",
    });
  }

  writeCsv(path.join(outDir, "proposed-blocks-11-20.csv"), proposed, [
    "block","wordIndex","spokenRank","englishLemma","english","jp","romaji","audio","confidence","flag","mnemonic",
  ]);
  fs.writeFileSync(
    path.join(outDir, "proposed-blocks-11-20.json"),
    JSON.stringify({
      meta: {
        count: proposed.length,
        method:
          "Walk spoken-english-frequency-5000 in order; skip closed-class/names/interjections; skip English lemmas already covered by blocks 1-10 senses; map high-confidence Japanese when known else TBD.",
        note:
          "Because blocks 1-10 did not cleanly consume ranks 1-500, this list backfills uncovered high-frequency spoken lemmas rather than blindly taking ranks 501-1000.",
      },
      words: proposed,
    }, null, 2) + "\n",
    "utf8",
  );

  console.log(JSON.stringify({
    first500: first500.length,
    auditStats: audit.stats,
    proposed: proposed.length,
    proposedTbd: proposed.filter((w) => w.jp === "TBD").length,
    proposedMapped: proposed.filter((w) => w.jp !== "TBD").length,
    proposedRankRange: [proposed[0] && proposed[0].spokenRank, proposed[proposed.length - 1] && proposed[proposed.length - 1].spokenRank],
    outDir,
  }, null, 2));
}

main();
