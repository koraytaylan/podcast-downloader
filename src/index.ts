import { chunk } from 'lodash'
import * as cheerio from 'cheerio'
import slugify from 'slugify'

const BATCH_SIZE = 20

interface Item {
	title: string
	date: number
	url: string
	size: number
}

interface Feed {
	channelTitle: string
	items: Item[]
}

/**
 * Fetches and parses an RSS feed from a given URL.
 * @returns A Promise that resolves to a Feed object containing the channel title and a list of valid items.
 */
const fetchFeed = async (feedUrl: string): Promise<Feed> => {
	const response = await fetch(feedUrl)
	const xml = await response.text()
	const $ = cheerio.load(xml, { xml: true }, false)
	const items: Item[] = $('item')
		.map((_i, el) => {
			return {
				title: $(el).find('title').text() || '',
				date: Date.parse($(el).find('pubDate').text()) || 0,
				url: $(el).find('enclosure').attr('url') || '',
				size: Number.parseInt($(el).find('enclosure').attr('length') || '0'),
			}
		})
		.get()

	// filter out items that don't have a url or title or a date
	const validItems = items.filter((item) => item.url && item.title && item.date)
	// sort items by date ascending
	validItems.sort((a, b) => a.date - b.date)
	const channelTitle = $('channel').children('title').text() || 'Untitled Podcast'
	const feed: Feed = {
		channelTitle,
		items: validItems,
	}

	return feed
}

/**
 * Converts a given file name into a slug format.
 * Replaces all occurrences of '-' with ' ' and applies slugify transformation.
 *
 * @param fileName - The original file name to be slugified.
 * @returns The slugified file name.
 */
const slugifyFileName = (fileName: string) => {
	return slugify(fileName.replaceAll('-', ' '), {
		replacement: ' ',
		strict: true,
		locale: 'en',
	})
}

/**
 * Builds a file name based on the provided feed and item.
 * @param {Feed} feed - The feed object.
 * @param {Item} item - The item object.
 * @returns {string} The generated file name.
 */
const buildFileName = (feed: Feed, item: Item) => {
	return `${slugifyFileName(feed.channelTitle)} ${new Date(item.date).toISOString().split('T')[0]} ${slugifyFileName(item.title)}`
}

/**
 * Builds the file path for a podcast episode based on the feed and item information.
 * The file path is constructed using the channel title, the slugified file name, and the ".mp3" extension.
 *
 * @param {Feed} feed - The podcast feed object.
 * @param {Item} item - The podcast episode object.
 * @returns {string} The file path for the podcast episode.
 */
const buildFilePath = (feed: Feed, item: Item) => {
	return `./podcasts/${slugifyFileName(feed.channelTitle)}/${buildFileName(feed, item)}.mp3`
}

/**
 * Downloads an item from a podcast feed.
 * @param item - The item to download.
 */
const downloadItem = async (feed: Feed, item: Item) => {
	const filePath = buildFilePath(feed, item)
	const response = await fetch(item.url)
	await Bun.write(filePath, response, {
		createPath: true,
	})
	console.log(`Downloaded ${item.title}`)
}

/**
 * Calculates the similarity between two numbers.
 * The similarity is a value between 0 and 1, where 0 indicates no similarity and 1 indicates perfect similarity.
 *
 * @param {number} num1 - The first number.
 * @param {number} num2 - The second number.
 * @returns {number} The similarity between the two numbers.
 */
const similarity = (a: number, b: number) => {
	return 1 - Math.abs(a - b) / (a + b)
}

/**
 * Checks if an item has already been downloaded by comparing its content size with the size of the existing file.
 * @param {Feed} feed - The feed object.
 * @param {Item} item - The item object.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the item has already been downloaded.
 */
const checkIfAlreadyDownloaded = async (feed: Feed, item: Item) => {
	const filePath = buildFilePath(feed, item)
	const file = Bun.file(filePath)
	const fileExists = await file.exists()
	if (!fileExists) {
		return false
	}
	if (similarity(file.size, item.size) < 0.98) {
		console.log(file.size, item.size, similarity(file.size, item.size))
	}
	return similarity(file.size, item.size) >= 0.98
}

/**
 * Filters out existing items from the given feed and returns an array of missing items.
 *
 * @param feed - The feed to filter.
 * @returns A promise that resolves to an array of missing items.
 */
const filterExistingItems = async (feed: Feed): Promise<Item[]> => {
	const missingItems: Item[] = []
	const chunks = chunk(feed.items, BATCH_SIZE)
	for (const chunk of chunks) {
		await Promise.all(
			chunk.map(async (item) => {
				const downloaded = await checkIfAlreadyDownloaded(feed, item)
				if (downloaded) {
					return
				}
				missingItems.push(item)
			}),
		)
	}
	return missingItems
}

/**
 * Downloads podcast episodes from the given feed URL.
 *
 * @param feedUrl - The URL of the podcast feed.
 */
const downloadPodcast = async (feedUrl: string) => {
	const feed = await fetchFeed(feedUrl)
	console.log(`Fetched ${feed.items.length} items from ${feed.channelTitle}`)
	const missingItems = await filterExistingItems(feed)
	console.log(`Found ${missingItems.length} missing items.`)
	for (const item of missingItems) {
		console.log(`Processing ${item.title}. ${missingItems.indexOf(item) + 1} of ${missingItems.length}`)
		await downloadItem(feed, item)
	}
}

// Get the feed URL from the command line arguments
const feedUrl = process.argv[2]

if (!feedUrl) {
	console.log('Please provide a feed URL as a command line argument.')
	process.exit(1)
}

// Call the function with the feed URL
downloadPodcast(feedUrl)
