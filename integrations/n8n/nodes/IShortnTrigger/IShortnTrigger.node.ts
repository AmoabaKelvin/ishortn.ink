import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { nextSeen, SEEN_LIMIT, takeNewLinks, type LinksPage } from './newLinks';

const PAGE_SIZE = 25;
// Bounds one poll to 1,000 links (for example after a large CSV import).
const MAX_PAGES = 40;

type TriggerState = { seen?: string[] };

async function fetchLinks(
	this: IPollFunctions,
	limit: number,
	cursor?: string,
): Promise<LinksPage> {
	const credentials = await this.getCredentials<{ baseUrl: string }>('iShortnApi');
	const domain = (this.getNodeParameter('domain', '') as string).trim();
	const qs: IDataObject = { limit };
	if (cursor) qs.cursor = cursor;
	if (domain) qs.domain = domain;

	return (await this.helpers.httpRequestWithAuthentication.call(this, 'iShortnApi', {
		method: 'GET',
		url: `${credentials.baseUrl.replace(/\/+$/, '')}/api/v1/links`,
		qs,
		json: true,
	})) as LinksPage;
}

export class IShortnTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'iShortn Trigger',
		name: 'iShortnTrigger',
		icon: { light: 'file:../../icons/ishortn.svg', dark: 'file:../../icons/ishortn.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{"New link"}}',
		description: 'Starts the workflow when a short link is created in iShortn',
		defaults: {
			name: 'iShortn Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'iShortnApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'New Link',
						value: 'newLink',
						description: 'A short link is created in your personal workspace',
					},
				],
				default: 'newLink',
			},
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				default: '',
				placeholder: 'isht.app',
				description:
					'Only watch links on this domain: a platform domain or an active custom domain. Leave empty to watch all of them.',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		// "Fetch Test Event" shows the newest link and leaves the stored state alone.
		if (this.getMode() === 'manual') {
			const { data } = await fetchLinks.call(this, 1);
			return data.length ? [this.helpers.returnJsonArray(data)] : null;
		}

		const state = this.getWorkflowStaticData('node') as TriggerState;

		// First poll after activation: remember what exists, emit nothing.
		if (!state.seen) {
			const { data } = await fetchLinks.call(this, SEEN_LIMIT);
			state.seen = data.map((link) => link.shortLink);
			return null;
		}

		const seen = new Set(state.seen);
		const found = [];
		let cursor: string | undefined;
		for (let page = 0; page < MAX_PAGES; page++) {
			const response = await fetchLinks.call(this, PAGE_SIZE, cursor);
			const { newLinks, reachedSeen } = takeNewLinks(response.data, seen);
			found.push(...newLinks);
			if (reachedSeen || !response.nextCursor) break;
			cursor = response.nextCursor;
		}

		if (!found.length) return null;
		state.seen = nextSeen(found, state.seen);
		// Oldest first, so the workflow handles links in the order they were created.
		return [this.helpers.returnJsonArray(found.reverse())];
	}
}
