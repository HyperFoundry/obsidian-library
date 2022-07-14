const notice = msg => new Notice(msg, 6000)
const log = msg => console.log(msg)

module.exports = {
	entry: start,
	settings: {
		name: 'Book Metadata Fetcher',
		author: 'HyperFoundry',
	},
}

let QuickAdd, Settings

async function start(params, settings) {
	QuickAdd = params
	Settings = settings

	// Display single-line prompt for user query entry (can be book title, author, ISBN, etc). Throw error if no input
	let query = await QuickAdd.quickAddApi.inputPrompt(
		'📖 Search by any keywords (title, author, ISBN, etc.): '
	)
	if (!query) {
		notice('❗No query entered')
		throw new Error('No query entered')
	}
	// Initalize the main object variables for our two sources of metadata. Declared in this scope for usage in either parts of the following if/else
	let googleMeta, goodreadsMeta

	/* User query is evaluated by isbnCheck() returning either the original query string or extracted ISBN as a number. 
	If Number.isInteger() is true, if{} executes specific book search by ISBN; if false, else{} executes search for books matching content of query string */
	if (Number.isInteger((query = isbnCheck(query)))) {
		/* Retrieve metadata of the book indicated by ISBN from both sources in parallel w/Promise.allSettled() handler for async() promises: requestAPIdata(), parseBookLink().
		Immediate destructuring assignment into googleMeta & goodreadsMeta var */
		;[googleMeta, goodreadsMeta] = await Promise.allSettled([
			requestAPIdata(`isbn:${query}`),
			parseBookLink(query),
		])

		// && (Logical 'AND' short-circuting operator) used in lieu of an if/else statement, where the right side (destructured data) is reassigned to our variable
		googleMeta =
			googleMeta.status === 'fulfilled' &&
			(({id, volumeInfo}) => ({id, ...volumeInfo}))(googleMeta.value)
		goodreadsMeta = goodreadsMeta.status === 'fulfilled' && goodreadsMeta.value
	} else {
		// Query Google Books API with user query string, top 10 matches are returned (default)
		const apiResults = await requestAPIdata(query)

		/* Duplicate results that all refer to the same book are common (different publishers, publication years, editions, etc. can all have the same ISBN)
		To deduplicate the results, we use map() to iterate through the results and create a new array with the result's ISBN13 as a 'key', and extract/destructure certain metadata as the 'value'
		A feature of Maps are that keys must be unique, so constructing a new Map() deduplicates the results by the ISBN13 keys we created. However, the new Map will overwrite values of duplicate keys, so in order to maintain the integrity of the order of the search results, slice().reverse() is used to create a reversed-order shallow copy.
		The spread syntax [...] converts te map back into an array, keeping only the metadata values(), results are reversed again to present results in relevance order */
		const uniqueResults = [
			...new Map(
				apiResults
					.slice()
					.reverse()
					.map(({id, volumeInfo}) => [+volumeInfo.ISBN_13, {id, ...volumeInfo}])
			).values(),
		].reverse()

		// Prompt user with list of unique book results to choose from and save that book's metadata to googleMeta. Throw an error if no book is selected
		googleMeta = await QuickAdd.quickAddApi.suggester(
			uniqueResults.map(formatSuggestions),
			uniqueResults
		)
		if (!googleMeta) {
			notice('❗No choice selected')
			throw new Error('No choice selected')
		}
		goodreadsMeta = await parseBookLink(googleMeta.ISBN_13 ?? googleMeta.ISBN_10)
	}

	// Assign our collected metadata to user friendly variables for use in their personalized templates
	QuickAdd.variables = {
		fileName: `${googleMeta.title} - ${googleMeta.authors}`,

		// Book Info
		title: googleMeta.title ?? goodreadsMeta.title,
		subTitle: googleMeta.subtitle ?? ' ',
		fullTitle: googleMeta.subtitle
			? `${googleMeta.title}: ${googleMeta.subtitle}`
			: googleMeta.title,
		authors: goodreadsMeta.authors,
		briefAbstract: googleMeta.description,
		abstract: goodreadsMeta.description,
		genres: goodreadsMeta.categories,

		series: goodreadsMeta.series,
		seriesCount: goodreadsMeta.seriesCount,
		seriesURL: goodreadsMeta.seriesURL,

		// Rating Details
		avRating: goodreadsMeta.ratingValue,
		numRatings: goodreadsMeta.ratingCount,
		numReviews: goodreadsMeta.reviewCount,
		avRatingGOOG: googleMeta.averageRating,
		numRatingsGOOG: googleMeta.ratingsCount,

		// Publication Info
		pubDate: goodreadsMeta.publishedDate ?? new Date(googleMeta.publishedDate).getFullYear(),
		publisher: googleMeta.publisher ?? goodreadsMeta.publisher,
		format: goodreadsMeta.printType,
		pages: goodreadsMeta.pageCount,
		language: goodreadsMeta.language,
		maturity: googleMeta.maturityRating,

		// Book Cover Images
		coverURL: goodreadsMeta.imageLinks,
		thumbnailURL: `${googleMeta.imageLinks?.thumbnail}`.replace('http:', 'https:') || ' ',

		// Reference Links
		goodreadsURL: goodreadsMeta.canonicalVolumeLink,
		googleURL: googleMeta.canonicalVolumeLink,
		//amznURL: goodreadsMeta.amznASIN !== undefined && `https://www.amazon.com/gp/product/${goodreadsMeta.amznASIN}`,

		// Book Identifiers & Unique IDs
		isbn13: googleMeta.ISBN_13 ?? goodreadsMeta.isbn13,
		isbn10: googleMeta.ISBN_10 ?? goodreadsMeta.isbn10,
		goodreadsID: goodreadsMeta.id,
		googleID: googleMeta.id,
		//amznASIN: goodreadsMeta.amznASIN,

		// Personal Fields
		myStatus: await params.quickAddApi.suggester(
			['📚 To Read', '✅ Completed Reading', '📖 Currently Reading'],
			['#toRead', '#read', '#reading']
		),
	}
}

// Check user's query string for ISBNs
const isbnCheck = str => {
	const ISBN_PRE_REGEX = /(?:\bISBN[- ]?(1[03])?[-: ]*)?/gi // Common ISBN prefix structure
	const ISBN_REGEX =
		/(97[89])?[\dX]{10}$|(?=(?:(\d+?[- ]){3,4}))([\dX](?:[- ])*?){10}(([\dX](?:[- ])*?){3})?$/g // ISBN(10/13); accounts for spaces/dashes
	const ILLEGAL_CHAR_REGEX = /[-\\,#%&+\/\*{}<>\$":@.]*/g // Common illegal characters for API query

	// if no ISBN REGEX matches, clean up user's query string, and return; else return extracted ISBN
	if (!ISBN_PRE_REGEX.test(str) || !ISBN_REGEX.test(str))
		return str.trim().replaceAll(ILLEGAL_CHAR_REGEX, '')
	return +str.match(ISBN_REGEX)[0].replaceAll(/[- ]/g, '')
}

const requestAPIdata = async query => {
	const GOOG_API_URL = 'https://www.googleapis.com/books/v1/volumes' // No API key requirement for Google Books queries (https://developers.google.com/books/docs/v1/using#PerformingSearch)

	// Construct query URL
	let apiQueryURL = new URL(GOOG_API_URL)
	apiQueryURL.searchParams.set('q', query)
	apiQueryURL.searchParams.set('fields', 'items(id,volumeInfo)')

	// Request URL using HTTP/HTTPS, without any CORS restrictions (similar to fetch())
	try {
		const response = await request({
			url: apiQueryURL.href,
			cache: 'no-cache',
		})
		const apiResult = await JSON.parse(response, isbnReviver) // JSON.parse deserializes a JSON reply string into an object
		return (await (apiResult.items.length === 1)) ? apiResult.items[0] : apiResult.items
	} catch (err) {
		if (apiResult.items.length === 0) {
			notice('🤷‍♂️ No results found')
			throw new Error('No results found')
		} else {
			notice(`🚨 Request failed`)
			throw new Error('Request failed')
		}
	}
}

// Reviver() for JSON.parse to extract deeply nested/key-disassociated ISBN. Reduce() outperforms map()
const isbnReviver = (key, value) => {
	if (key === 'volumeInfo') {
		value.industryIdentifiers.reduce(
			(acc, {type, identifier}) => ((value[type] = identifier), acc),
			{}
		)
	}
	return value // un-modified key/value pass though here
}

const parseBookLink = async isbn => {
	const GOODREADS_SEARCH_URL = 'https://www.goodreads.com/search?'

	let goodreadsQueryURL = new URL(GOODREADS_SEARCH_URL)
	goodreadsQueryURL.searchParams.set('q', isbn)
	goodreadsQueryURL.searchParams.set('search_type', 'books') // construct full request URL for Goodreads website

	const bookPage = await request({url: goodreadsQueryURL.href})
	const document = new DOMParser().parseFromString(bookPage, 'text/html') // turn requested webpage into DOM tree
	const $ = selector => document.querySelector(selector) // create shorthands for querySelector methods used to traverse DOM tree (mimics jQuery)
	const $$ = selector => [
		...new Set(Array.from(document.querySelectorAll(selector), x => x.textContent.trim())),
	]

	// Map of metadata fields w/associated CSS selectors for Goodreads
	let gdreadsElemSel = new Map([
		['id', $('#book_id').value],
		['title', $('#bookTitle').textContent.trim()],
		['authors', wikiLnkList($$('#bookAuthors a.authorName span[itemprop=name]'))],
		['description', $('#description span:last-of-type').innerHTML],
		[
			'categories',
			wikiLnkList(
				$$(
					'.bigBoxContent.containerWithHeaderContent .elementList:nth-child(-n+5) a.actionLinkLite.bookPageGenreLink:last-of-type'
				)
			),
		],
		['isbn13', $("meta[property='books:isbn']").content],
		[
			'isbn10',
			$('#bookDataBox .clearFloats:nth-child(2) .infoBoxRowItem').textContent.match(
				/\b\d{10}\b/g
			)[0],
		],
		['ratingValue', $('#bookMeta span[itemprop=ratingValue').textContent.trim()],
		['ratingCount', $('#bookMeta meta[itemprop=ratingCount]').content],
		['reviewCount', $('#bookMeta meta[itemprop=reviewCount]').content],
		['imageLinks', $('.bookCoverContainer img').src],
		[
			'publishedDate',
			$('#details .row:nth-child(2)').textContent.match(
				/(?:Published\n\s*\b)(?:\w)+ (?:\d+\w+) (\d{4})/im
			)[1],
		],
		['publisher', $('#details .row:nth-child(2)').textContent.match(/(?:by) (\w.*)$/im)[1]],
		['language', $('#bookDataBox .clearFloats:nth-child(3) .infoBoxRowItem').textContent],
		['printType', $('#details span[itemprop=bookFormat]').textContent],
		['pageCount', $("meta[property='books:page_count']").content],
		['canonicalVolumeLink', $("link[rel='canonical']").getAttribute('href')],
		[
			'series',
			$('#bookSeries')
				.textContent.trim()
				.slice(1, -1)
				.replace(/^((?=(?<series>\w+))\k<series>\s?)+(?<sNum>#\d+)/, '[[$<series>]] $<sNum>'),
		], // Selector for h2 element whose ID-typed attribute has the value "bookSeries"
		[
			'seriesCount',
			$('.seriesList .bigBoxContent.containerWithHeaderContent').innerText.match(/\([^)]+\)/)[0],
		],
		['seriesURL', `https://www.goodreads.com` + $('.seriesList a').getAttribute('href')],
		//['amznASIN', $('ul.buyButtonBar.left li a.glideButton.buttonBar').dataset.asin],
		//['amznURL', $('ul.buyButtonBar.left li a.glideButton.buttonBar').dataset.amazonUrl],
	])

	// Iterate over the map and mutate the value of each key to contain metadata. Return a book metadata object.
	// Refactored from a cleaner Array.reduce method since Map w/forEach significantly outperforms.
	gdreadsElemSel.forEach((value, key, map) => map.set(key, value))

	console.log(gdreadsElemSel)
	return Object.fromEntries(gdreadsElemSel)
}

// Formats string for our suggestion prompt; shows '📚' prefix if a book cover image is available or (📵) if not
const formatSuggestions = resultItem => {
	return `${resultItem.imageLinks ? '📚' : '📵'} ${resultItem.title} - ${resultItem.authors[0]} 
(Published ${new Date(resultItem.publishedDate).getFullYear()} by ${resultItem.publisher})`
}

// Convert a array into a wikilinks list of each item separated by commas
const wikiLnkList = list => {
	if (list?.length === 1) return `[[${list[0]}]]`
	return list?.map(i => `[[${i.trim()}]]`).join(', ') ?? ' '
}
