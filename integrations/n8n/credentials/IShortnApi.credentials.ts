import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class IShortnApi implements ICredentialType {
	name = 'iShortnApi';

	displayName = 'iShortn API';

	icon: Icon = { light: 'file:../icons/ishortn.svg', dark: 'file:../icons/ishortn.dark.svg' };

	documentationUrl = 'https://ishortn.ink/docs/integrations/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Create one in iShortn under Settings → API Keys. API keys need a Pro or Ultra plan.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://ishortn.ink',
			description: 'Change this only for a self-hosted iShortn install',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1',
			url: '/me',
			method: 'GET',
		},
	};
}
