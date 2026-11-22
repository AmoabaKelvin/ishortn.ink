import type { INodeProperties } from 'n8n-workflow';

// Dates picked in n8n have no offset and mean the workflow's time zone; the API
// wants ISO 8601 with an offset.
export const toApiDate =
	'={{ $value ? DateTime.fromISO(String($value), { zone: $now.zoneName }).toISO() : undefined }}';

// Empty means "the account's default domain", which is what leaving the parameter out does.
export const domainQuery = '={{ String($value ?? "").trim() || undefined }}';

// encodeURIComponent rather than n8n's toPathSegment, which needs n8n 2.46.1 or later.
// Aliases are only letters, digits, - and _, so the two encode the same.
export const aliasPath = (resource: string) =>
	`=/${resource}/{{ encodeURIComponent(String($parameter.alias).trim()) }}`;

export const aliasField: INodeProperties = {
	displayName: 'Alias',
	name: 'alias',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'launch-day',
	description: 'The part of the short link after the domain',
};

export const domainField: INodeProperties = {
	displayName: 'Domain',
	name: 'domain',
	type: 'string',
	default: '',
	placeholder: 'isht.app',
	description:
		"The link's domain: a platform domain or an active custom domain. Leave empty to use the account's default domain.",
	routing: {
		send: {
			type: 'query',
			property: 'domain',
			value: domainQuery,
		},
	},
};
