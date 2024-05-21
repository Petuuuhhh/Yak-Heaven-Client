/**
 * Search
 *
 * Code for searching for dex information, used by the Dex and
 * Teambuilder.
 *
 * Dependencies: battledata, search-index
 * Optional dependencies: pokedex, moves, items, abilities
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

type SearchType = (
	'pokemon' | 'type' | 'tier' | 'move' | 'item' | 'ability' | 'egggroup' | 'category' | 'article' | 'type2' | 'attribute' | 'typing' | 'level'
);

type SearchRow = (
	[SearchType, ID | number, number?, number?] | ['sortpokemon' | 'sortmove', ''] | ['header' | 'html', string | number]
);

type SearchFilter = [string, string | number];

/** ID, SearchType, index (if alias), offset (if offset alias) */
declare const BattleSearchIndex: [ID, SearchType, number?, number?][];
declare const BattleSearchIndexOffset: any;
declare const BattleTeambuilderTable: any;


/**
 * Backend for search UIs.
 */
class DexSearch {
	query = '';

	/**
	 * Dex for the mod/generation to search.
	 */
	dex: ModdedDex = Dex;

	typedSearch: BattleTypedSearch<SearchType> | null = null;

	results: SearchRow[] | null = null;
	exactMatch = false;

	static typeTable = {
		pokemon: 1,
		type: 2,
		tier: 3,
		move: 4,
		item: 5,
		ability: 6,
		egggroup: 7,
		category: 8,
		article: 9,
	};
	static typeName = {
		pokemon: 'Pok&eacute;mon',
		type: 'Type',
		tier: 'Tiers',
		move: 'Moves',
		item: 'Items',
		ability: 'Abilities',
		egggroup: 'Egg group',
		category: 'Category',
		article: 'Article',
	};
	firstPokemonColumn: 'Tier' | 'Number' = 'Number';

	/**
	 * Column to sort by. Default is `null`, a smart sort determined by how good
	 * things are according to the base filters, falling back to dex number (for
	 * Pokemon) and name (for everything else).
	 */
	sortCol: string | null = null;
	reverseSort = false;

	/**
	 * Filters for the search result. Does not include the two base filters
	 * (format and species).
	 */
	filters: SearchFilter[] | null = null;


	constructor(searchType: SearchType | '' = '', formatid = '' as ID, species = '' as ID) {
		this.setType(searchType, formatid, species);
		if (window.room.curTeam.mod) this.dex = Dex.mod(window.room.curTeam.mod);

	}

	getTypedSearch(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | PokemonSet = '' as ID) {
		if (!searchType) return null;
		switch (searchType) {
		case 'pokemon': return new BattlePokemonSearch('pokemon', format, speciesOrSet);
		case 'item': return new BattleItemSearch('item', format, speciesOrSet);
		case 'move': return new BattleMoveSearch('move', format, speciesOrSet);
		case 'ability': return new BattleAbilitySearch('ability', format, speciesOrSet);
		case 'type2': return new BattleType2Search('type2', format, speciesOrSet);
		case 'attribute': return new BattleAttributeSearch('attribute', format, speciesOrSet);
		case 'typing': return new BattleTypingSearch('typing', format, speciesOrSet);
		case 'level': return new BattleLevelSearch('level', format, speciesOrSet);
		case 'type': return new BattleTypeSearch('type', format, speciesOrSet);
		case 'category': return new BattleCategorySearch('category', format, speciesOrSet);
		}
		return null;
	}

	find(query: string) {
		query = toID(query);
		if (this.query === query && this.results) {
			return false;
		}
		this.query = query;
		if (!query) {
			this.results = this.typedSearch?.getResults(this.filters, this.sortCol, this.reverseSort) || [];
		} else {
			this.results = this.textSearch(query);
		}
		return true;
	}

	setType(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | PokemonSet = '' as ID) {
		// invalidate caches
		this.results = null;

		if (searchType !== this.typedSearch?.searchType) {
			this.filters = null;
			this.sortCol = null;
		}
		this.typedSearch = this.getTypedSearch(searchType, format, speciesOrSet);
		if (this.typedSearch) this.dex = this.typedSearch.dex;
	}

	addFilter(entry: SearchFilter): boolean {
		if (!this.typedSearch) return false;
		let [type] = entry;
		if (this.typedSearch.searchType === 'pokemon') {
			if (type === this.sortCol) this.sortCol = null;
			if (!['type', 'move', 'ability', 'egggroup', 'tier', 'type2', 'attribute', 'typing', 'level'].includes(type)) return false;
			if (type === 'move') entry[1] = toID(entry[1]);
			if (!this.filters) this.filters = [];
			this.results = null;
			for (const filter of this.filters) {
				if (filter[0] === type && filter[1] === entry[1]) {
					return true;
				}
			}
			this.filters.push(entry);
			return true;
		} else if (this.typedSearch.searchType === 'move') {
			if (type === this.sortCol) this.sortCol = null;
			if (!['type', 'category', 'pokemon'].includes(type)) return false;
			if (type === 'pokemon') entry[1] = toID(entry[1]);
			if (!this.filters) this.filters = [];
			this.filters.push(entry);
			this.results = null;
			return true;
		}
		return false;
	}

	removeFilter(entry?: SearchFilter): boolean {
		if (!this.filters) return false;
		if (entry) {
			const filterid = entry.join(':');
			let deleted: string[] | null = null;
			// delete specific filter
			for (let i = 0; i < this.filters.length; i++) {
				if (filterid === this.filters[i].join(':')) {
					deleted = this.filters[i];
					this.filters.splice(i, 1);
					break;
				}
			}
			if (!deleted) return false;
		} else {
			this.filters.pop();
		}
		if (!this.filters.length) this.filters = null;
		this.results = null;
		return true;
	}

	toggleSort(sortCol: string) {
		if (this.sortCol === sortCol) {
			if (!this.reverseSort) {
				this.reverseSort = true;
			} else {
				this.sortCol = null;
				this.reverseSort = false;
			}
		} else {
			this.sortCol = sortCol;
			this.reverseSort = false;
		}
		this.results = null;
	}

	filterLabel(filterType: string) {
		if (this.typedSearch && this.typedSearch.searchType !== filterType) {
			return 'Filter';
		}
		return null;
	}
	illegalLabel(id: ID) {
		return this.typedSearch?.illegalReasons?.[id] || null;
	}

	getTier(species: Species) {
		return this.typedSearch?.getTier(species) || '';
	}

	textSearch(query: string): SearchRow[] {
		query = toID(query);

		this.exactMatch = false;
		let searchType: SearchType | '' = this.typedSearch?.searchType || '';

		// If searchType exists, we're searching mainly for results of that type.
		// We'll still search for results of other types, but those results
		// will only be used to filter results for that type.
		let searchTypeIndex = (searchType ? DexSearch.typeTable[searchType] : -1);

		/** searching for "Psychic type" will make the type come up over the move */
		let qFilterType: 'type' | '' = '';
		if (query.slice(-4) === 'type') {
			if (query.slice(0, -4) in window.BattleTypeChart) {
				query = query.slice(0, -4);
				qFilterType = 'type';
			}
		}

		// i represents the location of the search index we're looking at
		let i = DexSearch.getClosest(query);
		this.exactMatch = (BattleSearchIndex[i][0] === query);

		// Even with output buffer buckets, we make multiple passes through
		// the search index. searchPasses is a queue of which pass we're on:
		// [passType, i, query]

		// By doing an alias pass after the normal pass, we ensure that
		// mid-word matches only display after start matches.
		let passType: SearchPassType | '' = '';
		/**
		 * pass types:
		 * * '': time to pop the next pass off the searchPasses queue
		 * * 'normal': start at i and stop when results no longer start with query
		 * * 'alias': like normal, but output aliases instead of non-alias results
		 * * 'fuzzy': start at i and stop when you have two results
		 * * 'exact': like normal, but stop at i
		 */
		type SearchPassType = 'normal' | 'alias' | 'fuzzy' | 'exact';
		/**
		 * [passType, i, query]
		 *
		 * i = index of BattleSearchIndex to start from
		 *
		 * By doing an alias pass after the normal pass, we ensure that
		 * mid-word matches only display after start matches.
		 */
		type SearchPass = [SearchPassType, number, string];
		let searchPasses: SearchPass[] = [['normal', i, query]];

		// For performance reasons, only do an alias pass if query is at
		// least 2 chars long
		if (query.length > 1) searchPasses.push(['alias', i, query]);

		// If the query matches an official alias in BattleAliases: These are
		// different from the aliases in the search index and are given
		// higher priority. We'll do a normal pass through the index with
		// the alias text before any other passes.
		let queryAlias;
		if (query in BattleAliases) {
			if (['sub', 'tr'].includes(query) || toID(BattleAliases[query]).slice(0, query.length) !== query) {
				queryAlias = toID(BattleAliases[query]);
				let aliasPassType: SearchPassType = (queryAlias === 'hiddenpower' ? 'exact' : 'normal');
				searchPasses.unshift([aliasPassType, DexSearch.getClosest(queryAlias), queryAlias]);
			}
			this.exactMatch = true;
		}

		// If there are no matches starting with query: Do a fuzzy match pass
		// Fuzzy matches will still be shown after alias matches
		if (!this.exactMatch && BattleSearchIndex[i][0].substr(0, query.length) !== query) {
			// No results start with this. Do a fuzzy match pass.
			let matchLength = query.length - 1;
			if (!i) i++;
			while (matchLength &&
				BattleSearchIndex[i][0].substr(0, matchLength) !== query.substr(0, matchLength) &&
				BattleSearchIndex[i - 1][0].substr(0, matchLength) !== query.substr(0, matchLength)) {
				matchLength--;
			}
			let matchQuery = query.substr(0, matchLength);
			while (i >= 1 && BattleSearchIndex[i - 1][0].substr(0, matchLength) === matchQuery) i--;
			searchPasses.push(['fuzzy', i, '']);
		}

		// We split the output buffers into 8 buckets.
		// Bucket 0 is usually unused, and buckets 1-7 represent
		// pokemon, types, moves, etc (see typeTable).

		// When we're done, the buffers are concatenated together to form
		// our results, with each buffer getting its own header, unlike
		// multiple-pass results, which have no header.

		// Notes:
		// - if we have a searchType, that searchType's buffer will be on top
		let bufs: SearchRow[][] = [[], [], [], [], [], [], [], [], [], []];
		let topbufIndex = -1;

		let count = 0;
		let nearMatch = false;

		/** [type, id, typeIndex] */
		let instafilter: [SearchType, ID, number] | null = null;
		let instafilterSort = [0, 1, 2, 5, 4, 3, 6, 7, 8];
		let illegal = this.typedSearch?.illegalReasons;

		// We aren't actually looping through the entirety of the searchIndex
		for (i = 0; i < BattleSearchIndex.length; i++) {
			if (!passType) {
				let searchPass = searchPasses.shift();
				if (!searchPass) break;
				passType = searchPass[0];
				i = searchPass[1];
				query = searchPass[2];
			}

			let entry = BattleSearchIndex[i];
			let id = entry[0];
			let type = entry[1];

			if (!id) break;

			if (passType === 'fuzzy') {
				// fuzzy match pass; stop after 2 results
				if (count >= 2) {
					passType = '';
					continue;
				}
				nearMatch = true;
			} else if (passType === 'exact') {
				// exact pass; stop after 1 result
				if (count >= 1) {
					passType = '';
					continue;
				}
			} else if (id.substr(0, query.length) !== query) {
				// regular pass, time to move onto our next match
				passType = '';
				continue;
			}

			if (entry.length > 2) {
				// alias entry
				if (passType !== 'alias') continue;
			} else {
				// normal entry
				if (passType === 'alias') continue;
			}

			let typeIndex = DexSearch.typeTable[type];

			// For performance, with a query length of 1, we only fill the first bucket
			if (query.length === 1 && typeIndex !== (searchType ? searchTypeIndex : 1)) continue;

			// For pokemon queries, accept types/tier/abilities/moves/eggroups as filters
			if (searchType === 'pokemon' && (typeIndex === 5 || typeIndex > 7)) continue;
			// For move queries, accept types/categories as filters
			if (searchType === 'move' && ((typeIndex !== 8 && typeIndex > 4) || typeIndex === 3)) continue;
			// For move queries in the teambuilder, don't accept pokemon as filters
			if (searchType === 'move' && illegal && typeIndex === 1) continue;
			// For ability/item queries, don't accept anything else as a filter
			if ((searchType === 'ability' || searchType === 'item') && typeIndex !== searchTypeIndex) continue;
			// Query was a type name followed 'type'; only show types
			if (qFilterType === 'type' && typeIndex !== 2) continue;
			// hardcode cases of duplicate non-consecutive aliases
			if ((id === 'megax' || id === 'megay') && 'mega'.startsWith(query)) continue;

			let matchStart = 0;
			let matchEnd = 0;
			if (passType === 'alias') {
				// alias entry
				// [aliasid, type, originalid, matchStart, originalindex]
				matchStart = entry[3]!;
				let originalIndex = entry[2]!;
				if (matchStart) {
					matchEnd = matchStart + query.length;
					matchStart += (BattleSearchIndexOffset[originalIndex][matchStart] || '0').charCodeAt(0) - 48;
					matchEnd += (BattleSearchIndexOffset[originalIndex][matchEnd - 1] || '0').charCodeAt(0) - 48;
				}
				id = BattleSearchIndex[originalIndex][0];
			} else {
				matchEnd = query.length;
				if (matchEnd) matchEnd += (BattleSearchIndexOffset[i][matchEnd - 1] || '0').charCodeAt(0) - 48;
			}

			// some aliases are substrings
			if (queryAlias === id && query !== id) continue;

			if (searchType && searchTypeIndex !== typeIndex) {
				// This is a filter, set it as an instafilter candidate
				if (!instafilter || instafilterSort[typeIndex] < instafilterSort[instafilter[2]]) {
					instafilter = [type, id, typeIndex];
				}
			}

			// show types above Arceus formes
			if (topbufIndex < 0 && searchTypeIndex < 2 && passType === 'alias' && !bufs[1].length && bufs[2].length) {
				topbufIndex = 2;
			}

						// determine if the element comes from the current mod
						const table = BattleTeambuilderTable[window.room.curTeam.mod];
						if (
							typeIndex === 1 && (!BattlePokedex[id] || BattlePokedex[id].exists === false) &&
							(!table || !table.overrideDexInfo || id in table.overrideDexInfo === false)
						) continue;
						else if (
							typeIndex === 5 && (!BattleItems[id] || BattleItems[id].exists === false) &&
							(!table || !table.overrideItemInfo || id in table.overrideItemInfo === false)
						) continue;
						else if (
							typeIndex === 4 && (!BattleMovedex[id] || BattleMovedex[id].exists === false) &&
							(!table || !table.overrideMoveInfo || id in table.overrideMoveInfo === false)
						) continue;
						else if (
							typeIndex === 6 && (!BattleAbilities[id] || BattleAbilities[id].exists === false) &&
							(!table || !table.overrideAbilityDesc || id in table.overrideAbilityDesc === false)
						) continue;
						else if (
							typeIndex === 2 && id.replace(id.charAt(0), id.charAt(0).toUpperCase()) in window.BattleTypeChart === false &&
							(!table || id.replace(id.charAt(0), id.charAt(0).toUpperCase()) in table.overrideTypeChart === false)
						) continue;

			if (illegal && typeIndex === searchTypeIndex) {
				// Always show illegal results under legal results.
				// This is done by putting legal results (and the type header)
				// in bucket 0, and illegal results in the searchType's bucket.
				// searchType buckets are always on top (but under bucket 0), so
				// illegal results will be seamlessly right under legal results.
				if (!bufs[typeIndex].length && !bufs[0].length) {
					bufs[0] = [['header', DexSearch.typeName[type]]];
				}
				if (!(id in illegal)) typeIndex = 0;
			} else {
				if (!bufs[typeIndex].length) {
					bufs[typeIndex] = [['header', DexSearch.typeName[type]]];
				}
			}

			// don't match duplicate aliases
			let curBufLength = (passType === 'alias' && bufs[typeIndex].length);
			if (curBufLength && bufs[typeIndex][curBufLength - 1][1] === id) continue;

			bufs[typeIndex].push([type, id, matchStart, matchEnd]);

			count++;
		}

		let topbuf: SearchRow[] = [];
		if (nearMatch) {
			topbuf = [['html', `<em>No exact match found. The closest matches alphabetically are:</em>`]];
		}
		if (topbufIndex >= 0) {
			topbuf = topbuf.concat(bufs[topbufIndex]);
			bufs[topbufIndex] = [];
		}
		if (searchTypeIndex >= 0) {
			topbuf = topbuf.concat(bufs[0]);
			topbuf = topbuf.concat(bufs[searchTypeIndex]);
			bufs[searchTypeIndex] = [];
			bufs[0] = [];
		}

		if (instafilter && count < 20) {
			// Result count is less than 20, so we can instafilter
			bufs.push(this.instafilter(searchType, instafilter[0], instafilter[1]));
		}

		this.results = Array.prototype.concat.apply(topbuf, bufs);
		return this.results;
	}
	private instafilter(searchType: SearchType | '', fType: SearchType, fId: ID): SearchRow[] {
		let buf: SearchRow[] = [];
		let illegalBuf: SearchRow[] = [];
		let illegal = this.typedSearch?.illegalReasons;
		// Change object to look in if using a mod
		let pokedex = BattlePokedex;
		let moveDex = BattleMovedex;
		if (window.room.curTeam.mod) {
			pokedex = {};
			moveDex = {};
			const table = BattleTeambuilderTable[window.room.curTeam.mod];
			for (const id in table.overrideDexInfo) {
				pokedex[id] = {
					types: table.overrideDexInfo[id].types,
					abilities: table.overrideDexInfo[id].abilities,
				};
			}
			for (const id in table.overrideMoveInfo) {
				moveDex[id] = {
					type: table.overrideMoveInfo.type,
					category: table.overrideMoveInfo.category,
				};
			}
			pokedex = {...pokedex, ...BattlePokedex};
			moveDex = {...moveDex, ...BattleMovedex};
		}
		if (searchType === 'pokemon') {
			switch (fType) {
			case 'type':
				let type = fId.charAt(0).toUpperCase() + fId.slice(1) as TypeName;
				buf.push(['header', `${type}-type Pok&eacute;mon`]);
				for (let id in BattlePokedex) {
					if (!BattlePokedex[id].types) continue;
					if (this.dex.species.get(id).types.includes(type)) {
						(illegal && id in illegal ? illegalBuf : buf).push(['pokemon', id as ID]);
					}
				}
				break;
			case 'ability':
				let ability = Dex.abilities.get(fId).name;
				buf.push(['header', `${ability} Pok&eacute;mon`]);
				for (let id in BattlePokedex) {
					if (!BattlePokedex[id].abilities) continue;
					if (Dex.hasAbility(this.dex.species.get(id), ability)) {
						(illegal && id in illegal ? illegalBuf : buf).push(['pokemon', id as ID]);
					}
				}
				break;
			}
		} else if (searchType === 'move') {
			switch (fType) {
			case 'type':
				let type = fId.charAt(0).toUpperCase() + fId.slice(1);
				buf.push(['header', `${type}-type moves`]);
				for (let id in BattleMovedex) {
					if (BattleMovedex[id].type === type) {
						(illegal && id in illegal ? illegalBuf : buf).push(['move', id as ID]);
					}
				}
				break;
			case 'category':
				let category = fId.charAt(0).toUpperCase() + fId.slice(1);
				buf.push(['header', `${category} moves`]);
				for (let id in BattleMovedex) {
					if (BattleMovedex[id].category === category) {
						(illegal && id in illegal ? illegalBuf : buf).push(['move', id as ID]);
					}
				}
				break;
			}
		}
		return [...buf, ...illegalBuf];
	}

	static getClosest(query: string) {
		// binary search through the index!
		let left = 0;
		let right = BattleSearchIndex.length - 1;
		while (right > left) {
			let mid = Math.floor((right - left) / 2 + left);
			if (BattleSearchIndex[mid][0] === query && (mid === 0 || BattleSearchIndex[mid - 1][0] !== query)) {
				// that's us
				return mid;
			} else if (BattleSearchIndex[mid][0] < query) {
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}
		if (left >= BattleSearchIndex.length - 1) left = BattleSearchIndex.length - 1;
		else if (BattleSearchIndex[left + 1][0] && BattleSearchIndex[left][0] < query) left++;
		if (left && BattleSearchIndex[left - 1][0] === query) left--;
		return left;
	}
}

abstract class BattleTypedSearch<T extends SearchType> {
	searchType: T;
	/**
	 * Dex for the mod/generation to search.
	 */
	dex: ModdedDex = Dex;
	/**
	 * Format is the first of two base filters. It constrains results to things
	 * legal in the format, and affects the default sort.
	 *
	 * This string specifically normalizes out generation number and the words
	 * "Doubles" and "Let's Go" from the name.
	 */
	format = '' as ID;
	/**
	*
	* mod formats can set the format variable to a standard format, so modFormat
	* keeps track of the original format in such a case
	*/
   modFormat = '' as ID;
	/**
	 * `species` is the second of two base filters. It constrains results to
	 * things that species can use, and affects the default sort.
	 */
	species = '' as ID;
	/**
	 * `set` is a pseudo-base filter; it has minor effects on move sorting.
	 * (Abilities/items can affect what moves are sorted as usable.)
	 */
	set: PokemonSet | null = null;
	mod = '';

	protected formatType: 'doubles' | 'bdsp' | 'bdspdoubles' | 'letsgo' | 'metronome' | 'natdex' | 'nfe' |
	'ssdlc1' | 'ssdlc1doubles' | 'predlc' | 'predlcdoubles' | 'predlcnatdex' | 'svdlc1' | 'svdlc1doubles' |
	'svdlc1natdex' | 'stadium' | 'lc' | null = null;

	/**
	 * Cached copy of what the results list would be with only base filters
	 * (i.e. with an empty `query` and `filters`)
	 */
	baseResults: SearchRow[] | null = null;
	/**
	 * Cached copy of all results not in `baseResults` - mostly in case a user
	 * is wondering why a specific result isn't showing up.
	 */
	baseIllegalResults: SearchRow[] | null = null;
	illegalReasons: {[id: string]: string} | null = null;
	results: SearchRow[] | null = null;

	protected readonly sortRow: SearchRow | null = null;

	constructor(searchType: T, format = '' as ID, speciesOrSet: ID | PokemonSet = '' as ID) {
		this.searchType = searchType;

		this.baseResults = null;
		this.baseIllegalResults = null;
		this.modFormat = format;
		let gen = 9;
		const ClientMods = window.ModConfig;
		if (format.slice(0, 3) === 'gen') {
			const gen = (Number(format.charAt(3)) || 6);
			// format = (format.slice(4) || 'customgame') as ID;
			this.dex = Dex.forGen(gen);
			let mod = '';
			let overrideFormat = '';
			let modFormatType = '';
			for (const modid in (ClientMods)) {
				for (const formatid in ClientMods[modid].formats) {
					if (formatid === format || format.slice(4) === formatid) {
						if (format.slice(4) === formatid) this.modFormat = formatid;
						mod = modid;
						const formatTable = ClientMods[modid].formats[formatid];
						if (mod && formatTable.teambuilderFormat) overrideFormat = toID(formatTable.teambuilderFormat);
						if (mod && formatTable.formatType) modFormatType = toID(formatTable.formatType);
						break;
					}
				}
			}
			if (mod) {
				this.dex = Dex.mod(mod as ID);
				this.dex.gen = gen;
				this.mod = mod;
			} else {
				this.dex = Dex.forGen(gen);
			}
			if (overrideFormat) format = overrideFormat as ID;
			else format = (format.slice(4) || 'customgame') as ID;
			if (modFormatType) this.formatType = modFormatType as 'doubles' | 'letsgo' | 'metronome' | 'natdex' | 'nfe' | 'dlc1' | 'dlc1doubles' | null;
		} else if (!format) {
			this.dex = Dex;
		}

		if (format.startsWith('dlc1') && this.dex.gen === 8) {
			if (format.includes('doubles')) {
				this.formatType = 'ssdlc1doubles';
			} else {
				this.formatType = 'ssdlc1';
			}
			format = format.slice(4) as ID;
		}
		if (format.startsWith('predlc')) {
			if (format.includes('doubles') && !format.includes('nationaldex')) {
				this.formatType = 'predlcdoubles';
			} else if (format.includes('nationaldex')) {
				this.formatType = 'predlcnatdex';
			} else {
				this.formatType = 'predlc';
			}
			format = format.slice(6) as ID;
		}
		if (format.startsWith('dlc1') && this.dex.gen === 9) {
			if (format.includes('doubles') && !format.includes('nationaldex')) {
				this.formatType = 'svdlc1doubles';
			} else if (format.includes('nationaldex')) {
				this.formatType = 'svdlc1natdex';
			} else {
				this.formatType = 'svdlc1';
			}
			format = format.slice(4) as ID;
		}
		if (format.startsWith('stadium')) {
			this.formatType = 'stadium';
			format = format.slice(7) as ID;
			if (!format) format = 'ou' as ID;
		}
		if (format.startsWith('vgc')) this.formatType = 'doubles';
		if (format === 'vgc2020') this.formatType = 'ssdlc1doubles';
		if (format === 'vgc2023regulationd') this.formatType = 'predlcdoubles';
		if (format === 'vgc2023regulatione') this.formatType = 'svdlc1doubles';
		if (format.includes('bdsp')) {
			if (format.includes('doubles')) {
				this.formatType = 'bdspdoubles';
			} else {
				this.formatType = 'bdsp';
			}
			format = format.slice(4) as ID;
			this.dex = Dex.mod('gen8bdsp' as ID);
		}
		if (format === 'partnersincrime') this.formatType = 'doubles';
		if (format.startsWith('ffa') || format === 'freeforall') this.formatType = 'doubles';
		if (format.includes('letsgo')) {
			this.formatType = 'letsgo';
			this.dex = Dex.mod('gen7letsgo' as ID);
		}
		if (format.includes('nationaldex') || format.startsWith('nd') || format.includes('natdex')) {
			if (format !== 'nationaldexdoubles') {
				format = (format.startsWith('nd') ? format.slice(2) :
					format.includes('natdex') ? format.slice(6) : format.slice(11)) as ID;
			}
			this.formatType = 'natdex';
			if (!format) format = 'ou' as ID;
		}
		if (format.includes('doubles') && this.dex.gen > 4 && !this.formatType) this.formatType = 'doubles';
		if (this.formatType === 'letsgo') format = format.slice(6) as ID;
		if (format.includes('metronome')) {
			this.formatType = 'metronome';
		}
		if (format.endsWith('nfe')) {
			format = format.slice(3) as ID;
			this.formatType = 'nfe';
			if (!format) format = 'ou' as ID;
		}
		if ((format.endsWith('lc') || format.startsWith('lc')) && format !== 'caplc' && !this.formatType) {
			this.formatType = 'lc';
			format = 'lc' as ID;
		}
		if (format.endsWith('draft')) format = format.slice(0, -5) as ID;
		this.format = format;

		this.species = '' as ID;
		this.set = null;
		if (typeof speciesOrSet === 'string') {
			if (speciesOrSet) this.species = speciesOrSet;
		} else {
			this.set = speciesOrSet as PokemonSet;
			this.species = toID(this.set.species);
		}
		if (!searchType || !this.set) return;
	}
	getResults(filters?: SearchFilter[] | null, sortCol?: string | null, reverseSort?: boolean): SearchRow[] {
		if (sortCol === 'type') {
			return [this.sortRow!, ...BattleTypeSearch.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'category') {
			return [this.sortRow!, ...BattleCategorySearch.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'ability') {
			return [this.sortRow!, ...BattleAbilitySearch.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'type2') {
			return [this.sortRow!, ...BattleType2Search.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'attribute') {
			return [this.sortRow!, ...BattleAttributeSearch.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'typing') {
			return [this.sortRow!, ...BattleTypingSearch.prototype.getDefaultResults.call(this)];
		} else if (sortCol === 'level') {
			return [this.sortRow!, ...BattleLevelSearch.prototype.getDefaultResults.call(this)];
		}

		if (!this.baseResults) {
			this.baseResults = this.getBaseResults();
		}

		if (!this.baseIllegalResults) {
			const legalityFilter: {[id: string]: 1} = {};
			for (const [resultType, value] of this.baseResults) {
				if (resultType === this.searchType) legalityFilter[value] = 1;
			}
			this.baseIllegalResults = [];
			this.illegalReasons = {};

			for (const id in this.getTable()) {
				if (!(id in legalityFilter)) {
					this.baseIllegalResults.push([this.searchType, id as ID]);
					this.illegalReasons[id] = 'Illegal';
				}
			}
		}

		let results: SearchRow[];
		let illegalResults: SearchRow[] | null;

		if (filters) {
			results = [];
			illegalResults = [];
			for (const result of this.baseResults) {
				if (this.filter(result, filters)) {
					if (results.length && result[0] === 'header' && results[results.length - 1][0] === 'header') {
						results[results.length - 1] = result;
					} else {
						results.push(result);
					}
				}
			}
			if (results.length && results[results.length - 1][0] === 'header') {
				results.pop();
			}
			for (const result of this.baseIllegalResults) {
				if (this.filter(result, filters)) {
					illegalResults.push(result);
				}
			}
		} else {
			results = [...this.baseResults];
			illegalResults = null;
		}

		if (sortCol) {
			results = results.filter(([rowType]) => rowType === this.searchType);
			results = this.sort(results, sortCol, reverseSort);
			if (illegalResults) {
				illegalResults = illegalResults.filter(([rowType]) => rowType === this.searchType);
				illegalResults = this.sort(illegalResults, sortCol, reverseSort);
			}
		}

		if (this.sortRow) {
			results = [this.sortRow, ...results];
		}
		if (illegalResults && illegalResults.length) {
			results = [...results, ['header', "Illegal results"], ...illegalResults];
		}
		return results;
	}
	protected firstLearnsetid(speciesid: ID) {
		let table = BattleTeambuilderTable;
		if (this.formatType?.startsWith('bdsp')) table = table['gen8bdsp'];
		if (this.formatType === 'letsgo') table = table['gen7letsgo'];
		if (speciesid in table.learnsets) return speciesid;
		const species = this.dex.species.get(speciesid);
		if (!species.exists) return '' as ID;

		let baseLearnsetid = toID(species.baseSpecies);
		if (typeof species.battleOnly === 'string' && species.battleOnly !== species.baseSpecies) {
			baseLearnsetid = toID(species.battleOnly);
		}
		if (baseLearnsetid in table.learnsets) return baseLearnsetid;
		return '' as ID;
	}
	protected firstPackDetailsid(speciesid: ID) {
		let table = BattleTeambuilderTable['ygo'];
		if (speciesid in table.overridePackDetails) return speciesid;
		return '' as ID;
	}
	protected nextLearnsetid(learnsetid: ID, speciesid: ID) {
		if (learnsetid === 'lycanrocdusk' || (speciesid === 'rockruff' && learnsetid === 'rockruff')) {
			return 'rockruffdusk' as ID;
		}
		const lsetSpecies = this.dex.species.get(learnsetid);
		if (!lsetSpecies.exists) return '' as ID;

		if (lsetSpecies.id === 'gastrodoneast') return 'gastrodon' as ID;
		if (lsetSpecies.id === 'pumpkaboosuper') return 'pumpkaboo' as ID;
		if (lsetSpecies.id === 'sinisteaantique') return 'sinistea' as ID;
		if (lsetSpecies.id === 'tatsugiristretchy') return 'tatsugiri' as ID;

		const next = lsetSpecies.battleOnly || lsetSpecies.changesFrom || lsetSpecies.prevo;
		if (next) return toID(next);

		return '' as ID;
	}
	protected nextPackDetailsID(packDetails: ID, speciesid: ID) {
		return '' as ID;
	}
	protected canLearn(speciesid: ID, moveid: ID) {
		const move = this.dex.moves.get(moveid);
		if (this.formatType === 'natdex' && move.isNonstandard && move.isNonstandard !== 'Past') {
			return false;
		}
		const gen = this.dex.gen;
		let genChar = `${gen}`;
		if (
			this.format.startsWith('vgc') ||
			this.format.startsWith('bss') ||
			this.format.startsWith('battlespot') ||
			this.format.startsWith('battlestadium') ||
			this.format.startsWith('battlefestival') ||
			(this.dex.gen === 9 && this.formatType !== 'natdex')
		) {
			if (gen === 9) {
				genChar = 'a';
			} else if (gen === 8) {
				genChar = 'g';
			} else if (gen === 7) {
				genChar = 'q';
			} else if (gen === 6) {
				genChar = 'p';
			}
		}
		let learnsetid = this.firstLearnsetid(speciesid);
		while (learnsetid) {
			let table = BattleTeambuilderTable;
			if (this.formatType?.startsWith('bdsp')) table = table['gen8bdsp'];
			if (this.formatType === 'letsgo') table = table['gen7letsgo'];
			let learnset = table.learnsets[learnsetid];
			if (this.mod) {
				if (this.mod != 'ygo') {
						const overrideLearnsets = BattleTeambuilderTable[this.mod].overrideLearnsets;
					if (overrideLearnsets[learnsetid]) {
						if (!learnset) learnset = overrideLearnsets[learnsetid]; //Didn't have learnset and mod gave it one
						learnset = JSON.parse(JSON.stringify(learnset));
						for (const learnedMove in overrideLearnsets[learnsetid]) learnset[learnedMove] = overrideLearnsets[learnsetid][learnedMove];
					}
				}
				else {
					const overridePackDetails = BattleTeambuilderTable[this.mod].overridePackDetails;
					if (overridePackDetails[learnsetid]) {
						if (!learnset) learnset = overridePackDetails[learnsetid]; //Didn't have learnset and mod gave it one
						learnset = JSON.parse(JSON.stringify(learnset));
						for (const learnedMove in overridePackDetails[learnsetid]) learnset[learnedMove] = overridePackDetails[learnsetid][learnedMove];
					}
				}
			}
			try {
				if (!Object.keys(learnset).length) { //Doesn't have learnset but one is loaded; some other mod gave it one
					learnsetid = toID(this.dex.species.get(learnsetid).baseSpecies);
				}
			} catch (e) {
				console.log("Error: Unable to load learnset data for " + learnsetid + " in " + this.mod);
			}

			// Modified this function to account for pet mods with tradebacks enabled
			const tradebacksMod = ['gen1expansionpack', 'gen1burgundy'];
			if (learnset && (moveid in learnset) && (!(this.format.startsWith('tradebacks') || tradebacksMod.includes(this.mod)) ? learnset[moveid].includes(genChar) :
				(learnset[moveid].includes(genChar) ||
					(learnset[moveid].includes(`${gen + 1}`) && move.gen === gen)))) {
				return true;
			}
			learnsetid = this.nextLearnsetid(learnsetid, speciesid);
		}
		return false;
	}
	getTier(pokemon: Species) {
		if (this.formatType === 'metronome') {
			return pokemon.num >= 0 ? String(pokemon.num) : pokemon.tier;
		}
		const modFormatTable = this.mod ? window.ModConfig[this.mod].formats[this.modFormat] : {};
		let table = window.BattleTeambuilderTable;
		if (this.mod) table = modFormatTable.gameType !== 'doubles' ? BattleTeambuilderTable[this.mod] : BattleTeambuilderTable[this.mod].doubles;
		const gen = this.dex.gen;
		const tableKey = this.formatType === 'doubles' ? `gen${gen}doubles` :
			this.formatType === 'letsgo' ? 'gen7letsgo' :
			this.formatType === 'bdsp' ? 'gen8bdsp' :
			this.formatType === 'bdspdoubles' ? 'gen8bdspdoubles' :
			this.formatType === 'nfe' ? `gen${gen}nfe` :
			this.formatType === 'lc' ? `gen${gen}lc` :
			this.formatType === 'ssdlc1' ? 'gen8dlc1' :
			this.formatType === 'ssdlc1doubles' ? 'gen8dlc1doubles' :
			this.formatType === 'predlc' ? 'gen9predlc' :
			this.formatType === 'predlcdoubles' ? 'gen9predlcdoubles' :
			this.formatType === 'predlcnatdex' ? 'gen9predlcnatdex'  :
			this.formatType === 'svdlc1' ? 'gen9dlc1' :
			this.formatType === 'svdlc1doubles' ? 'gen9dlc1doubles' :
			this.formatType === 'svdlc1natdex' ? 'gen9dlc1natdex' :
			this.formatType === 'natdex' ? `gen${gen}natdex` :
			this.formatType === 'stadium' ? `gen${gen}stadium${gen > 1 ? gen : ''}` :
			`gen${gen}`;
		if (table && table[tableKey]) {
			table = table[tableKey];
		}
		if (!table) return pokemon.tier;

		let id = pokemon.id;
		if (id in table.overrideTier) {
			return table.overrideTier[id];
		}
		if (id.slice(-5) === 'totem' && id.slice(0, -5) in table.overrideTier) {
			return table.overrideTier[id.slice(0, -5)];
		}
		id = toID(pokemon.baseSpecies);
		if (id in table.overrideTier) {
			return table.overrideTier[id];
		}

		return pokemon.tier;
	}
	abstract getTable(): {[id: string]: any};
	abstract getDefaultResults(): SearchRow[];
	abstract getBaseResults(): SearchRow[];
	abstract filter(input: SearchRow, filters: (string|number)[][]): boolean;
	abstract sort(input: SearchRow[], sortCol: string, reverseSort?: boolean): SearchRow[];
}

class BattlePokemonSearch extends BattleTypedSearch<'pokemon'> {
	sortRow: SearchRow = ['sortpokemon', ''];
	getTable() {
		if (!this.mod) return BattlePokedex;
		else return {...BattleTeambuilderTable[this.mod].overrideDexInfo, ...BattlePokedex};
	}
	getDefaultResults(): SearchRow[] {
		let results: SearchRow[] = [];
		for (let id in BattlePokedex) {
			switch (id) {
			case 'bulbasaur':
				results.push(['header', "Generation 1"]);
				break;
			case 'chikorita':
				results.push(['header', "Generation 2"]);
				break;
			case 'treecko':
				results.push(['header', "Generation 3"]);
				break;
			case 'turtwig':
				results.push(['header', "Generation 4"]);
				break;
			case 'victini':
				results.push(['header', "Generation 5"]);
				break;
			case 'chespin':
				results.push(['header', "Generation 6"]);
				break;
			case 'rowlet':
				results.push(['header', "Generation 7"]);
				break;
			case 'grookey':
				results.push(['header', "Generation 8"]);
				break;
			case 'sprigatito':
				results.push(['header', "Generation 9"]);
				break;
			case 'missingno':
				results.push(['header', "Glitch"]);
				break;
			case 'syclar':
				results.push(['header', "CAP"]);
				break;
			case 'pikachucosplay':
				continue;
			}
			results.push(['pokemon', id as ID]);
		}
		return results;
	}
	getBaseResults(): SearchRow[] {
		const format = this.format;
		if (!format) return this.getDefaultResults();
		const isVGCOrBS = format.startsWith('battlespot') || format.startsWith('bss') ||
			format.startsWith('battlestadium') || format.startsWith('vgc');
		const isHackmons = format.includes('hackmons') || format.endsWith('bh');
		let isDoublesOrBS = isVGCOrBS || this.formatType?.includes('doubles');
		const dex = this.dex;
		const modFormatTable = this.mod ? window.ModConfig[this.mod].formats[this.modFormat] : {};
		let table = BattleTeambuilderTable;
		if (this.mod) {
			table = modFormatTable.gameType !== 'doubles' ? BattleTeambuilderTable[this.mod] : BattleTeambuilderTable[this.mod].doubles;
		} else if ((format.endsWith('cap') || format.endsWith('caplc')) && dex.gen < 9) {
			table = table['gen' + dex.gen];
		} else if (isVGCOrBS) {
			table = table['gen' + dex.gen + 'vgc'];
		} else if (dex.gen === 9 && isHackmons && !this.formatType) {
			table = table['bh'];
		} else if (
			table['gen' + dex.gen + 'doubles'] && dex.gen > 4 &&
			this.formatType !== 'letsgo' && this.formatType !== 'bdspdoubles' &&
			this.formatType !== 'ssdlc1doubles' && this.formatType !== 'predlcdoubles' &&
			this.formatType !== 'svdlc1doubles' && !this.formatType?.includes('natdex') &&
			(
				format.includes('doubles') || format.includes('triples') ||
				format === 'freeforall' || format.startsWith('ffa') ||
				format === 'partnersincrime'
			)
		) {
			table = table['gen' + dex.gen + 'doubles'];
			isDoublesOrBS = true;
		} else if (dex.gen < 9 && !this.formatType) {
			table = table['gen' + dex.gen];
		} else if (this.formatType?.startsWith('bdsp')) {
			table = table['gen8' + this.formatType];
		} else if (this.formatType === 'letsgo') {
			table = table['gen7letsgo'];
		} else if (this.formatType === 'natdex') {
			table = table['gen' + dex.gen + 'natdex'];
		} else if (this.formatType === 'metronome') {
			table = table['gen' + dex.gen + 'metronome'];
		} else if (this.formatType === 'nfe') {
			table = table['gen' + dex.gen + 'nfe'];
		} else if (this.formatType === 'lc') {
			table = table['gen' + dex.gen + 'lc'];
		} else if (this.formatType?.startsWith('ssdlc1')) {
			if (this.formatType.includes('doubles')) {
				table = table['gen8dlc1doubles'];
			} else {
				table = table['gen8dlc1'];
			}
		} else if (this.formatType?.startsWith('predlc')) {
			if (this.formatType.includes('doubles')) {
				table = table['gen9predlcdoubles'];
			} else if (this.formatType.includes('natdex')) {
				table = table['gen9predlcnatdex'];
			} else {
				table = table['gen9predlc'];
			}
		} else if (this.formatType?.startsWith('svdlc1')) {
			if (this.formatType.includes('doubles')) {
				table = table['gen9dlc1doubles'];
			} else if (this.formatType.includes('natdex')) {
				table = table['gen9dlc1natdex'];
			} else {
				table = table['gen9dlc1'];
			}
		} else if (this.formatType === 'stadium') {
			table = table['gen' + dex.gen + 'stadium' + (dex.gen > 1 ? dex.gen : '')];
		}

		if (!table.tierSet) {
			table.tierSet = table.tiers.map((r: any) => {
				if (typeof r === 'string') return ['pokemon', r];
				return [r[0], r[1]];
			});
			table.tiers = null;
		}
		let tierSet: SearchRow[] = table.tierSet;
		let slices: {[k: string]: number} = table.formatSlices;
		if (format === 'ubers' || format === 'uber' || format === 'ubersuu' || format === 'nationaldexdoubles') {
			tierSet = tierSet.slice(slices.Uber);
		} else if (isVGCOrBS || (isHackmons && dex.gen === 9 && !this.formatType)) {
			if (format.endsWith('series13') || isHackmons) {
				// Show Mythicals
			} else if (
				format === 'vgc2010' || format === 'vgc2016' || format.startsWith('vgc2019') ||
				format === 'vgc2022' || format.endsWith('series10') || format.endsWith('series11')
			) {
				tierSet = tierSet.slice(slices["Restricted Legendary"]);
			} else {
				tierSet = tierSet.slice(slices.Regular);
			}
		} else if (format === 'ou') tierSet = tierSet.slice(slices.OU);
		else if (format === 'uu' || (format === 'ru' && dex.gen === 3)) tierSet = tierSet.slice(slices.UU);
		else if (format === 'ru') tierSet = tierSet.slice(slices.RU || slices.UU);
		else if (format === 'nu') tierSet = tierSet.slice(slices.NU || slices.RU || slices.UU);
		else if (format === 'pu') tierSet = tierSet.slice(slices.PU || slices.NU);
		else if (format === 'zu') tierSet = tierSet.slice(slices.ZU || slices.PU || slices.NU);
		else if (format === 'lc' || format === 'lcuu' || format.startsWith('lc') || (format !== 'caplc' && format.endsWith('lc'))) tierSet = tierSet.slice(slices.LC);
		else if (format === 'cap' || format.endsWith('cap')) {
			tierSet = tierSet.slice(0, slices.AG || slices.Uber).concat(tierSet.slice(slices.OU));
		} else if (format === 'caplc') {
			tierSet = tierSet.slice(slices['CAP LC'], slices.AG || slices.Uber).concat(tierSet.slice(slices.LC));
		} else if (format === 'anythinggoes' || format.endsWith('ag') || format.startsWith('ag')) {
			tierSet = tierSet.slice(slices.AG);
		} else if (isHackmons && (dex.gen < 9 || this.formatType === 'natdex')) {
			tierSet = tierSet.slice(slices.AG || slices.Uber);
		} else if (format === 'monotype' || format.startsWith('monothreat')) tierSet = tierSet.slice(slices.Uber);
		else if (format === 'doublesubers') tierSet = tierSet.slice(slices.DUber);
		else if (format === 'doublesou' && dex.gen > 4) tierSet = tierSet.slice(slices.DOU);
		else if (format === 'doublesuu') tierSet = tierSet.slice(slices.DUU);
		else if (format === 'doublesnu') tierSet = tierSet.slice(slices.DNU || slices.DUU);
		else if (this.formatType?.startsWith('bdsp') || this.formatType === 'letsgo' || this.formatType === 'stadium') {
			tierSet = tierSet.slice(slices.Uber);
		} else if (!isDoublesOrBS) {
			tierSet = [
				...tierSet.slice(slices.OU, slices.UU),
				...tierSet.slice(slices.AG, slices.Uber),
				...tierSet.slice(slices.Uber, slices.OU),
				...tierSet.slice(slices.UU),
			];
		} else {
			tierSet = [
				...tierSet.slice(slices.DOU, slices.DUU),
				...tierSet.slice(slices.DUber, slices.DOU),
				...tierSet.slice(slices.DUU),
			];
		}

		if (format === 'ubersuu' && table.ubersUUBans) {
			tierSet = tierSet.filter(([type, id]) => {
				if (id in table.ubersUUBans) return false;
				return true;
			});
		}
		if (format === 'nationaldexdoubles' && table.ndDoublesBans) {
			tierSet = tierSet.filter(([type, id]) => {
				if (id in table.ndDoublesBans) return false;
				return true;
			});
		}
		if (dex.gen >= 5) {
			if ((format === 'monotype' || format.startsWith('monothreat')) && table.monotypeBans) {
				tierSet = tierSet.filter(([type, id]) => {
					if (id in table.monotypeBans) return false;
					return true;
				});
			}
		}
		if (this.mod && !table.customTierSet) {
			table.customTierSet = table.customTiers.map((r: any) => {
				if (typeof r === 'string') return ['pokemon', r];
				return [r[0], r[1]];
			});
			table.customTiers = null;
		}
		let customTierSet: SearchRow[] = table.customTierSet;
		if (customTierSet) {
			tierSet = customTierSet.concat(tierSet);
			if (modFormatTable.bans.length > 0 && !modFormatTable.bans.includes("All Pokemon")) {
				tierSet = tierSet.filter(([type, id]) => {
					let banned = modFormatTable.bans;
					return !(banned.includes(id));
				});
			} else if (modFormatTable.unbans.length > 0 && modFormatTable.bans.includes("All Pokemon")) {
				tierSet = tierSet.filter(([type, id]) => {
					let unbanned = modFormatTable.unbans;
					return (unbanned.includes(id) || type === 'header');
				});
			}
			let headerCount = 0;
			let lastHeader = '';
			const emptyHeaders: string[] = [];
			for (const i in tierSet) {
				headerCount = tierSet[i][0] === 'header' ? headerCount + 1 : 0;
				if (headerCount > 1) emptyHeaders.push(lastHeader);
				if (headerCount > 0) lastHeader = tierSet[i][1];
			}
			if (headerCount === 1) emptyHeaders.push(lastHeader);
			tierSet = tierSet.filter(([type, id]) => {
				return (type !== 'header' || !emptyHeaders.includes(id));
			});
		}

		// Filter out Gmax Pokemon from standard tier selection
		if (!/^(battlestadium|vgc|doublesubers)/g.test(format)) {
			tierSet = tierSet.filter(([type, id]) => {
				if (type === 'header' && id === 'DUber by technicality') return false;
				if (type === 'pokemon') return !id.endsWith('gmax');
				return true;
			});
		}

		return tierSet;
	}
	filter(row: SearchRow, filters: (string|number)[][]) {
		if (!filters) return true;
		if (row[0] !== 'pokemon') return true;
		const species = this.dex.species.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'type':
				if (species.types[0] !== value && species.types[1] !== value) return false;
				break;
			case 'type2':
				if (species.type !== value) return false;
				break;
			case 'attribute':
				if (species.attribute !== value) return false;
				break;
			case 'typing':
				if (species.typing !== value) return false;
				break;
			case 'level':
				if (species.level !== value) return false;
				break;
			case 'egggroup':
				if (species.eggGroups[0] !== value && species.eggGroups[1] !== value) return false;
				break;
			case 'tier':
				if (this.getTier(species) !== value) return false;
				break;
			case 'ability':
				if (!Dex.hasAbility(species, value)) return false;
				break;
			case 'move':
				if (!this.canLearn(species.id, value as ID)) return false;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string, reverseSort?: boolean) {
		const sortOrder = reverseSort ? -1 : 1;
		const table = !this.mod ? '' : BattleTeambuilderTable[this.mod].overrideDexInfo;
		if (['type2', 'attribute', 'typing'].includes(sortCol)) {
			if (sortCol == 'type2') sortCol = 'type';
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pokedex1 = BattlePokedex;
				let pokedex2 = BattlePokedex;
				if (this.mod) {
					if (table[id1] && table[id1].baseStats) pokedex1 = table;
					if (table[id2] && table[id2].baseStats) pokedex2 = table;
				}
				const stat1ygo = Dex.mod('ygo' as ID).species.get(id1)[sortCol as YGOStatName];
				const stat2ygo = Dex.mod('ygo' as ID).species.get(id2)[sortCol as YGOStatName];
				return (stat1ygo < stat2ygo ? -1 : stat1ygo > stat2ygo ? 1 : 0) * sortOrder;
			});
		}
		else if (['level', 'attack', 'defense'].includes(sortCol)) {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pokedex1 = BattlePokedex;
				let pokedex2 = BattlePokedex;
				if (this.mod) {
					if (table[id1] && table[id1].baseStats) pokedex1 = table;
					if (table[id2] && table[id2].baseStats) pokedex2 = table;
				}
				const stat1ygo = Dex.mod('ygo' as ID).species.get(id1)[sortCol as YGOStatName];
				const stat2ygo = Dex.mod('ygo' as ID).species.get(id2)[sortCol as YGOStatName];
				return (stat2ygo - stat1ygo) * sortOrder;
			});
		}
		else if (['hp', 'atk', 'def', 'spa', 'spd', 'spe'].includes(sortCol)) {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pokedex1 = BattlePokedex;
				let pokedex2 = BattlePokedex;
				if (this.mod) {
					if (table[id1] && table[id1].baseStats) pokedex1 = table;
					if (table[id2] && table[id2].baseStats) pokedex2 = table;
				}
				const stat1 = this.dex.species.get(id1).baseStats[sortCol as StatName];
				const stat2 = this.dex.species.get(id2).baseStats[sortCol as StatName];
				return (stat2 - stat1) * sortOrder;
			});
		} else if (sortCol === 'bst') {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pokedex1 = BattlePokedex;
				let pokedex2 = BattlePokedex;
				if (this.mod) {
					if (table[id1] && table[id1].baseStats) pokedex1 = table;
					if (table[id2] && table[id2].baseStats) pokedex2 = table;
				}
				const base1 = this.dex.species.get(id1).baseStats;
				const base2 = this.dex.species.get(id2).baseStats;
				let bst1 = base1.hp + base1.atk + base1.def + base1.spa + base1.spd + base1.spe;
				let bst2 = base2.hp + base2.atk + base2.def + base2.spa + base2.spd + base2.spe;
				if (this.dex.gen === 1) {
					bst1 -= base1.spd;
					bst2 -= base2.spd;
				}
				return (bst2 - bst1) * sortOrder;
			});
		} else if (sortCol === 'name') {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const name1 = id1;
				const name2 = id2;
				return (name1 < name2 ? -1 : name1 > name2 ? 1 : 0) * sortOrder;
			});
		}
		throw new Error("invalid sortcol");
	}
}

class BattleAbilitySearch extends BattleTypedSearch<'ability'> {
	getTable() {
		if (!this.mod) return BattleAbilities;
		else return {...BattleTeambuilderTable[this.mod].fullAbilityName, ...BattleAbilities};
		}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in BattleAbilities) {
			results.push(['ability', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const format = this.format;
		const isHackmons = (format.includes('hackmons') || format.endsWith('bh'));
		const isAAA = (format === 'almostanyability' || format.includes('aaa'));
		const dex = this.dex;
		let species = dex.species.get(this.species);
		let abilitySet: SearchRow[] = [['header', "Abilities"]];

		if (species.isMega) {
			abilitySet.unshift(['html', `Will be <strong>${species.abilities['0']}</strong> after Mega Evolving.`]);
			species = dex.species.get(species.baseSpecies);
		}
		abilitySet.push(['ability', toID(species.abilities['0'])]);
		if (species.abilities['1']) {
			abilitySet.push(['ability', toID(species.abilities['1'])]);
		}
		if (species.abilities['H']) {
			abilitySet.push(['header', "Hidden Ability"]);
			abilitySet.push(['ability', toID(species.abilities['H'])]);
		}
		if (species.abilities['S']) {
			abilitySet.push(['header', "Special Event Ability"]);
			abilitySet.push(['ability', toID(species.abilities['S'])]);
		}
		if (isAAA || format.includes('metronomebattle') || isHackmons) {
			let abilities: ID[] = [];
			for (let i in this.getTable()) {
				const ability = dex.abilities.get(i);
				if (ability.isNonstandard) continue;
				if (ability.gen > dex.gen) continue;
				abilities.push(ability.id);
			}

			let goodAbilities: SearchRow[] = [['header', "Abilities"]];
			let poorAbilities: SearchRow[] = [['header', "Situational Abilities"]];
			let badAbilities: SearchRow[] = [['header', "Unviable Abilities"]];
			for (const ability of abilities.sort().map(abil => dex.abilities.get(abil))) {
				let rating = ability.rating;
				if (ability.id === 'normalize') rating = 3;
				if (rating >= 3) {
					goodAbilities.push(['ability', ability.id]);
				} else if (rating >= 2) {
					poorAbilities.push(['ability', ability.id]);
				} else {
					badAbilities.push(['ability', ability.id]);
				}
			}
			abilitySet = [...goodAbilities, ...poorAbilities, ...badAbilities];
			if (species.isMega) {
				if (isAAA) {
					abilitySet.unshift(['html', `Will be <strong>${species.abilities['0']}</strong> after Mega Evolving.`]);
				}
				// species is unused after this, so no need to replace
			}
		}
		return abilitySet;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'ability') return true;
		const ability = this.dex.abilities.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (!Dex.hasAbility(this.dex.species.get(value), ability.name)) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleType2Search extends BattleTypedSearch<'type2'> {
	getTable() {
		return YGOTypes;
		}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in YGOTypes) {
			results.push(['type2', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		let typeSet: SearchRow[] = [['header', "Types"]];

		typeSet.push(['type2', toID(species.type)]);
		return typeSet;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'type2') return true;
		const type = row[1];
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (type != this.dex.species.get(value).type) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleAttributeSearch extends BattleTypedSearch<'attribute'> {
	getTable() {
		return YGOAttributes;
		}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in YGOAttributes) {
			results.push(['attribute', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		let attributeSet: SearchRow[] = [['header', "Attributes"]];

		attributeSet.push(['attribute', toID(species.attribute)]);
		return attributeSet;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'attribute') return true;
		const attribute = row[1];
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (attribute != this.dex.species.get(value).attribute) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleTypingSearch extends BattleTypedSearch<'typing'> {
	getTable() {
		return YGOTypings;
		}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in YGOTypings) {
			results.push(['typing', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		let typingSet: SearchRow[] = [['header', "Attributes"]];

		typingSet.push(['typing', toID(species.typing)]);
		return typingSet;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'attribute') return true;
		const typing = row[1];
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (typing != this.dex.species.get(value).typing) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleLevelSearch extends BattleTypedSearch<'level'> {
	getTable() {
		return Array.from({length: 13}, (e, i)=> i);
		}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in Array.from({length: 13}, (e, i)=> i)) {
			results.push(['level', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		let levelSet: SearchRow[] = [['header', "Levels"]];

		levelSet.push(['level', toID(species.level)]);
		return levelSet;
	}
	filter(row: SearchRow, filters: (string|number)[][]) {
		if (!filters) return true;
		if (row[0] !== 'level') return true;
		const level = row[1];
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (Number(level) != this.dex.species.get(value).level) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleItemSearch extends BattleTypedSearch<'item'> {
	getTable() {
		if (!this.mod) return BattleItems;
		else return {...BattleTeambuilderTable[this.mod].overrideItemInfo, ...BattleItems};
	}
	getDefaultResults(): SearchRow[] {
		let table = BattleTeambuilderTable;
		if (this.mod) {
			table = table[this.mod];
		} else if (this.formatType?.startsWith('bdsp')) {
			table = table['gen8bdsp'];
		} else if (this.formatType === 'natdex') {
			table = table['gen' + this.dex.gen + 'natdex'];
		} else if (this.formatType === 'metronome') {
			table = table['gen' + this.dex.gen + 'metronome'];
		} else if (this.dex.gen < 9) {
			table = table['gen' + this.dex.gen];
		}
		if (!table.itemSet) {
			table.itemSet = table.items.map((r: any) => {
				if (typeof r === 'string') {
					return ['item', r];
				}
				return [r[0], r[1]];
			});
			table.items = null;
		}
		return table.itemSet;
	}
	getBaseResults(): SearchRow[] {
		const results = this.getDefaultResults();
		const species = this.dex.species.get(this.species);
		const speciesSpecific: SearchRow[] = [];
		for (let i = results.length - 1; i > 0; i--) {
			const row = results[i];
			if (row[0] !== 'item') continue;
			const id = row[1];
			let item = this.dex.items.get(id);
			if (!item.exists || item.isNonstandard) {
				if (item.isNonstandard !== "Past" || this.formatType !== 'natdex') {
					results.splice(i, 1);
					continue;
				}
			}
			if (item.itemUser?.includes(species.name)) {
				speciesSpecific.push(row);
			}
			if(id === 'boosterenergy' && species.tags?.includes('Paradox')) {
				speciesSpecific.push(row);
			}
		}
		if (speciesSpecific.length) {
			return [
				['header', "Specific to " + species.name],
				...speciesSpecific,
				...results,
			];
		}
		return results;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'ability') return true;
		const ability = this.dex.abilities.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (!Dex.hasAbility(this.dex.species.get(value), ability.name)) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleMoveSearch extends BattleTypedSearch<'move'> {
	sortRow: SearchRow = ['sortmove', ''];
	getTable() {
		if (!this.mod) return BattleMovedex;
		else if (this.mod != 'ygo') return {...BattleTeambuilderTable[this.mod].overrideMoveInfo, ...BattleMovedex};
		else return BattleTeambuilderTable[this.mod].overridePackDetails;
	}
	getDefaultResults(): SearchRow[] {
		let results: SearchRow[] = [];
		results.push(['header', "Moves"]);
		for (let id in this.getTable()) {
			switch (id) {
			case 'paleowave':
				results.push(['header', "CAP moves"]);
				break;
			case 'magikarpsrevenge':
				continue;
			}
			results.push(['move', id as ID]);
		}
		return results;
	}
	private moveIsNotUseless(id: ID, species: Species, moves: string[], set: PokemonSet | null) {
		const dex = this.dex;

		let abilityid: ID = set ? toID(set.ability) : '' as ID;
		const itemid: ID = set ? toID(set.item) : '' as ID;
		
		// Check if mod declared forced viability
		if (this.mod && id in BattleTeambuilderTable[this.mod].overrideMoveInfo) {
			if(BattleTeambuilderTable[this.mod].overrideMoveInfo[id].viable === true) return true;
			if(BattleTeambuilderTable[this.mod].overrideMoveInfo[id].viable === false) return false;
		}

		if (dex.gen === 1) {
			// Usually not useless for Gen 1
			if ([
				'acidarmor', 'amnesia', 'barrier', 'bind', 'blizzard', 'clamp', 'confuseray', 'counter', 'firespin', 'growth', 'headbutt', 'hyperbeam', 'mirrormove', 'pinmissile', 'razorleaf', 'sing', 'slash', 'sludge', 'twineedle', 'wrap',
			].includes(id)) {
				return true;
			}

			// Usually useless for Gen 1
			if ([
				'disable', 'haze', 'leechseed', 'quickattack', 'roar', 'thunder', 'toxic', 'triattack', 'waterfall', 'whirlwind',
			].includes(id)) {
				return false;
			}

			// Not useless only when certain moves aren't present
			switch (id) {
			case 'bubblebeam': return (!moves.includes('surf') && !moves.includes('blizzard'));
			case 'doubleedge': return !moves.includes('bodyslam');
			case 'doublekick': return !moves.includes('submission');
			case 'firepunch': return !moves.includes('fireblast');
			case 'megadrain': return !moves.includes('razorleaf') && !moves.includes('surf');
			case 'megakick': return !moves.includes('hyperbeam');
			case 'reflect': return !moves.includes('barrier') && !moves.includes('acidarmor');
			case 'stomp': return !moves.includes('headbutt');
			case 'submission': return !moves.includes('highjumpkick');
			case 'thunderpunch': return !moves.includes('thunderbolt');
			case 'triattack': return !moves.includes('bodyslam');
			}
			// Useful and Useless moves for Stadium OU, which changes many game mechanics.
			if (this.formatType === 'stadium') {
				if (['doubleedge', 'focusenergy', 'haze'].includes(id)) return true;
				if (['hyperbeam', 'sing', 'hypnosis'].includes(id)) return false;
				switch (id) {
				case 'fly': return !moves.includes('drillpeck');
				case 'dig': return !moves.includes('earthquake');
				}
			}
		}

		if (this.formatType === 'letsgo') {
			if (['megadrain', 'teleport'].includes(id)) return true;
		}

		if (this.formatType === 'metronome') {
			if (id === 'metronome') return true;
		}

		if (itemid === 'pidgeotite') abilityid = 'noguard' as ID;
		if (itemid === 'blastoisinite') abilityid = 'megalauncher' as ID;
		if (itemid === 'heracronite') abilityid = 'skilllink' as ID;
		if (itemid === 'cameruptite') abilityid = 'sheerforce' as ID;
		if (itemid === 'aerodactylite' || itemid === 'charizardmegax') abilityid = 'toughclaws' as ID;
		if (itemid === 'glalitite') abilityid = 'refrigerate' as ID;

		switch (id) {
		case 'fakeout': case 'flamecharge': case 'nuzzle': case 'poweruppunch': case 'trailblaze':
			return abilityid !== 'sheerforce';
		case 'solarbeam': case 'solarblade':
			return ['desolateland', 'drought', 'chlorophyll', 'orichalcumpulse'].includes(abilityid) || itemid === 'powerherb';
		case 'dynamicpunch': case 'grasswhistle': case 'inferno': case 'sing': case 'zapcannon':
			return abilityid === 'noguard';
		case 'heatcrash': case 'heavyslam':
			return species.weightkg >= (species.evos ? 75 : 130);
		case 'aerialace':
			return ['technician', 'toughclaws'].includes(abilityid) && !moves.includes('bravebird');
		case 'ancientpower':
			return ['serenegrace', 'technician'].includes(abilityid) || !moves.includes('powergem');
		case 'aquajet':
			return !moves.includes('jetpunch');
		case 'aurawheel':
			return species.baseSpecies === 'Morpeko';
		case 'axekick':
			return !moves.includes('highjumpkick');
		case 'bellydrum':
			return moves.includes('aquajet') || moves.includes('jetpunch') || moves.includes('extremespeed') ||
				['iceface', 'unburden'].includes(abilityid);
		case 'bulletseed':
			return ['skilllink', 'technician'].includes(abilityid);
		case 'chillingwater':
			return !moves.includes('scald');
		case 'counter':
			return species.baseStats.hp >= 65;
		case 'dazzlinggleam':
			return !moves.includes('alluringvoice') || this.formatType?.includes('doubles');
		case 'darkvoid':
			return dex.gen < 7;
		case 'dualwingbeat':
			return abilityid === 'technician' || !moves.includes('drillpeck');
		case 'electroshot':
			return true;
		case 'feint':
			return abilityid === 'refrigerate';
		case 'grassyglide':
			return abilityid === 'grassysurge';
		case 'gyroball':
			return species.baseStats.spe <= 60;
		case 'headbutt':
			return abilityid === 'serenegrace';
		case 'hex':
			return !moves.includes('infernalparade');
		case 'hiddenpowerelectric':
			return !(moves.includes('thunderbolt') || (dex.gen < 4 && moves.includes('thunderpunch')));
		case 'hiddenpowerfighting':
			return !(moves.includes('aurasphere') || moves.includes('focusblast') || (dex.gen < 4 && moves.includes('brickbreak')));
		case 'hiddenpowerfire':
			return !(moves.includes('flamethrower') || moves.includes('mysticalfire') || (dex.gen < 4 && moves.includes('firepunch')));
		case 'hiddenpowergrass':
			return !(moves.includes('energyball') || moves.includes('grassknot') || moves.includes('gigadrain'));
		case 'hiddenpowerice':
			return !(moves.includes('icebeam') || (dex.gen > 5 && (moves.includes('aurorabeam') || moves.includes('glaciate'))) || (dex.gen < 4 && moves.includes('icepunch')));
		case 'hiddenpowerflying':
			return dex.gen < 4 && !moves.includes('drillpeck');
		case 'hiddenpowerbug':
			return dex.gen < 4 && !moves.includes('megahorn');
		case 'hiddenpowerpsychic':
			return species.baseSpecies === 'Unown';
		case 'hyperspacefury':
			return species.id === 'hoopaunbound';
		case 'hypnosis':
			return (dex.gen < 4 && !moves.includes('sleeppowder')) || (dex.gen > 6 && abilityid === 'baddreams');
		case 'icepunch':
			return !moves.includes('icespinner') || ['sheerforce', 'ironfist'].includes(abilityid) || itemid === 'punchingglove';
		case 'iciclecrash':
			return !moves.includes('mountaingale');
		case 'icywind':
			// Keldeo needs Hidden Power for Electric/Ghost
			return species.baseSpecies === 'Keldeo' || this.formatType === 'doubles';
		case 'infestation':
			return moves.includes('stickyweb');
		case 'irondefense':
			return !moves.includes('acidarmor');
		case 'irontail':
			return dex.gen > 5 && !moves.includes('ironhead') && !moves.includes('gunkshot') && !moves.includes('poisonjab');
		case 'jumpkick':
			return !moves.includes('highjumpkick') && !moves.includes('axekick');
		case 'lastresort':
			return set && set.moves.length < 3;
		case 'leechlife':
			return dex.gen > 6;
		case 'meteorbeam':
			return true;
		case 'mysticalfire':
			return dex.gen > 6 && !moves.includes('flamethrower');
		case 'naturepower':
			return dex.gen === 5;
		case 'nightslash':
			return !moves.includes('crunch') && !(moves.includes('knockoff') && dex.gen >= 6);
		case 'outrage':
			return !moves.includes('glaiverush');
		case 'petaldance':
			return abilityid === 'owntempo';
		case 'phantomforce':
			return !(moves.includes('shadowforce') || moves.includes('poltergeist') || moves.includes('shadowclaw')) || this.formatType === 'doubles';
		case 'poisonfang':
			return species.types.includes('Poison') && !moves.includes('gunkshot') && !moves.includes('poisonjab');
		case 'relicsong':
			return species.id === 'meloetta';
		case 'refresh':
			return !moves.includes('aromatherapy') && !moves.includes('healbell');
		case 'risingvoltage':
			return abilityid === 'electricsurge' || abilityid === 'hadronengine';
		case 'rocktomb':
			return abilityid === 'technician';
		case 'selfdestruct':
			return dex.gen < 5 && !moves.includes('explosion');
		case 'shadowpunch':
			return abilityid === 'ironfist' && !moves.includes('ragefist');
		case 'shelter':
			return !moves.includes('acidarmor') && !moves.includes('irondefense');
		case 'smackdown':
			return species.types.includes('Ground');
		case 'smartstrike':
			return species.types.includes('Steel') && !moves.includes('ironhead');
		case 'soak':
			return abilityid === 'unaware';
		case 'steelwing':
			return !moves.includes('ironhead');
		case 'stompingtantrum':
			return (!moves.includes('earthquake') && !moves.includes('drillrun')) || this.formatType === 'doubles';
		case 'stunspore':
			return !moves.includes('thunderwave');
		case 'technoblast':
			return dex.gen > 5 && itemid.endsWith('drive') || itemid === 'dousedrive';
		case 'teleport':
			return dex.gen > 7;
		case 'temperflare':
			return (!moves.includes('flareblitz') && !moves.includes('pyroball') && !moves.includes('sacredfire') &&
				!moves.includes('bitterblade') && !moves.includes('firepunch')) || this.formatType === 'doubles';
		case 'terrainpulse': case 'waterpulse':
			return ['megalauncher', 'technician'].includes(abilityid) && !moves.includes('originpulse');
		case 'toxicspikes':
			return abilityid !== 'toxicdebris';
		case 'trickroom':
			return species.baseStats.spe <= 100;
		case 'wildcharge':
			return !moves.includes('supercellslam');
		}

		if (this.formatType === 'doubles' && BattleMoveSearch.GOOD_DOUBLES_MOVES.includes(id)) {
			return true;
		}

		const move = dex.moves.get(id);
		if (!move.exists) return true;
		if (!BattleMovedex[id].exists) return true; //Flag custom moves as viable by default
		if ((move.status === 'slp' || id === 'yawn') && dex.gen === 9 && !this.formatType) {
			return false;
		}
		if (move.category === 'Status') {
			return BattleMoveSearch.GOOD_STATUS_MOVES.includes(id);
		}
		if (move.basePower < 75) {
			return BattleMoveSearch.GOOD_WEAK_MOVES.includes(id);
		}
		if (id === 'skydrop') return true;
		// strong moves
		if (move.flags['charge']) {
			return itemid === 'powerherb';
		}
		if (move.flags['recharge']) {
			return false;
		}
		if (move.flags['slicing'] && abilityid === 'sharpness') {
			return true;
		}
		if (move.basePower < 75 && !(abilityid === 'technician' && move.basePower <= 60 && move.basePower >= 50)) {
			return BattleMoveSearch.GOOD_WEAK_MOVES.includes(id);
		}
		return !BattleMoveSearch.BAD_STRONG_MOVES.includes(id);
	}
	static readonly GOOD_STATUS_MOVES = [
		'acidarmor', 'agility', 'aromatherapy', 'auroraveil', 'autotomize', 'banefulbunker', 'batonpass', 'bellydrum', 'bulkup', 'burningbulwark', 'calmmind', 'chillyreception', 'clangoroussoul', 'coil', 'cottonguard', 'courtchange', 'curse', 'defog', 'destinybond', 'detect', 'disable', 'dragondance', 'encore', 'extremeevoboost', 'filletaway', 'geomancy', 'glare', 'haze', 'healbell', 'healingwish', 'healorder', 'heartswap', 'honeclaws', 'kingsshield', 'leechseed', 'lightscreen', 'lovelykiss', 'lunardance', 'magiccoat', 'maxguard', 'memento', 'milkdrink', 'moonlight', 'morningsun', 'nastyplot', 'naturesmadness', 'noretreat', 'obstruct', 'painsplit', 'partingshot', 'perishsong', 'protect', 'quiverdance', 'recover', 'reflect', 'reflecttype', 'rest', 'revivalblessing', 'roar', 'rockpolish', 'roost', 'shedtail', 'shellsmash', 'shiftgear', 'shoreup', 'silktrap', 'slackoff', 'sleeppowder', 'sleeptalk', 'softboiled', 'spikes', 'spikyshield', 'spore', 'stealthrock', 'stickyweb', 'strengthsap', 'substitute', 'switcheroo', 'swordsdance', 'synthesis', 'tailglow', 'tailwind', 'taunt', 'thunderwave', 'tidyup', 'toxic', 'transform', 'trick', 'victorydance', 'whirlwind', 'willowisp', 'wish', 'yawn',
	] as ID[] as readonly ID[];
	static readonly GOOD_WEAK_MOVES = [
		'accelerock', 'acrobatics', 'aquacutter', 'avalanche', 'barbbarrage', 'bonemerang', 'bouncybubble', 'bulletpunch', 'buzzybuzz', 'ceaselessedge', 'circlethrow', 'clearsmog', 'doubleironbash', 'dragondarts', 'dragontail', 'drainingkiss', 'endeavor', 'facade', 'firefang', 'flipturn', 'flowertrick', 'freezedry', 'frustration', 'geargrind', 'grassknot', 'gyroball', 'icefang', 'iceshard', 'iciclespear', 'infernalparade', 'knockoff', 'lastrespects', 'lowkick', 'machpunch', 'mortalspin', 'mysticalpower', 'naturesmadness', 'nightshade', 'nuzzle', 'pikapapow', 'populationbomb', 'psychocut', 'psyshieldbash', 'pursuit', 'quickattack', 'ragefist', 'rapidspin', 'return', 'rockblast', 'ruination', 'saltcure', 'scorchingsands', 'seismictoss', 'shadowclaw', 'shadowsneak', 'sizzlyslide', 'stoneaxe', 'storedpower', 'stormthrow', 'suckerpunch', 'superfang', 'surgingstrikes', 'tachyoncutter', 'tailslap', 'thunderclap', 'tripleaxel', 'tripledive', 'twinbeam', 'uturn', 'veeveevolley', 'voltswitch', 'watershuriken', 'weatherball',
	] as ID[] as readonly ID[];
	static readonly BAD_STRONG_MOVES = [
		'belch', 'burnup', 'crushclaw', 'dragonrush', 'dreameater', 'eggbomb', 'firepledge', 'flyingpress', 'grasspledge', 'hyperbeam', 'hyperfang', 'hyperspacehole', 'jawlock', 'landswrath', 'megakick', 'megapunch', 'mistyexplosion', 'muddywater', 'nightdaze', 'pollenpuff', 'rockclimb', 'selfdestruct', 'shelltrap', 'skyuppercut', 'slam', 'strength', 'submission', 'synchronoise', 'takedown', 'thrash', 'uproar', 'waterpledge',
	] as ID[] as readonly ID[];
	static readonly GOOD_DOUBLES_MOVES = [
		'allyswitch', 'bulldoze', 'coaching', 'electroweb', 'faketears', 'fling', 'followme', 'healpulse', 'helpinghand', 'junglehealing', 'lifedew', 'lunarblessing', 'muddywater', 'pollenpuff', 'psychup', 'ragepowder', 'safeguard', 'skillswap', 'snipeshot', 'wideguard',
	] as ID[] as readonly ID[];
	getBaseResults() {
		if (!this.species) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		const format = this.format;
		const isHackmons = (format.includes('hackmons') || format.endsWith('bh'));
		const isSTABmons = (format.includes('stabmons') || format.includes('stylemons')|| format === 'staaabmons');
		const isTradebacks = (format.includes('tradebacks') || this.mod === 'gen1expansionpack' || this.mod === 'gen1burgundy');
		const regionBornLegality = dex.gen >= 6 &&
			(/^battle(spot|stadium|festival)/.test(format) || format.startsWith('bss') ||
				format.startsWith('vgc') || (dex.gen === 9 && this.formatType !== 'natdex'));
		
				let hasOwnUsefulCheck = false;
				switch(typeof window.ModConfig[this.mod]?.moveIsNotUseless){
					case 'string':
						hasOwnUsefulCheck = true;
						const usefulCheck = JSON.parse(window.ModConfig[this.mod].moveIsNotUseless);
						const checkParameters = usefulCheck.substring(usefulCheck.indexOf('(')+1,usefulCheck.indexOf(')')).split(',');
						window.ModConfig[this.mod].moveIsNotUseless = new Function(...checkParameters, usefulCheck.substring(usefulCheck.indexOf('{')));
						break;
					case 'function':
						hasOwnUsefulCheck = true;
						break;
				}

		let learnsetid = this.firstLearnsetid(species.id);
		let packDetailsID = this.firstPackDetailsid(species.id);
		let moves: string[] = [];
		let sketchMoves: string[] = [];
		let sketch = false;
		let gen = '' + dex.gen;
		let lsetTable = BattleTeambuilderTable;
		if (this.formatType?.startsWith('bdsp')) lsetTable = lsetTable['gen8bdsp'];
		if (this.formatType === 'letsgo') lsetTable = lsetTable['gen7letsgo'];
		if (this.formatType?.startsWith('ssdlc1')) lsetTable = lsetTable['gen8dlc1'];
		if (this.formatType?.startsWith('predlc')) lsetTable = lsetTable['gen9predlc'];
		if (this.formatType?.startsWith('svdlc1')) lsetTable = lsetTable['gen9dlc1'];
		while (learnsetid || packDetailsID) {
			let learnset = lsetTable.learnsets[learnsetid];
			let packDetails = lsetTable.packDetails[packDetailsID];
			if (this.mod) {
				if (this.mod != 'ygo') {
					const overrideLearnsets = BattleTeambuilderTable[this.mod].overrideLearnsets;
					if (overrideLearnsets[learnsetid]) {
						if(!learnset) learnset = overrideLearnsets[learnsetid]; //Didn't have learnset and mod gave it one
						learnset = JSON.parse(JSON.stringify(learnset));
						for (const moveid in overrideLearnsets[learnsetid]) learnset[moveid] = overrideLearnsets[learnsetid][moveid];
					}
				}
				else {
					const overridePackDetails = BattleTeambuilderTable[this.mod].overridePackDetails;
					if (overridePackDetails[packDetailsID]) {
						if(!packDetails) packDetails = overridePackDetails[packDetailsID]; //Didn't have learnset and mod gave it one
						packDetails = JSON.parse(JSON.stringify(packDetails));
						for (const packid in overridePackDetails[packDetailsID]) packDetails[packid] = overridePackDetails[packDetailsID][packid];
					}
				}
			}
			if (learnset) {
				if (!Object.keys(learnset).length) { //Doesn't have learnset but one is loaded; some other mod gave it one
					learnsetid = toID(this.dex.species.get(learnsetid).baseSpecies);
					continue;
				}
				for (let moveid in learnset) {
					let learnsetEntry = learnset[moveid];
					const move = dex.moves.get(moveid);
					const minGenCode: {[gen: number]: string} = {6: 'p', 7: 'q', 8: 'g', 9: 'a'};
					if (regionBornLegality && !learnsetEntry.includes(minGenCode[dex.gen])) {
						continue;
					}
					if (
						!learnsetEntry.includes(gen) &&
						(!isTradebacks ? true : !(move.gen <= dex.gen && learnsetEntry.includes('' + (dex.gen + 1))))
					) {
						continue;
					}
					if (this.formatType !== 'natdex' && move.isNonstandard === "Past") {
						continue;
					}
					if (
						this.formatType?.startsWith('dlc1') &&
						BattleTeambuilderTable['gen8dlc1']?.nonstandardMoves.includes(moveid)
					) {
						continue;
					}
					if (
						this.formatType?.includes('predlc') && this.formatType !== 'predlcnatdex' &&
						BattleTeambuilderTable['gen9predlc']?.nonstandardMoves.includes(moveid)
					) {
						continue;
					}
					if (
						this.formatType?.includes('svdlc1') && this.formatType !== 'svdlc1natdex' &&
						BattleTeambuilderTable['gen9dlc1']?.nonstandardMoves.includes(moveid)
					) {
						continue;
					}
					if (moves.includes(moveid)) continue;
					moves.push(moveid);
					if (moveid === 'sketch') sketch = true;
					if (moveid === 'hiddenpower') {
						moves.push(
							'hiddenpowerbug', 'hiddenpowerdark', 'hiddenpowerdragon', 'hiddenpowerelectric', 'hiddenpowerfighting', 'hiddenpowerfire', 'hiddenpowerflying', 'hiddenpowerghost', 'hiddenpowergrass', 'hiddenpowerground', 'hiddenpowerice', 'hiddenpowerpoison', 'hiddenpowerpsychic', 'hiddenpowerrock', 'hiddenpowersteel', 'hiddenpowerwater'
						);
					}
				}
			}
			if (packDetails) {
				if (!Object.keys(packDetails).length) { //Doesn't have learnset but one is loaded; some other mod gave it one
					packDetailsID = toID(this.dex.species.get(packDetailsID).name);
					continue;
				}
				for (let packid in packDetails) {
					if (moves.includes(packid)) continue;
					moves.push(packid);
				}
			}
			learnsetid = this.nextLearnsetid(learnsetid, species.id);
			packDetailsID = this.nextPackDetailsID(packDetailsID, species.id);
		}
		if (sketch || isHackmons) {
			if (isHackmons) moves = [];
			for (let id in this.getTable()) {
				if (!format.startsWith('cap') && (id === 'paleowave' || id === 'shadowstrike')) continue;
				let move = dex.moves.get(id);
				if (!move.exists || moves.includes(id) || move.gen > dex.gen) continue;
				if (sketch) {
					if (move.noSketch || move.isMax || move.isZ) continue;
					if (move.isNonstandard && move.isNonstandard !== 'Past') continue;
					if (move.isNonstandard === 'Past' && this.formatType !== 'natdex') continue;
					sketchMoves.push(id);
				} else {
					if (!(dex.gen < 8 || this.formatType === 'natdex') && move.isZ) continue;
					if (typeof move.isMax === 'string') continue;
					if (move.isMax && dex.gen > 8) continue;
					if (move.isNonstandard === 'Past' && this.formatType !== 'natdex') continue;
					if (move.isNonstandard === 'LGPE' && this.formatType !== 'letsgo') continue;
					moves.push(id);
				}
			}
		}
		if (this.formatType === 'metronome') moves = ['metronome'];
		if (isSTABmons) {
			for (let id in this.getTable()) {
				const move = dex.moves.get(id);
				if (moves.includes(move.id)) continue;
				if (move.gen > dex.gen) continue;
				if (move.isZ || move.isMax || (move.isNonstandard && move.isNonstandard !== 'Unobtainable')) continue;

				const speciesTypes: string[] = [];
				const moveTypes: string[] = [];
				for (let i = dex.gen; i >= species.gen && i >= move.gen; i--) {
					const genDex = Dex.forGen(i);
					moveTypes.push(genDex.moves.get(move.name).type);

					const pokemon = genDex.species.get(species.name);
					let baseSpecies = genDex.species.get(pokemon.changesFrom || pokemon.name);
					if (!pokemon.battleOnly) speciesTypes.push(...pokemon.types);
					let prevo = pokemon.prevo;
					while (prevo) {
						const prevoSpecies = genDex.species.get(prevo);
						speciesTypes.push(...prevoSpecies.types);
						prevo = prevoSpecies.prevo;
					}
					if (pokemon.battleOnly && typeof pokemon.battleOnly === 'string') {
						species = dex.species.get(pokemon.battleOnly);
					}
					const excludedForme = (s: Species) => [
						'Alola', 'Alola-Totem', 'Galar', 'Galar-Zen', 'Hisui', 'Paldea', 'Paldea-Combat', 'Paldea-Blaze', 'Paldea-Aqua',
					].includes(s.forme);
					if (baseSpecies.otherFormes && !['Wormadam', 'Urshifu'].includes(baseSpecies.baseSpecies)) {
						if (!excludedForme(species)) speciesTypes.push(...baseSpecies.types);
						for (const formeName of baseSpecies.otherFormes) {
							const forme = dex.species.get(formeName);
							if (!forme.battleOnly && !excludedForme(forme)) speciesTypes.push(...forme.types);
						}
					}
				}
				let valid = false;
				for (let type of moveTypes) {
					if (speciesTypes.includes(type)) {
						valid = true;
						break;
					}
				}
				if (valid) moves.push(id);
			}
		}

		moves.sort();
		sketchMoves.sort();

		let usableMoves: SearchRow[] = [];
		let uselessMoves: SearchRow[] = [];
		if (this.mod != 'ygo') {
			for (const id of moves) {
				let isUsable = this.moveIsNotUseless(id as ID, species, moves, this.set);
				if (hasOwnUsefulCheck) {
					const modIsUsable = window.ModConfig[this.mod].moveIsNotUseless.apply(window.ModConfig[this.mod], [id as ID, species, moves, this.set, this.dex]);
					if (typeof modIsUsable === 'boolean' && modIsUsable !== isUsable) isUsable = modIsUsable;
				}
				if (isUsable) {
					if (!usableMoves.length) usableMoves.push(['header', "Moves"]);
					usableMoves.push(['move', id as ID]);
				} else {
					if (!uselessMoves.length) uselessMoves.push(['header', "Usually useless moves"]);
					uselessMoves.push(['move', id as ID]);
				}
			}
		}
		else {
			for (const id of moves) {
				if (!usableMoves.length) usableMoves.push(['header', "Moves"]);
				usableMoves.push(['move', id as ID]);
			}
		}
		if (sketchMoves.length) {
			usableMoves.push(['header', "Sketched moves"]);
			uselessMoves.push(['header', "Useless sketched moves"]);
		}
		for (const id of sketchMoves) {
			let isUsable = this.moveIsNotUseless(id as ID, species, sketchMoves, this.set);
			if (hasOwnUsefulCheck) {
				const modIsUsable = window.ModConfig[this.mod].moveIsNotUseless.apply(window.ModConfig[this.mod], [id as ID, species, moves, this.set, this.dex]);
				if (typeof modIsUsable === 'boolean' && modIsUsable !== isUsable) isUsable = modIsUsable;
			}
			if (isUsable) {
				usableMoves.push(['move', id as ID]);
			} else {
				uselessMoves.push(['move', id as ID]);
			}
		}
		return [...usableMoves, ...uselessMoves];
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'move') return true;
		const move = this.dex.moves.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'type':
				if (move.type !== value) return false;
				break;
			case 'category':
				if (move.category !== value) return false;
				break;
			case 'pokemon':
				if (!this.canLearn(value as ID, move.id)) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string, reverseSort?: boolean): SearchRow[] {
		const sortOrder = reverseSort ? -1 : 1;
		switch (sortCol) {
		case 'power':
			let powerTable: {[id: string]: number | undefined} = {
				return: 102, frustration: 102, spitup: 300, trumpcard: 200, naturalgift: 80, grassknot: 120,
				lowkick: 120, gyroball: 150, electroball: 150, flail: 200, reversal: 200, present: 120,
				wringout: 120, crushgrip: 120, heatcrash: 120, heavyslam: 120, fling: 130, magnitude: 150,
				beatup: 24, punishment: 1020, psywave: 1250, nightshade: 1200, seismictoss: 1200,
				dragonrage: 1140, sonicboom: 1120, superfang: 1350, endeavor: 1399, sheercold: 1501,
				fissure: 1500, horndrill: 1500, guillotine: 1500,
			};
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let move1 = this.dex.moves.get(id1);
				let move2 = this.dex.moves.get(id2);
				let pow1 = move1.basePower || powerTable[id1] || (move1.category === 'Status' ? -1 : 1400);
				let pow2 = move2.basePower || powerTable[id2] || (move2.category === 'Status' ? -1 : 1400);
				return (pow2 - pow1) * sortOrder;
			});
		case 'accuracy':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let accuracy1 = this.dex.moves.get(id1).accuracy || 0;
				let accuracy2 = this.dex.moves.get(id2).accuracy || 0;
				if (accuracy1 === true) accuracy1 = 101;
				if (accuracy2 === true) accuracy2 = 101;
				return (accuracy2 - accuracy1) * sortOrder;
			});
		case 'pp':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pp1 = this.dex.moves.get(id1).pp || 0;
				let pp2 = this.dex.moves.get(id2).pp || 0;
				return (pp2 - pp1) * sortOrder;
			});
		case 'name':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const name1 = id1;
				const name2 = id2;
				return (name1 < name2 ? -1 : name1 > name2 ? 1 : 0) * sortOrder;
			});
		}
		throw new Error("invalid sortcol");
	}
}

class BattleCategorySearch extends BattleTypedSearch<'category'> {
	getTable() {
		return {physical: 1, special: 1, status: 1};
	}
	getDefaultResults(): SearchRow[] {
		return [
			['category', 'physical' as ID],
			['category', 'special' as ID],
			['category', 'status' as ID],
		];
	}
	getBaseResults() {
		return this.getDefaultResults();
	}
	filter(row: SearchRow, filters: string[][]): boolean {
		throw new Error("invalid filter");
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleTypeSearch extends BattleTypedSearch<'type'> {
	getTable() {
		if (!this.mod) return window.BattleTypeChart;
		else return {...BattleTeambuilderTable[this.mod].overrideTypeChart, ...window.BattleTypeChart};
	}
	getDefaultResults(): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in window.BattleTypeChart) {
			results.push(['type', id as ID]);
		}
		return results;
	}
	getBaseResults() {
		return this.getDefaultResults();
	}
	filter(row: SearchRow, filters: string[][]): boolean {
		throw new Error("invalid filter");
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}
