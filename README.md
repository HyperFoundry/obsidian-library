# QuickAdd script for adding books to your Obsidian vault

## Demo
**Demo & Screenshots coming soon!**

## Description
This script allows you to easily add a book note with a wide range of metadata fields to your Obsidian vault using [Quickadd plugin](https://github.com/chhoumann/quickadd) by @chhoumann.

The script queries the [Google Books API](https://developers.google.com/books/) (no API key needed!) and scrapes [Goodreads](https://www.goodreads.com/) for metadata related to your book.

---
## Disclaimer
I am new to programming. I welcome any and all feedback. I am not responsible for any damage caused by the use of this script. I have commented the script thoroughly to help others understand it.

The script is inspired by [QuickAdd - Movie And Series Script](https://github.com/chhoumann/quickadd/blob/master/docs/Examples/Macro_MovieAndSeriesScript.md) by @chhoumann and the [QuickAdd - Books Script](https://github.com/Elaws/script_googleBooks_quickAdd) by @Elaws

**Please never run a script that you don't understand. Remember to make regular backups of your Obsidian's vault!**

---
## Installation
**Requirement:**
- the latest version of [QuickAdd](https://github.com/chhoumann/quickadd) for Obsidian (v. 0.5.5)

1. Save the [script](https://github.com/HyperFoundry/obsidian-library/blob/main/books.js) to your vault. Make sure it is saved as a JavaScript file, meaning that it has the `.js` extension at the end
2. Save my example book template to your vault, or create your own book template in vault. An example template is also provided below
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
ISBN13: {{VALUE:isbn13GR}}
ISBN10: {{VALUE:isbn10GR}}
Pages: {{VALUE:pageCtGR}}
Goodreads ID: {{VALUE:bookIDGR}}

---

# {{VALUE:fullTitleGOOG}}

Title:: {{VALUE:titleGOOG}}
Subtitle:: {{VALUE:subTitleGOOG}}
Authors:: {{VALUE:authorsGOOG}}
Publication Year:: {{VALUE:pubYearGOOG}}
Series:: {{VALUE:seriesGR}}
Genres:: {{VALUE:genresGR}}
Abstract:: {{VALUE:abstractGR}}

Rating:: {{VALUE:ratingGR}}
Total Ratings:: {{VALUE:numRatingsGR}}
Goodreads Reviews:: {{VALUE:numReviewsGR}}

## Book Links: 
Google URL:: [Google]({{VALUE:bookURLGOOG}})
Goodreads URL:: [Goodreads]({{VALUE:bookURLGR}})

Date Added:: [[{{DATE:gggg-MM-DD}}]]
#📚books {{VALUE:#to-read,#finished-reading}}

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
## Available Variables for your book template:
Below are the possible variables to use in your template. Simply write `{{VALUE:name}}` in your template, and replace `name` by the desired book data, including:

**Main Title** (the main title of the book):
- `titleGOOG` : (source: Google)
- `titleGR` : (source: Goodreads)

- `subTitleGOOG` : The subtitle of the book (also known as "title tag") (source: Google)
- `fullTitleGOOG` : A full title (combined main title & subtitle) (source: Google)

**Authors** (a list of the book's authors):
- `authorsGOOG` : (source: Google)
- `authorsGR` : (source: Goodreads)

**Genres** (a list of the book's genres):
- `genresGOOG` : (source: Google)
- `genresGR` : (source: Goodreads) > *recommended*

**Abstract** (a brief description of the book, like the blub you would find on a book jacket):
- `abstractGOOG` : (source: Google) > shorter descriptions 
- `abstractGR` : (source: Goodreads) > full, longer descriptions

**Rating (value)** (the book rating out of 5 stars on the respective websites):
- `ratingGOOG` : (source: Google) 
- `ratingGR` : (source: Goodreads) > *recommended*

**Number of Ratings** (the total # of ratings that make up the above rating value):
- `numRatingsGOOG` : (source: Google)
- `numRatingsGR` : (source: Goodreads) > *recommended*

- `numReviewsGR` : total # of written reviews on Goodreads

**Book Cover Image** (the URL address of the book's cover image from the respective sites):
- `coverURLGOOG` : (source: Google)
- `coverURLGR` : (source: Goodreads) > *recommended* (higher quality)

**Book URL** (the URL address to the book's info page on the respective sites):
- `bookURLGOOG` : (source: Google)
- `bookURLGR` : (source: Goodreads)

**Book Format** (the format of the book you selected (ie. hardcover, paperback, kindle, audiobook, etc.)):
- `bookFormGOOG` : (source: Google)
- `bookFormGR` : (source: Goodreads)

**Page Count** (the total pages in the print book version):
- `pageCtGOOG` : (source: Google)
- `pageCtGR` : (source: Goodreads)

**Language** (the language of the book you selected):
- `langGOOG` : (source: Google)
- `langGR` : (source: Goodreads)

**ISBN** (the ISBN10 & ISBN13 of the book):
- `isbn13GR` : (source: Goodreads)
- `isbn10GR` : (source: Goodreads)

- `publisherGOOG` : The book's publisher (source: Google)
- `pubYearGOOG` : The year the book was published (source: Google)
- `seriesGR` : The series the book in part of (source: Goodreads)
- `bookIDGR` : The unique Goodreads ID for the book (source: Goodreads)

