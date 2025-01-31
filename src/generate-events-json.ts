import { readdirSync } from 'fs';

import { paths } from './utils/config.js';
import { getDedupedJSON } from './utils/chat-gpt.js';
import { isEventRecent } from './utils/date-utils.js';
import {
    getHash,
    getEventsJSONHash,
    getJSONFixture,
    saveEventsJSON,
    stringifyJSON,
} from './utils/utils.js';
import logger from './utils/log-utils.js';

function getFixtureDirectoryNames() {
    try {
        const directoryEntries = readdirSync(paths.fixtures, {
            withFileTypes: true,
        });
        const directoryNames = directoryEntries
            .filter((entry) => entry.isDirectory())
            .map((directory) => directory.name)
            .sort(
                (a, b) =>
                    parseInt(b.split('_')[0], 10) -
                    parseInt(a.split('_')[0], 10),
            );
        return directoryNames;
    } catch (error) {
        logger.error('Error reading the fixtures directory:', error);
        return [];
    }
}

// Merge all event fixtures into one array
function mergeEventFixtures(directoryNames) {
    const events = directoryNames.reduce((acc, directoryName) => {
        const fixtureEvents = getJSONFixture(directoryName).events;
        const recentEvents = fixtureEvents.filter(isEventRecent);
        return [...acc, ...recentEvents];
    }, []);

    // Sort events based on the start date in descending order (newest first)
    const sortedEvents = events.sort((a, b) => {
        const aStartDate = a.dates && a.dates[0] ? a.dates[0].start : '';
        const bStartDate = b.dates && b.dates[0] ? b.dates[0].start : '';
        // Sorts in descending order
        return bStartDate.localeCompare(aStartDate);
    });

    return {
        events: sortedEvents,
    };
}

async function generateEventsJSON() {
    logger.info('Generating events.json');
    const directoryNames = getFixtureDirectoryNames();
    const mergedEvents = mergeEventFixtures(directoryNames);
    logger.info('mergedEvents', mergedEvents);
    saveEventsJSON(mergedEvents);

    // Get a hash of the merged events
    const mergedEventsString = stringifyJSON(mergedEvents);
    const mergedEventsHash = getHash(mergedEventsString);

    // Get the current deduped events list
    const currentEventsHash = getEventsJSONHash();
    if (currentEventsHash === mergedEventsHash) {
        logger.info('events.json is already up to date');
        return;
    }

    logger.info('Deduping events.json');
    const dedupedJSON = await getDedupedJSON(mergedEvents, true);
    // Add hash from the merged events
    dedupedJSON.hash = mergedEventsHash;
    logger.info('dedupedJSON', dedupedJSON);
    saveEventsJSON(dedupedJSON, false);
}

generateEventsJSON();
