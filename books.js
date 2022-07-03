const notice = msg => new Notice(msg, 6000)
const log = msg => console.log(msg)

// Google Books does not require an API key for book queries (https://developers.google.com/books/docs/v1/using#PerformingSearch)
const GOOG_API_URL = 'https://www.googleapis.com/books/v1/volumes'
const GOODREADS_SEARCH_URL = 'https://www.goodreads.com/search?'

module.exports = {
	entry: start,
	settings: {
		name: 'Book Metadata Fetcher',
		author: 'HyperFoundry',
	},
}

let QuickAdd
let Settings

async function start(params, settings) {
	QuickAdd = params
	Settings = settings
	// prompt for search terms; can be book title, author, ISBN, etc.
	var query = await QuickAdd.quickAddApi.inputPrompt('📖 Search by any keywords (title, author, ISBN, etc.): ')
	if (!query) {
		notice('❗No query entered')
		throw new Error('No query entered')
	}

	query = query.trim().replace(/[\\,#%&!?\{\}\/*<>`$\'\":@.*]/g, '') // clean up user entry with REGEX

	let googleMData
	let greadsMData

	query = isbnCheck(query) // check if user query has ISBN identifying info
	if (query.isbnID) {
		// if there is ISBN info, we will query Google Books API & scrape the book's Goodreads page at the same time
		[googleMData, greadsMData] = await Promise.allSettled([reqAPI(query.isbnQuery), scrapeBookData(query.isbnID)])

		googleMData =
			googleMData.status === 'fulfilled' && (({ id, volumeInfo }) => ({ id, ...volumeInfo }))(googleMData.value[0]) // checks if fetch was successful, then destructures object to the values we want
		greadsMData = greadsMData.status === 'fulfilled' && greadsMData.value
	} else {
		const results = await reqAPI(query) // user query without ISBN is sent to Google Books API search
		// deduplicate results w/ISBN13 as comparison key
		const uniqueResults = [
			...new Map(
				results.map(({ id, volumeInfo }) => [+volumeInfo.industryIdentifiers.find(n => n.type === 'ISBN_13').identifier, { id, ...volumeInfo }])
			).values(),
		]
		//prompt user with list of unique results
		googleMData = await QuickAdd.quickAddApi.suggester(uniqueResults.map(formatSuggestions), uniqueResults)
		if (!googleMData) {
			notice('❗No choice selected')
			throw new Error('No choice selected')
		}
		const isbn13 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier // extract ISBNs from Google Book metadata
		const isbn10 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_10')?.identifier
		greadsMData = await scrapeBookData(isbn13 || isbn10) // scrape the corresponding Goodreads books page
	}

	QuickAdd.variables = {
		fileName: `${googleMData.title} - ${googleMData.authors}`,

		goodreadsID: greadsMData.id,
		googleID: googleMData.id,
		// amazonASIN: greadsMData.amznASIN,

		title: googleMData.title,
		subTitle: googleMData.subtitle ?? ' ',
		fullTitle: googleMData.subtitle ? `${googleMData.title}: ${googleMData.subtitle}` : googleMData.title,
		authors: wikiLnkList(greadsMData.authors),
		abstract: greadsMData.description,
		genres: wikiLnkList(greadsMData.categories),
		series: greadsMData.series.slice(1, -1),
		seriesCount: greadsMData.seriesCount.match(/\([^\)]+\)/)[0],
		//`[[${greadsMData.series[0]}]] ${greadsMData.series[1]} [${greadsMData.seriesCount}](${greadsMData.seriesURL})`,
		isbn13: greadsMData.isbn13,
		isbn10: greadsMData.isbn10.match(/\b\d{10}\b/g)[0],

		avRating: greadsMData.ratingValue,
		numRatings: greadsMData.ratingCount,
		numReviews: greadsMData.reviewCount,
		avRatingGOOG: googleMData.averageRating,
		numRatingsGOOG: googleMData.ratingsCount,

		pubYear: new Date(googleMData.publishedDate)?.getFullYear() ?? ' ',
		publisher: googleMData.publisher,
		language: greadsMData.language,
		maturity: googleMData.maturityRating,
		format: greadsMData.printType,
		pageCt: greadsMData.pageCount,

		coverURL: greadsMData.imageLinks,
		coverURLGOOG: `${googleMData.imageLinks?.thumbnail}`?.replace('http:', 'https:') ?? ' ',

		googleURL: googleMData.canonicalVolumeLink,
		goodreadsURL: greadsMData.canonicalVolumeLink,
		//amznURL: `${greadsMData.amznASIN !== ' ' && `https://www.amazon.com/gp/product/${greadsMData.amazonASIN}`}`,
	}
}

let isbnCheck = str => {
	const isbnPre = /(?:\bISBN[- ]?(1[03])?[-: ]*)?/gi // REGEX; ISBN identifier prefix
	const isbnNum = /(97[89])?[\dX]{10}$|(?=(?:(\d+?[- ]){3,4}))([\dX](?:[- ])*?){10}(([\dX](?:[- ])*?){3})?$/g // REGEX; look for ISBN-10/13 taking into account spaces or dashes

	if (!isbnPre.test(str) || !isbnNum.test(str)) return str // if no REGEX matches, return the original query
	let isbnID = str.match(isbnNum)[0].replaceAll(/[- ]/g, '') // else, extract ISBN using the regex & clean up so its only numbers
	return { isbnQuery: `isbn:${isbnID}`, isbnID } // return modified query value for Google books API, and extracted ISBN to scrape its specific Goodread's page
}

let reqAPI = async query => {
	let constructURL = new URL(GOOG_API_URL)
	constructURL.searchParams.set('q', query) // construct full query URL for Google books API
	const googleQueryURL = decodeURIComponent(constructURL.href) // decodeURI necessary so symbols in URL like ':' are not malformed in http request

	try {
		const response = await request({
			url: googleQueryURL,
			cache: 'no-cache'
		})
		const index = await JSON.parse(response)
		return await index.items
	} catch (error) {
		if (index.totalItems === 0) {
			notice('🤷‍♂️ No results found')
			throw new Error('No results found')
		} else {
			notice(`🚨 Request failed`)
			throw new Error('Request failed')
		}
	}
}

let scrapeBookData = async isbn => {
	let goodreadsQueryURL = new URL(GOODREADS_SEARCH_URL)
	goodreadsQueryURL.searchParams.set('q', isbn)
	goodreadsQueryURL.searchParams.set('search_type', 'books') // construct full request URL for Goodreads website

	const bookPage = await request({ url: goodreadsQueryURL.href })
	const document = new DOMParser().parseFromString(bookPage, 'text/html') // turn requested webpage into DOM tree
	const $ = (selector, attr, scope = document) => scope.querySelector(selector)[attr].trim()
	const $$ = (selector, attr, scope = document) => new Set(Array.from(scope.querySelectorAll(selector), x => x[attr]))

	const grCSSelectors = [
		{ field: 'id', sel: '#book_id', val: 'value' },
		{ field: 'title', sel: 'h1#bookTitle', val: 'innerText' },
		{ field: 'authors', sel: '#bookAuthors a.authorName span[itemprop=name]', qs: $$ },
		{ field: 'description', sel: '#descriptionContainer #description span:last-of-type', val: 'innerHTML' },
		{ field: 'isbn13', sel: "meta[property='books:isbn']", val: 'content' },
		{ field: 'isbn10', sel: '#bookDataBox .clearFloats:nth-child(2) .infoBoxRowItem' },
		{
			field: 'categories',
			sel: '.bigBoxContent.containerWithHeaderContent .elementList:nth-child(-n+5) a.actionLinkLite.bookPageGenreLink', // bookPageGenreLink:last-of-type
			qs: $$,
		},
		{ field: 'series', sel: 'h2#bookSeries', val: 'innerText' },
		{ field: 'seriesCount', sel: '.seriesList .bigBoxContent.containerWithHeaderContent', val: 'innerText' },
		{ field: 'seriesURL', sel: '.seriesList a', val: 'href' },
		{ field: 'ratingValue', sel: '#bookMeta span[itemprop=ratingValue]' },
		{ field: 'ratingCount', sel: '#bookMeta meta[itemprop=ratingCount]', val: 'content' },
		{ field: 'reviewCount', sel: '#bookMeta meta[itemprop=reviewCount]', val: 'content' },
		{ field: 'imageLinks', sel: '.bookCoverContainer img', val: 'src' },
		{ field: 'publishedDate', sel: '#details .row:nth-child(2)' },
		{ field: 'publisher', sel: '#details .row:nth-child(2)' },
		{ field: 'language', sel: '#bookDataBox .clearFloats:nth-child(3) .infoBoxRowItem' },
		{ field: 'printType', sel: '#details span[itemprop=bookFormat]' },
		{ field: 'pageCount', sel: "meta[property='books:page_count']", val: 'content' },
		{ field: 'canonicalVolumeLink', sel: "link[rel='canonical']", val: 'href' },
		//{ field: 'amznASIN', sel: 'ul.buyButtonBar.left li a.glideButton.buttonBar', val:'dataset', qs: $$ },
		//{ field: 'amznURL', sel: 'ul.buyButtonBar.left a.glideButton.buttonBar', val: 'dataset.amazonUrl'},
	]
	const bookMData = grCSSelectors.reduce(
		(acc, { field, sel, val = 'textContent', qs = $, fieldVal = qs(sel, val) } = {}) => {
			fieldVal && (acc[field] = fieldVal)
			return acc
		},
		{}
	)
	console.log({bookMData})
	return bookMData
}

// Suggestion prompt shows '📚' prefix if a book cover image is available or (📵) if not
// Also displays: Book title, author, publication year, and ISBNs
let formatSuggestions = resultItem => {
	return `${resultItem.imageLinks ? '📚' : '📵'} ${resultItem.title} - ${resultItem.authors[0]} (${new Date(
		resultItem.publishedDate
	).getFullYear()})`
}

// convert a list into a wikilinks list
let wikiLnkList = list => {
	if (list?.length === 0) return ' '
	if (list?.length === 1) return `[[${list[0]}]]`
	return Array.from(list, i => `[[${i.trim()}]]`).join(', ') ?? ' '
}
