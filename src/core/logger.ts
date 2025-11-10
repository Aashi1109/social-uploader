import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
	level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
	base: undefined,
	transport: isProd
		? undefined
		: {
				target: 'pino-pretty',
				options: { colorize: true, singleLine: true },
		  },
});


