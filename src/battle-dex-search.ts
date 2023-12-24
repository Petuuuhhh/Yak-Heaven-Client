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
	'pokemon' | 'type' | 'tier' | 'move' | 'item' | 'ability' | 'egggroup' | 'category' | 'article'
);

type SearchRow = (
	[SearchType, ID, number?, number?] | ['sortpokemon' | 'sortmove', ''] | ['header' | 'html', string]
);

type SearchFilter = [string, string];

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
			if (!['type', 'move', 'ability', 'egggroup', 'tier'].includes(type)) return false;
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
			if (searchType === 'pokemon' && typeIndex === 3 && this.dex.gen < 9) continue;
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
							(!table || !table.overrideItemDesc || id in table.overrideItemDesc === false)
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
				for (let id in pokedex) {
					if (!pokedex[id].types) continue;
					if (this.dex.species.get(id).types.includes(type)) {
						(illegal && id in illegal ? illegalBuf : buf).push(['pokemon', id as ID]);
					}
				}
				break;
			case 'ability':
				let ability = Dex.abilities.get(fId).name;
				buf.push(['header', `${ability} Pok&eacute;mon`]);
				for (let id in pokedex) {
					if (!pokedex[id].abilities) continue;
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
				for (let id in moveDex) {
					if (moveDex[id].type === type) {
						(illegal && id in illegal ? illegalBuf : buf).push(['move', id as ID]);
					}
				}
				break;
			case 'category':
				let category = fId.charAt(0).toUpperCase() + fId.slice(1);
				buf.push(['header', `${category} moves`]);
				for (let id in moveDex) {
					if (moveDex[id].category === category) {
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
	'ssdlc1' | 'ssdlc1doubles' | 'predlc' | 'predlcdoubles' | 'predlcnatdex' | 'stadium' | 'lc' | null = null;

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
		if (format.startsWith('dlc1')) {
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
		if (format.startsWith('stadium')) {
			this.formatType = 'stadium';
			format = format.slice(7) as ID;
			if (!format) format = 'ou' as ID;
		}
		if (format.startsWith('vgc')) this.formatType = 'doubles';
		if (format === 'vgc2020') this.formatType = 'ssdlc1doubles';
		if (format === 'vgc2023regulationd') this.formatType = 'predlcdoubles';
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
			format = (format.startsWith('nd') ? format.slice(2) :
				format.includes('natdex') ? format.slice(6) : format.slice(11)) as ID;
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
		let learnsets = table.learnsets;
		if (speciesid in learnsets) return speciesid;
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
	protected canLearn(speciesid: ID, moveid: ID) {
		const move = this.dex.moves.get(moveid);
		if (this.formatType === 'natdex' && move.isNonstandard && move.isNonstandard !== 'Past') {
			return false;
		}
		const gen = this.dex.gen;
		let genChar = `${gen}`;
		if (
			this.format.startsWith('vgc') ||
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
				const overrideLearnsets = BattleTeambuilderTable[this.mod].overrideLearnsets;
				if (overrideLearnsets[learnsetid] && overrideLearnsets[learnsetid][moveid]) learnset = overrideLearnsets[learnsetid];
			}
			// Modified this function to account for pet mods with tradebacks enabled
			const tradebacksMod = ['gen1expansionpack', 'gen1burgundy'];
			if (learnset && (moveid in learnset) && (!this.format.startsWith('tradebacks') || !(tradebacksMod.includes(this.mod)) ? learnset[moveid].includes(genChar) :
				learnset[moveid].includes(genChar) ||
					(learnset[moveid].includes(`${gen + 1}`) && move.gen === gen))) {
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
			this.formatType === 'predlcnatdex' ? 'gen9predlcnatdex' :
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
	abstract filter(input: SearchRow, filters: string[][]): boolean;
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
		const isVGCOrBS = format.startsWith('battlespot') || format.startsWith('battlestadium') || format.startsWith('vgc');
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
		} else if (this.formatType?.startsWith('dlc1')) {
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
		if (format === 'ubers' || format === 'uber') tierSet = tierSet.slice(slices.Uber);
		else if (isVGCOrBS || (isHackmons && dex.gen === 9 && !this.formatType)) {
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
		else if (format === 'uu') tierSet = tierSet.slice(slices.UU);
		else if (format === 'ru') tierSet = tierSet.slice(slices.RU || slices.UU);
		else if (format === 'nu') tierSet = tierSet.slice(slices.NU || slices.RU || slices.UU);
		else if (format === 'pu') tierSet = tierSet.slice(slices.PU || slices.NU);
		else if (format === 'zu') tierSet = tierSet.slice(slices.ZU || slices.PU || slices.NU);
		else if (format === 'lc' || format === 'lcuu' || format.startsWith('lc') || (format !== 'caplc' && format.endsWith('lc'))) tierSet = tierSet.slice(slices.LC);
		else if (format === 'cap') tierSet = tierSet.slice(0, slices.AG || slices.Uber).concat(tierSet.slice(slices.OU));
		else if (format === 'caplc') {
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

		if (dex.gen >= 5) {
			if (format === 'zu' && table.zuBans) {
				tierSet = tierSet.filter(([type, id]) => {
					if (id in table.zuBans) return false;
					return true;
				});
			}
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
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'pokemon') return true;
		const species = this.dex.species.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'type':
				if (species.types[0] !== value && species.types[1] !== value) return false;
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
		if (['hp', 'atk', 'def', 'spa', 'spd', 'spe'].includes(sortCol)) {
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
				const bst1 = base1.hp + base1.atk + base1.def + base1.spa + base1.spd + base1.spe;
				const bst2 = base2.hp + base2.atk + base2.def + base2.spa + base2.spd + base2.spe;
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

class BattleItemSearch extends BattleTypedSearch<'item'> {
	getTable() {
		if (!this.mod) return BattleItems;
		else return {...BattleTeambuilderTable[this.mod].fullItemName, ...BattleItems};
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
		if (!this.species) return this.getDefaultResults();
		const speciesName = this.dex.species.get(this.species).name;
		const results = this.getDefaultResults();
		const speciesSpecific: SearchRow[] = [];
		for (const row of results) {
			if (row[0] !== 'item') continue;
			if (this.dex.items.get(row[1]).itemUser?.includes(speciesName)) {
				speciesSpecific.push(row);
			}
		}
		if (speciesSpecific.length) {
			return [
				['header', "Specific to " + speciesName],
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
		else return {...BattleTeambuilderTable[this.mod].overrideMoveInfo, ...BattleMovedex};
	}
	getDefaultResults(): SearchRow[] {
		let results: SearchRow[] = [];
		results.push(['header', "Moves"]);
		for (let id in BattleMovedex) {
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
			// KEP Integrations. This acts as a "correctional" patch.
			if (this.mod === 'gen1expansionpack') {
				if (['bulletpunch', 'irondefense', 'ironhead', 'metalsound', 'drainingkiss', 'charm'].includes(id)) return true;
				if (['magnetbomb', 'disarmingvoice', 'brutalswing'].includes(id)) return false;
				switch (id) {
					// steel hierarchy
					case 'smartstrike': return !moves.includes('ironhead');
					case 'magnetbomb': return !moves.includes('ironhead') && !moves.includes('smartstrike');
					case 'mirrorshot': return !moves.includes('ironhead') && !moves.includes('smartstrike') && !moves.includes('magnetbomb');
					// dark hierarchy
					case 'kowtowcleave': return !moves.includes('nightslash');
					case 'falsesurrender': return !moves.includes('kowtowcleave') && !moves.includes('nightslash');
					case 'feintattack': return !moves.includes('kowtowcleave') && !moves.includes('falsesurrender') && !moves.includes('nightslash');
					case 'brutalswing': return !moves.includes('kowtowcleave') && !moves.includes('falsesurrender') && !moves.includes('nightslash') && !moves.includes('feintattack');
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
		if (itemid === 'aerodactylite') abilityid = 'toughclaws' as ID;
		if (itemid === 'glalitite') abilityid = 'refrigerate' as ID;

		switch (id) {
		case 'fakeout': case 'flamecharge': case 'nuzzle': case 'poweruppunch':
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
		case 'darkvoid':
			return dex.gen < 7;
		case 'dualwingbeat':
			return abilityid === 'technician' || !moves.includes('drillpeck');
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
			return (dex.gen < 4 && !moves.includes('thunderpunch')) && !moves.includes('thunderbolt');
		case 'hiddenpowerfighting':
			return (dex.gen < 4 && !moves.includes('brickbreak')) && !moves.includes('aurasphere') && !moves.includes('focusblast');
		case 'hiddenpowerfire':
			return (dex.gen < 4 && !moves.includes('firepunch')) && !moves.includes('flamethrower') &&
				!moves.includes('mysticalfire') && !moves.includes('burningjealousy');
		case 'hiddenpowergrass':
			return !moves.includes('energyball') && !moves.includes('grassknot') && !moves.includes('gigadrain');
		case 'hiddenpowerice':
			return !moves.includes('icebeam') && (dex.gen < 4 && !moves.includes('icepunch')) ||
				(dex.gen > 5 && !moves.includes('aurorabeam') && !moves.includes('glaciate'));
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
			return (!moves.includes('poltergeist') && !moves.includes('shadowclaw')) || this.formatType === 'doubles';
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
		case 'terrainpulse': case 'waterpulse':
			return ['megalauncher', 'technician'].includes(abilityid) && !moves.includes('originpulse');
		case 'toxicspikes':
			return abilityid !== 'toxicdebris';
		case 'trickroom':
			return species.baseStats.spe <= 100;
		}

		if (this.formatType === 'doubles' && BattleMoveSearch.GOOD_DOUBLES_MOVES.includes(id)) {
			return true;
		}
		// Custom move added by a mod
		if (this.mod && id in BattleTeambuilderTable[this.mod].overrideMoveInfo 
			&& !BattleTeambuilderTable[this.mod].overrideMoveInfo[id].unviable
			&& !BattleTeambuilderTable[this.mod].overrideMoveInfo[id].modMoveFromOldGen
			) return true;
		const modMoveData = BattleMovedex[id];
		if (!modMoveData) return true;
		if (modMoveData.category === 'Status') {
			return BattleMoveSearch.GOOD_STATUS_MOVES.includes(id);
		}
		const moveData = BattleMovedex[id];
		if (!moveData) return true;
		if (moveData.category === 'Status') {
			return BattleMoveSearch.GOOD_STATUS_MOVES.includes(id);
		}
		if (moveData.basePower < 75) {
			return BattleMoveSearch.GOOD_WEAK_MOVES.includes(id);
		}
		if (id === 'skydrop') return true;
		// strong moves
		if (moveData.flags?.charge) {
			return itemid === 'powerherb';
		}
		if (moveData.flags?.recharge) {
			return false;
		}
		if (moveData.flags?.slicing && abilityid === 'sharpness') {
			return true;
		}
		return !BattleMoveSearch.BAD_STRONG_MOVES.includes(id);
	}
	static readonly GOOD_STATUS_MOVES = [
		'acidarmor', 'agility', 'aromatherapy', 'auroraveil', 'autotomize', 'banefulbunker', 'batonpass', 'bellydrum', 'bulkup', 'calmmind', 'chillyreception', 'clangoroussoul', 'coil', 'cottonguard', 'courtchange', 'curse', 'defog', 'destinybond', 'detect', 'disable', 'dragondance', 'encore', 'extremeevoboost', 'filletaway', 'geomancy', 'glare', 'haze', 'healbell', 'healingwish', 'healorder', 'heartswap', 'honeclaws', 'kingsshield', 'leechseed', 'lightscreen', 'lovelykiss', 'lunardance', 'magiccoat', 'maxguard', 'memento', 'milkdrink', 'moonlight', 'morningsun', 'nastyplot', 'naturesmadness', 'noretreat', 'obstruct', 'painsplit', 'partingshot', 'perishsong', 'protect', 'quiverdance', 'recover', 'reflect', 'reflecttype', 'rest', 'revivalblessing', 'roar', 'rockpolish', 'roost', 'shedtail', 'shellsmash', 'shiftgear', 'shoreup', 'silktrap', 'slackoff', 'sleeppowder', 'sleeptalk', 'softboiled', 'spikes', 'spikyshield', 'spore', 'stealthrock', 'stickyweb', 'strengthsap', 'substitute', 'switcheroo', 'swordsdance', 'synthesis', 'tailglow', 'tailwind', 'taunt', 'thunderwave', 'tidyup', 'toxic', 'transform', 'trick', 'victorydance', 'whirlwind', 'willowisp', 'wish', 'yawn',
	] as ID[] as readonly ID[];
	static readonly GOOD_WEAK_MOVES = [
		'accelerock', 'acrobatics', 'aquacutter', 'avalanche', 'barbbarrage', 'bonemerang', 'bouncybubble', 'bulletpunch', 'buzzybuzz', 'ceaselessedge', 'circlethrow', 'clearsmog', 'doubleironbash', 'dragondarts', 'dragontail', 'drainingkiss', 'endeavor', 'facade', 'firefang', 'flipturn', 'flowertrick', 'freezedry', 'frustration', 'geargrind', 'grassknot', 'gyroball', 'icefang', 'iceshard', 'iciclespear', 'infernalparade', 'knockoff', 'lastrespects', 'lowkick', 'machpunch', 'mortalspin', 'mysticalpower', 'naturesmadness', 'nightshade', 'nuzzle', 'pikapapow', 'populationbomb', 'psychocut', 'psyshieldbash', 'pursuit', 'quickattack', 'ragefist', 'rapidspin', 'return', 'rockblast', 'ruination', 'saltcure', 'scorchingsands', 'seismictoss', 'shadowclaw', 'shadowsneak', 'sizzlyslide', 'stoneaxe', 'storedpower', 'stormthrow', 'suckerpunch', 'superfang', 'surgingstrikes', 'tailslap', 'trailblaze', 'tripleaxel', 'tripledive', 'twinbeam', 'uturn', 'veeveevolley', 'voltswitch', 'watershuriken', 'weatherball',
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
		(/^battle(spot|stadium|festival)/.test(format) || format.startsWith('vgc') ||
		(dex.gen === 9 && this.formatType !== 'natdex'));
		// Hoenn Gaiden Baton Pass Gaiden Declaration
		const isHoennGaiden = this.modFormat === 'gen3hoenngaiden' || this.modFormat.endsWith('hoenngaiden');

		let learnsetid = this.firstLearnsetid(species.id);
		let moves: string[] = [];
		let sketchMoves: string[] = [];
		let sketch = false;
		let gen = '' + dex.gen;
		let lsetTable = BattleTeambuilderTable;
		if (this.formatType?.startsWith('bdsp')) lsetTable = lsetTable['gen8bdsp'];
		if (this.formatType === 'letsgo') lsetTable = lsetTable['gen7letsgo'];
		if (this.formatType?.startsWith('dlc1')) lsetTable = lsetTable['gen8dlc1'];
		if (this.formatType?.startsWith('predlc')) lsetTable = lsetTable['gen9predlc'];
		while (learnsetid) {
			let learnset = lsetTable.learnsets[learnsetid];
			if (this.mod) {
				learnset = JSON.parse(JSON.stringify(learnset));
				const overrideLearnsets = BattleTeambuilderTable[this.mod].overrideLearnsets;
				if (overrideLearnsets[learnsetid]) {
					for (const moveid in overrideLearnsets[learnsetid]) learnset[moveid] = overrideLearnsets[learnsetid][moveid];
				}
			}
			if (learnset) {
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
					if (moves.includes(moveid)) continue;
					moves.push(moveid);
					if (moveid === 'sketch') sketch = true;
					if (moveid === 'hiddenpower') {
						moves.push(
							'hiddenpowerbug', 'hiddenpowerdark', 'hiddenpowerdragon', 'hiddenpowerelectric', 'hiddenpowerfighting', 'hiddenpowerfire', 'hiddenpowerflying', 'hiddenpowerghost', 'hiddenpowergrass', 'hiddenpowerground', 'hiddenpowerice', 'hiddenpowerpoison', 'hiddenpowerpsychic', 'hiddenpowerrock', 'hiddenpowersteel', 'hiddenpowerwater'
						);
					}
					if (isHoennGaiden && moveid === 'batonpass') {
						moves.push('batonpassgaiden');
						moves.splice(moves.indexOf('batonpass'), 1);
					}
				}
			}
			learnsetid = this.nextLearnsetid(learnsetid, species.id);
		}
		if (sketch || isHackmons) {
			if (isHackmons) moves = [];
			for (let id in BattleMovedex) {
				if (!format.startsWith('cap') && (id === 'paleowave' || id === 'shadowstrike')) continue;
				const move = dex.moves.get(id);
				if (move.gen > dex.gen) continue;
				if (sketch) {
					if (move.noSketch || move.isMax || move.isZ) continue;
					if (move.isNonstandard && move.isNonstandard !== 'Past') continue;
					if (move.isNonstandard === 'Past' && this.formatType !== 'natdex') continue;
					sketchMoves.push(move.id);
				} else {
					if (!(dex.gen < 8 || this.formatType === 'natdex') && move.isZ) continue;
					if (typeof move.isMax === 'string') continue;
					if (move.isMax && dex.gen > 8) continue;
					if (move.isNonstandard === 'Past' && this.formatType !== 'natdex') continue;
					if (move.isNonstandard === 'LGPE' && this.formatType !== 'letsgo') continue;
					moves.push(move.id);
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
        let advTradebacksMoves: SearchRow[] = [];
        		if (this.species == 'bulbasaur') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['ancientpower', 'headbutt', 'razorwind'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ingrain', 'knockoff', 'naturepower', 'amnesia', 'sludge', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'frenzyplant', 'weatherball', 'falseswipe', 'bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'outrage'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ivysaur') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'naturepower', 'stringshot', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['weatherball', 'falseswipe', 'bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'outrage'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'venusaur') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'knockoff', 'naturepower', 'outrage', 'stringshot', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['weatherball', 'falseswipe', 'bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'charmander') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'leer', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['crunch', 'curse', 'dragonbreath', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'howl', 'rocktomb', 'willowisp', 'quickattack', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['blastburn', 'block', 'falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['aircutter'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'furyswipes', 'wingattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'charmeleon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'leer', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dragonbreath', 'crunch', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'rocktomb', 'willowisp', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'furyswipes'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'charizard') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'leer', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dragonbreath', 'sandstorm', 'crunch', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'rocktomb', 'willowisp', 'twister', 'solarbeam', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['blazekick', 'helpinghand', 'weatherball', 'furyswipes'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'squirtle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'reflect', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'zapcannon', 'confusion', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fakeout', 'irondefense', 'muddywater', 'rocktomb', 'waterspout'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'followme', 'hydrocannon', 'falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'outrage', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wartortle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'reflect', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'rocktomb', 'muddywater'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'outrage', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'blastoise') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'rage', 'reflect', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'rocktomb', 'signalbeam', 'fakeout', 'muddywater', 'outrage', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'crunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'caterpie') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['snore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'metapod') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'butterfree') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'psywave', 'rage', 'razorwind', 'reflect', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'signalbeam', 'irondefense', 'psychup', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['batonpass', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'weedle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
		}
		if (this.species == 'kakuna') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'beedrill') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'reflect', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'silverwind', 'falseswipe', 'flash'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pidgey') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pidgeotto') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pidgeot') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'rattata') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['crunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'revenge'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'raticate') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['crunch', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'spearow') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'sonicboom'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'featherdance', 'heatwave', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['focusenergy'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'fearow') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'payday', 'rage', 'razorwind', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['focusenergy'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ekans') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'megadrain', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['crunch', 'curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['poisontail', 'rocktomb', 'scaryface', 'disable'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'arbok') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'megadrain', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'crunch', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['rocktomb'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pikachu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['payday', 'rage', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt', 'sing'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'knockoff', 'signalbeam', 'yawn', 'endeavor', 'fakeout', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'extremespeed'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['spark'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['refresh', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['calmmind', 'thief', 'doublekick'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'raichu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['payday', 'rage', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'knockoff', 'signalbeam', 'fakeout', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['spark'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['calmmind', 'safeguard'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sandshrew') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'mudshot', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'magnitude'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'amnesia', 'leechlife'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sandslash') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'mudshot', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'magnitude'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['spikes', 'agility', 'amnesia', 'leechlife', 'pinmissile'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidoranf') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'tackle'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'moonlight', 'sweetkiss', 'headbutt', 'lovelykiss'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['poisonfang', 'pursuit', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['poisontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidorina') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'horndrill', 'rage', 'reflect', 'skullbash', 'tackle', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['poisonfang', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidoqueen') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'horndrill', 'payday', 'rage', 'reflect', 'skullbash', 'submission', 'tackle', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['uproar', 'outrage', 'whirlpool', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot', 'rockblast', 'sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidoranm') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'tackle'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'morningsun', 'sweetkiss', 'headbutt', 'lovelykiss'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['poisontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['thrash'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidorino') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'reflect', 'skullbash', 'tackle', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nidoking') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'payday', 'rage', 'reflect', 'skullbash', 'submission', 'tackle', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'uproar', 'outrage', 'whirlpool', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot', 'rockblast', 'sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'clefairy') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'endeavor', 'helpinghand', 'knockoff', 'magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'covet', 'faketears', 'uproar', 'healbell', 'rocksmash'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'batonpass'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'clefable') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'endeavor', 'helpinghand', 'knockoff', 'magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'covet', 'faketears', 'uproar', 'healbell', 'rocksmash'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'batonpass'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'vulpix') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['extrasensory', 'roleplay', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['memento', 'weatherball', 'encore', 'agility', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ninetales') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['calmmind', 'roleplay', 'extrasensory', 'painsplit', 'dreameater', 'solarbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['faketears', 'weatherball', 'encore', 'shadowball', 'agility', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'jigglypuff') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'endeavor', 'helpinghand', 'knockoff', 'magiccoat', 'recycle', 'roleplay', 'covet', 'uproar', 'healbell', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['spitup', 'stockpile', 'swallow'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['batonpass', 'screech', 'selfdestruct'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind', 'magicalleaf', 'skillswap', 'taunt', 'encore', 'sandstorm', 'thief', 'amnesia', 'metronome', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wigglytuff') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'endeavor', 'helpinghand', 'knockoff', 'magiccoat', 'recycle', 'roleplay', 'covet', 'uproar', 'healbell', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['spitup', 'stockpile', 'swallow'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['batonpass', 'minimize', 'screech', 'selfdestruct'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind', 'magicalleaf', 'skillswap', 'taunt', 'encore', 'sandstorm', 'thief', 'amnesia', 'metronome', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'zubat') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'razorwind', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'flail'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'twister', 'fly', 'hypnosis', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['crunch', 'agility', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'golbat') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'razorwind', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'twister', 'fly', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['crunch', 'agility', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'oddish') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['teeterdance', 'tickle'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['growth'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gloom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['growth'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'vileplume') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['safeguard'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['growth'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'paras') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'knockoff', 'metalclaw', 'agility', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['leechseed'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'parasect') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'knockoff', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['leechseed'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'venonat') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'psywave', 'rage', 'reflect', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['poisonfang', 'morningsun', 'agility', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['confuseray', 'headbutt', 'nightshade'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'venomoth') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'psywave', 'rage', 'razorwind', 'reflect', 'takedown', 'teleport', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'poisonfang', 'twister', 'stringshot', 'agility'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['confuseray', 'dreameater', 'headbutt', 'nightshade'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'diglett') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['astonish', 'reversal', 'sandstorm'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['memento', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'rockblast', 'charm', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dugtrio') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['astonish', 'reversal'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'rockblast', 'scaryface', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'meowth') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'odorsleuth', 'uproar', 'flail', 'tailwhip'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['faketears', 'helpinghand', 'falseswipe', 'metalclaw', 'agility', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'persian') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['faketears', 'helpinghand', 'falseswipe', 'metalclaw', 'agility', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'psyduck') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['amnesia', 'bide', 'bubblebeam', 'payday', 'rage', 'skullbash', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt', 'petaldance', 'triattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['roleplay', 'signalbeam', 'yawn', 'encore', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'skillswap', 'taunt', 'thief', 'lowkick', 'metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'golduck') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'payday', 'rage', 'skullbash', 'submission', 'takedown', 'watergun', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['roleplay', 'signalbeam', 'yawn', 'encore', 'lowkick', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'skillswap', 'taunt', 'thief', 'metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mankey') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'payday', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'endeavor', 'helpinghand', 'roleplay', 'uproar', 'encore', 'outrage', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['pursuit'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'primeape') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'payday', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'roleplay', 'uproar', 'covet', 'outrage', 'spite', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['pursuit'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'growlithe') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'dragonrage', 'rage', 'reflect', 'skullbash'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dragonbreath', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['willowisp', 'morningsun', 'mudslap', 'reversal'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'outrage', 'doublekick'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'arcanine') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'dragonrage', 'rage', 'reflect', 'skullbash', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dragonbreath', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['willowisp', 'mudslap', 'reversal', 'solarbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'outrage'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hypervoice', 'superpower', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'poliwag') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['amnesia', 'bide', 'psywave', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'growth', 'headbutt', 'lovelykiss'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'helpinghand', 'mudshot', 'refresh', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'lowkick', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'poliwhirl') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['amnesia', 'bide', 'fissure', 'psywave', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'mudshot', 'endeavor', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'lowkick', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'poliwrath') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'psywave', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['mudshot', 'endeavor', 'encore', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'superpower', 'reversal', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'abra') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'foresight', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['confusion', 'swift'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kadabra') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'dig', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['nightshade', 'swift'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'alakazam') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'dig', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'nightshade', 'swift'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'machop') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'falseswipe', 'headbutt', 'thrash'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'roleplay', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['knockoff', 'tickle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'machoke') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'roleplay', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['knockoff'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'machamp') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'roleplay', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['knockoff'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'reversal'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'bellsprout') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetkiss', 'lovelykiss'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'tickle', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'weepinbell') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'victreebel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'leafblade'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tentacool') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'magiccoat', 'muddywater'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['tickle', 'bind', 'bubble'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['acidarmor', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tentacruel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'magiccoat', 'muddywater'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['acidarmor', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'geodude') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'harden', 'rage', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'rapidspin', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'ancientpower', 'flail', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'graveler') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'harden', 'rage', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'ancientpower', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'golem') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'harden', 'rage', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'ancientpower', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ponyta') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'horndrill', 'rage', 'reflect', 'skullbash'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'willowisp', 'morningsun'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'rapidash') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'horndrill', 'payday', 'rage', 'reflect', 'skullbash'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'willowisp', 'megahorn'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['swordsdance'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slowpoke') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'payday', 'psywave', 'rage', 'reflect', 'skullbash', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'magiccoat', 'recycle', 'signalbeam', 'slackoff', 'trick', 'whirlpool', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'mudshot', 'weatherball', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'psybeam', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slowbro') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'payday', 'psywave', 'rage', 'reflect', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'irondefense', 'magiccoat', 'recycle', 'signalbeam', 'slackoff', 'trick', 'whirlpool', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['aerialace'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'muddywater', 'mudshot', 'weatherball', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'metronome', 'psybeam', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magnemite') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'agility'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'magiccoat', 'recycle', 'signalbeam', 'psychup', 'explosion', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'sandstorm', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magneton') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'magiccoat', 'recycle', 'signalbeam', 'psychup', 'explosion', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'sandstorm', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'farfetchd') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'reflect', 'skullbash', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'covet', 'heatwave', 'leafblade', 'uproar', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['helpinghand', 'revenge', 'skyattack'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['focusenergy', 'razorleaf'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'doduo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'reflect', 'skullbash', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'mirrormove'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['thrash'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['jumpkick', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dodrio') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'reflect', 'skullbash', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'mirrormove'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['thrash'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['jumpkick', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'seel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'payday', 'rage', 'skullbash', 'strength', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'flail', 'whirlpool', 'peck'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['signalbeam', 'spitup', 'stockpile', 'swallow', 'watersport'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dewgong') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'payday', 'rage', 'skullbash', 'strength', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'grimer') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['spitup', 'stockpile', 'swallow', 'painsplit', 'shadowball', 'rockslide', 'strength'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'sandstorm', 'confuseray', 'headbutt', 'metronome', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'muk') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'painsplit', 'shadowball', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'sandstorm', 'confuseray', 'headbutt', 'metronome', 'swift', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shellder') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'mudshot', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hydropump', 'twineedle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'spikes', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cloyster') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'signalbeam', 'mudshot', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hydropump', 'twineedle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'headbutt', 'lightscreen', 'pinmissile'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'scaryface', 'bodyslam', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gastly') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'thunder'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'trick', 'uproar', 'icywind', 'painsplit', 'disable', 'firepunch', 'icepunch', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['scaryface', 'smog'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt', 'poisongas'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['imprison'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'haunter') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'thunder'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'trick', 'uproar', 'icywind', 'painsplit', 'firepunch', 'icepunch', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['scaryface', 'smog'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['encore', 'headbutt', 'poisongas'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['imprison', 'metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gengar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['knockoff', 'roleplay', 'trick', 'uproar', 'icywind', 'painsplit', 'disable'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['scaryface', 'smog'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'encore', 'poisongas'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'onix') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sharpen'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['mudsport', 'rockblast', 'ancientpower', 'rollout', 'twister', 'defensecurl'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragondance', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'drowzee') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['flatter', 'magiccoat', 'recycle', 'signalbeam', 'trick', 'lowkick', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'imprison', 'encore', 'nightshade', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hypno') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'signalbeam', 'trick', 'lowkick', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'imprison', 'encore', 'scaryface', 'confuseray', 'nightshade', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'krabby') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'metalclaw', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'irondefense', 'mudsport', 'superpower', 'tickle', 'ancientpower', 'falseswipe', 'agility', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt', 'slash'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kingler') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'irondefense', 'mudsport', 'superpower', 'ancientpower', 'falseswipe', 'rockslide', 'agility'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'voltorb') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'agility', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'metalsound', 'recycle', 'thundershock'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'electrode') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'headbutt', 'agility'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'scaryface', 'thundershock'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'exeggcute') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'eggbomb', 'psywave', 'rage', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['megadrain'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['naturepower', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'extrasensory'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['absorb', 'headbutt', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'exeggutor') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'megadrain', 'psywave', 'rage', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['naturepower', 'lowkick', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'extrasensory'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['calmmind', 'magicalleaf', 'futuresight', 'absorb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cubone') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'furyattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'irondefense', 'knockoff', 'uproar', 'furycutter', 'doublekick', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['swift'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'marowak') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'irondefense', 'knockoff', 'uproar', 'furycutter', 'outrage', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['swift'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hitmonlee') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['blazekick', 'bounce', 'knockoff', 'roleplay', 'superpower', 'fakeout', 'uproar', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hitmonchan') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'dizzypunch'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['roleplay', 'fakeout', 'uproar', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['focusenergy', 'leer'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lickitung') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'rage', 'skullbash', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['doubleslap', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['muddywater', 'whirlpool', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['thrash'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['acid', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'koffing') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['grudge', 'uproar', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['spitup', 'stockpile', 'swallow'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'weezing') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['uproar', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['heatwave', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'rhyhorn') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'leer', 'rage', 'skullbash'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['pursuit', 'zapcannon', 'headbutt', 'thrash'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'superpower', 'uproar', 'ancientpower', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot', 'rockthrow', 'sandattack', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'rhydon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'leer', 'payday', 'rage', 'skullbash', 'submission', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'endeavor', 'superpower', 'uproar', 'ancientpower', 'outrage', 'spite', 'whirlpool', 'icepunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['irondefense', 'mudshot', 'hydropump', 'rockthrow', 'sandattack', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'chansey') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'reflect', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'helpinghand', 'recycle', 'uproar', 'charm', 'firepunch', 'icepunch', 'rockslide', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['thief', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tangela') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent', 'synthesis', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'knockoff', 'shockwave', 'ancientpower', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kangaskhan') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'fissure', 'skullbash', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'feintattack', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'helpinghand', 'uproar', 'crunch', 'outrage', 'spite', 'whirlpool', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['beatup', 'growl', 'hydropump', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'horsea') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'haze', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'muddywater', 'signalbeam', 'outrage', 'focusenergy', 'razorwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'seadra') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'muddywater', 'outrage', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'goldeen') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'knockoff', 'furycutter', 'mudslap', 'whirlpool', 'bodyslam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['mudshot', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'headbutt', 'quickattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'seaking') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'knockoff', 'furycutter', 'mudslap', 'whirlpool', 'bodyslam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['signalbeam', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'headbutt', 'quickattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'staryu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['attract', 'curse', 'twister', 'whirlpool', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'signalbeam', 'painsplit', 'rollout'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['confuseray'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'starmie') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'takedown', 'teleport', 'triattack'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['attract', 'curse', 'whirlpool', 'zapcannon', 'twister'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'signalbeam', 'trick', 'painsplit', 'rollout'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'headbutt', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mrmime') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dynamicpunch', 'mindreader', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aerialace', 'helpinghand', 'irondefense', 'magiccoat', 'signalbeam', 'teeterdance', 'tickle', 'uproar', 'charm', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'icywind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['pound'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'scyther') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'skullbash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'sonicboom'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'knockoff'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aircutter', 'helpinghand', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'jynx') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'thrash', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'sweetscent', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'uproar', 'healbell'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['iciclespear', 'charm', 'encore', 'futuresight', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'electabuzz') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'metronome', 'psywave', 'rage', 'reflect', 'skullbash', 'submission', 'takedown', 'teleport', 'thundershock'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'signalbeam', 'uproar', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['charge', 'taunt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magmar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'metronome', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'feintattack', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'helpinghand', 'overheat', 'willowisp', 'uproar', 'firespin', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['taunt', 'flamewheel', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pinsir') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'slash', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'knockoff', 'superpower', 'vitalthrow', 'quickattack', 'stringshot', 'thrash'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['outrage', 'reversal'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tauros') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'fissure', 'horndrill', 'leer', 'skullbash', 'stomp'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon', 'headbutt', 'quickattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'helpinghand', 'roleplay', 'uproar', 'outrage', 'spite', 'whirlpool', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['revenge', 'megahorn', 'reversal', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['shadowball', 'thief', 'dig'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magikarp') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['dragonrage'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['reversal', 'bubble'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hydropump'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gyarados') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dragonbreath', 'whirlpool', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'uproar', 'outrage', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['crunch'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['scaryface'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'bind'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'sunnyday'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lapras') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'dragonrage', 'psywave', 'rage', 'reflect', 'skullbash', 'solarbeam', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['dragonbreath', 'futuresight', 'whirlpool', 'zapcannon', 'aurorabeam', 'bite', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'signalbeam', 'ancientpower', 'outrage', 'fissure'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'charm', 'megahorn'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ditto') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
		}
		if (this.species == 'eevee') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'focusenergy', 'rage', 'reflect', 'skullbash'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'growth', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'faketears', 'yawn', 'healbell'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'sing'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['refresh'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'doublekick', 'payday'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'vaporeon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'mist', 'rage', 'reflect', 'skullbash', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['muddywater', 'signalbeam', 'covet', 'faketears', 'yawn', 'healbell', 'rocksmash', 'strength'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'doublekick', 'payday'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'jolteon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['signalbeam', 'covet', 'faketears', 'yawn', 'healbell', 'rocksmash', 'lightscreen', 'strength'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'payday'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind', 'falseswipe'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'flareon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'reflect', 'skullbash', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'superpower', 'willowisp', 'covet', 'faketears', 'yawn', 'healbell', 'rocksmash', 'scaryface', 'strength'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'doublekick', 'payday'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'porygon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'psywave', 'rage', 'reflect', 'skullbash', 'takedown', 'teleport'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'barrier'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'signalbeam', 'trick', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['defensecurl'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['headbutt', 'thundershock'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'omanyte') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'hornattack', 'rage', 'reflect', 'spikecannon', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'knockoff', 'muddywater', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'omastar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'hornattack', 'horndrill', 'rage', 'reflect', 'skullbash', 'submission', 'takedown'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'knockoff', 'rockblast', 'muddywater'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['crunch', 'pinmissile', 'sandattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kabuto') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'hydropump', 'rage', 'reflect', 'slash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'mudslap', 'whirlpool', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['foresight'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'headbutt', 'leechlife'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kabutops') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'hydropump', 'rage', 'razorwind', 'reflect', 'skullbash', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'headbutt', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'superpower', 'mudslap', 'lowkick', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'leechlife'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'aerodactyl') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'dragonrage', 'rage', 'razorwind', 'reflect'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'crunch', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragondance', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'snorlax') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'harden', 'payday', 'psywave', 'rage', 'reflect', 'skullbash', 'submission', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['rocksmash', 'sweetkiss', 'zapcannon', 'lovelykiss', 'splash'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['recycle', 'superpower', 'stockpile', 'swallow', 'uproar', 'crunch', 'outrage', 'pursuit', 'whirlpool', 'whirlwind', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'snatch'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['encore', 'flail', 'bite', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'articuno') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'peck', 'rage', 'razorwind', 'takedown', 'watergun', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'signalbeam', 'ancientpower', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['iciclespear', 'weatherball', 'mirrorcoat', 'headbutt', 'leer'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'zapdos') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'rage', 'razorwind', 'reflect', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'signalbeam', 'ancientpower', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hail', 'weatherball', 'headbutt', 'leer'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'moltres') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'leer', 'peck', 'rage', 'razorwind', 'reflect', 'takedown', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'ancientpower', 'twister', 'solarbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'gust', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dratini') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'rage', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'extremespeed', 'zapcannon', 'headbutt', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['firespin'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dragonair') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'horndrill', 'rage', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['firespin'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dragonite') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'horndrill', 'rage', 'razorwind', 'reflect', 'skullbash', 'takedown', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'whirlpool', 'zapcannon', 'extremespeed', 'headbutt', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'superpower', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['barrier'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['firespin', 'megakick', 'megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'encore', 'scaryface', 'lowkick', 'metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mewtwo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'payday', 'psywave', 'rage', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'zapcannon', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'willowisp', 'lowkick', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['dive'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['ancientpower', 'agility', 'confuseray', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'imprison', 'reversal', 'scaryface', 'nightshade'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mew') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 1']);
			const advTradebacksMovePickupsGen1 = ['bide', 'bubblebeam', 'dragonrage', 'eggbomb', 'fissure', 'horndrill', 'megadrain', 'payday', 'psywave', 'rage', 'razorwind', 'skullbash', 'submission', 'takedown', 'teleport', 'triattack', 'watergun', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen1) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dragonbreath', 'sweetscent', 'whirlpool', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'block', 'bounce', 'endeavor', 'heatwave', 'helpinghand', 'irondefense', 'knockoff', 'magiccoat', 'recycle', 'signalbeam', 'silverwind', 'superpower', 'trick', 'uproar', 'willowisp', 'batonpass', 'falseswipe', 'healbell', 'outrage', 'painsplit', 'spite', 'synthesis', 'twister', 'amnesia', 'barrier', 'lowkick', 'stringshot', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice', 'bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['leechlife'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['blazekick', 'cosmicpower', 'dragondance', 'faketears', 'iciclespear', 'imprison', 'leafblade', 'magicalleaf', 'muddywater', 'mudshot', 'revenge', 'rockblast', 'sandtomb', 'weatherball', 'beatup', 'charm', 'crunch', 'encore', 'futuresight', 'megahorn', 'reversal', 'scaryface', 'spikes', 'agility', 'confusion', 'firespin', 'focusenergy', 'hydropump', 'pinmissile', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['blastburn', 'frenzyplant', 'hydrocannon', 'poisontail', 'metalclaw', 'confuseray', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'chikorita') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'petaldance', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aromatherapy', 'magicalleaf', 'magiccoat', 'furycutter'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['refresh'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'bayleef') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aromatherapy', 'magicalleaf', 'magiccoat'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'meganium') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'sweetscent', 'petaldance'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aromatherapy', 'magicalleaf', 'magiccoat', 'outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cyndaquil') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'irontail', 'submission'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['eruption', 'extrasensory', 'heatwave', 'willowisp', 'doublekick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'quilava') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'irontail'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['eruption', 'heatwave', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'typhlosion') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'irontail'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['eruption', 'heatwave', 'rocktomb', 'willowisp', 'lowkick', 'solarbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'firespin', 'shadowball', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'totodile') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'razorwind', 'submission', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['dragondance', 'rocktomb', 'superpower', 'uproar', 'flail', 'lowkick', 'metalclaw', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['flatter'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'croconaw') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['rocktomb', 'superpower', 'uproar', 'flail', 'lowkick', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'feraligatr') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['rocktomb', 'superpower', 'uproar', 'agility', 'flail', 'lowkick', 'outrage', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sentret') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'tackle'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'hypervoice', 'knockoff', 'uproar', 'batonpass', 'charm', 'foresight', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'furret') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['hypervoice', 'knockoff', 'uproar', 'covet', 'batonpass', 'foresight', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['agility'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hoothoot') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'nightshade'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'extrasensory', 'heatwave', 'magiccoat', 'recycle', 'silverwind', 'uproar', 'agility', 'psychup', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['meanlook'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['calmmind', 'imprison', 'amnesia', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'noctowl') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'extrasensory', 'heatwave', 'magiccoat', 'recycle', 'silverwind', 'uproar', 'psychup', 'twister', 'agility'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['calmmind', 'imprison', 'amnesia', 'futuresight', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ledyba') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['barrier', 'curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'uproar', 'encore', 'machpunch', 'screech', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['dizzypunch'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['counter'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ledian') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'uproar', 'machpunch', 'rocksmash', 'strength', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'spinarak') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'growth', 'screech'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'pinmissile'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['twineedle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['megahorn'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ariados') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'screech'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'pinmissile'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb', 'focusenergy', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'crobat') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'uproar', 'skyattack', 'superfang', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'crunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'chinchou') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'lightscreen', 'whirlpool', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'agility', 'bubblebeam', 'healbell', 'icywind', 'mist', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lanturn') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'spitup', 'stockpile', 'swallow', 'bubblebeam', 'healbell', 'icywind', 'agility'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pichu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'petaldance', 'scaryface', 'sing', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'fakeout', 'helpinghand', 'signalbeam', 'tickle', 'uproar', 'flail', 'thunderpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['reflect'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cleffa') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'petaldance', 'scaryface', 'swift', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aromatherapy', 'covet', 'endeavor', 'faketears', 'helpinghand', 'magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'tickle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'igglybuff') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'petaldance', 'scaryface', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'covet', 'endeavor', 'helpinghand', 'magiccoat', 'recycle', 'roleplay', 'uproar', 'healbell', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['disable', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['encore', 'swift', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'togepi') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'extrasensory', 'magiccoat', 'signalbeam', 'trick', 'uproar', 'healbell'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice', 'morningsun'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['aerialace', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'togetic') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'endeavor', 'heatwave', 'magiccoat', 'signalbeam', 'silverwind', 'trick', 'uproar', 'healbell', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'pound'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'natu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'safeguard'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'magiccoat', 'signalbeam', 'silverwind', 'trick', 'painsplit', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['cosmicpower', 'imprison'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'xatu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'magiccoat', 'signalbeam', 'silverwind', 'trick', 'painsplit', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['cosmicpower', 'imprison'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mareep') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['flatter', 'signalbeam', 'sandattack'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['agility', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'dig', 'sunnyday'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'flaaffy') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['confuseray', 'agility'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'dig', 'icepunch', 'lowkick', 'sunnyday'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ampharos') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['signalbeam', 'outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['confuseray', 'agility'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'dig', 'icepunch', 'lowkick', 'sunnyday'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'bellossom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'megadrain'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['leafblade', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['growth'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'batonpass'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'marill') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dizzypunch', 'foresight', 'headbutt', 'scaryface', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'knockoff', 'superpower', 'faketears', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bounce', 'covet', 'hypervoice', 'muddywater', 'watersport'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['camouflage'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['metronome', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'azumarill') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'knockoff', 'superpower', 'faketears', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bounce', 'covet', 'hypervoice', 'watersport', 'muddywater'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['metronome', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sudowoodo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'roleplay', 'sandtomb', 'torment', 'faketears', 'uproar', 'harden'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['irondefense', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'hyperbeam', 'spikes', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'politoed') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'helpinghand', 'hypervoice', 'mudshot', 'endeavor', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'uproar', 'weatherball', 'pound', 'screech'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hoppip') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['agility', 'curse', 'growl', 'headbutt', 'payday', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aromatherapy', 'bounce', 'memento', 'silverwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'batonpass', 'charm', 'lightscreen', 'raindance', 'takedown', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'skiploom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'memento', 'silverwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'batonpass', 'charm', 'lightscreen', 'takedown', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'jumpluff') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'memento', 'silverwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['falseswipe'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'batonpass', 'charm', 'lightscreen', 'raindance', 'takedown', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'aipom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'covet', 'fakeout', 'knockoff', 'roleplay', 'uproar', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['revenge'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sunkern') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['splash', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['uproar', 'razorleaf'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bide', 'morningsun'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'raindance', 'tackle', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sunflora') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'raindance', 'tackle', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'yanma') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetkiss'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'ancientpower', 'feintattack', 'pursuit', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wooper') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['bellydrum', 'headbutt', 'scaryface', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['muddywater', 'counter', 'doublekick', 'encore', 'icywind', 'recover'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'rocktomb', 'rockslide', 'spikes', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'quagsire') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['muddywater', 'icywind', 'rockslide', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['thief'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'spikes', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'espeon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt', 'zapcannon', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'signalbeam', 'trick', 'covet', 'faketears', 'futuresight', 'healbell'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'payday'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['imprison', 'magicalleaf', 'confuseray', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'umbreon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt', 'zapcannon', 'focusenergy', 'reflect'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'faketears', 'healbell', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball', 'crunch', 'payday', 'thief'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['calmmind', 'skillswap', 'lightscreen', 'scaryface', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'murkrow') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['beatup', 'curse', 'detect', 'quickattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'uproar', 'psychic', 'screech', 'spite', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['flatter'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['gust', 'hyperbeam', 'scaryface', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slowking') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['whirlpool', 'zapcannon', 'payday', 'reflect', 'takedown', 'triattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'irondefense', 'magiccoat', 'recycle', 'signalbeam', 'trick', 'slackoff', 'lightscreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'muddywater', 'mudshot', 'weatherball', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['rocktomb', 'firepunch', 'metronome', 'psybeam', 'rockslide', 'thunderpunch', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'misdreavus') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'hypnosis', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'memento', 'trick', 'uproar', 'willowisp', 'healbell', 'icywind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['faketears', 'helpinghand', 'magicalleaf', 'charm', 'confusion', 'hyperbeam', 'nightshade', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'unown') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
		}
		if (this.species == 'wobbuffet') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['mimic'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'girafarig') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['recycle', 'signalbeam', 'trick', 'uproar', 'doublekick', 'mirrorcoat', 'razorwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'meanlook'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'imprison', 'confuseray', 'hyperbeam', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pineco') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'revenge', 'rocktomb', 'painsplit', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'rockblast', 'raindance', 'reversal'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'forretress') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'irondefense', 'rocktomb', 'signalbeam', 'painsplit', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'rockblast', 'raindance', 'reversal', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dunsparce') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['furyattack', 'horndrill', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'agility', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'amnesia', 'batonpass'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['hypervoice', 'mudshot', 'poisontail', 'hyperbeam', 'sandstorm', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gligar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'knockoff', 'taunt', 'torment', 'agility', 'batonpass', 'falseswipe'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['poisontail', 'skyuppercut'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'steelix') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['mudsport', 'rockblast', 'ancientpower', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragondance', 'irondefense', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'snubbull') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'leer', 'lovelykiss', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'lowkick', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'granbull') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['superpower', 'lowkick', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice', 'outrage'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'qwilfish') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'spitup', 'stockpile', 'taunt', 'explosion', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['bubble'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['reversal', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'poisontail', 'agility', 'crunch'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'scizor') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'takedown'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'knockoff', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aircutter', 'helpinghand', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shuckle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'knockoff', 'sandtomb', 'ancientpower', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['rockblast', 'acid', 'bind', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['covet', 'irondefense', 'mudshot', 'reversal'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'heracross') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aerialace', 'helpinghand', 'irondefense', 'knockoff', 'revenge', 'lowkick', 'pursuit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['armthrust', 'bulletseed', 'rockblast', 'pinmissile'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['spikes', 'thrash'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sneasel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'moonlight'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['assist', 'knockoff', 'falseswipe', 'lowkick', 'pursuit', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['faketears', 'megakick', 'megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'waterpulse', 'reversal', 'scaryface', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'teddiursa') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'focusenergy', 'headbutt', 'sweetscent', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'rocktomb', 'superpower', 'bellydrum', 'charm', 'crosschop', 'rockslide'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ursaring') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['covet', 'superpower', 'uproar', 'lowkick', 'scaryface', 'charm'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slugma') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'memento', 'rocktomb', 'spitup', 'stockpile', 'swallow', 'willowisp', 'ancientpower', 'painsplit', 'recover', 'smokescreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magcargo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'willowisp', 'ancientpower', 'explosion', 'painsplit', 'recover', 'solarbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'swinub') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'mudsport', 'superpower', 'fissure'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['flail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'piloswine') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'mudsport', 'superpower', 'peck'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['thrash', 'flail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'corsola') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'magiccoat', 'naturepower', 'icywind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irondefense', 'bide', 'flail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['camouflage'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump', 'watergun'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'remoraid') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['amnesia', 'curse', 'mist', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'bulletseed', 'signalbeam', 'waterspout', 'flail', 'icywind', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['mudshot', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'octillery') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'icywind', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['mudshot', 'bind', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'wrap'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'delibird') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'payday', 'spikes'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'brickbreak', 'fakeout', 'recycle', 'signalbeam', 'icepunch', 'rollout'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['destinybond'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['drillpeck'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'iciclespear', 'memento', 'weatherball', 'agility', 'batonpass', 'steelwing'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aircutter', 'hyperbeam', 'reversal', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mantine') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'gust', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'bounce', 'bulletseed', 'helpinghand', 'rocktomb', 'signalbeam', 'watersport', 'hyperbeam', 'mirrorcoat', 'psybeam', 'splash', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['amnesia'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'watergun'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'skarmory') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'furycutter'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'rocktomb', 'flash', 'icywind', 'slash', 'swordsdance', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['metalclaw'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb', 'wingattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'houndour') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'roleplay', 'uproar', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['destinybond'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'raindance', 'scaryface', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'houndoom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'roleplay', 'uproar', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'raindance', 'scaryface', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kingdra') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'whirlpool', 'bubblebeam'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'signalbeam', 'yawn', 'muddywater', 'focusenergy', 'outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'phanpy') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['absorb', 'curse', 'encore', 'headbutt', 'watergun'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'knockoff', 'superpower', 'charm', 'rockslide', 'slam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'dig', 'raindance', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'donphan') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'encore'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'bounce', 'endeavor', 'irondefense', 'knockoff', 'superpower', 'magnitude', 'scaryface', 'slam', 'charm'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'dig', 'raindance', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'porygon2') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'signalbeam', 'trick', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['thundershock'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'stantler') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'safeguard'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'imprison', 'signalbeam', 'uproar', 'doublekick', 'megahorn', 'thrash'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['mudsport', 'jumpkick', 'rage'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'trick', 'agility', 'dig', 'hyperbeam', 'psybeam', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'smeargle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['odorsleuth', 'falseswipe', 'meanlook', 'sleeptalk', 'spore'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['flamethrower', 'furyswipes', 'seismictoss'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tyrogue') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'rage'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fakeout', 'roleplay', 'uproar', 'foresight', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'pursuit'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['focusenergy', 'megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hitmontop') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aerialace', 'roleplay', 'fakeout', 'uproar', 'lowkick', 'rollout', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'smoochum') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'dizzypunch', 'petaldance', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'magiccoat', 'recycle', 'roleplay', 'signalbeam', 'trick', 'uproar', 'healbell'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['charm', 'encore'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'elekid') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'headbutt', 'pursuit', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'signalbeam', 'uproar', 'lowkick', 'thundershock'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['charge'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'magby') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dizzypunch', 'feintattack', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['heatwave', 'helpinghand', 'overheat', 'uproar', 'willowisp', 'bellydrum', 'firespin', 'machpunch'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'focusenergy'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['flamewheel', 'lowkick', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'miltank') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['headbutt', 'sweetscent', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'dizzypunch', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['charm'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'blissey') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'headbutt', 'zapcannon', 'takedown', 'triattack'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'endeavor', 'helpinghand', 'recycle', 'uproar', 'firepunch', 'icepunch', 'rockslide', 'thunderpunch', 'charm'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['trick', 'swift', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'raikou') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['extrasensory', 'signalbeam', 'weatherball', 'extremespeed', 'lightscreen', 'shadowball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['charge', 'helpinghand', 'howl', 'agility'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'entei') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['crushclaw', 'eruption', 'extrasensory', 'heatwave', 'howl', 'overheat', 'willowisp', 'extremespeed', 'shadowball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['sacredfire'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'agility', 'crunch', 'flamewheel', 'reversal', 'scaryface', 'smokescreen'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'suicune') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'headbutt', 'watergun', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['extrasensory', 'sheercold', 'signalbeam', 'extremespeed', 'shadowball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'weatherball', 'agility', 'crunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'larvitar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt', 'rage'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'rocktomb', 'superpower', 'uproar', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'sandtomb', 'rockthrow', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'rockblast', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pupitar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense', 'rocktomb', 'superpower', 'uproar', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'sandtomb', 'rockthrow', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aerialace', 'helpinghand', 'mudshot', 'rockblast', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tyranitar') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['detect', 'dragonbreath', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'superpower', 'uproar', 'irondefense', 'icepunch', 'lowkick', 'spite', 'thunderpunch', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'revenge', 'rockblast', 'sandtomb', 'hydropump', 'rockthrow', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'icywind', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lugia') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dragonbreath', 'headbutt', 'whirlpool', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'extrasensory', 'signalbeam', 'trick', 'weatherball', 'flash', 'skyattack', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'imprison', 'mist'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hooh') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'dragonbreath', 'zapcannon'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'extrasensory', 'heatwave', 'signalbeam', 'weatherball', 'willowisp', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand', 'imprison', 'firespin'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'celebi') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 2']);
			const advTradebacksMovePickupsGen2 = ['curse', 'detect', 'sweetscent'];
			for (const id of advTradebacksMovePickupsGen2) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'magicalleaf', 'magiccoat', 'signalbeam', 'silverwind', 'trick', 'uproar', 'synthesis', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['imprison', 'leafblade', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'treecko') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['doublekick', 'grasswhistle', 'headbutt', 'lowkick', 'magicalleaf', 'razorwind', 'rockslide', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['slash'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'grovyle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'lowkick', 'rockslide', 'synthesis', 'magicalleaf'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sceptile') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['frenzyplant', 'headbutt', 'lowkick', 'outrage', 'rockslide', 'synthesis', 'magicalleaf'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragondance'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'torchic') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['agility', 'batonpass', 'bounce', 'crushclaw', 'featherdance', 'headbutt', 'heatwave', 'helpinghand', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['curse', 'lowkick'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['detect'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'combusken') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'headbutt', 'heatwave', 'helpinghand', 'lowkick', 'willowisp', 'agility', 'batonpass', 'featherdance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['blazekick', 'detect', 'revenge'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'blaziken') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['blastburn', 'bounce', 'headbutt', 'heatwave', 'helpinghand', 'knockoff', 'lowkick', 'roleplay', 'solarbeam', 'superpower', 'willowisp', 'agility', 'batonpass', 'featherdance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['highjumpkick'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['detect', 'revenge'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mudkip') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'bite', 'counter', 'headbutt', 'lowkick', 'rockslide', 'sludge', 'superpower', 'yawn'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['barrier', 'rockthrow'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia', 'screech', 'supersonic'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'marshtomp') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'brickbreak', 'headbutt', 'lowkick', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['rockthrow'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia', 'sandtomb', 'screech', 'supersonic'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'swampert') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'headbutt', 'hydrocannon', 'lowkick', 'outrage', 'superpower'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['rockthrow'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia', 'bulkup', 'sandtomb', 'screech', 'supersonic'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'poochyena') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'spite', 'superfang', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mightyena') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'spite', 'superfang', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'zigzagoon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['takedown'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'linoone') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['helpinghand', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['takedown'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wurmple') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['snore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'silcoon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'beautifly') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'signalbeam', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['rage'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cascoon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['irondefense'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dustox') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'signalbeam', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['poisonpowder'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lotad') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bubblebeam', 'counter', 'headbutt', 'tickle', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['teeterdance'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['bubble'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lombre') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bubblebeam', 'headbutt', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'teeterdance'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['bubble', 'knockoff'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['encore', 'megakick', 'megapunch', 'muddywater', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ludicolo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'whirlpool', 'bubblebeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice', 'teeterdance'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['knockoff'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia', 'encore', 'muddywater', 'mudshot', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'seedot') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['beatup'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['absorb', 'astonish', 'megadrain', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nuzleaf') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'lowkick', 'razorleaf', 'rockslide', 'spite'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['beatup'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['leafblade'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['absorb', 'aircutter', 'astonish', 'megadrain', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shiftry') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'bounce', 'headbutt', 'icywind', 'knockoff', 'lowkick', 'razorleaf', 'rockslide', 'silverwind', 'spite', 'twister', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['beatup'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['leafblade'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['absorb', 'astonish', 'heatwave', 'megadrain', 'revenge', 'screech', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'taillow') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'twister', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'swellow') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wingull') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'hydropump', 'surf', 'takedown', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'pelipper') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'knockoff', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['bodyslam', 'helpinghand', 'takedown', 'waterfall'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ralts') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['confuseray', 'encore', 'grudge', 'headbutt', 'helpinghand', 'magicalleaf', 'magiccoat', 'painsplit', 'recycle', 'signalbeam', 'swift', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['knockoff', 'megakick', 'megapunch', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kirlia') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'helpinghand', 'magiccoat', 'painsplit', 'recycle', 'signalbeam', 'swift', 'trick', 'confuseray', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['megakick', 'megapunch', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['hyperbeam', 'metronome'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gardevoir') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'healbell', 'helpinghand', 'magiccoat', 'painsplit', 'recycle', 'signalbeam', 'swift', 'trick', 'confuseray', 'encore'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['megakick', 'megapunch', 'psybeam'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['metronome', 'nightshade'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'surskit') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['batonpass', 'mudslap', 'signalbeam', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'leechlife', 'surf', 'takedown', 'waterfall', 'watergun'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'masquerain') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'mudslap', 'signalbeam', 'stringshot', 'twister', 'batonpass'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'leechlife', 'surf', 'takedown', 'waterfall', 'watergun'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shroomish') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['synthesis'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['focuspunch'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['magicalleaf', 'raindance', 'swift', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'breloom') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['rockslide', 'rocktomb', 'superpower', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aerialace', 'dig', 'lowkick', 'magicalleaf', 'mudshot', 'raindance', 'reversal', 'swift', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slakoth') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'rocktomb'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['tickle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['falseswipe', 'helpinghand', 'metalclaw', 'metronome', 'mudshot', 'takedown', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'vigoroth') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'lowkick', 'rocktomb'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['dig', 'falseswipe', 'helpinghand', 'hypervoice', 'metalclaw', 'metronome', 'mudshot', 'outrage', 'scaryface', 'takedown', 'thief', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'slaking') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'lowkick', 'rocktomb'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['dig', 'falseswipe', 'helpinghand', 'hypervoice', 'metalclaw', 'metronome', 'mudshot', 'outrage', 'scaryface', 'takedown', 'thief', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nincada') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['spite', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['bide'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['flail'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'ninjask') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'spite', 'stringshot', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shedinja') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['stringshot', 'trick', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['absorb'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'whismur') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['endeavor', 'headbutt', 'smokescreen'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['whirlwind'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'loudred') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bite', 'headbutt', 'lowkick', 'rocktomb', 'endeavor'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'exploud') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bite', 'crunch', 'headbutt', 'lowkick', 'outrage', 'rocktomb', 'surf', 'whirlpool', 'endeavor'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'makuhita') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'lowkick', 'roleplay', 'superpower', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'swift', 'takedown', 'taunt', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'hariyama') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'lowkick', 'roleplay', 'superpower', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['mudshot', 'scaryface', 'swift', 'takedown', 'taunt', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'azurill') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['faketears', 'headbutt', 'helpinghand', 'knockoff', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bounce', 'bubblebeam', 'covet', 'hypervoice', 'lightscreen', 'muddywater', 'watersport'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['camouflage'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['bellydrum', 'mudshot', 'perishsong', 'present', 'supersonic'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'nosepass') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'headbutt', 'irondefense', 'magiccoat', 'painsplit'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['rockblast', 'spark'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'skitty') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fakeout', 'foresight', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['cosmicpower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'delcatty') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fakeout', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sableye') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['flatter', 'headbutt', 'icywind', 'lowkick', 'magiccoat', 'painsplit', 'roleplay', 'signalbeam', 'spite', 'trick', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['octazooka', 'tickle'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['imprison'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['disable', 'encore'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['bulkup', 'gigadrain', 'hyperbeam', 'lightscreen', 'metalclaw', 'mudshot', 'psybeam', 'reflect', 'skillswap', 'takedown', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'mawile') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'knockoff', 'painsplit', 'shadowball', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['slam', 'snatch'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['growl'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'aron') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'curse', 'screech', 'spite', 'superpower', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lairon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'spite', 'superpower', 'uproar', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'aggron') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'block', 'lowkick', 'outrage', 'spite', 'superpower', 'uproar', 'whirlpool', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['reversal'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['crunch', 'hydropump', 'rockblast', 'sandtomb', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'meditite') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'helpinghand', 'lowkick', 'magiccoat', 'painsplit', 'recycle', 'rockslide', 'roleplay', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aerialace', 'imprison', 'nightshade', 'psybeam', 'skillswap', 'takedown', 'taunt', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'medicham') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'helpinghand', 'lowkick', 'magiccoat', 'painsplit', 'recycle', 'roleplay', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['aerialace', 'imprison', 'nightshade', 'psybeam', 'skillswap', 'takedown', 'taunt', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'electrike') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['flamethrower', 'lightscreen', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'manectric') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['flamethrower', 'lightscreen', 'overheat', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'hypervoice', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'plusle') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'signalbeam', 'sing', 'sweetkiss', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['charm'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['covet'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'minun') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['faketears', 'headbutt', 'signalbeam', 'sing', 'sweetkiss', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['covet'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'volbeat') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'encore', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['dizzypunch'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'illumise') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['confuseray', 'faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['aromatherapy'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'roselia') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['mindreader', 'raindance', 'razorleaf', 'sleeppowder', 'extrasensory', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gulpin') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['curse', 'destinybond', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'mudshot', 'swordsdance', 'takedown', 'thief', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'swalot') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'earthquake', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['brickbreak', 'helpinghand', 'metronome', 'mudshot', 'swordsdance', 'takedown', 'thief', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'carvanha') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'bounce', 'spite', 'superfang', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['destinybond', 'poisonfang'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sharpedo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'bounce', 'spite', 'superfang', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['destinybond', 'poisonfang'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wailmer') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wailord') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'bounce', 'headbutt'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'numel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'headbutt', 'heatwave', 'spitup', 'stockpile', 'swallow', 'willowisp', 'yawn'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['curse'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['growth', 'naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'helpinghand', 'mudshot', 'raindance'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'camerupt') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'heatwave', 'solarbeam', 'willowisp', 'yawn'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['curse'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'helpinghand', 'mudshot', 'raindance'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'torkoal') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['earthquake', 'fissure', 'headbutt', 'hyperbeam', 'rapidspin', 'rocktomb', 'rollout', 'skullbash', 'solarbeam', 'willowisp', 'withdraw'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['flamewheel', 'naturepower', 'superpower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['ancientpower', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'sandstorm', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'spoink') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['amnesia', 'headbutt', 'healbell', 'mirrorcoat', 'recycle', 'roleplay', 'signalbeam', 'thunderwave'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'whirlwind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['confusion', 'encore', 'growl', 'helpinghand', 'imprison', 'nightshade', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'grumpig') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'headbutt', 'healbell', 'recycle', 'roleplay', 'signalbeam', 'thunderwave', 'amnesia'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['teeterdance'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['confusion', 'dig', 'encore', 'helpinghand', 'hypervoice', 'imprison', 'lowkick', 'metronome', 'mudshot', 'nightshade', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'spinda') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fakeout', 'headbutt', 'helpinghand', 'lowkick', 'recycle', 'roleplay'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet', 'faketears', 'hypervoice', 'rapidspin', 'superpower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'trapinch') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['fissure', 'flail', 'furycutter', 'headbutt', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bide', 'signalbeam', 'superpower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['astonish'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'vibrava') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'furycutter', 'headbutt', 'heatwave', 'outrage', 'silverwind', 'sonicboom', 'supersonic', 'twister', 'fissure', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bide', 'signalbeam', 'superpower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['uproar'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['astonish'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'flygon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aerialace', 'aircutter', 'headbutt', 'heatwave', 'outrage', 'silverwind', 'sonicboom', 'supersonic', 'thunderpunch', 'twister', 'fissure', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bide', 'signalbeam', 'superpower'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['uproar'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['dragondance'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['astonish', 'firespin', 'megakick', 'megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cacnea') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'headbutt', 'lowkick', 'magicalleaf', 'roleplay', 'smellingsalts', 'spite', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block', 'disable'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['dig', 'helpinghand', 'raindance', 'scaryface', 'swift', 'takedown', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cacturne') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'headbutt', 'lowkick', 'roleplay', 'spite', 'superpower', 'synthesis', 'magicalleaf'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['block'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['dig', 'helpinghand', 'raindance', 'scaryface', 'shadowball', 'swift', 'takedown', 'taunt', 'thief'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'swablu') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'featherdance', 'healbell', 'heatwave', 'outrage', 'twister', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragonbreath'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'altaria') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'outrage', 'twister', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['firespin'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'zangoose') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['disable', 'endeavor', 'furyswipes', 'headbutt', 'knockoff', 'lowkick', 'metalclaw', 'rocktomb'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['revenge'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['bellydrum'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['agility', 'batonpass', 'helpinghand', 'hyperbeam', 'reversal', 'surf', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'seviper') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'knockoff', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['swordsdance'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['brickbreak', 'helpinghand', 'hyperbeam', 'reversal', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lunatone') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'blizzard', 'helpinghand', 'magiccoat', 'painsplit', 'recycle', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['icywind', 'moonlight'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hail', 'rockblast', 'sandtomb', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'solrock') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'helpinghand', 'irondefense', 'magiccoat', 'painsplit', 'recycle', 'signalbeam', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['heatwave', 'morningsun'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hypnosis', 'raindance', 'rockblast', 'sandtomb', 'swordsdance', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'barboach') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'dragondance', 'flail', 'headbutt', 'hydropump', 'takedown'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['muddywater', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'outrage', 'rockslide', 'sunnyday', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'whiscash') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'headbutt', 'dragondance', 'hydropump', 'takedown'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['muddywater', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb', 'uproar', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['bodyslam', 'helpinghand', 'outrage', 'scaryface', 'spikes', 'sunnyday', 'swift'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'corphish') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['dragondance', 'falseswipe', 'irondefense', 'metalclaw', 'rockslide', 'spite', 'superpower', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump', 'muddywater', 'mudshot', 'slash', 'watergun'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'crawdaunt') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['falseswipe', 'irondefense', 'rockslide', 'spite', 'superpower', 'whirlpool', 'dragondance'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['naturepower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump', 'muddywater', 'mudshot', 'revenge', 'watergun'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'baltoy') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['calmmind', 'headbutt', 'magiccoat', 'recycle', 'safeguard', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['extrasensory'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['imprison'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'claydol') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['calmmind', 'headbutt', 'magiccoat', 'recycle', 'safeguard', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['extrasensory'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['imprison'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['futuresight', 'irondefense', 'sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'lileep') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['curse', 'flash', 'painsplit', 'rocktomb', 'stringshot', 'swordsdance', 'synthesis', 'tickle'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind', 'megadrain'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot', 'rockblast', 'wrap'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'cradily') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'flash', 'headbutt', 'painsplit', 'stringshot', 'swordsdance', 'synthesis'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind', 'megadrain'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dig', 'leechseed', 'mudshot', 'rockblast', 'wrap'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'anorith') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['crushclaw', 'curse', 'falseswipe', 'headbutt', 'irondefense', 'sandattack', 'screech', 'stringshot'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'armaldo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'crushclaw', 'falseswipe', 'headbutt', 'irondefense', 'lowkick', 'stringshot', 'superpower', 'screech'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'feebas') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['haze', 'mist', 'tickle', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['irontail'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['muddywater', 'mudshot'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'milotic') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['dragondance', 'helpinghand', 'imprison', 'muddywater', 'mudshot', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'castform') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['amnesia', 'disable'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['headbutt', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['cosmicpower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kecleon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['dizzypunch', 'fakeout', 'headbutt', 'knockoff', 'lowkick', 'recover', 'recycle', 'roleplay'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['camouflage'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shuppet') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['confuseray', 'headbutt', 'magiccoat', 'painsplit', 'pursuit', 'roleplay', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['encore', 'helpinghand', 'metronome', 'psybeam', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'banette') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'magiccoat', 'painsplit', 'roleplay', 'trick', 'confuseray'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['encore', 'psybeam', 'scaryface', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'duskull') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'spite', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['haze'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['revenge'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'dusclops') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['brickbreak', 'headbutt', 'spite', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['revenge'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'tropius') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'curse', 'dragondance', 'leafblade', 'outrage', 'silverwind', 'twister'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'raindance', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'chimecho') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['extrasensory', 'futuresight', 'helpinghand', 'knockoff', 'magiccoat', 'recycle', 'signalbeam', 'thunderwave', 'trick', 'wish', 'recover'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['cosmicpower'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['perishsong'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'absol') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'detect', 'falseswipe', 'headbutt', 'knockoff', 'meanlook', 'megahorn', 'pursuit', 'rocktomb', 'roleplay', 'superpower', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['focusenergy'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'wynaut') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'snorunt') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bide', 'disable', 'rollout', 'spite', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['astonish'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'glalie') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['signalbeam', 'spite', 'superfang', 'weatherball'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['faketears'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['astonish', 'iciclespear', 'scaryface'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'spheal') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'signalbeam', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['bellydrum'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'sealeo') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'signalbeam', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['iciclespear'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'walrein') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'crunch', 'furycutter', 'headbutt', 'signalbeam', 'superfang', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['hydropump', 'iciclespear', 'swordsdance'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'clamperl') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['muddywater'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'huntail') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'superfang'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['feintattack'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'gorebyss') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'psychup', 'signalbeam'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 6']);
			const advTradebacksMovePickupsGen6 = ['watersport'];
			for (const id of advTradebacksMovePickupsGen6) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'relicanth') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'headbutt', 'muddywater', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['mudshot'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 7']);
			const advTradebacksMovePickupsGen7 = ['flail'];
			for (const id of advTradebacksMovePickupsGen7) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['irondefense', 'rockblast'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'luvdisc') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['bounce', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hydropump'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['wish'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'bagon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['defensecurl', 'hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'shelgon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'salamence') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['aircutter', 'heatwave', 'outrage'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['hypervoice'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['firespin', 'helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'beldum') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'irondefense'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'metang') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['cosmicpower', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'metagross') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['cosmicpower', 'tackle'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'regirock') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'stomp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['rockblast', 'sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'regice') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'rocktomb', 'signalbeam', 'stomp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['iciclespear'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'registeel') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'stomp'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['sandtomb'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'latias') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'outrage', 'roleplay', 'trick', 'twister', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['covet'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'batonpass', 'confusion', 'dragondance', 'futuresight', 'sweetkiss', 'triattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'latios') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['magiccoat', 'outrage', 'trick', 'twister', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['agility', 'batonpass', 'confusion', 'futuresight', 'triattack'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'kyogre') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'muddywater', 'signalbeam', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'groudon') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['block', 'headbutt', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['crunch', 'heatwave', 'helpinghand', 'metalclaw', 'rockblast', 'spikes', 'takedown', 'willowisp'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'rayquaza') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['headbutt', 'hypervoice', 'rocktomb', 'swordsdance', 'uproar', 'whirlpool'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['cosmicpower', 'hydropump'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 9']);
			const advTradebacksMovePickupsGen9 = ['helpinghand', 'takedown'];
			for (const id of advTradebacksMovePickupsGen9) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'jirachi') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['ancientpower', 'headbutt', 'irondefense', 'magiccoat', 'recycle', 'signalbeam', 'trick', 'uproar'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['followme', 'meteormash'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 8']);
			const advTradebacksMovePickupsGen8 = ['amnesia', 'batonpass', 'charm', 'encore', 'imprison', 'megakick', 'megapunch'];
			for (const id of advTradebacksMovePickupsGen8) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		if (this.species == 'deoxys') {
			advTradebacksMoves.push(['header', 'Tradeback Move Pickups']);
			advTradebacksMoves.push(['header', 'Gen 4']);
			const advTradebacksMovePickupsGen4 = ['detect', 'headbutt', 'lowkick', 'magiccoat', 'meteormash', 'recycle', 'roleplay', 'signalbeam', 'trick'];
			for (const id of advTradebacksMovePickupsGen4) {
				advTradebacksMoves.push(['move', id as ID]);
			}
			advTradebacksMoves.push(['header', 'Gen 5']);
			const advTradebacksMovePickupsGen5 = ['bind'];
			for (const id of advTradebacksMovePickupsGen5) {
				advTradebacksMoves.push(['move', id as ID]);
			}
		}
		for (const id of moves) {
            const isUsable = this.moveIsNotUseless(id as ID, species, moves, this.set);
            if (isUsable) {
                if (!usableMoves.length) usableMoves.push(['header', "Moves"]);
                usableMoves.push(['move', id as ID]);
            } else {
                if (!uselessMoves.length) uselessMoves.push(['header', "Usually useless moves"]);
                uselessMoves.push(['move', id as ID]);
            }
        }
		if (sketchMoves.length) {
			usableMoves.push(['header', "Sketched moves"]);
			uselessMoves.push(['header', "Useless sketched moves"]);
		}
		for (const id of sketchMoves) {
			const isUsable = this.moveIsNotUseless(id as ID, species, sketchMoves, this.set);
			if (isUsable) {
				usableMoves.push(['move', id as ID]);
			} else {
				uselessMoves.push(['move', id as ID]);
			}
		}
		if (this.mod != 'gen3expansionpak') return [...usableMoves, ...uselessMoves];
        else return [...advTradebacksMoves, ...usableMoves, ...uselessMoves];
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
        const table = !this.mod ? '' : BattleTeambuilderTable[this.mod].overrideMoveInfo;
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
                let movedex1 = BattleMovedex;
                let movedex2 = BattleMovedex;
                if (this.mod) {
                    if (table[id1] && table[id1].basePower) movedex1 = table;
                    if (table[id2] && table[id2].basePower) movedex2 = table;
                }
				let move1 = this.dex.moves.get(id1);
				let move2 = this.dex.moves.get(id2);
				let pow1 = movedex1[id1].basePower || move1.basePower || powerTable[id1] || (move1.category === 'Status' ? -1 : 1400);
				let pow2 = movedex2[id2].basePower || move2.basePower || powerTable[id2] || (move2.category === 'Status' ? -1 : 1400);
				return (pow2 - pow1) * sortOrder;
			});
		case 'accuracy':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
                let movedex1 = BattleMovedex;
                let movedex2 = BattleMovedex;
                if (this.mod) {
                    if (table[id1] && table[id1].accuracy) movedex1 = table;
                    if (table[id2] && table[id2].accuracy) movedex2 = table;
                }
				let accuracy1 = movedex1[id1].accuracy || 0;
				let accuracy2 = movedex2[id2].accuracy || 0;
				if (accuracy1 === true) accuracy1 = 101;
				if (accuracy2 === true) accuracy2 = 101;
				return (accuracy2 - accuracy1) * sortOrder;
			});
		case 'pp':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
                let movedex1 = BattleMovedex;
                let movedex2 = BattleMovedex;
                if (this.mod) {
                    if (table[id1] && table[id1].pp) movedex1 = table;
                    if (table[id2] && table[id2].pp) movedex2 = table;
                }
				let pp1 = movedex1[id1].pp || 0;
				let pp2 = movedex2[id2].pp || 0;
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
