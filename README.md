# QuickAdd script for adding books to your Obsidian vault

## Demo
**Demo & Screenshots coming soon!**

## Description
This script allows you to quickly create & add a book note with complete metadata fields to your Obsidian vault using [Quickadd plugin](https://github.com/chhoumann/quickadd) by @chhoumann.

Metadata is sourced from the [Google Books API](https://developers.google.com/books/) (no API key needed!) and [Goodreads](https://www.goodreads.com/). I plan to add additional sources such as: Open Library API, Amazon.com / Kindle, New York Times Books API

---
## Disclaimer
I am new to programming. I welcome any and all feedback. I am not responsible for any damage caused by the use of this script. I have commented the script thoroughly to help others understand it.

The script is inspired by [QuickAdd - Movie And Series Script](https://github.com/chhoumann/quickadd/blob/master/docs/Examples/Macro_MovieAndSeriesScript.md) by @chhoumann and the [QuickAdd - Books Script](https://github.com/Elaws/script_googleBooks_quickAdd) by @Elaws

**Please never run a script that you don't understand. Remember to make regular backups of your Obsidian's vault!**

---
## Installation
**Requirement:**
- the latest version of [QuickAdd (v. 0.5.5)](https://github.com/chhoumann/quickadd) for Obsidian 

1. Save the [script](https://github.com/HyperFoundry/obsidian-library/blob/main/books.js) to your vault. Make sure it is saved as a JavaScript file, meaning that it has the `.js` extension at the end
2. Save my example [book template](https://github.com/HyperFoundry/obsidian-library/blob/main/Book_ExTemplate.md) to your vault, or create your own book template in vault. An example template is also provided below
3. Go into your Obsidian settings > QuickAdd plugin > Manage Macros 
	1. within `Macro name` type your macro name (example: Lookup Book) > *click* "Add Macro"
6. Under your new macro, *click* "Configure"
	1. within `User scripts` type/select the script you saved in Step 1
	2. *click* Template, which adds a Template command > *click* '⚙ (gear icon)'
		1. within `Template Path`, point to the example book template you saved in Step 2 or the new book template you created
		2. recommended to set a folder to store all your book entires
7.  Exit all the windows until you are back in the main QuickAdd settings menu
	1. within `Name`, type a name for your QuickAdd macro (example: Add Book)
	2. in the dropdown list, *select* "Macro", *click* Add Choice
8. *Click* the ⚙ (gear icon) for your new Macro, and attach the macro you created in Step 3.1 (ie. Lookup Book)
9. *Click* the ⚡so that its highlighted which adds the Macro to your command palette
10. *Optional:* Assign a hotkey to your macro for quicker access

**Great! You can now use the macro to quick create a new book note to add book information to your vault!**

---
## Book page template (Example):
```markdown
---
Cover: {{VALUE:coverURLGR}}
ISBN13: {{VALUE:isbn13}}
ISBN10: {{VALUE:isbn10}}
Pages: {{VALUE:pageCtGR}}
Goodreads ID: {{VALUE:goodreadsID}}
Amazon ASIN: {{VALUE:amazonASIN}}

---

# {{VALUE:fullTitleGOOG}}

Title:: {{VALUE:titleGOOG}}
Subtitle:: {{VALUE:subTitleGOOG}}
Authors:: {{VALUE:authorsGOOG}}
Publication Year:: {{VALUE:pubYearGOOG}}
Series:: {{VALUE:seriesGR}}
Genres:: {{VALUE:genresGR}}
Abstract:: {{VALUE:abstractGR}}

Rating:: {{VALUE:avRatingGR}}
Total Ratings:: {{VALUE:numRatingsGR}}
Goodreads Reviews:: {{VALUE:numReviewsGR}}

## Book Links:
Amazon URL:: [Amazon]({{VALUE:amazonURL}})
Goodreads URL:: [Goodreads]({{VALUE:bookURLGR}})
Google URL:: [Google]({{VALUE:bookURLGOOG}})

Date Added:: [[{{DATE:gggg-MM-DD}}]]
#📚books {{VALUE:#want-to-read,#currently-reading,#read}}

---

# My Highlights & Notes

```

## Dataview query for Gallery rendering (Example):
```
```dataview
TABLE WITHOUT ID 
	("![](" + Cover + ")") AS Cover,
	Title AS Title,
	"by " + Authors AS Authors,
	Genre AS Genre,
	"Rating: " + Rating AS "Rating",
	"Date Added: " + Date Added AS "Date Added"
FROM #to-read AND "Library" AND #📚books AND -"_templates"
WHERE Cover != null
```
---
## Metadata fields available for your book template:
Below are the possible fields to use in your book template. Simply write `{{VALUE:name}}` in your template, and replace `name` by the desired book data. Example field results are presented in [ ] and the source (src) of the field is presented in ( ).

**Main Title** (the main title of the book):
- `titleGOOG`: (src: Google)
- `titleGR`: (src: Goodreads)

- `subTitleGOOG`: the subtitle of the book (also known as "title tag") (src: Google)
- `fullTitleGOOG`: a full title (combined main title & subtitle) (src: Google)

**Authors** (a `[[wiklink]]` list of the book's authors):
- `authorsGOOG`: `[[author 1]], [[author 2]], [[author 3]]` (src: Google) 
- `authorsGR`: `[[author 1]], [[author 2]], [[author 3]]` (src: Goodreads)  

**Genres** (a `[[wiklink]]` list of the book's top 4 genres):
- `genresGOOG`: `[[genre 1]], [[genre 2]], [[genre 3]], [[genre 4]]` (src: Google)
- `genresGR`: `[[genre 1]], [[genre 2]], [[genre 3]], [[genre 4]]`  (src: Goodreads) > *recommended*

**Abstract** (a brief description of the book, like the blurbs you would find on a book jacket):
- `abstractGOOG`: `[shorter descriptions]` (src: Google)
- `abstractGR`: `[full, longer descriptions]` (src: Goodreads)

**Rating (value)** (the book's average rating (out of 5 stars) on the respective sites):
- `avRatingGOOG`: `[4]` (src: Google)
- `avRatingGR`: `[4.63]` (src: Goodreads) > *recommended*

**Number of Ratings** (the # of ratings for the average rating value):
- `numRatingsGOOG`: `[1123]` (src: Google)
- `numRatingsGR`: `[3728327]` (src: Goodreads) > *recommended*

- `numReviewsGR`: `[26181]` # of written reviews for the books on Goodreads

**Book Cover Image** (the URL address of the book's cover image from the respective sites):
- `coverURLGOOG`: `[http://books.google.com/books/content?id=kIjwwAEACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api]` (src: Google)
- `coverURLGR`: `[https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1388184640l/7235533.jpg]` (src: Goodreads) > *recommended* (higher quality)

**Book URL** (the URL address to the book's main page on the respective sites):
- `googleURL`: `[https://books.google.com/books/about/The_Way_of_Kings.html?hl=&id=kIjwwAEACAAJ]`(src: Google)
- `goodreadsURL`: `[https://www.goodreads.com/book/show/7235533-the-way-of-kings]` (src: Goodreads)
- `amazonURL`: `[https://www.amazon.com/gp/product/B00540QR7Q]` (src: Goodreads)

**Book Format** (the format of the particular book you selected):
- `bkFormGOOG`: `[BOOK] or [MAGAZINE]`(src: Google)
- `bkFormGR`: `[hardcover, paperback, audiobook, kindle edition, ebook, etc.]` (src: Goodreads) > *recommended*

**Page Count** (the total # pages in the book's print version):
- `pageCtGOOG`: `[1008]` (src: Google)
- `pageCtGR`: `[1008]`(src: Goodreads)

**Language** (the language of the book you selected):
- `langGOOG`: `[en]` (src: Google)
- `langGR`: `[English]` (src: Goodreads)

**ISBN** (ISBN10 & ISBN13 of the book):
- `isbn13`: `[9780765326355]` (src: Google)
- `isbn10`: `[0765326353]` (src: Google)
- `isbn13GR`: `[9780765326355]` (src: Goodreads)
- `isbn10GR`: `[0765326353]` (src: Goodreads)

**Unique IDs** (the book's unique identifier for each respective site):
- `googleID`: `[kIjwwAEACAAJ]` (src: Google)
- `goodreadsID`: `[7235533]` (src: Goodreads)
- `amazonASIN`: `[B00540QR7Q]` (src: Goodreads)

**Other**:
- `publisherGOOG`: `[Tor Books]` the book's publishing company (src: Google)
- `pubYearGOOG`: `[2010]` the year the book was published (src: Google)
- `seriesGR`: `[The Stormlight Archive #1]` the series & book # (if available) (src: Goodreads)
- `maturityGOOG`: `[MATURE] or [NOT_MATURE]` whether the book is rated as mature or not (src: Google)

