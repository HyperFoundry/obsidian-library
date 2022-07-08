# Obsidian Library Builder Script (for QuickAdd plugin)

## Demo & Screenshots
Screenshots coming soon! Please refer to installation guide below

## 📰 Description
This script allows you to quickly search for books and build a book tracker/library in Obsidian. For use in conjunction with [Quickadd plugin](https://github.com/chhoumann/quickadd) by @chhoumann, search and create new book notes with a complete selection of metadata fields sourced from [Google Books API](https://developers.google.com/books/) (no API key needed!) and [Goodreads](https://www.goodreads.com/). 

I plan to add additional metadata sources such as: 
- Open Library API
- Amazon.com / Kindle
- New York Times Books API

I plan to add additional metadata fields & features:
- pricing details
- other book editions &  links to other book editions
- search by: print type (ie. book, ebook, kindle, etc.), publisher, lccn/oclc ID
- may turn this into a full fledged plugin 

---
## 🛠 Installation
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
## 📃 Available metadata fields:
Below are the possible fields to use in your book template. Simply write `{{VALUE:name}}` in your template, and replace `name` by the desired book data. Example field results are shown and the source used (src).

- `fileName`: "Book Title - Author Name" (ex: `The Way of Kings - Brandon Sanderson`) (src: Google)


**Titles:** 
- `title`: **Main Title** (the main title of the book) 
- `subTitle`: the subtitle of the book (also known as "title tag")
- `fullTitle`: a full title (combined main title & subtitle)

**Authors** (`[[wiklink]]` list of the book's authors separated by commas):
- `authors`: `[[author 1]]`, `[[author 2]]`, `[[author 3]]` 

**Abstract** (a brief description of the book, like the blurbs you would find on a book jacket) (src: Goodreads) :
- `abstract`: full descriptions 
- shorter descriptions are also available from google using `googleMData.description`

**Genres** (`[[wiklink]]` list of the book's top 5 genres separated by commas) (src: Goodreads):
- `genres`: `[[genre 1]]`, `[[genre 2]]`, `[[genre 3]]`, `[[genre 4]]`, `[[genre 5]]`

**Series** (`[[wikilink]]` of the book series w/book #, total books & URL link to series on Goodreads, if available)
- `series`: `[[The Stormlight Archive]] #1` (the series & book #)
- `seriesCount`: `(10 books)` (total # of books in the series)
- `seriesURL`: (link to book series on Goodreads)

**Rating details** (book's average rating (out of 5 stars), total # of ratings, and # of written reviews for the books on Goodreads)
- `avRating`: `4.63`
- `numRatings`: `3728327`
- `numReviews`: `26181`
- rating info from Google Books API available as: `avRatingGOOG`, `numRatingsGOOG`, but does not provide good data

**Publication Info**
- `pubDate`: `2010` (the **year** the book was published)
- `publisher`: `Tor Books` (the book's publishing company for the selection book edition)
- `format`: `Hardcover, Paperback, Audiobook, Kindle Edition, Ebook, Magazine` (the format of this book edition)
- `pages`: `823` (the total # pages in the book's print version)
- `language`: `English` (language of this book edition)
- `maturity`: `MATURE` or `NOT_MATURE` (whether the book is rated as mature or not)

**Book Cover Image** (the URL address of the book's cover image):
- `coverURL`: (~200-325px (WIDTH) / ~400-500px (HEIGHT) [72-300 dpi resolution]; src: Goodreads)
- `thumbnailURL`: ( ~128px (WIDTH) / ~200 pixels (HEIGHT) [20-22 dpi resolution]; src: Google) 

**Reference Links** (URLs to the book's main info page on the respective sites):
- `goodreadsURL`: `https://www.goodreads.com/book/show/7235533-the-way-of-kings`
- `googleURL`: `https://books.google.com/books/about/The_Way_of_Kings.html?hl=&id=kIjwwAEACAAJ`
- `amznURL`: `https://www.amazon.com/gp/product/B00540QR7Q`

**Identifiers / Unique IDs** (ISBN13, ISBN10, or the book's unique identifier for each respective site):
- `isbn13`: `9780765326355`
- `isbn10`: `0765326353`
- `goodreadsID`: `7235533`
- `googleID`: `kIjwwAEACAAJ`
- `amznASIN`: `B00540QR7Q`

**Personal Fields** (hashtag of your current status for the book):
- myStatus: `#toRead`, `#read`, `#reading`

---
## 📐 Book page template (example):
```markdown
---
Cover: {{VALUE:coverURL}}
ISBN13: {{VALUE:isbn13}}
ISBN10: {{VALUE:isbn10}}
Pages: {{VALUE:pages}}
Publication Year: {{VALUE:pubYear}}
Publisher: {{VALUE:publisher}}
Goodreads ID: {{VALUE:goodreadsID}}

---

# {{VALUE:fullTitle}}

Title:: {{VALUE:title}}
Subtitle:: {{VALUE:subTitle}}
Authors:: {{VALUE:authors}}
Series:: {{VALUE:series}}
Genres:: {{VALUE:genres}}
Abstract:: {{VALUE:abstract}}

Rating:: {{VALUE:avRating}}
Ratings:: {{VALUE:numRatings}}
Reviews:: {{VALUE:numReviews}}


## Reference Links:
Goodreads URL:: [Goodreads]({{VALUE:goodreadsURL}})
Google URL:: [Google]({{VALUE:googleURL}})
Amazon URL:: [Amazon]({{VALUE:amznURL}})


Date Added:: [[{{DATE:gggg-MM-DD}}]]
My Status:: {{VALUE:myStatus}}

#📚books

---

# My Highlights & Notes

```

## DataView query to render a gallery of your books (example):
```
```dataview
TABLE WITHOUT ID 
	("![](" + Cover + ")") AS Cover,
	Title AS Title,
	"by " + Authors AS Authors,
	Genres AS Genres,
	"Rating: " + Rating AS "Rating",
	"Date Added: " + Date Added AS "Date Added"
FROM #toRead AND "Library" AND #📚books AND -"_templates"
WHERE Cover != null
```


---
## 🚧 Disclaimer
👼 I am completely new to programming. I have tried to document the script thoroughly to help others understand it. I welcome any and all feedback! 

⚠ I am not responsible for any damage caused by the use of this script. 

**Please never run a script that you don't understand. Remember to make regular backups of your Obsidian's vault!**

## 🙏Acknowledgements 
 The script is inspired by [QuickAdd - Movie And Series Script](https://github.com/chhoumann/quickadd/blob/master/docs/Examples/Macro_MovieAndSeriesScript.md) by @chhoumann and the [QuickAdd - Books Script](https://github.com/Elaws/script_googleBooks_quickAdd) by @Elaws

