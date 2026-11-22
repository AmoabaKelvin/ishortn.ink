import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { analyticsDescription } from './resources/analytics';
import { linkDescription } from './resources/link';

export class IShortn implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'iShortn',
		name: 'iShortn',
		icon: { light: 'file:../../icons/ishortn.svg', dark: 'file:../../icons/ishortn.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and manage iShortn short links and read their analytics',
		defaults: {
			name: 'iShortn',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'iShortnApi', required: true }],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Link', value: 'link' },
				],
				default: 'link',
			},
			...linkDescription,
			...analyticsDescription,
		],
	};
}
