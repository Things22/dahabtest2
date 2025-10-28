/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import type { ExecutionContext } from '@cloudflare/workers-types';

export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		return new Response('Hello from Dahab Worker!');
	},
};