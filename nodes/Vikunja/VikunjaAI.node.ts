import {
	IHttpRequestMethods,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { apiRequest } from './helper';

export class VikunjaAI implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vikunja AI',
		name: 'vikunjaAi',
		icon: 'file:vikunja.svg',
		group: ['transform'],
		version: 1,
		description: 'Control Vikunja via natural language using OpenAI',
		defaults: {
			name: 'Vikunja AI',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'openAiApi',
				required: true,
			},
			{
				name: 'vikunjaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Instruction',
				name: 'instruction',
				type: 'string',
				default: '',
				description: 'Instruction in natural language describing a Vikunja operation',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const instruction = this.getNodeParameter('instruction', 0) as string;

		const requestBody = {
			model: 'gpt-3.5-turbo-0613',
			messages: [
				{
					role: 'system',
					content:
						'Translate the user instruction to a Vikunja API request.' +
						' Respond using the function calling format.',
				},
				{ role: 'user', content: instruction },
			],
			functions: [
				{
					name: 'vikunja_request',
					description: 'Vikunja API request to perform',
					parameters: {
						type: 'object',
						properties: {
							method: {
								type: 'string',
								enum: ['GET', 'POST', 'PUT', 'DELETE'],
							},
							endpoint: { type: 'string' },
							body: { type: 'object' },
							query: { type: 'object' },
						},
						required: ['method', 'endpoint'],
					},
				},
			],
			function_call: { name: 'vikunja_request' },
		};

		const aiResponse = await this.helpers.httpRequestWithAuthentication.call(this, 'openAiApi', {
			method: 'POST',
			url: 'https://api.openai.com/v1/chat/completions',
			json: requestBody,
		});

		const args = aiResponse?.choices?.[0]?.message?.function_call?.arguments;
		if (!args) {
			throw new Error('No function arguments returned from AI');
		}

		let requestParams: {
			method: IHttpRequestMethods;
			endpoint: string;
			body?: object;
			query?: object;
		};
		try {
			requestParams = JSON.parse(args);
		} catch {
			throw new Error('Failed to parse AI response');
		}

		const { method, endpoint, body, query } = requestParams;

		const responseData = await apiRequest.call(this, method, endpoint, body, query);

		return this.helpers.returnJsonArray(
			Array.isArray(responseData) ? responseData : [responseData],
		);
	}
}
