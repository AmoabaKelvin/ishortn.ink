import type { INodeProperties } from 'n8n-workflow';

import { aliasField, aliasPath, domainField } from '../shared';

const showForGet = { resource: ['analytics'], operation: ['get'] };

export const analyticsDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['analytics'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get analytics for a short link',
				description:
					"Get total clicks, a daily series and breakdowns by country, city, device, browser, OS and referrer over the plan's analytics range",
				routing: {
					request: {
						method: 'GET',
						url: aliasPath('analytics'),
					},
				},
			},
		],
		default: 'get',
	},
	{ ...aliasField, displayOptions: { show: showForGet } },
	{ ...domainField, displayOptions: { show: showForGet } },
];
