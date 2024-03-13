# podcast-downloader

This is a simple podcast downloader script. It fetches a podcast feed from a given URL, checks for new episodes, and downloads them to a local directory.

The script works by fetching the RSS feed of a specified podcast from a given URL. It parses the feed to identify new episodes, comparing them with the episodes that have already been downloaded and stored in a local directory. If new episodes are found, the script downloads them and saves them to the local directory.

This tool is aimed for podcast enthusiasts who want to automate the process of keeping their podcast library up-to-date. It can be run on a schedule, ensuring that you always have the latest episodes of your favorite podcasts ready to listen to.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts {{feedUrl}}
```

This project was created using `bun init` in bun v1.0.30. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
