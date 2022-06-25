const notice = msg => new Notice(msg, 5000)
const log = msg => console.log(msg)

// Google Books does not require an API key for book queries (https://developers.google.com/books/docs/v1/using#PerformingSearch)
const GOOG_API_URL = 'https://www.googleapis.com/books/v1/volumes'
const GOODREADS_SEARCH_URL = 'https://www.goodreads.com/search?'

module.exports = {
	entry: start,
	settings: {
		name: 'Books Metadata Fetcher',
		author: 'HyperFoundry',
	},
}

let QuickAdd
let Settings

async function start(params, settings) {
	QuickAdd = params
	Settings = settings

	var query = await QuickAdd.quickAddApi.inputPrompt(
		// prompt for search terms; can be book title, author, ISBN, etc.
		'📖 Search by any keywords (title, author, ISBN, etc.): '
	)
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
		;[googleMData, greadsMData] = await Promise.allSettled([
			fetchAPIdata(query.isbnQuery),
			scrapeBookData(query.isbnID),
		])

		googleMData =
			googleMData.status === 'fulfilled' && (({ id, volumeInfo }) => ({ id, ...volumeInfo }))(googleMData.value[0]) // checks if fetch was successful, then destructures object to the values we want
		greadsMData = greadsMData.status === 'fulfilled' && greadsMData.value
	} else {
		const options = await fetchAPIdata(query) // if user query has no ISBN identifying info, sent query to Google Books API

		// deduplicate the search results using ISBN13 #s as comparison & a key
		const uniqueOptions = [
			...new Map(
				options.map(a => [
					JSON.stringify(a.volumeInfo.industryIdentifiers.find(e => e.type === 'ISBN_13').identifier),
					a,
				])
			).values(),
		]

		// provide user with list of options returned by Google Books API
		let selectedBook = await QuickAdd.quickAddApi.suggester(uniqueOptions.map(formatSuggestions), uniqueOptions)
		if (!selectedBook) {
			notice('❗No choice selected')
			throw new Error('No choice selected')
		}
		googleMData = selectedBook.volumeInfo // save the user's selected book
		const isbn13 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_13')?.identifier // extract ISBNs from Google Book Metadata
		const isbn10 = googleMData.industryIdentifiers.find(n => n.type === 'ISBN_10')?.identifier
		greadsMData = await scrapeBookData(isbn13 || isbn10) // for the ISBN; scrape the corresponding Goodreads books page
	}

	QuickAdd.variables = {
		...googleMData,
		...greadsMData,

		fileName: `${googleMData.title} - ${googleMData.authors}`,

		// GOOGLE Metadata categories gathered from Google Books API
		titleGOOG: googleMData.title,
		subTitleGOOG: `${googleMData.subtitle}` || ' ',
		fullTitleGOOG: `${googleMData.subtitle ? `${googleMData.title}: ${googleMData.subtitle}` : googleMData.title}`,
		authorsGOOG: wikiLnkList(googleMData.authors),
		genresGOOG: wikiLnkList(googleMData.categories),
		abstractGOOG: googleMData.description,
		publisherGOOG: googleMData.publisher,
		pubYearGOOG: googleMData.publishedDate ? new Date(googleMData.publishedDate).getFullYear() : ' ',
		pageCtGOOG: googleMData.pageCount || googleMData.printedPageCount,
		avRatingGOOG: googleMData.averageRating,
		numRatingsGOOG: googleMData.ratingsCount,
		bkFormGOOG: googleMData.printType,
		langGOOG: googleMData.language,
		coverURLGOOG: `${googleMData.imageLinks?.thumbnail}`?.replace('http:', 'https:') || ' ',
		googleURL: googleMData.canonicalVolumeLink,
		maturityGOOG: googleMData.maturityRating,

		// GOODREADS Metadata categories scraped from book page (with better/cleaner data than Google)
		titleGR: greadsMData.title,
		authorsGR: wikiLnkList(greadsMData.authors),
		genresGR: wikiLnkList(greadsMData.genres),
		seriesGR: greadsMData.series,
		abstractGR: greadsMData.abstract,
		isbn13GR: greadsMData.isbn13,
		isbn10GR: greadsMData.isbn10,
		pageCtGR: greadsMData.pageCount,
		avRatingGR: greadsMData.ratingValue,
		numRatingsGR: greadsMData.numRatings,
		numReviewsGR: greadsMData.numReviews,
		bkFormGR: greadsMData.bookFormat,
		langGR: greadsMData.language,
		coverURLGR: greadsMData.coverURL,
		goodreadsURL: `${greadsMData.goodreadsURL}`.replace(/^app:\/\/obsidian.md/gm, 'https://www.goodreads.com'),
		pubYearGR: greadsMData.pubYear,
		publisherGR: greadsMData.publisher,
		goodreadsID: greadsMData.goodreadsID,
		amazonASIN: greadsMData.amazonASIN,
		amazonURL: `${greadsMData.amazonASIN !== " " && `https://www.amazon.com/gp/product/${greadsMData.amazonASIN}`}`,
	}
}

let isbnCheck = str => {
	const isbnPre = /(?:\bISBN[- ]?(1[03])?[-: ]*)?/gi // REGEX; ISBN identifier prefix
	const isbnNum = /(97[89])?[\dX]{10}$|(?=(?:(\d+?[- ]){3,4}))([\dX](?:[- ])*?){10}(([\dX](?:[- ])*?){3})?$/g // REGEX; look for ISBN-10/13 taking into account spaces or dashes

	if (!isbnPre.test(str) || !isbnNum.test(str)) return str // if no REGEX matches, return the original query
	let isbnID = str.match(isbnNum)[0].replaceAll(/[- ]/g, '') // else, extract ISBN using the regex & clean up so its only numbers
	return { isbnQuery: `isbn:${isbnID}`, isbnID } // return modified query value for Google books API, and extracted ISBN to scrape its specific Goodread's page
}

let fetchAPIdata = async query => {
	let constructURL = new URL(GOOG_API_URL)
	constructURL.searchParams.set('q', query) // construct full query URL for Google books API
	const googleQueryURL = decodeURIComponent(constructURL.href) // decodeURI necessary so symbols in URL like ':' are not malformed in http request

	try {
		const response = await request({
			url: googleQueryURL,
			cache: 'no-cache',
		})
		const results = await JSON.parse(response)
		return await results.items
	} catch (error) {
		if (results.totalItems === 0) {
			notice('🤷‍♂️ No results found')
			throw new Error('No results found')
		} else {
			notice('🚨 Request failed')
			throw new Error('Request failed')
		}
	}
}

let scrapeBookData = async (isbn) => {
	let goodreadsQueryURL = new URL(GOODREADS_SEARCH_URL)
	goodreadsQueryURL.searchParams.set('q', isbn)
	goodreadsQueryURL.searchParams.set('search_type', 'books') // construct full request URL for Goodreads website

	const bookPage = await request({ url: goodreadsQueryURL.href })
	const document = new DOMParser().parseFromString(bookPage, 'text/html') // turn requested webpage into DOM tree
	const $ = s => document.querySelector(s)
	const $$ = a => document.querySelectorAll(a)

  		// create goodreads book object
	let goodreadsBook = {
		title:
			$('h1#bookTitle').textContent.trim() ||
			$('div#bookDataBox div.clearFloats:nth-child(1) div.infoBoxRowItem').textContent.trim(),
		series: $('h2#bookSeries').textContent.trim().slice(1, -1), // selector for h2 element whose ID-typed attribute has the value "bookSeries"
		authors: [...$$('div#bookAuthors a.authorName span[itemprop=name]')].map(x => x.textContent),
		genres: [...$$('div.bigBoxContent.containerWithHeaderContent div.elementList:nth-child(-n+4) a.actionLinkLite.bookPageGenreLink:last-of-type'),
		].map(x => x.textContent), // Gets top 4 genres
		ratingValue: $('div#bookMeta span[itemprop=ratingValue]').textContent.trim(),
		numRatings: $('div#bookMeta meta[itemprop=ratingCount]').content,
		numReviews: $('div#bookMeta meta[itemprop=reviewCount]').content,
		coverURL: $(
			'div.bookCoverContainer div.bookCoverPrimary img#coverImage' || 'div.bookCoverContainer div.editionCover img'
		).src,
		abstract: $('div#descriptionContainer div#description span:last-of-type').innerHTML,
		bookFormat: $('div#details span[itemprop=bookFormat]').textContent,
		pageCount:
			$("meta[property='books:page_count']").content ||
			$('div#details span[itemprop=numberOfPages]').textContent.match(/^\d+\b/g)[0],
		isbn13:
			$("meta[property='books:isbn']").content ||
			$('div#bookDataBox div.infoBoxRowItem span[itemprop=isbn]').textContent,
		goodreadsID: $('div.wtrUp #book_id').value,
		goodreadsURL: $('a.bookLink').href || $("meta[property='og:url']").content,
		isbn10:
			$('div#bookDataBox div.clearFloats:nth-child(2) div.infoBoxRowItem').textContent.match(/\b\d{10}\b/g)[0] ?? ' ',
		language: $('div#bookDataBox div.clearFloats:nth-child(3) div.infoBoxRowItem').textContent.trim() ?? ' ',
		pubYear: $('div#details div.row:nth-child(2)').textContent.match(
			/(?:Published\n\s*\b)(?:\w)+ (?:\d+\w+) (\d{4})/im
		)[1],
		amazonASIN: $('ul.buyButtonBar.left li a.glideButton.buttonBar')?.dataset.asin ?? ' ',
		publisher: $('div#details div.row:nth-child(2)').textContent.match(/(?:by) (\w.*)$/im)[1],
	}
	return goodreadsBook
}

// Suggestion prompt shows '📚' prefix if a book cover image is available or (📵) if not
// Also displays: Book title, author, publication year, and ISBNs
function formatSuggestions(resultItem) {
	return `${resultItem.volumeInfo.imageLinks ? '📚' : '📵'} ${resultItem.volumeInfo.title} - ${
		resultItem.volumeInfo.authors ? resultItem.volumeInfo.authors[0] : ''
	} (${new Date(resultItem.volumeInfo.publishedDate).getFullYear()})
	ISBN: ${resultItem.volumeInfo.industryIdentifiers.find(element => element.type === 'ISBN_10')?.identifier} (ISBN13: ${
		resultItem.volumeInfo.industryIdentifiers.find(element => element.type === 'ISBN_13')?.identifier
	})`
}

function wikiLnkList(list) {
	// make multiple entries like author & genre into a wikilinks list
	if (list.length === 0) return ''
	if (list.length === 1) return `[[${list[0]}]]`
	return list.map(item => `[[${item.trim()}]]`).join(', ')
}
