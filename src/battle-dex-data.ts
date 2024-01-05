/**
 * Pokemon Showdown Dex Data
 *
 * A collection of data and definitions for src/battle-dex.ts.
 *
 * Larger data has their own files in data/, so this is just for small
 * miscellaneous data that doesn't need its own file.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

/**
 * String that contains only lowercase alphanumeric characters.
 */
type ID = string & {__isID: true};

const BattleNatures: {[k in NatureName]: {plus?: StatName, minus?: StatName}} = {
	Adamant: {
		plus: 'atk',
		minus: 'spa',
	},
	Bashful: {},
	Bold: {
		plus: 'def',
		minus: 'atk',
	},
	Brave: {
		plus: 'atk',
		minus: 'spe',
	},
	Calm: {
		plus: 'spd',
		minus: 'atk',
	},
	Careful: {
		plus: 'spd',
		minus: 'spa',
	},
	Docile: {},
	Gentle: {
		plus: 'spd',
		minus: 'def',
	},
	Hardy: {},
	Hasty: {
		plus: 'spe',
		minus: 'def',
	},
	Impish: {
		plus: 'def',
		minus: 'spa',
	},
	Jolly: {
		plus: 'spe',
		minus: 'spa',
	},
	Lax: {
		plus: 'def',
		minus: 'spd',
	},
	Lonely: {
		plus: 'atk',
		minus: 'def',
	},
	Mild: {
		plus: 'spa',
		minus: 'def',
	},
	Modest: {
		plus: 'spa',
		minus: 'atk',
	},
	Naive: {
		plus: 'spe',
		minus: 'spd',
	},
	Naughty: {
		plus: 'atk',
		minus: 'spd',
	},
	Quiet: {
		plus: 'spa',
		minus: 'spe',
	},
	Quirky: {},
	Rash: {
		plus: 'spa',
		minus: 'spd',
	},
	Relaxed: {
		plus: 'def',
		minus: 'spe',
	},
	Sassy: {
		plus: 'spd',
		minus: 'spe',
	},
	Serious: {},
	Timid: {
		plus: 'spe',
		minus: 'atk',
	},
};
const BattleStatIDs: {[k: string]: StatName | undefined} = {
	HP: 'hp',
	hp: 'hp',
	Atk: 'atk',
	atk: 'atk',
	Def: 'def',
	def: 'def',
	SpA: 'spa',
	SAtk: 'spa',
	SpAtk: 'spa',
	spa: 'spa',
	spc: 'spa',
	Spc: 'spa',
	SpD: 'spd',
	SDef: 'spd',
	SpDef: 'spd',
	spd: 'spd',
	Spe: 'spe',
	Spd: 'spe',
	spe: 'spe',
};
/** Stat short names */
const BattleStatNames = {
	hp: 'HP',
	atk: 'Atk',
	def: 'Def',
	spa: 'SpA',
	spd: 'SpD',
	spe: 'Spe',
} as const;

const BattleBaseSpeciesChart = [
	"unown", "burmy", "shellos", "gastrodon", "deerling", "sawsbuck", "vivillon", "flabebe", "floette", "florges", "furfrou", "minior", "alcremie", "tatsugiri", "pokestarufo", "pokestarbrycenman", "pokestarmt", "pokestarmt2", "pokestartransport", "pokestargiant", "pokestarhumanoid", "pokestarmonster", "pokestarf00", "pokestarf002", "pokestarspirit", "pokestarblackdoor", "pokestarwhitedoor", "pokestarblackbelt",
] as ID[];

const BattlePokemonIconIndexes: {[id: string]: number} = {
	// alt forms
	egg: 1020 + 1,
	pikachubelle: 1020 + 2,
	pikachulibre: 1020 + 3,
	pikachuphd: 1020 + 4,
	pikachupopstar: 1020 + 5,
	pikachurockstar: 1020 + 6,
	pikachucosplay: 1020 + 7,
	unownexclamation: 1020 + 8,
	unownquestion: 1020 + 9,
	unownb: 1020 + 10,
	unownc: 1020 + 11,
	unownd: 1020 + 12,
	unowne: 1020 + 13,
	unownf: 1020 + 14,
	unowng: 1020 + 15,
	unownh: 1020 + 16,
	unowni: 1020 + 17,
	unownj: 1020 + 18,
	unownk: 1020 + 19,
	unownl: 1020 + 20,
	unownm: 1020 + 21,
	unownn: 1020 + 22,
	unowno: 1020 + 23,
	unownp: 1020 + 24,
	unownq: 1020 + 25,
	unownr: 1020 + 26,
	unowns: 1020 + 27,
	unownt: 1020 + 28,
	unownu: 1020 + 29,
	unownv: 1020 + 30,
	unownw: 1020 + 31,
	unownx: 1020 + 32,
	unowny: 1020 + 33,
	unownz: 1020 + 34,
	castformrainy: 1020 + 35,
	castformsnowy: 1020 + 36,
	castformsunny: 1020 + 37,
	deoxysattack: 1020 + 38,
	deoxysdefense: 1020 + 39,
	deoxysspeed: 1020 + 40,
	burmysandy: 1020 + 41,
	burmytrash: 1020 + 42,
	wormadamsandy: 1020 + 43,
	wormadamtrash: 1020 + 44,
	cherrimsunshine: 1020 + 45,
	shelloseast: 1020 + 46,
	gastrodoneast: 1020 + 47,
	rotomfan: 1020 + 48,
	rotomfrost: 1020 + 49,
	rotomheat: 1020 + 50,
	rotommow: 1020 + 51,
	rotomwash: 1020 + 52,
	giratinaorigin: 1020 + 53,
	shayminsky: 1020 + 54,
	unfezantf: 1020 + 55,
	basculinbluestriped: 1020 + 56,
	darmanitanzen: 1020 + 57,
	deerlingautumn: 1020 + 58,
	deerlingsummer: 1020 + 59,
	deerlingwinter: 1020 + 60,
	sawsbuckautumn: 1020 + 61,
	sawsbucksummer: 1020 + 62,
	sawsbuckwinter: 1020 + 63,
	frillishf: 1020 + 64,
	jellicentf: 1020 + 65,
	tornadustherian: 1020 + 66,
	thundurustherian: 1020 + 67,
	landorustherian: 1020 + 68,
	kyuremblack: 1020 + 69,
	kyuremwhite: 1020 + 70,
	keldeoresolute: 1020 + 71,
	meloettapirouette: 1020 + 72,
	vivillonarchipelago: 1020 + 73,
	vivilloncontinental: 1020 + 74,
	vivillonelegant: 1020 + 75,
	vivillonfancy: 1020 + 76,
	vivillongarden: 1020 + 77,
	vivillonhighplains: 1020 + 78,
	vivillonicysnow: 1020 + 79,
	vivillonjungle: 1020 + 80,
	vivillonmarine: 1020 + 81,
	vivillonmodern: 1020 + 82,
	vivillonmonsoon: 1020 + 83,
	vivillonocean: 1020 + 84,
	vivillonpokeball: 1020 + 85,
	vivillonpolar: 1020 + 86,
	vivillonriver: 1020 + 87,
	vivillonsandstorm: 1020 + 88,
	vivillonsavanna: 1020 + 89,
	vivillonsun: 1020 + 90,
	vivillontundra: 1020 + 91,
	pyroarf: 1020 + 92,
	flabebeblue: 1020 + 93,
	flabebeorange: 1020 + 94,
	flabebewhite: 1020 + 95,
	flabebeyellow: 1020 + 96,
	floetteblue: 1020 + 97,
	floetteeternal: 1020 + 98,
	floetteorange: 1020 + 99,
	floettewhite: 1020 + 100,
	floetteyellow: 1020 + 101,
	florgesblue: 1020 + 102,
	florgesorange: 1020 + 103,
	florgeswhite: 1020 + 104,
	florgesyellow: 1020 + 105,
	furfroudandy: 1020 + 106,
	furfroudebutante: 1020 + 107,
	furfroudiamond: 1020 + 108,
	furfrouheart: 1020 + 109,
	furfroukabuki: 1020 + 110,
	furfroulareine: 1020 + 111,
	furfroumatron: 1020 + 112,
	furfroupharaoh: 1020 + 113,
	furfroustar: 1020 + 114,
	meowsticf: 1020 + 115,
	aegislashblade: 1020 + 116,
	xerneasneutral: 1020 + 117,
	hoopaunbound: 1020 + 118,
	rattataalola: 1020 + 119,
	raticatealola: 1020 + 120,
	raichualola: 1020 + 121,
	sandshrewalola: 1020 + 122,
	sandslashalola: 1020 + 123,
	vulpixalola: 1020 + 124,
	ninetalesalola: 1020 + 125,
	diglettalola: 1020 + 126,
	dugtrioalola: 1020 + 127,
	meowthalola: 1020 + 128,
	persianalola: 1020 + 129,
	geodudealola: 1020 + 130,
	graveleralola: 1020 + 131,
	golemalola: 1020 + 132,
	grimeralola: 1020 + 133,
	mukalola: 1020 + 134,
	exeggutoralola: 1020 + 135,
	marowakalola: 1020 + 136,
	greninjaash: 1020 + 137,
	zygarde10: 1020 + 138,
	zygardecomplete: 1020 + 139,
	oricoriopompom: 1020 + 140,
	oricoriopau: 1020 + 141,
	oricoriosensu: 1020 + 142,
	lycanrocmidnight: 1020 + 143,
	wishiwashischool: 1020 + 144,
	miniormeteor: 1020 + 145,
	miniororange: 1020 + 146,
	minioryellow: 1020 + 147,
	miniorgreen: 1020 + 148,
	miniorblue: 1020 + 149,
	miniorindigo: 1020 + 150,
	miniorviolet: 1020 + 151,
	magearnaoriginal: 1020 + 152,
	pikachuoriginal: 1020 + 153,
	pikachuhoenn: 1020 + 154,
	pikachusinnoh: 1020 + 155,
	pikachuunova: 1020 + 156,
	pikachukalos: 1020 + 157,
	pikachualola: 1020 + 158,
	pikachupartner: 1020 + 159,
	lycanrocdusk: 1020 + 160,
	necrozmaduskmane: 1020 + 161,
	necrozmadawnwings: 1020 + 162,
	necrozmaultra: 1020 + 163,
	pikachustarter: 1020 + 164,
	eeveestarter: 1020 + 165,
	meowthgalar: 1020 + 166,
	ponytagalar: 1020 + 167,
	rapidashgalar: 1020 + 168,
	farfetchdgalar: 1020 + 169,
	weezinggalar: 1020 + 170,
	mrmimegalar: 1020 + 171,
	corsolagalar: 1020 + 172,
	zigzagoongalar: 1020 + 173,
	linoonegalar: 1020 + 174,
	darumakagalar: 1020 + 175,
	darmanitangalar: 1020 + 176,
	darmanitangalarzen: 1020 + 177,
	yamaskgalar: 1020 + 178,
	stunfiskgalar: 1020 + 179,
	cramorantgulping: 1020 + 180,
	cramorantgorging: 1020 + 181,
	toxtricitylowkey: 1020 + 182,
	alcremierubycream: 1020 + 183,
	alcremiematchacream: 1020 + 184,
	alcremiemintcream: 1020 + 185,
	alcremielemoncream: 1020 + 186,
	alcremiesaltedcream: 1020 + 187,
	alcremierubyswirl: 1020 + 188,
	alcremiecaramelswirl: 1020 + 189,
	alcremierainbowswirl: 1020 + 190,
	eiscuenoice: 1020 + 191,
	indeedeef: 1020 + 192,
	morpekohangry: 1020 + 193,
	zaciancrowned: 1020 + 194,
	zamazentacrowned: 1020 + 195,
	slowpokegalar: 1020 + 196,
	slowbrogalar: 1020 + 197,
	zarudedada: 1020 + 198,
	pikachuworld: 1020 + 199,
	articunogalar: 1020 + 200,
	zapdosgalar: 1020 + 201,
	moltresgalar: 1020 + 202,
	slowkinggalar: 1020 + 203,
	calyrexice: 1020 + 204,
	calyrexshadow: 1020 + 205,
	growlithehisui: 1020 + 206,
	arcaninehisui: 1020 + 207,
	voltorbhisui: 1020 + 208,
	electrodehisui: 1020 + 209,
	typhlosionhisui: 1020 + 210,
	qwilfishhisui: 1020 + 211,
	sneaselhisui: 1020 + 212,
	samurotthisui: 1020 + 213,
	lilliganthisui: 1020 + 214,
	zoruahisui: 1020 + 215,
	zoroarkhisui: 1020 + 216,
	braviaryhisui: 1020 + 217,
	sliggoohisui: 1020 + 218,
	goodrahisui: 1020 + 219,
	avalugghisui: 1020 + 220,
	decidueyehisui: 1020 + 221,
	basculegionf: 1020 + 222,
	enamorustherian: 1020 + 223,
	taurospaldea: 1020 + 224,
	taurospaldeafire: 1020 + 225,
	taurospaldeawater: 1020 + 226,
	taurospaldeacombat: 1020 + 224,
	taurospaldeablaze: 1020 + 225,
	taurospaldeaaqua: 1020 + 226,
	wooperpaldea: 1020 + 227,
	oinkolognef: 1020 + 228,
	palafinhero: 1020 + 229,
	mausholdfour: 1020 + 230,
	tatsugiridroopy: 1020 + 231,
	tatsugiristretchy: 1020 + 232,
	squawkabillyblue: 1020 + 233,
	squawkabillyyellow: 1020 + 234,
	squawkabillywhite: 1020 + 235,
	gimmighoulroaming: 1020 + 236,
	dialgaorigin: 1020 + 237,
	palkiaorigin: 1020 + 238,
	basculinwhitestriped: 1020 + 239,
	ursalunabloodmoon: 1020 + 240,
	ogerponwellspring: 1020 + 241,
	ogerponhearthflame: 1020 + 242,
	ogerponcornerstone: 1020 + 243,

	// alt forms with duplicate icons
	greninjabond: 658,
	gumshoostotem: 735,
	raticatealolatotem: 1020 + 120,
	marowakalolatotem: 1020 + 136,
	araquanidtotem: 752,
	lurantistotem: 754,
	salazzletotem: 758,
	vikavolttotem: 738,
	togedemarutotem: 777,
	mimikyutotem: 778,
	mimikyubustedtotem: 778,
	ribombeetotem: 743,
	kommoototem: 784,
	sinisteaantique: 854,
	polteageistantique: 855,
	poltchageistartisan: 1012,
	sinistchamasterpiece: 1013,
	ogerpontealtera: 1017,
	ogerponwellspringtera: 1020 + 241,
	ogerponhearthflametera: 1020 + 242,
	ogerponcornerstonetera: 1020 + 243,

	// Mega/G-Max
	venusaurmega: 1272 + 0,
	charizardmegax: 1272 + 1,
	charizardmegay: 1272 + 2,
	blastoisemega: 1272 + 3,
	beedrillmega: 1272 + 4,
	pidgeotmega: 1272 + 5,
	alakazammega: 1272 + 6,
	slowbromega: 1272 + 7,
	gengarmega: 1272 + 8,
	kangaskhanmega: 1272 + 9,
	pinsirmega: 1272 + 10,
	gyaradosmega: 1272 + 11,
	aerodactylmega: 1272 + 12,
	mewtwomegax: 1272 + 13,
	mewtwomegay: 1272 + 14,
	ampharosmega: 1272 + 15,
	steelixmega: 1272 + 16,
	scizormega: 1272 + 17,
	heracrossmega: 1272 + 18,
	houndoommega: 1272 + 19,
	tyranitarmega: 1272 + 20,
	sceptilemega: 1272 + 21,
	blazikenmega: 1272 + 22,
	swampertmega: 1272 + 23,
	gardevoirmega: 1272 + 24,
	sableyemega: 1272 + 25,
	mawilemega: 1272 + 26,
	aggronmega: 1272 + 27,
	medichammega: 1272 + 28,
	manectricmega: 1272 + 29,
	sharpedomega: 1272 + 30,
	cameruptmega: 1272 + 31,
	altariamega: 1272 + 32,
	banettemega: 1272 + 33,
	absolmega: 1272 + 34,
	glaliemega: 1272 + 35,
	salamencemega: 1272 + 36,
	metagrossmega: 1272 + 37,
	latiasmega: 1272 + 38,
	latiosmega: 1272 + 39,
	kyogreprimal: 1272 + 40,
	groudonprimal: 1272 + 41,
	rayquazamega: 1272 + 42,
	lopunnymega: 1272 + 43,
	garchompmega: 1272 + 44,
	lucariomega: 1272 + 45,
	abomasnowmega: 1272 + 46,
	gallademega: 1272 + 47,
	audinomega: 1272 + 48,
	dianciemega: 1272 + 49,
	charizardgmax: 1272 + 50,
	butterfreegmax: 1272 + 51,
	pikachugmax: 1272 + 52,
	meowthgmax: 1272 + 53,
	machampgmax: 1272 + 54,
	gengargmax: 1272 + 55,
	kinglergmax: 1272 + 56,
	laprasgmax: 1272 + 57,
	eeveegmax: 1272 + 58,
	snorlaxgmax: 1272 + 59,
	garbodorgmax: 1272 + 60,
	melmetalgmax: 1272 + 61,
	corviknightgmax: 1272 + 62,
	orbeetlegmax: 1272 + 63,
	drednawgmax: 1272 + 64,
	coalossalgmax: 1272 + 65,
	flapplegmax: 1272 + 66,
	appletungmax: 1272 + 67,
	sandacondagmax: 1272 + 68,
	toxtricitygmax: 1272 + 69,
	toxtricitylowkeygmax: 1272 + 69,
	centiskorchgmax: 1272 + 70,
	hatterenegmax: 1272 + 71,
	grimmsnarlgmax: 1272 + 72,
	alcremiegmax: 1272 + 73,
	copperajahgmax: 1272 + 74,
	duraludongmax: 1272 + 75,
	eternatuseternamax: 1272 + 76,
	venusaurgmax: 1272 + 77,
	blastoisegmax: 1272 + 78,
	rillaboomgmax: 1272 + 79,
	cinderacegmax: 1272 + 80,
	inteleongmax: 1272 + 81,
	urshifugmax: 1272 + 82,
	urshifurapidstrikegmax: 1272 + 83,

	// CAP
	syclant: 1464 + 0,
	revenankh: 1464 + 1,
	pyroak: 1464 + 2,
	fidgit: 1464 + 3,
	stratagem: 1464 + 4,
	arghonaut: 1464 + 5,
	kitsunoh: 1464 + 6,
	cyclohm: 1464 + 7,
	colossoil: 1464 + 8,
	krilowatt: 1464 + 9,
	voodoom: 1464 + 10,
	tomohawk: 1464 + 11,
	necturna: 1464 + 12,
	mollux: 1464 + 13,
	aurumoth: 1464 + 14,
	malaconda: 1464 + 15,
	cawmodore: 1464 + 16,
	volkraken: 1464 + 17,
	plasmanta: 1464 + 18,
	naviathan: 1464 + 19,
	crucibelle: 1464 + 20,
	crucibellemega: 1464 + 21,
	kerfluffle: 1464 + 22,
	pajantom: 1464 + 23,
	jumbao: 1464 + 24,
	caribolt: 1464 + 25,
	smokomodo: 1464 + 26,
	snaelstrom: 1464 + 27,
	equilibra: 1464 + 28,
	astrolotl: 1464 + 29,
	miasmaw: 1464 + 30,
	chromera: 1464 + 31,
	venomicon: 1464 + 32,
	venomiconepilogue: 1464 + 33,
	saharaja: 1464 + 34,
	hemogoblin: 1464 + 35,

	// CAP prevos
	syclar: 1500 + 0,
	embirch: 1500 + 1,
	flarelm: 1500 + 2,
	breezi: 1500 + 3,
	scratchet: 1500 + 4,
	necturine: 1500 + 5,
	cupra: 1500 + 6,
	argalis: 1500 + 7,
	brattler: 1500 + 8,
	cawdet: 1500 + 9,
	volkritter: 1500 + 10,
	snugglow: 1500 + 11,
	floatoy: 1500 + 12,
	caimanoe: 1500 + 13,
	pluffle: 1500 + 14,
	rebble: 1500 + 15,
	tactite: 1500 + 16,
	privatyke: 1500 + 17,
	nohface: 1500 + 18,
	monohm: 1500 + 19,
	duohm: 1500 + 20,
	protowatt: 1500 + 21,
	voodoll: 1500 + 22,
	mumbao: 1500 + 23,
	fawnifer: 1500 + 24,
	electrelk: 1500 + 25,
	smogecko: 1500 + 26,
	smoguana: 1500 + 27,
	swirlpool: 1500 + 28,
	coribalis: 1500 + 29,
	justyke: 1500 + 30,
	solotl: 1500 + 31,
	miasmite: 1500 + 32,
	dorsoil: 1500 + 33,
	saharascal: 1500 + 34,
	ababo: 1500 + 35,
	scattervein: 1500 + 36,
};

const BattlePokemonIconIndexesLeft: {[id: string]: number} = {
	pikachubelle: 1356 + 0,
	pikachupopstar: 1356 + 1,
	clefairy: 1356 + 2,
	clefable: 1356 + 3,
	jigglypuff: 1356 + 4,
	wigglytuff: 1356 + 5,
	dugtrioalola: 1356 + 6,
	poliwhirl: 1356 + 7,
	poliwrath: 1356 + 8,
	mukalola: 1356 + 9,
	kingler: 1356 + 10,
	croconaw: 1356 + 11,
	cleffa: 1356 + 12,
	igglybuff: 1356 + 13,
	politoed: 1356 + 14,
	unownb: 1356 + 15,
	unownc: 1356 + 16,
	unownd: 1356 + 17,
	unowne: 1356 + 18,
	unownf: 1356 + 19,
	unowng: 1356 + 20,
	unownh: 1356 + 21,
	unownj: 1356 + 22,
	unownk: 1356 + 23,
	unownl: 1356 + 24,
	unownm: 1356 + 25,
	unownn: 1356 + 26,
	unownp: 1356 + 27,
	unownq: 1356 + 28,
	unownquestion: 1356 + 29,
	unownr: 1356 + 30,
	unowns: 1356 + 31,
	unownt: 1356 + 32,
	unownv: 1356 + 33,
	unownz: 1356 + 34,
	sneasel: 1356 + 35,
	teddiursa: 1356 + 36,
	roselia: 1356 + 37,
	zangoose: 1356 + 38,
	seviper: 1356 + 39,
	castformsnowy: 1356 + 40,
	absolmega: 1356 + 41,
	absol: 1356 + 42,
	regirock: 1356 + 43,
	torterra: 1356 + 44,
	budew: 1356 + 45,
	roserade: 1356 + 46,
	magmortar: 1356 + 47,
	togekiss: 1356 + 48,
	rotomwash: 1356 + 49,
	shayminsky: 1356 + 50,
	emboar: 1356 + 51,
	pansear: 1356 + 52,
	simisear: 1356 + 53,
	drilbur: 1356 + 54,
	excadrill: 1356 + 55,
	sawk: 1356 + 56,
	lilligant: 1356 + 57,
	garbodor: 1356 + 58,
	solosis: 1356 + 59,
	vanilluxe: 1356 + 60,
	amoonguss: 1356 + 61,
	klink: 1356 + 62,
	klang: 1356 + 63,
	klinklang: 1356 + 64,
	litwick: 1356 + 65,
	golett: 1356 + 66,
	golurk: 1356 + 67,
	kyuremblack: 1356 + 68,
	kyuremwhite: 1356 + 69,
	kyurem: 1356 + 70,
	keldeoresolute: 1356 + 71,
	meloetta: 1356 + 72,
	greninja: 1356 + 73,
	greninjabond: 1356 + 73,
	greninjaash: 1356 + 74,
	furfroudebutante: 1356 + 75,
	barbaracle: 1356 + 76,
	clauncher: 1356 + 77,
	clawitzer: 1356 + 78,
	sylveon: 1356 + 79,
	klefki: 1356 + 80,
	zygarde: 1356 + 81,
	zygarde10: 1356 + 82,
	zygardecomplete: 1356 + 83,
	dartrix: 1356 + 84,
	steenee: 1356 + 85,
	tsareena: 1356 + 86,
	comfey: 1356 + 87,
	miniormeteor: 1356 + 88,
	minior: 1356 + 89,
	miniororange: 1356 + 90,
	minioryellow: 1356 + 91,
	miniorgreen: 1356 + 92,
	miniorblue: 1356 + 93,
	miniorviolet: 1356 + 94,
	miniorindigo: 1356 + 95,
	dhelmise: 1356 + 96,
	necrozma: 1356 + 97,
	marshadow: 1356 + 98,
	pikachuoriginal: 1356 + 99,
	pikachupartner: 1356 + 100,
	necrozmaduskmane: 1356 + 101,
	necrozmadawnwings: 1356 + 102,
	necrozmaultra: 1356 + 103,
	stakataka: 1356 + 104,
	blacephalon: 1356 + 105,
};

const BattleAvatarNumbers: {[k: string]: string} = {
	1: 'andre-prism',
	2: 'ayaka-prism',
	3: 'bronze-prism',
	4: 'brooklyn-prism',
	5: 'brown-palletpatrol-prism',
	6: 'bruce-prism',
	7: 'bugsy-prism',
	8: 'cadence-prism',
	9: 'cheerleader-prism',
	10: 'daichi-prism',
	11: 'delinquentf-prism',
	12: 'delinquentm-prism',
	13: 'edison-prism',
	14: 'ernest-prism',
	15: 'guitaristf-prism',
	16: 'joe-prism',
	17: 'josiah-prism',
	18: 'karpman-prism',
	19: 'koji-prism',
	20: 'lance-prism',
	21: 'lily-prism',
	22: 'lois-prism',
	23: 'miner-prism',
	24: 'mura-prism',
	25: 'palette_black-prism',
	26: 'palette_blue-prism',
	27: 'palette_green-prism',
	28: 'palette_pink-prism',
	29: 'palette_red-prism',
	30: 'palette_yellow-prism',
	31: 'ra-ethan-prism',
	32: 'ra-karpman-prism',
	33: 'rinji-prism',
	34: 'sabrina-prism',
	35: 'sheryl-prism',
	36: 'silver-prism',
	37: 'sora-prism',
	38: 'sparky-prism',
	39: 'whitney-prism',
	40: 'yuki-prism',
    41: 'ahrimosrs',
    42: 'archaeologist',
    43: 'ariane',
    44: 'anubtot',
    45: 'babe',
    46: 'bandosguy',
    47: 'barbarianduo',
    48: 'barbarianf',
    49: 'barbarianm',
    50: 'barrowsverac',
    51: 'blackknightf',
    52: 'blackknightm',
    53: 'botdragonslayer',
    54: 'botminer',
    55: 'botwoodcutting',
    56: 'canadagrrl',
    57: 'cook',
    58: 'cookfmduo',
    59: 'countdraynor',
    60: 'demonheadge',
    61: 'dharokosrs',
    62: 'divination',
    63: 'dnd',
    64: 'dukehoracio',
    65: 'durial321',
    66: 'dwarfm',
    67: 'elite 4_4',
    68: 'elite 4_3',
    69: 'elite 4_2',
    70: 'elite 4_1',
    71: 'farmer',
    72: 'firemaking',
    73: 'fisher',
    74: 'gaal',
    75: 'gentleshen',
    76: 'gertrude',
    77: 'goblin',
    78: 'goebie',
    79: 'graceful',
    80: 'guardalkhaird',
    81: 'guardalkhairdduo',
    82: 'guarddraynor',
    83: 'guardfalador',
    84: 'guardkhazard',
    85: 'guardvarrock',
    86: 'gunthor',
    87: 'guthanosrs',
    88: 'guthixwizard',
    89: 'hairdresser',
    90: 'hamgruntf',
    91: 'hamgruntm',
    92: 'hunterf',
    93: 'hunterm',
    94: 'hyperstan',
    95: 'ironman',
    96: 'jitterbug',
    97: 'jmodf',
    98: 'jmodm',
    99: 'karilosrs',
    100: 'katrine',
    101: 'kingroald',
    102: 'lopendebank',
    103: 'lukien',
    104: 'maggie',
    105: 'meg',
    106: 'merchant',
    107: 'miller',
    108: 'miner',
    109: 'mithrilman',
    110: 'monk',
    111: 'mugger',
    112: 'noobdefault',
    113: 'noobrune',
    114: 'orchy',
    115: 'ozan',
    116: 'patty',
    117: 'pirate',
    118: 'pkdh',
    119: 'pkduo',
    120: 'pkrusher',
    121: 'prezleek',
    122: 'princeali',
    123: 'protaganistf',
    124: 'protaganistm',
    125: 'quester',
    126: 'raptor',
    127: 'rsmvduo',
    128: 'rsmvf',
    129: 'rsmvm',
    130: 'sailor',
    131: 'scammer',
    132: 'scammerandvictim',
    133: 'sigmund',
    134: 'siramikvarze',
    135: 'sirowen',
    136: 'skeleton',
    137: 'skiller',
    138: 'slayer',
    139: 'smith',
    140: 'soffanquo',
    141: 'straven',
    142: 'sudobash',
    143: 'summoner',
    144: 'toragosrs',
    145: 'tribesman',
    146: 'tzhaar',
    147: 'vannaka',
    148: 'veracosrs',
    149: 'whiteknightf',
    150: 'whiteknightm',
    151: 'willmissit',
    152: 'wiseoldman',
    153: 'wizarddark',
    154: 'wizardf',
    155: 'wizardm',
    156: 'woodcutter',
    157: 'woodcutteralt',
    158: 'xeina',
    159: 'zanik',
    160: 'zezima',
	161: 'lucas',
    162: 'dawn',
    163: 'youngster-gen4dp',
    164: 'lass-gen4dp',
    165: 'camper',
    166: 'picnicker',
    167: 'bugcatcher-gen4dp',
    168: 'aromalady',
    169: 'twins-gen4dp',
    170: 'hiker-gen4',
    171: 'battlegirl-gen4',
    172: 'fisherman-gen4',
    173: 'cyclist-gen4',
    174: 'cyclistf-gen4',
    175: 'blackbelt-gen4dp',
    176: 'artist-gen4',
    177: 'pokemonbreeder-gen4',
    178: 'pokemonbreederf-gen4',
    179: 'cowgirl',
    180: 'jogger',
    181: 'pokefan-gen4',
    182: 'pokefanf-gen4',
    183: 'pokekid',
    184: 'youngcouple-gen4dp',
    185: 'acetrainer-gen4dp',
    186: 'acetrainerf-gen4dp',
    187: 'waitress-gen4',
    188: 'veteran-gen4',
    189: 'ninjaboy',
    190: 'dragontamer',
    191: 'birdkeeper-gen4dp',
    192: 'doubleteam',
    193: 'richboy-gen4',
    194: 'lady-gen4',
    195: 'gentleman-gen4dp',
    196: 'madame-gen4dp',
    197: 'beauty-gen4dp',
    198: 'collector',
    199: 'policeman-gen4',
    200: 'pokemonranger-gen4',
    201: 'pokemonrangerf-gen4',
    202: 'scientist-gen4dp',
    203: 'swimmer-gen4dp',
    204: 'swimmerf-gen4dp',
    205: 'tuber',
    206: 'tuberf',
    207: 'sailor',
    208: 'sisandbro',
    209: 'ruinmaniac',
    210: 'psychic-gen4',
    211: 'psychicf-gen4',
    212: 'gambler',
    213: 'guitarist-gen4',
    214: 'acetrainersnow',
    215: 'acetrainersnowf',
    216: 'skier',
    217: 'skierf-gen4dp',
    218: 'roughneck-gen4',
    219: 'clown',
    220: 'worker-gen4',
    221: 'schoolkid-gen4dp',
    222: 'schoolkidf-gen4',
    223: 'roark',
    224: 'barry',
    225: 'byron',
    226: 'aaron',
    227: 'bertha',
    228: 'flint',
    229: 'lucian',
    230: 'cynthia-gen4',
    231: 'bellepa',
    232: 'rancher',
    233: 'mars',
    234: 'galacticgrunt',
    235: 'gardenia',
    236: 'crasherwake',
    237: 'maylene',
    238: 'fantina',
    239: 'candice',
    240: 'volkner',
    241: 'parasollady-gen4',
    242: 'waiter-gen4dp',
    243: 'interviewers',
    244: 'cameraman',
    245: 'reporter',
    246: 'idol',
    247: 'cyrus',
    248: 'jupiter',
    249: 'saturn',
    250: 'galacticgruntf',
    251: 'argenta',
    252: 'palmer',
    253: 'thorton',
    254: 'buck',
    255: 'darach-caitlin',
    256: 'marley',
    257: 'mira',
    258: 'cheryl',
    259: 'riley',
    260: 'dahlia',
    261: 'ethan',
    262: 'lyra',
    263: 'twins-gen4',
    264: 'lass-gen4',
    265: 'acetrainer-gen4',
    266: 'acetrainerf-gen4',
    267: 'juggler',
    268: 'sage',
    269: 'li',
    270: 'gentleman-gen4',
    271: 'teacher',
    272: 'beauty',
    273: 'birdkeeper',
    274: 'swimmer-gen4',
    275: 'swimmerf-gen4',
    276: 'kimonogirl',
    277: 'scientist-gen4',
    278: 'acetrainercouple',
    279: 'youngcouple',
    280: 'supernerd',
    281: 'medium',
    282: 'schoolkid-gen4',
    283: 'blackbelt-gen4',
    284: 'pokemaniac',
    285: 'firebreather',
    286: 'burglar',
    287: 'biker-gen4',
    288: 'skierf',
    289: 'boarder',
    290: 'rocketgrunt',
    291: 'rocketgruntf',
    292: 'archer',
    293: 'ariana',
    294: 'proton',
    295: 'petrel',
    296: 'eusine',
    297: 'lucas-gen4pt',
    298: 'dawn-gen4pt',
    299: 'madame-gen4',
    300: 'waiter-gen4',
    301: 'falkner',
    302: 'bugsy',
    303: 'whitney',
    304: 'morty',
    305: 'chuck',
    306: 'jasmine',
    307: 'pryce',
    308: 'clair',
    309: 'will',
    310: 'koga',
    311: 'bruno',
    312: 'karen',
    313: 'lance',
    314: 'brock',
    315: 'misty',
    316: 'ltsurge',
    317: 'erika',
    318: 'janine',
    319: 'sabrina',
    320: 'blaine',
    321: 'blue',
    322: 'red',
    323: 'red',
    324: 'silver',
    325: 'giovanni',
    326: 'unknownf',
    327: 'unknown',
    328: 'unknown',
    329: 'hilbert',
    330: 'hilda',
    331: 'youngster',
    332: 'lass',
    333: 'schoolkid',
    334: 'schoolkidf',
    335: 'smasher',
    336: 'linebacker',
    337: 'waiter',
    338: 'waitress',
    339: 'chili',
    340: 'cilan',
    341: 'cress',
    342: 'nurseryaide',
    343: 'preschoolerf',
    344: 'preschooler',
    345: 'twins',
    346: 'pokemonbreeder',
    347: 'pokemonbreederf',
    348: 'lenora',
    349: 'burgh',
    350: 'elesa',
    351: 'clay',
    352: 'skyla',
    353: 'pokemonranger',
    354: 'pokemonrangerf',
    355: 'worker',
    356: 'backpacker',
    357: 'backpackerf',
    358: 'fisherman',
    359: 'musician',
    360: 'dancer',
    361: 'harlequin',
    362: 'artist',
    363: 'baker',
    364: 'psychic',
    365: 'psychicf',
    366: 'cheren',
    367: 'bianca',
    368: 'plasmagrunt-gen5bw',
    369: 'n',
    370: 'richboy',
    371: 'lady',
    372: 'pilot',
    373: 'workerice',
    374: 'hoopster',
    375: 'scientistf',
    376: 'clerkf',
    377: 'acetrainerf',
    378: 'acetrainer',
    379: 'blackbelt',
    380: 'scientist',
    381: 'striker',
    382: 'brycen',
    383: 'iris',
    384: 'drayden',
    385: 'roughneck',
    386: 'janitor',
    387: 'pokefan',
    388: 'pokefanf',
    389: 'doctor',
    390: 'nurse',
    391: 'hooligans',
    392: 'battlegirl',
    393: 'parasollady',
    394: 'clerk',
    395: 'clerk-boss',
    396: 'backers',
    397: 'backersf',
    398: 'veteran',
    399: 'veteranf',
    400: 'biker',
    401: 'infielder',
    402: 'hiker',
    403: 'madame',
    404: 'gentleman',
    405: 'plasmagruntf-gen5bw',
    406: 'shauntal',
    407: 'marshal',
    408: 'grimsley',
    409: 'caitlin',
    410: 'ghetsis-gen5bw',
    411: 'depotagent',
    412: 'swimmer',
    413: 'swimmerf',
    414: 'policeman',
    415: 'maid',
    416: 'ingo',
    417: 'alder',
    418: 'cyclist',
    419: 'cyclistf',
    420: 'cynthia',
    421: 'emmet',
    422: 'hilbert-wonderlauncher',
    423: 'hilda-wonderlauncher',
    424: 'hugh',
    425: 'rosa',
    426: 'nate',
    427: 'colress',
    428: 'beauty-gen5bw2',
    429: 'ghetsis',
    430: 'plasmagrunt',
    431: 'plasmagruntf',
    432: 'iris-gen5bw2',
    433: 'brycenman',
    434: 'shadowtriad',
    435: 'rood',
    436: 'zinzolin',
    437: 'cheren-gen5bw2',
    438: 'marlon',
    439: 'roxie',
    440: 'roxanne',
    441: 'brawly',
    442: 'wattson',
    443: 'flannery',
    444: 'norman',
    445: 'winona',
    446: 'tate',
    447: 'liza',
    448: 'juan',
    449: 'guitarist',
    450: 'steven',
    451: 'wallace',
    452: 'bellelba',
    453: 'benga',
    454: 'ash',
	'#bw2elesa': 'elesa-gen5bw2',
	'#teamrocket': 'teamrocket',
	'#yellow': 'yellow',
	'#zinnia': 'zinnia',
	'#clemont': 'clemont',
	'#wally': 'wally',
	breeder: 'pokemonbreeder',
	breederf: 'pokemonbreederf',
	'hilbert-dueldisk': 'hilbert-wonderlauncher',
	'hilda-dueldisk': 'hilda-wonderlauncher',
	'nate-dueldisk': 'nate-wonderlauncher',
	'rosa-dueldisk': 'rosa-wonderlauncher',

	1001: '#1001',
	1002: '#1002',
	1003: '#1003',
	1005: '#1005',
	1010: '#1010',
};

type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type NatureName = 'Adamant' | 'Bashful' | 'Bold' | 'Brave' | 'Calm' | 'Careful' | 'Docile' | 'Gentle' |
	'Hardy' | 'Hasty' | 'Impish' | 'Jolly' | 'Lax' | 'Lonely' | 'Mild' | 'Modest' | 'Naive' | 'Naughty' |
	'Quiet' | 'Quirky' | 'Rash' | 'Relaxed' | 'Sassy' | 'Serious' | 'Timid';
type StatNameExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type TypeName = 'Normal' | 'Fighting' | 'Flying' | 'Poison' | 'Ground' | 'Rock' | 'Bug' | 'Ghost' | 'Steel' |
	'Fire' | 'Water' | 'Grass' | 'Electric' | 'Psychic' | 'Ice' | 'Dragon' | 'Dark' | 'Fairy' | '???';
type StatusName = 'par' | 'psn' | 'frz' | 'slp' | 'brn';
type BoostStatName = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'evasion' | 'accuracy' | 'spc';
type GenderName = 'M' | 'F' | 'N';

interface Effect {
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly effectType: 'Item' | 'Move' | 'Ability' | 'Species' | 'PureEffect';
	/**
	 * Do we have data on this item/move/ability/species?
	 * WARNING: Always false if the relevant data files aren't loaded.
	 */
	readonly exists: boolean;
}

class PureEffect implements Effect {
	readonly effectType = 'PureEffect';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;
	constructor(id: ID, name: string) {
		this.id = id;
		this.name = name;
		this.gen = 0;
		this.exists = false;
	}
}

class Item implements Effect {
	// effect
	readonly effectType = 'Item';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly num: number;
	readonly spritenum: number;
	readonly desc: string;
	readonly shortDesc: string;

	readonly megaStone: string;
	readonly megaEvolves: string;
	readonly zMove: string | true | null;
	readonly zMoveType: TypeName | '';
	readonly zMoveFrom: string;
	readonly zMoveUser: readonly string[] | null;
	readonly onPlate: TypeName;
	readonly onMemory: TypeName;
	readonly onDrive: TypeName;
	readonly fling: any;
	readonly naturalGift: any;
	readonly isPokeball: boolean;
	readonly itemUser?: readonly string[];

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);

		this.num = data.num || 0;
		this.spritenum = data.spritenum || 0;
		this.desc = data.desc || data.shortDesc || '';
		this.shortDesc = data.shortDesc || this.desc;

		this.megaStone = data.megaStone || '';
		this.megaEvolves = data.megaEvolves || '';
		this.zMove = data.zMove || null;
		this.zMoveType = data.zMoveType || '';
		this.zMoveFrom = data.zMoveFrom || '';
		this.zMoveUser = data.zMoveUser || null;
		this.onPlate = data.onPlate || '';
		this.onMemory = data.onMemory || '';
		this.onDrive = data.onDrive || '';
		this.fling = data.fling || null;
		this.naturalGift = data.naturalGift || null;
		this.isPokeball = !!data.isPokeball;
		this.itemUser = data.itemUser;

		if (!this.gen) {
			if (this.num >= 577) {
				this.gen = 6;
			} else if (this.num >= 537) {
				this.gen = 5;
			} else if (this.num >= 377) {
				this.gen = 4;
			} else {
				this.gen = 3;
			}
		}
	}
}

interface MoveFlags {
	/** The move has an animation when used on an ally. */
	allyanim?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Strong Jaw Ability. */
	bite?: 1 | 0;
	/** Has no effect on Pokemon with the Bulletproof Ability. */
	bullet?: 1 | 0;
	/** Ignores a target's substitute. */
	bypasssub?: 1 | 0;
	/** The user is unable to make a move between turns. */
	charge?: 1 | 0;
	/** Makes contact. */
	contact?: 1 | 0;
	/** When used by a Pokemon, other Pokemon with the Dancer Ability can attempt to execute the same move. */
	dance?: 1 | 0;
	/** Thaws the user if executed successfully while the user is frozen. */
	defrost?: 1 | 0;
	/** Can target a Pokemon positioned anywhere in a Triple Battle. */
	distance?: 1 | 0;
	/** Prevented from being executed or selected during Gravity's effect. */
	gravity?: 1 | 0;
	/** Prevented from being executed or selected during Heal Block's effect. */
	heal?: 1 | 0;
	/** Can be copied by Mirror Move. */
	mirror?: 1 | 0;
	/** Prevented from being executed or selected in a Sky Battle. */
	nonsky?: 1 | 0;
	/** Has no effect on Grass-type Pokemon, Pokemon with the Overcoat Ability, and Pokemon holding Safety Goggles. */
	powder?: 1 | 0;
	/** Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield. */
	protect?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Mega Launcher Ability. */
	pulse?: 1 | 0;
	/** Power is multiplied by 1.2 when used by a Pokemon with the Iron Fist Ability. */
	punch?: 1 | 0;
	/** If this move is successful, the user must recharge on the following turn and cannot make a move. */
	recharge?: 1 | 0;
	/** Bounced back to the original user by Magic Coat or the Magic Bounce Ability. */
	reflectable?: 1 | 0;
	/** Power is multiplied by 1.5 when used by a Pokemon with the Sharpness Ability. */
	slicing?: 1 | 0;
	/** Can be stolen from the original user and instead used by another Pokemon using Snatch. */
	snatch?: 1 | 0;
	/** Has no effect on Pokemon with the Soundproof Ability. */
	sound?: 1 | 0;
	/** Activates the effects of the Wind Power and Wind Rider Abilities. */
	wind?: 1 | 0;
}

type MoveTarget = 'normal' | 'any' | 'adjacentAlly' | 'adjacentFoe' | 'adjacentAllyOrSelf' | 'anyAlly' | // single-target
	'self' | 'randomNormal' | // single-target, automatic
	'allAdjacent' | 'allAdjacentFoes' | // spread
	'allySide' | 'foeSide' | 'all'; // side and field

class Move implements Effect {
	// effect
	readonly effectType = 'Move';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly basePower: number;
	readonly accuracy: number | true;
	readonly pp: number;
	readonly type: TypeName;
	readonly category: 'Physical' | 'Special' | 'Status';
	readonly priority: number;
	readonly target: MoveTarget;
	readonly pressureTarget: MoveTarget;
	readonly flags: Readonly<MoveFlags>;
	readonly critRatio: number;

	readonly desc: string;
	readonly shortDesc: string;
	readonly isNonstandard: string | null;
	readonly isZ: ID;
	readonly zMove?: {
		basePower?: number,
		effect?: string,
		boost?: {[stat in StatName]?: number},
	};
	readonly isMax: boolean | string;
	readonly maxMove: {basePower: number};
	readonly ohko: true | 'Ice' | null;
	readonly recoil: number[] | null;
	readonly heal: number[] | null;
	readonly multihit: number[] | number | null;
	readonly hasCrashDamage: boolean;
	readonly noPPBoosts: boolean;
	readonly secondaries: ReadonlyArray<any> | null;
	readonly noSketch: boolean;
	readonly num: number;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);

		this.basePower = data.basePower || 0;
		this.accuracy = data.accuracy || 0;
		this.pp = data.pp || 1;
		this.type = data.type || '???';
		this.category = data.category || 'Physical';
		this.priority = data.priority || 0;
		this.target = data.target || 'normal';
		this.pressureTarget = data.pressureTarget || this.target;
		this.flags = data.flags || {};
		this.critRatio = data.critRatio === 0 ? 0 : (data.critRatio || 1);

		// TODO: move to text.js
		this.desc = data.desc;
		this.shortDesc = data.shortDesc;
		this.isNonstandard = data.isNonstandard || null;
		this.isZ = data.isZ || '';
		this.zMove = data.zMove || {};
		this.ohko = data.ohko || null;
		this.recoil = data.recoil || null;
		this.heal = data.heal || null;
		this.multihit = data.multihit || null;
		this.hasCrashDamage = data.hasCrashDamage || false;
		this.noPPBoosts = data.noPPBoosts || false;
		this.secondaries = data.secondaries || (data.secondary ? [data.secondary] : null);
		this.noSketch = !!data.noSketch;

		this.isMax = data.isMax || false;
		this.maxMove = data.maxMove || {basePower: 0};
		if (this.category !== 'Status' && !this.maxMove?.basePower) {
			if (this.isZ || this.isMax) {
				this.maxMove = {basePower: 1};
			} else if (!this.basePower) {
				this.maxMove = {basePower: 100};
			} else if (['Fighting', 'Poison'].includes(this.type)) {
				if (this.basePower >= 150) {
					this.maxMove = {basePower: 100};
				} else if (this.basePower >= 110) {
					this.maxMove = {basePower: 95};
				} else if (this.basePower >= 75) {
					this.maxMove = {basePower: 90};
				} else if (this.basePower >= 65) {
					this.maxMove = {basePower: 85};
				} else if (this.basePower >= 55) {
					this.maxMove = {basePower: 80};
				} else if (this.basePower >= 45) {
					this.maxMove = {basePower: 75};
				} else  {
					this.maxMove = {basePower: 70};
				}
			} else {
				if (this.basePower >= 150) {
					this.maxMove = {basePower: 150};
				} else if (this.basePower >= 110) {
					this.maxMove = {basePower: 140};
				} else if (this.basePower >= 75) {
					this.maxMove = {basePower: 130};
				} else if (this.basePower >= 65) {
					this.maxMove = {basePower: 120};
				} else if (this.basePower >= 55) {
					this.maxMove = {basePower: 110};
				} else if (this.basePower >= 45) {
					this.maxMove = {basePower: 100};
				} else  {
					this.maxMove = {basePower: 90};
				}
			}
		}

		if (this.category !== 'Status' && !this.isZ && !this.isMax) {
			let basePower = this.basePower;
			this.zMove = {};
			if (Array.isArray(this.multihit)) basePower *= 3;
			if (!basePower) {
				this.zMove.basePower = 100;
			} else if (basePower >= 140) {
				this.zMove.basePower = 200;
			} else if (basePower >= 130) {
				this.zMove.basePower = 195;
			} else if (basePower >= 120) {
				this.zMove.basePower = 190;
			} else if (basePower >= 110) {
				this.zMove.basePower = 185;
			} else if (basePower >= 100) {
				this.zMove.basePower = 180;
			} else if (basePower >= 90) {
				this.zMove.basePower = 175;
			} else if (basePower >= 80) {
				this.zMove.basePower = 160;
			} else if (basePower >= 70) {
				this.zMove.basePower = 140;
			} else if (basePower >= 60) {
				this.zMove.basePower = 120;
			} else {
				this.zMove.basePower = 100;
			}
			if (data.zMove) this.zMove.basePower = data.zMove.basePower;
		}

		this.num = data.num || 0;
		if (!this.gen) {
			if (this.num >= 743) {
				this.gen = 8;
			} else if (this.num >= 622) {
				this.gen = 7;
			} else if (this.num >= 560) {
				this.gen = 6;
			} else if (this.num >= 468) {
				this.gen = 5;
			} else if (this.num >= 355) {
				this.gen = 4;
			} else if (this.num >= 252) {
				this.gen = 3;
			} else if (this.num >= 166) {
				this.gen = 2;
			} else if (this.num >= 1) {
				this.gen = 1;
			}
		}
	}
}

class Ability implements Effect {
	// effect
	readonly effectType = 'Ability';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	readonly num: number;
	readonly shortDesc: string;
	readonly desc: string;

	readonly rating: number;
	readonly isPermanent: boolean;
	readonly isNonstandard: boolean;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);
		this.num = data.num || 0;
		this.shortDesc = data.shortDesc || data.desc || '';
		this.desc = data.desc || data.shortDesc || '';
		this.rating = data.rating || 1;
		this.isPermanent = !!data.isPermanent;
		this.isNonstandard = !!data.isNonstandard;
		if (!this.gen) {
			if (this.num >= 234) {
				this.gen = 8;
			} else if (this.num >= 192) {
				this.gen = 7;
			} else if (this.num >= 165) {
				this.gen = 6;
			} else if (this.num >= 124) {
				this.gen = 5;
			} else if (this.num >= 77) {
				this.gen = 4;
			} else if (this.num >= 1) {
				this.gen = 3;
			}
		}
	}
}

class Species implements Effect {
	// effect
	readonly effectType = 'Species';
	readonly id: ID;
	readonly name: string;
	readonly gen: number;
	readonly exists: boolean;

	// name
	readonly baseSpecies: string;
	readonly forme: string;
	readonly formeid: string;
	readonly spriteid: string;
	readonly baseForme: string;

	// basic data
	readonly num: number;
	readonly types: ReadonlyArray<TypeName>;
	readonly abilities: Readonly<{
		0: string, 1?: string, H?: string, S?: string,
	}>;
	readonly baseStats: Readonly<{
		hp: number, atk: number, def: number, spa: number, spd: number, spe: number,
	}>;
	readonly bst: number;
	readonly weightkg: number;

	// flavor data
	readonly heightm: number;
	readonly gender: GenderName;
	readonly color: string;
	readonly genderRatio: Readonly<{M: number, F: number}> | null;
	readonly eggGroups: ReadonlyArray<string>;
	readonly tags: ReadonlyArray<string>;

	// format data
	readonly otherFormes: ReadonlyArray<string> | null;
	readonly cosmeticFormes: ReadonlyArray<string> | null;
	readonly evos: ReadonlyArray<string> | null;
	readonly prevo: string;
	readonly evoType: 'trade' | 'useItem' | 'levelMove' | 'levelExtra' | 'levelFriendship' | 'levelHold' | 'other' | '';
	readonly evoLevel: number;
	readonly evoMove: string;
	readonly evoItem: string;
	readonly evoCondition: string;
	readonly requiredItems: ReadonlyArray<string>;
	readonly tier: string;
	readonly isTotem: boolean;
	readonly isMega: boolean;
	readonly isPrimal: boolean;
	readonly canGigantamax: boolean;
	readonly cannotDynamax: boolean;
	readonly forceTeraType: TypeName;
	readonly battleOnly: string | string[] | undefined;
	readonly isNonstandard: string | null;
	readonly unreleasedHidden: boolean | 'Past';
	readonly changesFrom: string | undefined;

	constructor(id: ID, name: string, data: any) {
		if (!data || typeof data !== 'object') data = {};
		if (data.name) name = data.name;
		this.name = Dex.sanitizeName(name);
		this.id = id;
		this.gen = data.gen || 0;
		this.exists = ('exists' in data ? !!data.exists : true);
		this.baseSpecies = data.baseSpecies || name;
		this.forme = data.forme || '';
		const baseId = toID(this.baseSpecies);
		this.formeid = (baseId === this.id ? '' : '-' + toID(this.forme));
		this.spriteid = baseId + this.formeid;
		if (this.spriteid.slice(-5) === 'totem') this.spriteid = this.spriteid.slice(0, -5);
		if (this.spriteid === 'greninja-bond') this.spriteid = 'greninja';
		if (this.spriteid.slice(-1) === '-') this.spriteid = this.spriteid.slice(0, -1);
		this.baseForme = data.baseForme || '';

		this.num = data.num || 0;
		this.types = data.types || ['???'];
		this.abilities = data.abilities || {0: "No Ability"};
		this.baseStats = data.baseStats || {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
		this.bst = this.baseStats.hp + this.baseStats.atk + this.baseStats.def +
			this.baseStats.spa + this.baseStats.spd + this.baseStats.spe;
		this.weightkg = data.weightkg || 0;

		this.heightm = data.heightm || 0;
		this.gender = data.gender || '';
		this.color = data.color || '';
		this.genderRatio = data.genderRatio || null;
		this.eggGroups = data.eggGroups || [];
		this.tags = data.tags || [];

		this.otherFormes = data.otherFormes || null;
		this.cosmeticFormes = data.cosmeticFormes || null;
		this.evos = data.evos || null;
		this.prevo = data.prevo || '';
		this.evoType = data.evoType || '';
		this.evoLevel = data.evoLevel || 0;
		this.evoMove = data.evoMove || '';
		this.evoItem = data.evoItem || '';
		this.evoCondition = data.evoCondition || '';
		this.requiredItems = data.requiredItems || (data.requiredItem ? [data.requiredItem] : []);
		this.tier = data.tier || '';

		this.isTotem = false;
		this.isMega = !!(this.forme && ['-mega', '-megax', '-megay'].includes(this.formeid));
		this.isPrimal = !!(this.forme && this.formeid === '-primal');
		this.canGigantamax = !!data.canGigantamax;
		this.cannotDynamax = !!data.cannotDynamax;
		this.forceTeraType = data.forceTeraType || '';
		this.battleOnly = data.battleOnly || undefined;
		this.isNonstandard = data.isNonstandard || null;
		this.unreleasedHidden = data.unreleasedHidden || false;
		this.changesFrom = data.changesFrom || undefined;
		if (!this.gen) {
			if (this.num >= 906 || this.formeid.startsWith('-paldea')) {
				this.gen = 9;
			} else if (this.num >= 810 || this.formeid.startsWith('-galar') || this.formeid.startsWith('-hisui')) {
				this.gen = 8;
			} else if (this.num >= 722 || this.formeid === '-alola' || this.formeid === '-starter') {
				this.gen = 7;
			} else if (this.isMega || this.isPrimal) {
				this.gen = 6;
				this.battleOnly = this.baseSpecies;
			} else if (this.formeid === '-totem' || this.formeid === '-alolatotem') {
				this.gen = 7;
				this.isTotem = true;
			} else if (this.num >= 650) {
				this.gen = 6;
			} else if (this.num >= 494) {
				this.gen = 5;
			} else if (this.num >= 387) {
				this.gen = 4;
			} else if (this.num >= 252) {
				this.gen = 3;
			} else if (this.num >= 152) {
				this.gen = 2;
			} else if (this.num >= 1) {
				this.gen = 1;
			}
		}
	}
}

interface Type extends Effect {
	damageTaken?: AnyObject;
	HPivs?: Partial<StatsTable>;
	HPdvs?: Partial<StatsTable>;
}

if (typeof require === 'function') {
	// in Node
	(global as any).BattleBaseSpeciesChart = BattleBaseSpeciesChart;
	(global as any).BattleNatures = BattleNatures;
	(global as any).PureEffect = PureEffect;
	(global as any).Species = Species;
	(global as any).Ability = Ability;
	(global as any).Item = Item;
	(global as any).Move = Move;
}
