import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

import { aliasField, aliasPath, domainField, toApiDate } from '../shared';

const linkUrl = aliasPath('links');

const showFor = (operation: string[]) => ({ resource: ['link'], operation });

const expiresAtField: INodeProperties = {
	displayName: 'Expires At',
	name: 'expiresAt',
	type: 'dateTime',
	default: '',
	description: 'When the link stops redirecting',
	routing: { send: { type: 'body', property: 'expiresAt', value: toApiDate } },
};

const activatesAtField: INodeProperties = {
	displayName: 'Activates At',
	name: 'activatesAt',
	type: 'dateTime',
	default: '',
	description: 'When the link starts redirecting. Pro and Ultra only.',
	routing: { send: { type: 'body', property: 'activatesAt', value: toApiDate } },
};

const expiresAfterField: INodeProperties = {
	displayName: 'Expire After Clicks',
	name: 'expiresAfter',
	type: 'number',
	typeOptions: { minValue: 1, numberPrecision: 0 },
	default: 100,
	description: 'Number of clicks after which the link stops redirecting',
	routing: { send: { type: 'body', property: 'expiresAfter' } },
};

const utmField = (name: string, displayName: string): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	default: '',
	description: `Added to the destination as ${name} when the link is visited. Ultra only.`,
	routing: { send: { type: 'body', property: `utmParams.${name}` } },
});

const CLEARABLE_FIELDS = ['expiresAt', 'activatesAt', 'expiresAfter'];

async function clearSettings(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const selected = this.getNodeParameter('updateFields.clear', []) as string[];
	const body = (requestOptions.body ?? {}) as IDataObject;
	for (const field of selected) {
		if (CLEARABLE_FIELDS.includes(field)) body[field] = null;
	}
	requestOptions.body = body;
	return requestOptions;
}

export const linkDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['link'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a short link',
				description: 'Shorten a URL',
				routing: { request: { method: 'POST', url: '/links' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a short link',
				description: 'Delete a short link',
				routing: {
					request: { method: 'DELETE', url: linkUrl },
					output: {
						postReceive: [
							{
								type: 'set',
								properties: { value: '={{ { "deleted": true } }}' },
							},
						],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a short link',
				description: 'Get a short link by its alias',
				routing: { request: { method: 'GET', url: linkUrl } },
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many short links',
				description: 'List short links, newest first',
				routing: {
					request: { method: 'GET', url: '/links' },
					output: {
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a short link',
				description: "Change a link's destination, alias, expiry or schedule",
				routing: {
					request: { method: 'PATCH', url: linkUrl },
					send: { preSend: [clearSettings] },
				},
			},
		],
		default: 'create',
	},

	// Create
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/page',
		description: 'The destination to shorten',
		displayOptions: { show: showFor(['create']) },
		routing: { send: { type: 'body', property: 'url' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor(['create']) },
		options: [
			activatesAtField,
			{
				displayName: 'Alias',
				name: 'alias',
				type: 'string',
				default: '',
				placeholder: 'launch-day',
				description:
					'Letters, numbers, - and _, up to 20 characters. Defaults to a random alias.',
				routing: { send: { type: 'body', property: 'alias' } },
			},
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				default: '',
				placeholder: 'isht.app',
				description:
					"A platform domain or an active custom domain. Defaults to the account's default domain.",
				routing: { send: { type: 'body', property: 'domain' } },
			},
			expiresAfterField,
			expiresAtField,
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Visitors must enter this password before they are redirected. Pro and Ultra only.',
				routing: { send: { type: 'body', property: 'password' } },
			},
			utmField('utm_campaign', 'UTM Campaign'),
			utmField('utm_content', 'UTM Content'),
			utmField('utm_medium', 'UTM Medium'),
			utmField('utm_source', 'UTM Source'),
			utmField('utm_term', 'UTM Term'),
		],
	},

	// Get, Update, Delete
	{
		...aliasField,
		displayOptions: { show: showFor(['get', 'update', 'delete']) },
	},
	{
		...domainField,
		displayOptions: { show: showFor(['get', 'update', 'delete']) },
	},

	// Update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor(['update']) },
		options: [
			activatesAtField,
			{
				displayName: 'Clear Settings',
				name: 'clear',
				type: 'multiOptions',
				default: [],
				description: 'Settings to remove from the link',
				options: [
					{ name: 'Activation Date', value: 'activatesAt' },
					{ name: 'Click Limit', value: 'expiresAfter' },
					{ name: 'Expiry Date', value: 'expiresAt' },
				],
			},
			expiresAfterField,
			expiresAtField,
			{
				displayName: 'New Alias',
				name: 'newAlias',
				type: 'string',
				default: '',
				placeholder: 'launch-day-2',
				description:
					'Rename the link. The old alias stops working and cannot be reused. Letters, numbers, - and _, up to 20 characters.',
				routing: { send: { type: 'body', property: 'alias' } },
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/new-page',
				description: 'The new destination',
				routing: { send: { type: 'body', property: 'url' } },
			},
		],
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show: showFor(['getAll']) },
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		routing: {
			send: { paginate: '={{ $value }}', type: 'query', property: 'limit', value: '100' },
			operations: {
				pagination: {
					type: 'generic',
					properties: {
						continue: '={{ !!$response.body?.nextCursor }}',
						// Replaces the whole query string, so carry limit and domain over.
						request: {
							qs: {
								limit: '={{ $request.qs.limit }}',
								domain: '={{ $request.qs.domain }}',
								cursor: '={{ $response.body?.nextCursor }}',
							},
						},
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: { show: { ...showFor(['getAll']), returnAll: [false] } },
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: { type: 'query', property: 'limit' },
			output: { maxResults: '={{ $value }}' },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor(['getAll']) },
		options: [
			{
				...domainField,
				description:
					'Only list links on this domain: a platform domain or an active custom domain. Leave out to list links on all of them.',
			},
		],
	},
];
