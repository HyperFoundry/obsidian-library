const notice = msg => new Notice(msg, 6000)
const log = msg => console.log(msg)

// Declare our global variables; const means the variable cannot be reassigned
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

let QuickAdd, Settings

async function start(params, settings) {
	QuickAdd = params
	Settings = settings

	// Display a single-line prompt for user query entry (it can be book title, author, ISBN, etc). Throw an error if no input
	let query = await QuickAdd.quickAddApi.inputPrompt('📖 Search by any keywords (title, author, ISBN, etc.): ')
	if (!query) {
		notice('❗No query entered')
		throw new Error('No query entered')
	}

	// Declare the object variables where we will store the book metadata from our two sources. They are declared here because they will be used in either parts of the following if/else statement
	let googleMData, greadsMData

	/* This if/else statement first sends the user query to the isbnCheck() which returns either an extracted ISBN or the original user query (if no ISBN present).
	Whatever is returned is assigned to the reassignable query variable (becuase we declared it with 'let').
	Then the 'query' is evaluated by Number.isInteger() which is true if query is an ISBN (integer number) which executes if{}, 
	or false if query is a string which executes the else{} */
	if (Number.isInteger((query = isbnCheck(query)))) {
		/* if an ISBN is stored in 'query', we know the specific book the user is looking for and can therefore retrieve its metadata from our two sources in parallel
		Promise.allSettled() handles the promises from our asyncronous functions: requestAPIdata() & parseBookLink(), waitng for both to return
		The left side of eq. is an immediate destructuring assignment which assigns the data returned from requestAPIdata() to googleMData var & parseBookLink() to greadsMData var */
		;[googleMData, greadsMData] = await Promise.allSettled([requestAPIdata(`isbn:${query}`), parseBookLink(query)])

		/* A short-circuting operator && is used in lieu of an if/else statement, where the right side is assigned to our variable if the left side is truthy. 
		We reassign out variable to only keep the data we want, here the rest operator and destructuring our utilized */
		googleMData =
			googleMData.status === 'fulfilled' && (({ id, volumeInfo }) => ({ id, ...volumeInfo }))(googleMData.value[0])
		greadsMData = greadsMData.status === 'fulfilled' && greadsMData.value
	} else {
		// if user query has no ISBN identifier, the user's query is sent to the Google Books API, which returns the top 10 matches (default)
		const results = await requestAPIdata(query)
		/* Duplicate results that all refer to the same book are common (different publishers, publication years, editions, etc. can all have the same ISBN)
		To deduplicate the results, we use map() to iterate through the results and create a new array with the result's ISBN13 as a 'key', and extracted/destructured metadata as the 'value'
		A feature of Maps is that their keys must be unique, so by constructing a new Map() from the resulting array, the results are deduplicated by the ISBN13 keys we created.
		The Map is converted back into an array using the spread operator shorthand [...] keeping only the book metadata values by Map values() and assigned to uniqueResults */
		const uniqueResults = [
			...new Map(
				results.map(({ id, volumeInfo }) => [
					+volumeInfo.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier,
					{ id, ...volumeInfo },
				])
			).values(),
		]
		// Prompt user with list of unique book results to choose from and save that book's metadata to googleMData. Throw an error if no book is selected
		googleMData = await QuickAdd.quickAddApi.suggester(uniqueResults.map(formatSuggestions), uniqueResults)
		if (!googleMData) {
			notice('❗No choice selected')
			throw new Error('No choice selected')
		}
		// Extract the user's selected book's ISBN which allows us to target the book's page on Goodreads
		const isbn13 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier
		const isbn10 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_10')?.identifier
		greadsMData = await parseBookLink(isbn13 || isbn10)
	}

	// Assign our collected metadata to user friendly variables for use in their personalized templates
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
		thumbnailURL: `${googleMData.imageLinks?.thumbnail}`?.replace(/^http:/, 'https:') ?? ' ',

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
			['📚 To Read', '📗 Completed Reading', '📖 Currently Reading'],
			['#toRead', '#read', '#reading']
		),
	}
}

let isbnCheck = str => {
	const ISBN_PREFIX_REGEX = /(?:\bISBN[- ]?(1[03])?[-: ]*)?/gi // REGEX; ISBN identifier prefix
	const ISBN_REGEX = /(97[89])?[\dX]{10}$|(?=(?:(\d+?[- ]){3,4}))([\dX](?:[- ])*?){10}(([\dX](?:[- ])*?){3})?$/g // REGEX; for ISBN-10/13 taking into account spaces or dashes
	const ILLEGAL_CHAR_REGEX = /[\\,#%&!?\{\}\/*<>`$\'\":@.*]/g // REGEX; common illegal characters for API queries

	if (!ISBN_PREFIX_REGEX.test(str) || !ISBN_REGEX.test(str)) return str.trim().replace(ILLEGAL_CHAR_REGEX, '') // if no ISBN REGEX matches, clean up user's query, and return
	return +str.match(ISBN_REGEX)[0].replaceAll(/[- ]/g, '') // else, use ISBN_REGEX to extract ISBN, remove dashes/spaces, and return 10/13 char number
}

let requestAPIdata = async query => {
	let constructURL = new URL(GOOG_API_URL)
	constructURL.searchParams.set('q', query) // Construct full query URL for Google books API
	const googleQueryURL = decodeURIComponent(constructURL.href) // DecodeURI necessary so symbols in URL like ':' are not malformed in http request

	// Request URL using HTTP/HTTPS, without any CORS restrictions (similar to fetch())
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
	if (list?.size === 0) return ' '
	if (list?.size === 1) return `[[${list[0]}]]`
	return Array.from(list, i => `[[${i.trim()}]]`)?.join(', ') ?? ' '
}
