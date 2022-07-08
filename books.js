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
	// single line prompt for user query; can be book title, author, ISBN, etc.
	let query = await QuickAdd.quickAddApi.inputPrompt('📖 Search by any keywords (title, author, ISBN, etc.): ')
	query &&= query.trim().replace(/[\\,#%&!?\{\}\/*<>`$\'\":@.*]/g, '') //use REGEX to clean up user entry
	// throw error if user does not enter a query
	if (!query) {
		notice('❗No query entered')
		throw new Error('No query entered')
	}

	let googleMData, greadsMData // declare object variables where we will store out book metadata from our two sources

	// check if user query contains ISBN
	if (Number.isInteger((query = isbnCheck(query)))) {
		// if ISBN is extracted from user query, we can retrieve metadata for the specific book from our two sources in parallel. Immediately destructure the promises returned
		;[googleMData, greadsMData] = await Promise.allSettled([requestAPIdata(`isbn:${query}`), parseBookLink(query)])

		// if promises were successful, use destructuring & spread operator to save only the metadata we want back into the main metadata containers/objects
		googleMData =
			googleMData.status === 'fulfilled' && (({ id, volumeInfo }) => ({ id, ...volumeInfo }))(googleMData.value[0])
		greadsMData = greadsMData.status === 'fulfilled' && greadsMData.value
	} else {
		// if user query contains no ISBN, search using the Google Books API first
		const results = await requestAPIdata(query)
		// results returned from Google Books API is deduplicated by comparing their ISBN13
		const uniqueResults = [
			...new Map(
				results.map(({ id, volumeInfo }) => [
					+volumeInfo.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier,
					{ id, ...volumeInfo },
				])
			).values(),
		]
		//prompt user with list of unique book results to choose from
		googleMData = await QuickAdd.quickAddApi.suggester(uniqueResults.map(formatSuggestions), uniqueResults)
		// if no book is selected, throw an error
		if (!googleMData) {
			notice('❗No choice selected')
			throw new Error('No choice selected')
		}
		// extract the ISBNs from the selected book to find the book's page on Goodreads
		const isbn13 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier
		const isbn10 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_10')?.identifier
		greadsMData = await parseBookLink(isbn13 || isbn10)
	}

	// assign our collected metadata to user friendly variables for use in their personalized templates
	QuickAdd.variables = {
		fileName: `${googleMData.title} - ${googleMData.authors}`,

		// Book Info
		title: googleMData.title,
		subTitle: googleMData.subtitle ?? ' ',
		fullTitle: googleMData.subtitle ? `${googleMData.title}: ${googleMData.subtitle}` : googleMData.title,
		authors: wikiLnkList(greadsMData.authors),
		abstract: greadsMData.description,
		genres: wikiLnkList(greadsMData.categories),
		series: greadsMData.series
			.slice(1, -1)
			.replace(/^((?=(?<series>\w+))\k<series>\s?)+(?<sNum>#\d+)/, '[[$<series>]] $<sNum>'),
		seriesCount: greadsMData.seriesCount.match(/\([^\)]+\)/)[0],
		seriesURL: `${greadsMData.seriesURL}`.replace(/^app:\/\/obsidian.md/m, 'https://www.goodreads.com'),

		// Rating Details
		avRating: greadsMData.ratingValue,
		numRatings: greadsMData.ratingCount,
		numReviews: greadsMData.reviewCount,
		avRatingGOOG: googleMData.averageRating,
		numRatingsGOOG: googleMData.ratingsCount,

		// Publication Info
		pubDate:
			new Date(googleMData.publishedDate)?.getFullYear() ||
			greadsMData.publishedDate.match(/(?:Published\n\s*\b)(?:\w)+ (?:\d+\w+) (\d{4})/im)[1],
		publisher: googleMData.publisher || greadsMData.publisher.match(/(?:by) (\w.*)$/im)[1],
		format: greadsMData.printType,
		pages: greadsMData.pageCount,
		language: greadsMData.language,
		maturity: googleMData.maturityRating,

		// Book Cover Images
		coverURL: greadsMData.imageLinks,
		thumbnailURL: `${googleMData.imageLinks?.thumbnail}`?.replace('http:', 'https:') ?? ' ',

		// Reference Links
		goodreadsURL: greadsMData.canonicalVolumeLink,
		googleURL: googleMData.canonicalVolumeLink,
		//amznURL: `${greadsMData.amznASIN !== ' ' && `https://www.amazon.com/gp/product/${greadsMData.amazonASIN}`}`,

		// Book Identifiers & Unique IDs
		isbn13: greadsMData.isbn13,
		isbn10: greadsMData.isbn10.match(/\b\d{10}\b/)[0],
		goodreadsID: greadsMData.id,
		googleID: googleMData.id,
		// amznASIN: greadsMData.amznASIN,

		// Personal Fields
		myStatus: await params.quickAddApi.suggester(
			['To Read', 'Completed Reading', 'Currently Reading'],
			['#toRead', '#read', '#reading']
		),
	}
}

let isbnCheck = str => {
	const ISBN_PREFIX_REGEX = /(?:\bISBN[- ]?(1[03])?[-: ]*)?/gi // REGEX; ISBN identifier prefix
	const ISBN_REGEX = /(97[89])?[\dX]{10}$|(?=(?:(\d+?[- ]){3,4}))([\dX](?:[- ])*?){10}(([\dX](?:[- ])*?){3})?$/g // REGEX; for ISBN-10/13 taking into account spaces or dashes

	if (!ISBN_PREFIX_REGEX.test(str) || !ISBN_REGEX.test(str)) return str // if no REGEX matches, return the original query
	return +str.match(ISBN_REGEX)[0].replaceAll(/[- ]/g, '') // else, use REGEX to extract ISBN and remove dashes/spaces, and return
}

let requestAPIdata = async query => {
	let constructURL = new URL(GOOG_API_URL)
	constructURL.searchParams.set('q', query) // construct full query URL for Google books API
	const googleQueryURL = decodeURIComponent(constructURL.href) // decodeURI necessary so symbols in URL like ':' are not malformed in http request

	// request a URL using HTTP/HTTPS, without any CORS restrictions (similar to fetch())
	try {
		const response = await request({
			url: googleQueryURL,
			cache: 'no-cache',
		})
		const index = await JSON.parse(response) // this method turns the json reply string into an object
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

let parseBookLink = async isbn => {
	let goodreadsQueryURL = new URL(GOODREADS_SEARCH_URL)
	goodreadsQueryURL.searchParams.set('q', isbn)
	goodreadsQueryURL.searchParams.set('search_type', 'books') // construct full request URL for Goodreads website

	const bookPage = await request({ url: goodreadsQueryURL.href })
	const document = new DOMParser().parseFromString(bookPage, 'text/html') // turn requested webpage into DOM tree
	const $ = (selectors, attr) => document.querySelector(selectors)[attr].trim() // create shorthands for querySelector methods used to traverse DOM tree (mimics jQuery)
	const $$ = (selectors, attr) => new Set(Array.from(document.querySelectorAll(selectors), x => x[attr]))

	// array of metadata fields w/associated CSS selectors for Goodreads
	const goodreadsCSSelectors = [
		{ field: 'id', el: '#book_id', val: 'value' },
		{ field: 'title', el: 'h1#bookTitle', val: 'innerText' },
		{ field: 'authors', el: '#bookAuthors a.authorName span[itemprop=name]', qs: $$ },
		{ field: 'description', el: '#descriptionContainer #description span:last-of-type', val: 'innerHTML' },
		{ field: 'isbn13', el: "meta[property='books:isbn']", val: 'content' },
		{ field: 'isbn10', el: '#bookDataBox .clearFloats:nth-child(2) .infoBoxRowItem' },
		{
			field: 'categories',
			el: '.bigBoxContent.containerWithHeaderContent .elementList:nth-child(-n+5) a.actionLinkLite.bookPageGenreLink', // bookPageGenreLink:last-of-type
			qs: $$,
		},
		{ field: 'series', el: 'h2#bookSeries', val: 'innerText' }, //selector for h2 element whose ID-typed attribute has the value "bookSeries"
		{ field: 'seriesCount', el: '.seriesList .bigBoxContent.containerWithHeaderContent', val: 'innerText' },
		{ field: 'seriesURL', el: '.seriesList a', val: 'href' },
		{ field: 'ratingValue', el: '#bookMeta span[itemprop=ratingValue]' },
		{ field: 'ratingCount', el: '#bookMeta meta[itemprop=ratingCount]', val: 'content' },
		{ field: 'reviewCount', el: '#bookMeta meta[itemprop=reviewCount]', val: 'content' },
		{ field: 'imageLinks', el: '.bookCoverContainer img', val: 'src' },
		{ field: 'publishedDate', el: '#details .row:nth-child(2)' },
		{ field: 'publisher', el: '#details .row:nth-child(2)' },
		{ field: 'language', el: '#bookDataBox .clearFloats:nth-child(3) .infoBoxRowItem' },
		{ field: 'printType', el: '#details span[itemprop=bookFormat]' },
		{ field: 'pageCount', el: "meta[property='books:page_count']", val: 'content' },
		{ field: 'canonicalVolumeLink', el: "link[rel='canonical']", val: 'href' },
		//{ field: 'amznASIN', el: 'ul.buyButtonBar.left li a.glideButton.buttonBar', val: 'dataset' }, //dataset.asin
		//{ field: 'amznURL', el: 'ul.buyButtonBar.left a.glideButton.buttonBar', val: 'dataset.amazonUrl'},
	]

	// use the array 'reduce' method to loop through the CSS selectors array and assign results to a book metadata object
	const bookMData = goodreadsCSSelectors.reduce(
		(acc, { field, el, val = 'textContent', qs = $, fieldVal = qs(el, val) } = {}) => {
			fieldVal && (acc[field] = fieldVal)
			return acc
		},
		{}
	)
	return bookMData
}

// Formats string for our suggestion prompt; shows '📚' prefix if a book cover image is available or (📵) if not
let formatSuggestions = resultItem => {
	return `${resultItem.imageLinks ? '📚' : '📵'} ${resultItem.title} - ${resultItem.authors[0]} (${new Date(
		resultItem.publishedDate
	).getFullYear()})`
}

// convert a list into a wikilinks list separated by commas
let wikiLnkList = list => {
	if (list?.length === 0) return ' '
	if (list?.length === 1) return `[[${list[0]}]]`
	return Array.from(list, i => `[[${i.trim()}]]`)?.join(', ') ?? ' '
}
