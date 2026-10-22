// The crest a face stamps when it is picked. Each one is in that character's own tongue: tennis players get a tennis ball and
// their home cheer (Spanish VAMOS, Serbian АЈДЕ, Swiss German HOPP, Greek ΠΑΜΕ...). Dragon Ball and Jujutsu Kaisen are Japanese
// stories, so theirs are the kanji they wear or fight with (Goku's 悟, the turtle school's 亀, Gojo's 無 for Infinity).

export type CrestKind = 'tennis' | 'dbz' | 'jjk';
export type Crest = { kind: CrestKind; text: string };

const T = (text: string): Crest => ({ kind: 'tennis', text });
const D = (text: string): Crest => ({ kind: 'dbz', text });
const J = (text: string): Crest => ({ kind: 'jjk', text });

export const CRESTS: Record<string, Crest> = {
  // Tennis: the cheer, in the language of home.
  federer: T('HOPP'), // Swiss German: Hopp Schwiiz
  nadal: T('VAMOS'),
  alcaraz: T('VAMOS'),
  djokovic: T('АЈДЕ'), // Serbian
  borg: T('HEJA'), // Swedish
  graf: T('LOS'), // German
  zverev: T('LOS'),
  navratilova: T('DO TOHO'), // Czech
  sinner: T('FORZA'), // Italian
  tsitsipas: T('ΠΑΜΕ'), // Greek
  swiatek: T('DAWAJ'), // Polish
  medvedev: T('ДАВАЙ'), // Russian
  sharapova: T('ДАВАЙ'),
  sabalenka: T('ДАВАЙ'), // Belarusian
  rybakina: T('АЛҒА'), // Kazakh
  jabeur: T('يلا'), // Arabic, Tunisia
  osaka: T('がんばれ'), // Japanese
  kyrgios: T('OI OI OI'), // Australian
  murray: T('C’MON'), // Scottish
  raducanu: T('C’MON'), // British
  serena: T('COME ON'),
  venus: T('COME ON'),
  agassi: T('LET’S GO'),
  sampras: T('LET’S GO'),
  connors: T('C’MON'),
  mcenroe: T('SERIOUS?'),
  billie_jean: T('LET’S GO'),
  gauff: T('LET’S GO'),
  tiafoe: T('BIG FOE'),
  fritz: T('LET’S GO'),
  shelton: T('LET’S GO'),
  // Dragon Ball: the kanji on the gi, or what the character is.
  goku: D('悟'), goten: D('悟'), krillin: D('亀'), roshi: D('亀'), yamcha: D('亀'), gohan: D('飯'), piccolo: D('魔'), buu: D('魔'),
  vegeta: D('王'), nappa: D('兵'), raditz: D('兄'), broly: D('伝'), frieza: D('帝'), cell: D('完'), beerus: D('破'), whis: D('天'),
  tien: D('鶴'), chiaotzu: D('鶴'), gotenks: D('合'), gogeta: D('合'), vegito: D('合'), trunks: D('未'), bulma: D('C'),
  android_16: D('16'), android_17: D('17'), android_18: D('18'), dr_gero: D('RR'), chichi: D('牛'), videl: D('義'), hercule: D('王者'),
  shenron: D('龍'),
  // Jujutsu Kaisen: the technique.
  gojo: J('無'), sukuna: J('斬'), itadori: J('拳'), megumi: J('影'), nobara: J('釘'), nanami: J('七'), todo: J('拍'), maki: J('武'),
  toge: J('言'), panda: J('熊'), geto: J('操'), yuta: J('愛'), choso: J('血'), hanami: J('花'), jogo: J('火'), junpei: J('月'),
  miwa: J('刀'), kenjaku: J('脳'), hakari: J('賭'), mechamaru: J('機'), mahito: J('魂'), mai: J('銃'), yaga: J('傀'), momo: J('箒'),
  naoya: J('投'), kamo: J('赤'), rika: J('呪'), ino: J('吉'), toji: J('天'), yuki: J('星'),
};
